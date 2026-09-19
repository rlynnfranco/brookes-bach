"use client";

import { useEffect, useState } from "react";
import { BookExportReview } from "@/components/book-export-review";
import { BookPhotoPreview } from "@/components/book-photo-preview";
import {
  getBookCuration,
  setCommentBookInclusion,
  setPhotoBookInclusion,
  setQuoteBookInclusion,
  type BookCuration,
  type BookNoteGroup,
  type BookPhoto,
  type BookQuote,
} from "@/lib/book";
import { buildBookExportManifest } from "@/lib/book-export";
import type { Participant } from "@/lib/participants";

type BookFilter = "all" | "selected";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn’t update the book. Please try again.";
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function BookView({ participant }: { participant: Participant }) {
  const [curation, setCuration] = useState<BookCuration | null>(null);
  const [filter, setFilter] = useState<BookFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadCuration() {
      setIsLoading(true);
      setLoadError(null);
      setActionError(null);

      try {
        const nextCuration = await getBookCuration(participant.id);

        if (isActive) {
          setCuration(nextCuration);
        }
      } catch (error) {
        if (isActive) {
          setLoadError(getErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCuration();

    return () => {
      isActive = false;
    };
  }, [participant.id]);

  function markPending(id: string, isPending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);

      if (isPending) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  async function togglePhoto(photo: BookPhoto) {
    if (pendingIds.has(photo.id)) {
      return;
    }

    markPending(photo.id, true);
    setActionError(null);

    try {
      const nextValue = !photo.include_in_book;
      await setPhotoBookInclusion(photo.id, nextValue);
      setCuration((current) =>
        current
          ? {
              ...current,
              photos: current.photos.map((item) =>
                item.id === photo.id
                  ? { ...item, include_in_book: nextValue }
                  : item,
              ),
            }
          : current,
      );
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      markPending(photo.id, false);
    }
  }

  async function toggleQuote(quote: BookQuote) {
    if (pendingIds.has(quote.id)) {
      return;
    }

    markPending(quote.id, true);
    setActionError(null);

    try {
      const nextValue = !quote.include_in_book;
      await setQuoteBookInclusion(quote.id, nextValue);
      setCuration((current) =>
        current
          ? {
              ...current,
              quotes: current.quotes.map((item) =>
                item.id === quote.id
                  ? { ...item, include_in_book: nextValue }
                  : item,
              ),
            }
          : current,
      );
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      markPending(quote.id, false);
    }
  }

  async function toggleNote(noteId: string, included: boolean) {
    if (pendingIds.has(noteId)) {
      return;
    }

    markPending(noteId, true);
    setActionError(null);

    try {
      const nextValue = !included;
      await setCommentBookInclusion(noteId, nextValue);
      setCuration((current) =>
        current
          ? {
              ...current,
              noteGroups: current.noteGroups.map((group) => ({
                ...group,
                notes: group.notes.map((note) =>
                  note.id === noteId
                    ? { ...note, include_in_book: nextValue }
                    : note,
                ),
              })),
            }
          : current,
      );
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      markPending(noteId, false);
    }
  }

  const photos = curation?.photos ?? [];
  const quotes = curation?.quotes ?? [];
  const noteGroups = curation?.noteGroups ?? [];
  const selectedPhotoCount = photos.filter((photo) => photo.include_in_book).length;
  const selectedQuoteCount = quotes.filter((quote) => quote.include_in_book).length;
  const selectedNoteCount = noteGroups.reduce(
    (count, group) =>
      count + group.notes.filter((note) => note.include_in_book).length,
    0,
  );
  const visiblePhotos =
    filter === "selected"
      ? photos.filter((photo) => photo.include_in_book)
      : photos;
  const visibleQuotes =
    filter === "selected"
      ? quotes.filter((quote) => quote.include_in_book)
      : quotes;
  const visibleNoteGroups = noteGroups
    .map((group) => ({
      ...group,
      notes:
        filter === "selected"
          ? group.notes.filter((note) => note.include_in_book)
          : group.notes,
    }))
    .filter((group) => group.notes.length > 0);
  const previewPhoto =
    photos.find((photo) => photo.id === previewPhotoId) ?? null;
  const selectedCount =
    selectedPhotoCount + selectedQuoteCount + selectedNoteCount;
  const exportManifest = curation ? buildBookExportManifest(curation) : null;

  return (
    <section className="mt-8" aria-labelledby="book-heading">
      <div
        inert={previewPhoto ? true : undefined}
        aria-hidden={previewPhoto ? true : undefined}
      >
      <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
        The edit
      </p>
      <h2
        id="book-heading"
        className="font-serif mt-2 text-3xl leading-tight tracking-tight text-ink"
      >
        Book
      </h2>
      <p className="mt-3 max-w-md text-base leading-7 text-ink-muted">
        Shape the record into what stays.
      </p>

      <p className="mt-6 text-sm leading-6 text-ink-muted">
        {selectedPhotoCount} {selectedPhotoCount === 1 ? "photo" : "photos"} ·{" "}
        {selectedQuoteCount} {selectedQuoteCount === 1 ? "quote" : "quotes"} ·{" "}
        {selectedNoteCount} {selectedNoteCount === 1 ? "note" : "notes"} selected
      </p>

      {selectedCount > 0 && !isExportOpen ? (
        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="mt-4 inline-flex h-11 items-center border-b border-rule text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Prepare export
        </button>
      ) : null}

      {isExportOpen && exportManifest ? (
        <BookExportReview
          manifest={exportManifest}
          onClose={() => setIsExportOpen(false)}
        />
      ) : null}

      {!isExportOpen ? (
        <>
      <div className="mt-8 border-b border-rule">
        <div className="flex gap-8" role="group" aria-label="Book filter">
          <FilterButton
            label="All"
            isActive={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="Selected"
            isActive={filter === "selected"}
            onClick={() => setFilter("selected")}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-base leading-7 text-ink-muted" role="status">
          Reviewing the record…
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-8 text-sm leading-6 text-clay" role="alert">
          {loadError}
        </p>
      ) : null}

      {actionError ? (
        <p className="mt-6 text-sm leading-6 text-clay" role="alert">
          {actionError}
        </p>
      ) : null}

      {!isLoading && !loadError ? (
        <>
          <BookPhotosSection
            photos={visiblePhotos}
            isFiltered={filter === "selected"}
            pendingIds={pendingIds}
            onToggle={togglePhoto}
            onPreview={setPreviewPhotoId}
          />
          <BookQuotesSection
            quotes={visibleQuotes}
            isFiltered={filter === "selected"}
            pendingIds={pendingIds}
            onToggle={toggleQuote}
          />
          <BookNotesSection
            groups={visibleNoteGroups}
            isFiltered={filter === "selected"}
            pendingIds={pendingIds}
            onToggle={toggleNote}
          />
        </>
      ) : null}
        </>
      ) : null}
      </div>

      {previewPhoto ? (
        <BookPhotoPreview
          photo={previewPhoto}
          error={actionError}
          onClose={() => setPreviewPhotoId(null)}
        >
          <IncludeInBookControl
            included={previewPhoto.include_in_book}
            pending={pendingIds.has(previewPhoto.id)}
            onToggle={() => togglePhoto(previewPhoto)}
          />
        </BookPhotoPreview>
      ) : null}
    </section>
  );
}

function FilterButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        isActive ? "border-ink text-ink" : "border-transparent text-ink-muted"
      }`}
    >
      {label}
    </button>
  );
}

const BOOK_VOTE_LABELS: Record<string, string> = {
  photo_of_weekend: "Photo of the Weekend",
  a24_or_lifetime: "A24 or Lifetime?",
  portrait_on_fire: "Portrait on Fire",
  wrong_reasons: "Wrong Reasons",
  criterion_collection: "Criterion",
};

function bookVoteLabel(category: string, fallback: string) {
  return BOOK_VOTE_LABELS[category] ?? fallback;
}

function IncludeInBookControl({
  included,
  pending,
  onToggle,
}: {
  included: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={included}
      disabled={pending}
      onClick={onToggle}
      className="mt-2 inline-flex min-h-11 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
          included ? "border-ink bg-ink text-paper" : "border-rule bg-paper-raised text-transparent"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M3.6 8.2 6.7 11.2 12.4 4.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`text-xs leading-4 ${
          included ? "text-ink" : "text-ink-muted"
        }`}
      >
        Include in book
      </span>
    </button>
  );
}

function BookPhotosSection({
  photos,
  isFiltered,
  pendingIds,
  onToggle,
  onPreview,
}: {
  photos: BookPhoto[];
  isFiltered: boolean;
  pendingIds: Set<string>;
  onToggle: (photo: BookPhoto) => void;
  onPreview: (photoId: string) => void;
}) {
  return (
    <section
      className={isFiltered ? "mt-12" : "mt-10"}
      aria-labelledby="book-photos-heading"
    >
      <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
        The album
      </p>
      <h3
        id="book-photos-heading"
        className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
      >
        Photos
      </h3>

      {photos.length === 0 ? (
        <p className="mt-5 text-base leading-7 text-ink-muted">
          {isFiltered
            ? "No photos selected yet."
            : "No photographs have been added."}
        </p>
      ) : (
        <ul
          className={
            isFiltered
              ? "mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4"
              : "mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4"
          }
        >
          {photos.map((photo, index) => (
            <li key={photo.id}>
              {photo.thumbnailUrl ? (
                <button
                  type="button"
                  onClick={() => onPreview(photo.id)}
                  className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  aria-label="Preview photo"
                >
                  {/* Signed URLs expire and should not be optimized through next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl}
                    alt=""
                    loading={index < 8 ? "eager" : "lazy"}
                    decoding="async"
                    className={`aspect-square h-auto w-full object-cover ${
                      photo.include_in_book
                        ? "outline outline-1 outline-ink/25"
                        : ""
                    }`}
                  />
                </button>
              ) : (
                <span className="flex aspect-square items-center justify-center bg-paper-raised text-center text-[11px] leading-4 text-ink-muted">
                  Unavailable
                </span>
              )}
              <div className="pt-2">
                {photo.isBridesFavorite ? (
                  <p className="text-[10px] font-medium tracking-[0.14em] text-ink uppercase">
                    Bride’s Favorite
                  </p>
                ) : null}
                {photo.categoryVotes.length > 0 ? (
                  <ul
                    className={
                      photo.isBridesFavorite ? "mt-1 space-y-0.5" : "space-y-0.5"
                    }
                  >
                    {photo.categoryVotes.map((vote) => (
                      <li
                        key={vote.category}
                        className="text-[11px] leading-4 text-ink-muted"
                      >
                        {bookVoteLabel(vote.category, vote.label)}
                        <span className="text-ink-soft"> · {vote.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p
                  className={`truncate text-xs leading-4 text-ink-soft ${
                    photo.isBridesFavorite || photo.categoryVotes.length > 0
                      ? "mt-1.5"
                      : ""
                  }`}
                >
                  {photo.uploaderName
                    ? `by ${photo.uploaderName}`
                    : "by a guest"}
                </p>
                <IncludeInBookControl
                  included={photo.include_in_book}
                  pending={pendingIds.has(photo.id)}
                  onToggle={() => onToggle(photo)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookQuotesSection({
  quotes,
  isFiltered,
  pendingIds,
  onToggle,
}: {
  quotes: BookQuote[];
  isFiltered: boolean;
  pendingIds: Set<string>;
  onToggle: (quote: BookQuote) => void;
}) {
  return (
    <section
      className={
        isFiltered
          ? "mt-16 border-t border-rule pt-12"
          : "mt-12 border-t border-rule pt-10"
      }
      aria-labelledby="book-quotes-heading"
    >
      <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
        The record
      </p>
      <h3
        id="book-quotes-heading"
        className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
      >
        Overheard
      </h3>

      {quotes.length === 0 ? (
        <p className="mt-5 text-base leading-7 text-ink-muted">
          {isFiltered
            ? "No quotes selected yet."
            : "Nothing has been overheard yet."}
        </p>
      ) : (
        <ul className={isFiltered ? "mt-8 divide-y divide-rule" : "mt-6 divide-y divide-rule"}>
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className={isFiltered ? "py-9 first:pt-0" : "py-7 first:pt-0"}
            >
              <blockquote>
                <p className="font-serif text-[1.45rem] leading-snug tracking-tight text-ink">
                  “{quote.quote}”
                </p>
                {quote.said_by ? (
                  <footer className="mt-3 text-sm leading-6 text-ink-muted">
                    — {quote.said_by}
                  </footer>
                ) : null}
              </blockquote>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {formatCount(quote.likeCount, "heart", "hearts")}
              </p>
              <IncludeInBookControl
                included={quote.include_in_book}
                pending={pendingIds.has(quote.id)}
                onToggle={() => onToggle(quote)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookNotesSection({
  groups,
  isFiltered,
  pendingIds,
  onToggle,
}: {
  groups: BookNoteGroup[];
  isFiltered: boolean;
  pendingIds: Set<string>;
  onToggle: (noteId: string, included: boolean) => void;
}) {
  return (
    <section
      className={
        isFiltered
          ? "mt-16 border-t border-rule pt-12"
          : "mt-12 border-t border-rule pt-10"
      }
      aria-labelledby="book-notes-heading"
    >
      <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
        In the margins
      </p>
      <h3
        id="book-notes-heading"
        className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
      >
        Notes from the Margin
      </h3>

      {groups.length === 0 ? (
        <p className="mt-5 text-base leading-7 text-ink-muted">
          {isFiltered
            ? "No notes selected yet."
            : "No notes have been written yet."}
        </p>
      ) : (
        <ul
          className={
            isFiltered
              ? "mt-8 divide-y divide-rule border-t border-rule"
              : "mt-6 divide-y divide-rule border-t border-rule"
          }
        >
          {groups.map((group) => (
            <li key={group.photoId} className={isFiltered ? "py-8" : "py-6"}>
              <div className="flex gap-3">
                {group.thumbnailUrl ? (
                  // Signed URLs expire and should not be optimized through next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-paper-raised text-center text-[11px] leading-4 text-ink-muted">
                    Unavailable
                  </span>
                )}
                <p className="self-center text-sm leading-6 text-ink-muted">
                  {group.uploaderName
                    ? `On a photograph by ${group.uploaderName}`
                    : "On a photograph"}
                </p>
              </div>
              <ul className="mt-4 divide-y divide-rule">
                {group.notes.map((note) => (
                  <li key={note.id} className="py-4 first:pt-0">
                    <p className="text-sm leading-6 text-ink">{note.body}</p>
                    <p className="mt-1 text-xs leading-4 text-ink-muted">
                      {note.authorName}
                    </p>
                    <IncludeInBookControl
                      included={note.include_in_book}
                      pending={pendingIds.has(note.id)}
                      onToggle={() =>
                        onToggle(note.id, note.include_in_book)
                      }
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
