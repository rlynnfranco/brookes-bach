"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/participants";
import {
  addComment,
  commentFromRealtimeRow,
  getCommentsForPhoto,
  getCommentWithAuthor,
  insertCommentOldestFirst,
  type PhotoComment,
} from "@/lib/comments";
import { supabase } from "@/lib/supabase";
import { useOnVisible } from "@/lib/visibility";

const COMMENT_MAX_LENGTH = 200;
const COMMENT_COUNT_THRESHOLD = 160;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn’t save that note. Please try again.";
}

export function PhotoComments({
  photoId,
  participant,
}: {
  photoId: string;
  participant: Participant;
}) {
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const participantRef = useRef(participant);
  participantRef.current = participant;
  const characterCount = body.length;
  const showCharacterCount = characterCount >= COMMENT_COUNT_THRESHOLD;

  useEffect(() => {
    let isActive = true;

    async function loadComments() {
      setIsLoading(true);
      setListError(null);

      try {
        const nextComments = await getCommentsForPhoto(photoId);

        if (isActive) {
          setComments(nextComments);
        }
      } catch (error) {
        if (isActive) {
          setListError(getErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      isActive = false;
    };
  }, [photoId]);

  async function refreshComments() {
    try {
      const nextComments = await getCommentsForPhoto(photoId);
      setComments(nextComments);
      setListError(null);
    } catch {
      // Keep the current notes if a background refresh fails.
    }
  }

  useOnVisible(() => {
    void refreshComments();
  });

  useEffect(() => {
    const channel = supabase
      .channel(`weekend-photo-comments:${photoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `photo_id=eq.${photoId}`,
        },
        (payload) => {
          const row = commentFromRealtimeRow(payload.new);

          if (!row || row.photo_id !== photoId) {
            return;
          }

          void (async () => {
            try {
              const currentParticipant = participantRef.current;
              const nextComment = await getCommentWithAuthor(
                row,
                row.participant_id === currentParticipant.id
                  ? currentParticipant.name
                  : undefined,
              );
              setComments((current) =>
                insertCommentOldestFirst(current, nextComment),
              );
            } catch {
              // Leave the notes as-is if a live comment cannot be hydrated.
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [photoId]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [body]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setFormError("Write a note first.");
      return;
    }

    if (trimmedBody.length > COMMENT_MAX_LENGTH) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const nextComment = await addComment(
        photoId,
        participant.id,
        trimmedBody,
        participant.name,
      );
      setComments((current) => [...current, nextComment]);
      setBody("");
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="mt-5 border-t border-rule pt-4"
      aria-labelledby="photo-comments-heading"
    >
      <h3
        id="photo-comments-heading"
        className="font-serif text-lg leading-6 tracking-tight text-ink"
      >
        Notes from the Margin
      </h3>

      {isLoading ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted" role="status">
          Loading notes…
        </p>
      ) : null}

      {listError ? (
        <p className="mt-3 text-sm leading-6 text-clay" role="alert">
          {listError}
        </p>
      ) : null}

      {!isLoading && !listError && comments.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          No notes yet.
        </p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="mt-3 divide-y divide-rule">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3 first:pt-0">
              <p className="text-sm leading-6 text-ink">{comment.body}</p>
              <p className="mt-1 text-xs leading-4 text-ink-muted">
                {comment.authorName}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="mt-4 space-y-2.5" onSubmit={handleSubmit} noValidate>
        <label htmlFor="photo-note" className="sr-only">
          Add a note
        </label>
        <textarea
          ref={textareaRef}
          id="photo-note"
          name="photoNote"
          rows={1}
          maxLength={COMMENT_MAX_LENGTH}
          value={body}
          onChange={(event) => {
            setBody(event.target.value.slice(0, COMMENT_MAX_LENGTH));
            if (formError) {
              setFormError(null);
            }
          }}
          disabled={isSubmitting}
          aria-invalid={formError ? true : undefined}
          aria-describedby={
            [
              formError ? "photo-note-error" : null,
              showCharacterCount ? "photo-note-count" : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="block min-h-9 w-full resize-none overflow-hidden rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm leading-5 text-ink outline-none placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30 disabled:opacity-60"
          placeholder="Add context, commentary, or evidence…"
        />

        {showCharacterCount ? (
          <p
            id="photo-note-count"
            className="text-xs leading-4 text-ink-muted"
          >
            {characterCount} / {COMMENT_MAX_LENGTH}
          </p>
        ) : null}

        {formError ? (
          <p
            id="photo-note-error"
            className="text-sm leading-6 text-clay"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            body.trim().length === 0 ||
            body.length > COMMENT_MAX_LENGTH
          }
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-rule bg-transparent px-3 text-sm font-medium text-ink transition-colors hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add note"}
        </button>
      </form>
    </section>
  );
}
