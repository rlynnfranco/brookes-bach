"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  addPhoto,
  getLastSeenPhotosAt,
  getPhotosWithSignedUrls,
  getPhotoWithSignedUrl,
  insertPhotoNewestFirst,
  isAcceptedImage,
  isPhotoNewerThan,
  PHOTO_ACCEPT,
  photoFromRealtimeRow,
  setLastSeenPhotosAt,
  type PhotoUploadStage,
  type PhotoWithUrl,
} from "@/lib/photos";
import type { Participant } from "@/lib/participants";
import { PhotoDetail } from "@/components/photo-detail";
import { supabase } from "@/lib/supabase";
import { useOnVisible } from "@/lib/visibility";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function PhotoFeed({ participant }: { participant: Participant }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<PhotoUploadStage | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithUrl | null>(null);
  const [newPhotoIds, setNewPhotoIds] = useState<Set<string>>(() => new Set());
  const knownPhotoIdsRef = useRef<Set<string> | null>(null);

  function addNewPhotoIds(photoIds: string[]) {
    if (photoIds.length === 0) {
      return;
    }

    setNewPhotoIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const photoId of photoIds) {
        if (!next.has(photoId)) {
          next.add(photoId);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }

  function photosNewerThanLastVisit(nextPhotos: PhotoWithUrl[]) {
    const previousSeenAt = getLastSeenPhotosAt();

    if (!previousSeenAt) {
      return [];
    }

    return nextPhotos
      .filter((photo) => isPhotoNewerThan(photo.created_at, previousSeenAt))
      .map((photo) => photo.id);
  }

  function rememberGalleryVisit(nextPhotos: PhotoWithUrl[]) {
    const knownIds = knownPhotoIdsRef.current;

    if (knownIds === null) {
      addNewPhotoIds(photosNewerThanLastVisit(nextPhotos));
      knownPhotoIdsRef.current = new Set(nextPhotos.map((photo) => photo.id));
    } else {
      const newcomerIds = nextPhotos
        .filter((photo) => !knownIds.has(photo.id))
        .map((photo) => photo.id);

      for (const photoId of newcomerIds) {
        knownIds.add(photoId);
      }

      addNewPhotoIds(newcomerIds);
    }

    setLastSeenPhotosAt();
  }

  function beginFreshVisit(nextPhotos: PhotoWithUrl[]) {
    setNewPhotoIds(new Set(photosNewerThanLastVisit(nextPhotos)));
    knownPhotoIdsRef.current = new Set(nextPhotos.map((photo) => photo.id));
    setLastSeenPhotosAt();
  }

  async function loadPhotos() {
    setFeedError(null);
    const nextPhotos = await getPhotosWithSignedUrls();
    setPhotos(nextPhotos);
    rememberGalleryVisit(nextPhotos);
  }

  async function refreshPhotos(startNewVisit = false) {
    try {
      const nextPhotos = await getPhotosWithSignedUrls();
      setPhotos(nextPhotos);

      if (startNewVisit) {
        beginFreshVisit(nextPhotos);
      } else {
        rememberGalleryVisit(nextPhotos);
      }

      setFeedError(null);
    } catch {
      // Keep the current gallery if a background refresh fails.
    }
  }

  useOnVisible((resumedFromHidden) => {
    void refreshPhotos(resumedFromHidden);
  });

  useEffect(() => {
    let isActive = true;

    async function loadFeed() {
      try {
        const nextPhotos = await getPhotosWithSignedUrls();

        if (isActive) {
          setPhotos(nextPhotos);
          rememberGalleryVisit(nextPhotos);
        }
      } catch (error) {
        if (isActive) {
          setFeedError(getErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoadingFeed(false);
        }
      }
    }

    void loadFeed();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("weekend-photos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos" },
        (payload) => {
          const row = photoFromRealtimeRow(payload.new);

          if (!row) {
            return;
          }

          void (async () => {
            try {
              const nextPhoto = await getPhotoWithSignedUrl(row);
              setPhotos((current) => insertPhotoNewestFirst(current, nextPhoto));
            } catch {
              // Leave the gallery as-is if a live photo cannot be hydrated.
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const knownIds = knownPhotoIdsRef.current;

    if (!knownIds) {
      return;
    }

    const newcomerIds = photos
      .filter((photo) => !knownIds.has(photo.id))
      .map((photo) => photo.id);

    if (newcomerIds.length === 0) {
      return;
    }

    for (const photoId of newcomerIds) {
      knownIds.add(photoId);
    }

    addNewPhotoIds(newcomerIds);
  }, [photos]);

  function resetComposer() {
    setSelectedFile(null);
    setCaption("");
    setUploadError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isAcceptedImage(file)) {
      setSelectedFile(null);
      setUploadError("Please choose a JPEG, PNG, WebP, or HEIC image.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || isUploading) {
      setUploadError("Choose a photo to add.");
      return;
    }

    setIsUploading(true);
    setUploadStage("uploading-original");
    setUploadError(null);

    try {
      await addPhoto(participant.id, selectedFile, caption, setUploadStage);
      resetComposer();
      setIsComposerOpen(false);
      await loadPhotos();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setIsUploading(false);
      setUploadStage(null);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="photo-feed-heading">
      <div
        inert={selectedPhoto ? true : undefined}
        aria-hidden={selectedPhoto ? true : undefined}
      >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
            Shared album
          </p>
          <h2
            id="photo-feed-heading"
            className="font-serif mt-2 text-3xl leading-tight tracking-tight text-ink"
          >
            Photos
          </h2>
        </div>
        {selectedPhoto ? (
          <span className="inline-flex h-11 min-w-11" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen((open) => !open);
              if (isComposerOpen) {
                resetComposer();
              }
            }}
            disabled={isUploading}
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
            aria-expanded={isComposerOpen}
            aria-controls="photo-composer"
          >
            {isComposerOpen ? "Close" : "+ Add"}
          </button>
        )}
      </div>

      {isComposerOpen ? (
        <form id="photo-composer" className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            id="photo-file"
            type="file"
            accept={PHOTO_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex h-12 w-full items-center justify-center rounded-md border border-rule bg-paper-raised px-5 text-base font-medium text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Photo
          </button>

          {selectedFile ? (
            <p className="text-sm leading-6 text-ink-muted">
              Selected: {selectedFile.name}
            </p>
          ) : null}

          {isUploading ? (
            <p className="text-sm leading-6 text-ink-muted" role="status" aria-live="polite">
              Adding photo…
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="photo-caption" className="block text-sm font-medium text-ink">
              Caption
              <span className="font-normal text-ink-muted"> (optional)</span>
            </label>
            <input
              id="photo-caption"
              name="caption"
              type="text"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              disabled={isUploading}
              className="h-12 w-full rounded-md border border-rule bg-paper-raised px-4 text-base text-ink outline-none placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30 disabled:opacity-60"
              placeholder="A line to remember this by"
            />
          </div>

          {uploadError ? (
            <p className="text-sm leading-6 text-clay" role="alert">
              {uploadError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Adding…" : "Share this photo"}
          </button>
        </form>
      ) : null}

      <div className="mt-6" aria-live="polite">
        {isLoadingFeed ? (
          <p className="text-base leading-7 text-ink-muted">Gathering photos…</p>
        ) : null}

        {feedError ? (
          <p className="text-sm leading-6 text-clay" role="alert">
            {feedError}
          </p>
        ) : null}

        {!isLoadingFeed && !feedError && photos.length === 0 ? (
          <p className="text-base leading-7 text-ink-muted">
            No photos yet. Add the first one for the weekend.
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          {photos.map((photo, index) => {
            const isNew = newPhotoIds.has(photo.id);

            return (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerOpen(false);
                    resetComposer();
                    setSelectedPhoto(photo);
                  }}
                  className="relative block w-full overflow-hidden bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  aria-label={
                    isNew
                      ? `${photo.caption || "Open photo"}, new`
                      : photo.caption || "Open photo"
                  }
                >
                  {photo.thumbnailUrl || photo.signedUrl ? (
                    // Signed URLs expire and should not be optimized through next/image.
                    // Thumbnail object-cover is display-only and does not alter the stored file.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.thumbnailUrl || photo.signedUrl || ""}
                      alt={photo.caption || "Weekend photo"}
                      loading={index < 6 ? "eager" : "lazy"}
                      decoding="async"
                      className="aspect-square h-auto w-full object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square items-center justify-center px-3 text-left text-sm leading-6 text-ink-muted">
                      Unavailable
                    </span>
                  )}
                  {isNew ? (
                  <span className="absolute top-1.5 left-1.5 border border-rule bg-paper/95 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.16em] text-ink uppercase">
                    New
                  </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      </div>

      {selectedPhoto ? (
        <PhotoDetail
          photo={selectedPhoto}
          participant={participant}
          onClose={() => setSelectedPhoto(null)}
        />
      ) : null}
    </section>
  );
}
