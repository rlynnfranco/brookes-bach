"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { BookPhoto } from "@/lib/book";

const BOOK_VOTE_LABELS: Record<string, string> = {
  photo_of_weekend: "Photo of the Weekend",
  a24_or_lifetime: "A24 or Lifetime?",
  portrait_on_fire: "Portrait on Fire",
  wrong_reasons: "Wrong Reasons",
  criterion_collection: "Criterion",
};

export function BookPhotoPreview({
  photo,
  error,
  onClose,
  children,
}: {
  photo: BookPhoto;
  error: string | null;
  onClose: () => void;
  children: ReactNode;
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
          {photo.caption || "Book photo preview"}
        </h2>

        <div className="bg-paper-raised">
          {photo.displayUrl ? (
            // Signed URLs expire and should not be optimized through next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.displayUrl}
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
          <p className="text-sm leading-6 text-ink-muted">
            {photo.uploaderName ? `by ${photo.uploaderName}` : "by a guest"}
          </p>
          {photo.isBridesFavorite ? (
            <p className="mt-3 text-xs font-medium tracking-[0.16em] text-ink uppercase">
              Bride’s Favorite
            </p>
          ) : null}
          {photo.categoryVotes.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {photo.categoryVotes.map((vote) => (
                <li key={vote.category} className="text-sm leading-6 text-ink-muted">
                  {BOOK_VOTE_LABELS[vote.category] ?? vote.label}
                  <span className="text-ink-soft"> · {vote.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {children}
          {error ? (
            <p className="mt-3 text-sm leading-6 text-clay" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
