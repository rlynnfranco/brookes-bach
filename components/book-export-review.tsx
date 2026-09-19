"use client";

import { useState } from "react";
import type { BookExportManifest, ExportPhoto, PhotoZipProgress } from "@/lib/book-export";
import {
  downloadBookPhotosZip,
  downloadExportManifest,
  isLargePhotoExport,
} from "@/lib/book-export";

const BOOK_VOTE_LABELS: Record<string, string> = {
  photo_of_weekend: "Photo of the Weekend",
  a24_or_lifetime: "A24 or Lifetime?",
  portrait_on_fire: "Portrait on Fire",
  wrong_reasons: "Wrong Reasons",
  criterion_collection: "Criterion",
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sourceLabel(item: ExportPhoto) {
  if (!item.hasPrintableSource) {
    return "No printable file";
  }

  if (item.hasOriginal) {
    return "Print source: original";
  }

  return "Print source: display copy";
}

export function BookExportReview({
  manifest,
  onClose,
}: {
  manifest: BookExportManifest;
  onClose: () => void;
}) {
  const originalCount = manifest.photos.filter((item) => item.hasOriginal).length;
  const displayCopyCount = manifest.photos.filter(
    (item) => item.hasPrintableSource && !item.hasOriginal,
  ).length;
  const missingSourceCount = manifest.photos.filter(
    (item) => !item.hasPrintableSource,
  ).length;
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<PhotoZipProgress | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const showLargeWarning = isLargePhotoExport(manifest);

  function handleDownloadManifest() {
    downloadExportManifest(manifest);
  }

  async function handleDownloadPhotos() {
    if (isPreparingZip) {
      return;
    }

    setIsPreparingZip(true);
    setZipError(null);
    setZipProgress(null);

    try {
      await downloadBookPhotosZip(manifest, setZipProgress);
    } catch (error) {
      setZipError(
        error instanceof Error
          ? error.message
          : "We couldn’t prepare the photo archive. Please try again.",
      );
    } finally {
      setIsPreparingZip(false);
      setZipProgress(null);
    }
  }

  const canDownloadManifest =
    manifest.photos.length > 0 ||
    manifest.quotes.length > 0 ||
    manifest.notes.length > 0;
  const progressLabel =
    zipProgress?.kind === "photo"
      ? `Preparing ${zipProgress.current} of ${zipProgress.total} photos…`
      : zipProgress?.kind === "packaging"
        ? "Preparing download…"
        : null;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
            For production
          </p>
          <h3 className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink">
            Export
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
            Review what will go to the printer, then download the files for
            production.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownloadManifest}
            disabled={!canDownloadManifest || isPreparingZip}
            className="inline-flex h-11 items-center border-b border-ink text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-transparent disabled:text-ink-muted"
          >
            Download manifest
          </button>
          {manifest.photos.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleDownloadPhotos()}
              disabled={isPreparingZip}
              className="inline-flex h-11 items-center border-b border-ink text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:border-transparent disabled:text-ink-muted"
            >
              {isPreparingZip ? "Preparing…" : "Download photos"}
            </button>
          ) : null}
        </div>
      </div>

      {manifest.photos.length > 0 ? (
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Uses full-resolution originals when available.
        </p>
      ) : null}

      {showLargeWarning && !isPreparingZip ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          This export is large and may use significant memory. Continue on a
          desktop computer.
        </p>
      ) : null}

      {progressLabel ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted" role="status" aria-live="polite">
          {progressLabel}
        </p>
      ) : null}

      {zipError ? (
        <p className="mt-3 text-sm leading-6 text-clay" role="alert">
          {zipError}
        </p>
      ) : null}

      {missingSourceCount > 0 ? (
        <p className="mt-6 text-sm leading-6 text-clay" role="alert">
          {formatCount(
            missingSourceCount,
            "selected photo has no printable file.",
            "selected photos have no printable file.",
          )}
        </p>
      ) : null}

      <p className="mt-6 text-sm leading-6 text-ink-muted">
        {formatCount(manifest.photos.length, "photo", "photos")}
        <br />
        {formatCount(originalCount, "original", "originals")} ·{" "}
        {formatCount(displayCopyCount, "display copy", "display copies")}
        <br />
        {formatCount(manifest.quotes.length, "quote", "quotes")} ·{" "}
        {formatCount(manifest.notes.length, "note", "notes")}
      </p>

      <section className="mt-12" aria-labelledby="export-photos-heading">
        <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
          The album
        </p>
        <h4
          id="export-photos-heading"
          className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
        >
          Photos
        </h4>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {formatCount(manifest.photos.length, "photo selected", "photos selected")}
        </p>

        {manifest.photos.length === 0 ? (
          <p className="mt-5 text-base leading-7 text-ink-muted">
            No photos selected yet.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-rule border-t border-rule">
            {manifest.photos.map((item) => (
              <li key={item.photo.id} className="flex gap-4 py-6">
                {item.photo.thumbnailUrl ? (
                  // Signed URLs expire and should not be optimized through next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photo.thumbnailUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-paper-raised text-center text-[11px] leading-4 text-ink-muted">
                    Unavailable
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-6 text-ink">
                    {item.exportFilename || "—"}
                  </p>
                  <p
                    className={`mt-1 text-sm leading-6 ${
                      item.hasPrintableSource ? "text-ink-muted" : "text-clay"
                    }`}
                  >
                    {sourceLabel(item)}
                  </p>
                  <p className="mt-2 text-xs leading-4 text-ink-soft">
                    {item.photo.uploaderName
                      ? `by ${item.photo.uploaderName}`
                      : "by a guest"}
                  </p>
                  {item.photo.isBridesFavorite ? (
                    <p className="mt-2 text-[10px] font-medium tracking-[0.14em] text-ink uppercase">
                      Bride’s Favorite
                    </p>
                  ) : null}
                  {item.photo.categoryVotes.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {item.photo.categoryVotes.map((vote) => (
                        <li
                          key={vote.category}
                          className="text-[11px] leading-4 text-ink-muted"
                        >
                          {BOOK_VOTE_LABELS[vote.category] ?? vote.label}
                          <span className="text-ink-soft"> · {vote.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="mt-16 border-t border-rule pt-12"
        aria-labelledby="export-quotes-heading"
      >
        <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
          The record
        </p>
        <h4
          id="export-quotes-heading"
          className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
        >
          Overheard
        </h4>

        {manifest.quotes.length === 0 ? (
          <p className="mt-5 text-base leading-7 text-ink-muted">
            No quotes selected yet.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-rule">
            {manifest.quotes.map((quote) => (
              <li key={quote.id} className="py-7 first:pt-0">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="mt-16 border-t border-rule pt-12"
        aria-labelledby="export-notes-heading"
      >
        <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
          In the margins
        </p>
        <h4
          id="export-notes-heading"
          className="font-serif mt-2 text-2xl leading-tight tracking-tight text-ink"
        >
          Notes from the Margin
        </h4>

        {manifest.notes.length === 0 ? (
          <p className="mt-5 text-base leading-7 text-ink-muted">
            No notes selected yet.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-rule border-t border-rule">
            {manifest.notes.map((item) => (
              <li key={item.note.id} className="py-6">
                <div className="flex gap-3">
                  {item.group.thumbnailUrl ? (
                    // Signed URLs expire and should not be optimized through next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.group.thumbnailUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-paper-raised text-center text-[11px] leading-4 text-ink-muted">
                      Unavailable
                    </span>
                  )}
                  <p className="self-center text-sm leading-6 text-ink-muted">
                    {item.relatedSequence
                      ? `${paddedLabel(item.relatedSequence)} · `
                      : ""}
                    {item.group.uploaderName
                      ? `On a photograph by ${item.group.uploaderName}`
                      : "On a photograph"}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink">{item.note.body}</p>
                <p className="mt-1 text-xs leading-4 text-ink-muted">
                  {item.note.authorName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function paddedLabel(sequence: number) {
  return String(sequence).padStart(3, "0");
}
