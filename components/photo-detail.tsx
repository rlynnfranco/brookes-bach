"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Participant } from "@/lib/participants";
import type { PhotoWithUrl } from "@/lib/photos";
import { PhotoVotes } from "@/components/photo-votes";
import { PhotoComments } from "@/components/photo-comments";

function isNotesField(
  target: EventTarget | null,
): target is HTMLTextAreaElement {
  return target instanceof HTMLTextAreaElement;
}

function revealFieldInScrollArea(field: HTMLElement, container: HTMLElement) {
  const fieldRect = field.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const viewport = window.visualViewport;
  const visibleTop = Math.max(
    containerRect.top,
    viewport ? viewport.offsetTop : 0,
  );
  const visibleBottom = Math.min(
    containerRect.bottom,
    viewport ? viewport.offsetTop + viewport.height : window.innerHeight,
  );

  if (visibleBottom <= visibleTop) {
    return;
  }

  const padding = 16;

  if (
    fieldRect.top >= visibleTop + padding &&
    fieldRect.bottom <= visibleBottom - padding
  ) {
    return;
  }

  const fieldCenter = fieldRect.top + fieldRect.height / 2;
  const visibleCenter = (visibleTop + visibleBottom) / 2;
  container.scrollTop += fieldCenter - visibleCenter;
}

export function PhotoDetail({
  photo,
  participant,
  onClose,
  onCommentsSeen,
}: {
  photo: PhotoWithUrl;
  participant: Participant;
  onClose: () => void;
  onCommentsSeen?: (photoId: string) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    closeButtonRef.current?.focus();

    let cancelledEnter = false;
    const enterFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelledEnter) {
          setIsEntered(true);
        }
      });
    });

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
      cancelledEnter = true;
      window.cancelAnimationFrame(enterFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const scrollArea = scrollAreaRef.current;

    if (!dialog || !scrollArea) {
      return;
    }

    let pending = false;
    let settleTimer = 0;
    let fallbackTimer = 0;

    function revealIfNeeded() {
      const field = document.activeElement;
      const container = scrollAreaRef.current;

      if (!pending) {
        return;
      }

      if (!isNotesField(field) || !container?.contains(field)) {
        pending = false;
        return;
      }

      revealFieldInScrollArea(field, container);
      pending = false;
    }

    function scheduleReveal(delay: number) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(revealIfNeeded, delay);
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isNotesField(event.target) || !scrollArea.contains(event.target)) {
        return;
      }

      pending = true;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(revealIfNeeded, 400);
    }

    function handleViewportChange() {
      const field = document.activeElement;

      if (!isNotesField(field) || !scrollArea.contains(field)) {
        return;
      }

      pending = true;
      scheduleReveal(180);
    }

    dialog.addEventListener("focusin", handleFocusIn);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      dialog.removeEventListener("focusin", handleFocusIn);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 min-h-[100lvh] overflow-hidden bg-paper">
      <div
        className={`absolute inset-0 hidden bg-ink/55 transition-opacity duration-150 ease-out motion-reduce:opacity-100 motion-reduce:transition-none sm:block ${
          isEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onClose();
          }
        }}
      />
      <div className="relative flex h-full max-h-[100dvh] items-stretch justify-center sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative z-10 flex h-full max-h-full w-full max-w-lg flex-col overflow-hidden bg-paper transition-[opacity,transform] duration-150 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:h-auto sm:max-h-[92vh] sm:rounded-md ${
            isEntered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div className="flex shrink-0 justify-end bg-paper px-3 pt-2 sm:px-4">
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

          <div
            ref={scrollAreaRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
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
              <PhotoComments
                photoId={photo.id}
                participant={participant}
                onCommentsSeen={onCommentsSeen}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
