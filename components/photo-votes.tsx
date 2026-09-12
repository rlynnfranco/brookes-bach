"use client";

import { useEffect, useState } from "react";
import type { Participant } from "@/lib/participants";
import {
  canVoteInCategory,
  getMyVotesForPhoto,
  getVisibleVoteCategories,
  toggleVote,
  type VoteCategory,
} from "@/lib/votes";
import { VoteCategoryIcon } from "@/components/vote-icons";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn’t save that vote. Please try again.";
}

export function PhotoVotes({
  photoId,
  participant,
}: {
  photoId: string;
  participant: Participant;
}) {
  const categories = getVisibleVoteCategories(participant.role);
  const [selected, setSelected] = useState<Set<VoteCategory>>(new Set());
  const [pending, setPending] = useState<Set<VoteCategory>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadVotes() {
      setIsLoading(true);
      setError(null);

      try {
        const votes = await getMyVotesForPhoto(photoId, participant.id);

        if (isActive) {
          setSelected(new Set(votes.map((vote) => vote.category)));
        }
      } catch (loadError) {
        if (isActive) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadVotes();

    return () => {
      isActive = false;
    };
  }, [photoId, participant.id]);

  async function handleToggle(category: VoteCategory) {
    if (!canVoteInCategory(participant.role, category) || pending.has(category)) {
      return;
    }

    const wasSelected = selected.has(category);
    const nextSelected = new Set(selected);

    if (wasSelected) {
      nextSelected.delete(category);
    } else {
      nextSelected.add(category);
    }

    setSelected(nextSelected);
    setPending((current) => new Set(current).add(category));
    setError(null);

    try {
      await toggleVote(photoId, participant.id, category, wasSelected);
    } catch (toggleError) {
      setSelected((current) => {
        const restored = new Set(current);

        if (wasSelected) {
          restored.add(category);
        } else {
          restored.delete(category);
        }

        return restored;
      });
      setError(getErrorMessage(toggleError));
    } finally {
      setPending((current) => {
        const nextPending = new Set(current);
        nextPending.delete(category);
        return nextPending;
      });
    }
  }

  return (
    <section className="mt-5 border-t border-rule pt-4" aria-labelledby="photo-votes-heading">
      <h3
        id="photo-votes-heading"
        className="font-serif text-lg leading-6 tracking-tight text-ink"
      >
        For Your Consideration
      </h3>

      {isLoading ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted" role="status">
          Loading your votes…
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {categories.map((category) => {
            const isSelected = selected.has(category.value);
            const isPending = pending.has(category.value);

            return (
              <li key={category.value}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isPending}
                  onClick={() => handleToggle(category.value)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-md border px-3 py-1.5 text-left text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait ${
                    isSelected
                      ? "border-ink bg-ink text-paper"
                      : "border-rule bg-paper-raised text-ink"
                  }`}
                >
                  <VoteCategoryIcon category={category.value} />
                  <span className="min-w-0">
                    <span className="block">{category.label}</span>
                    {"description" in category && category.description ? (
                      <span
                        className={`mt-px block text-[11px] leading-3.5 ${
                          isSelected ? "text-paper/65" : "text-ink-soft"
                        }`}
                      >
                        {category.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-3 text-sm leading-6 text-clay" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
