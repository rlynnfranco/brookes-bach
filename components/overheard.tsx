"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/participants";
import {
  addQuoteLike,
  applyQuoteLikeEvent,
  createQuote,
  getQuotesWithLikes,
  insertQuoteNewestFirst,
  quoteFromRealtimeRow,
  quoteLikeFromRealtimeRow,
  quoteWithEmptyLikes,
  removeQuoteLike,
  type QuoteWithLikes,
} from "@/lib/quotes";
import { HeartFilledIcon, HeartOutlineIcon } from "@/components/vote-icons";
import { supabase } from "@/lib/supabase";
import { useOnVisible } from "@/lib/visibility";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function Overheard({ participant }: { participant: Participant }) {
  const [quotes, setQuotes] = useState<QuoteWithLikes[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [saidBy, setSaidBy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);
  const participantIdRef = useRef(participant.id);
  participantIdRef.current = participant.id;

  async function refreshQuotes() {
    try {
      const nextQuotes = await getQuotesWithLikes(participantIdRef.current);
      setQuotes(nextQuotes);
      setListError(null);
    } catch {
      // Keep the current record if a background refresh fails.
    }
  }

  useOnVisible(() => {
    void refreshQuotes();
  });

  useEffect(() => {
    let isActive = true;

    async function loadQuotes() {
      try {
        const nextQuotes = await getQuotesWithLikes(participant.id);

        if (isActive) {
          setQuotes(nextQuotes);
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

    void loadQuotes();

    return () => {
      isActive = false;
    };
  }, [participant.id]);

  useEffect(() => {
    const channel = supabase
      .channel("weekend-overheard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes" },
        (payload) => {
          const row = quoteFromRealtimeRow(payload.new);

          if (!row) {
            return;
          }

          setQuotes((current) =>
            insertQuoteNewestFirst(current, quoteWithEmptyLikes(row)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quote_likes" },
        (payload) => {
          const like = quoteLikeFromRealtimeRow(payload.new);

          if (!like) {
            return;
          }

          setQuotes((current) =>
            applyQuoteLikeEvent(
              current,
              like,
              participantIdRef.current,
              "insert",
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "quote_likes" },
        (payload) => {
          const like = quoteLikeFromRealtimeRow(payload.old);

          if (!like) {
            void refreshQuotes();
            return;
          }

          setQuotes((current) =>
            applyQuoteLikeEvent(
              current,
              like,
              participantIdRef.current,
              "delete",
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  function resetComposer() {
    setQuoteText("");
    setSaidBy("");
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuote = quoteText.trim();

    if (!trimmedQuote) {
      setFormError("Write what was said.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const nextQuote = await createQuote(participant.id, trimmedQuote, saidBy);
      setQuotes((current) => [nextQuote, ...current]);
      resetComposer();
      setIsComposerOpen(false);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleLike(quote: QuoteWithLikes) {
    if (pendingLikes.has(quote.id)) {
      return;
    }

    const wasLiked = quote.likedByMe;

    setPendingLikes((current) => new Set(current).add(quote.id));
    setLikeError(null);
    setQuotes((current) =>
      current.map((item) =>
        item.id === quote.id
          ? {
              ...item,
              likedByMe: !wasLiked,
              likeCount: item.likeCount + (wasLiked ? -1 : 1),
            }
          : item,
      ),
    );

    try {
      if (wasLiked) {
        await removeQuoteLike(quote.id, participant.id);
      } else {
        await addQuoteLike(quote.id, participant.id);
      }
    } catch (error) {
      setQuotes((current) =>
        current.map((item) =>
          item.id === quote.id
            ? {
                ...item,
                likedByMe: wasLiked,
                likeCount: item.likeCount + (wasLiked ? 1 : -1),
              }
            : item,
        ),
      );
      setLikeError(getErrorMessage(error));
    } finally {
      setPendingLikes((current) => {
        const next = new Set(current);
        next.delete(quote.id);
        return next;
      });
    }
  }

  return (
    <section className="mt-8" aria-labelledby="overheard-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
            The record
          </p>
          <h2
            id="overheard-heading"
            className="font-serif mt-2 text-3xl leading-tight tracking-tight text-ink"
          >
            Overheard
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsComposerOpen((open) => !open);
            if (isComposerOpen) {
              resetComposer();
            }
          }}
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={isComposerOpen}
          aria-controls="quote-composer"
        >
          {isComposerOpen ? "Close" : "+ Add"}
        </button>
      </div>

      {isComposerOpen ? (
        <form id="quote-composer" className="mt-6 mb-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <h3 className="font-serif text-xl leading-7 tracking-tight text-ink">
            Add to the record
          </h3>

          <div className="space-y-2">
            <label htmlFor="quote-text" className="block text-sm font-medium text-ink">
              What was said?
            </label>
            <textarea
              id="quote-text"
              name="quote"
              rows={3}
              value={quoteText}
              onChange={(event) => {
                setQuoteText(event.target.value);
                if (formError) {
                  setFormError(null);
                }
              }}
              disabled={isSubmitting}
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? "quote-error" : undefined}
              className="min-h-24 w-full resize-y rounded-md border border-rule bg-paper-raised px-4 py-3 text-base leading-7 text-ink outline-none placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30 disabled:opacity-60"
              placeholder="A line worth keeping"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quote-said-by" className="block text-sm font-medium text-ink">
              Who said it?
              <span className="font-normal text-ink-muted"> (optional)</span>
            </label>
            <input
              id="quote-said-by"
              name="saidBy"
              type="text"
              value={saidBy}
              onChange={(event) => setSaidBy(event.target.value)}
              disabled={isSubmitting}
              className="h-12 w-full rounded-md border border-rule bg-paper-raised px-4 text-base text-ink outline-none placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30 disabled:opacity-60"
              placeholder="A first name, or nobody in particular"
            />
          </div>

          {formError ? (
            <p id="quote-error" className="text-sm leading-6 text-clay" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || quoteText.trim().length === 0}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Preserving…" : "Preserve forever"}
          </button>
        </form>
      ) : null}

      <div className="mt-8" aria-live="polite">
        {isLoading ? (
          <p className="text-base leading-7 text-ink-muted">Listening…</p>
        ) : null}

        {listError ? (
          <p className="text-sm leading-6 text-clay" role="alert">
            {listError}
          </p>
        ) : null}

        {likeError ? (
          <p className="text-sm leading-6 text-clay" role="alert">
            {likeError}
          </p>
        ) : null}

        {!isLoading && !listError && quotes.length === 0 ? (
          <p className="text-base leading-7 text-ink-muted">
            Nothing incriminating has been said yet.
          </p>
        ) : null}

        <ul className="divide-y divide-rule">
          {quotes.map((quote) => (
            <li key={quote.id} className="py-7 first:pt-0">
              <blockquote>
                <p className="font-serif text-[1.65rem] leading-snug tracking-tight text-ink sm:text-3xl">
                  “{quote.quote}”
                </p>
                {quote.said_by ? (
                  <footer className="mt-3 text-sm leading-6 text-ink-muted">
                    — {quote.said_by}
                  </footer>
                ) : null}
              </blockquote>

              <button
                type="button"
                onClick={() => handleToggleLike(quote)}
                disabled={pendingLikes.has(quote.id)}
                aria-pressed={quote.likedByMe}
                aria-label={
                  quote.likedByMe
                    ? `Unlike quote, ${quote.likeCount} likes`
                    : `Like quote, ${quote.likeCount} likes`
                }
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait"
              >
                {quote.likedByMe ? <HeartFilledIcon /> : <HeartOutlineIcon />}
                <span className="text-sm leading-none text-ink-muted">
                  {quote.likeCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
