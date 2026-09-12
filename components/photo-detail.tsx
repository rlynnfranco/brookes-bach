"use client";

import { useEffect, useId, useRef } from "react";
import type { Participant } from "@/lib/participants";
import type { PhotoWithUrl } from "@/lib/photos";
import { PhotoVotes } from "@/components/photo-votes";
import { PhotoComments } from "@/components/photo-comments";

export function PhotoDetail({
  photo,
  participant,
  onClose,
}: {
  photo: PhotoWithUrl;
  participant: Participant;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onClose();
          }
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[100dvh] w-full max-w-lg flex-col overflow-y-auto bg-paper sm:max-h-[92vh] sm:rounded-md"
      >
        <div className="flex justify-end px-3 pt-2 sm:px-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 min-w-11 items-center justify-center border-0 bg-transparent px-2 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Close
          </button>
        </div>

        <h2 id={titleId} className="sr-only">
          {photo.caption || "Weekend photo"}
        </h2>

        <div className="bg-paper-raised">
          {photo.signedUrl ? (
            // Signed URLs expire and should not be optimized through next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.signedUrl}
              alt={photo.caption || "Weekend photo"}
              className="block h-auto w-full"
            />
          ) : (
            <p className="px-4 py-10 text-center text-sm leading-6 text-ink-muted">
              This photo could not be opened right now.
            </p>
          )}
        </div>

        <div className="px-4 pb-6 pt-4 sm:px-5">
          <div>
            {photo.caption ? (
              <p className="font-serif text-2xl leading-8 tracking-tight text-ink">
                {photo.caption}
              </p>
            ) : null}
            <p
              className={`text-sm leading-6 text-ink-muted ${
                photo.caption ? "mt-2" : ""
              }`}
            >
              {photo.uploaderName ? `by ${photo.uploaderName}` : "by a guest"}
            </p>
          </div>

          <PhotoVotes photoId={photo.id} participant={participant} />
          <PhotoComments photoId={photo.id} participant={participant} />
        </div>
      </div>
    </div>
  );
}
