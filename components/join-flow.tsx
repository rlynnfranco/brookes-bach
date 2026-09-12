"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentUserId,
  getOrCreateGuestParticipant,
  getParticipantByAuthUserId,
  signInAnonymouslyIfNeeded,
  type Participant,
} from "@/lib/participants";
import {
  grantWeekendAccess,
  hasWeekendAccess,
  verifyWeekendAccessCode,
} from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PhotoFeed } from "@/components/photo-feed";
import { Overheard } from "@/components/overheard";

type View = "loading" | "access" | "join" | "welcome";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function JoinFlow() {
  const [view, setView] = useState<View>("loading");
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        if (!isSupabaseConfigured()) {
          if (isActive) {
            setError(
              "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, save the file, and restart the dev server.",
            );
            setView("access");
          }
          return;
        }

        const userId = await getCurrentUserId();

        if (userId) {
          const existingParticipant = await getParticipantByAuthUserId(userId);

          if (!isActive) {
            return;
          }

          if (existingParticipant) {
            setParticipant(existingParticipant);
            setView("welcome");
            return;
          }
        }

        if (!isActive) {
          return;
        }

        setView(hasWeekendAccess() ? "join" : "access");
      } catch (restoreError) {
        if (isActive) {
          const message = getErrorMessage(restoreError);

          if (message !== "Auth session missing!") {
            setError(message);
          }

          setView(hasWeekendAccess() ? "join" : "access");
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedCode = accessCode.trim();

    if (!trimmedCode) {
      setAccessError("Please enter the weekend code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setAccessError(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, save the file, and restart the dev server.",
        );
      }

      await signInAnonymouslyIfNeeded();
      const isValid = await verifyWeekendAccessCode(trimmedCode);

      if (!isValid) {
        setAccessError("Not quite. Try again.");
        return;
      }

      grantWeekendAccess();
      setAccessCode("");
      setView("join");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError("Please enter your first name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNameError(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, save the file, and restart the dev server.",
        );
      }

      const userId = await signInAnonymouslyIfNeeded();
      const nextParticipant = await getOrCreateGuestParticipant(
        userId,
        trimmedName,
      );

      setParticipant(nextParticipant);
      setView("welcome");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background px-5 py-10 text-foreground sm:px-8">
      <main
        className={`mx-auto flex w-full flex-1 flex-col ${
          view === "welcome"
            ? "max-w-2xl justify-start"
            : "max-w-md justify-center"
        }`}
      >
        <p className="font-sans text-xs font-medium tracking-[0.22em] text-ink-muted uppercase">
          A private weekend
        </p>
        <h1 className="font-serif mt-3 text-5xl leading-none tracking-tight text-ink sm:text-6xl">
          Brooke&apos;s Bach
        </h1>

        {view === "loading" ? (
          <p
            className="mt-8 text-base leading-7 text-ink-muted"
            role="status"
            aria-live="polite"
          >
            Opening the door…
          </p>
        ) : null}

        {view === "access" ? (
          <>
            <p className="mt-6 max-w-sm text-lg leading-8 text-ink-muted">
              You’ll need the weekend code to get in.
            </p>

            <form
              className="mt-10 space-y-6"
              onSubmit={handleAccessSubmit}
              noValidate
            >
              <div className="space-y-2">
                <label
                  htmlFor="weekend-code"
                  className="block text-sm font-medium text-ink"
                >
                  Weekend code
                </label>
                <input
                  id="weekend-code"
                  name="weekendCode"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={accessCode}
                  onChange={(event) => {
                    setAccessCode(event.target.value);
                    if (accessError) {
                      setAccessError(null);
                    }
                  }}
                  aria-invalid={accessError ? true : undefined}
                  aria-describedby={
                    accessError
                      ? "access-error"
                      : error
                        ? "join-error"
                        : undefined
                  }
                  className="h-12 w-full rounded-md border border-rule bg-paper-raised px-4 text-base text-ink shadow-none outline-none transition-colors placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
                />
              </div>

              {accessError ? (
                <p
                  id="access-error"
                  className="text-sm leading-6 text-clay"
                  role="alert"
                >
                  {accessError}
                </p>
              ) : null}

              {error ? (
                <p
                  id="join-error"
                  className="text-sm leading-6 text-clay"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || accessCode.trim().length === 0}
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Checking…" : "Enter"}
              </button>
            </form>
          </>
        ) : null}

        {view === "join" ? (
          <>
            <p className="mt-6 max-w-sm text-lg leading-8 text-ink-muted">
              Write your first name and come in. The rest of the weekend can
              wait a moment.
            </p>

            <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="first-name"
                  className="block text-sm font-medium text-ink"
                >
                  First name
                </label>
                <input
                  id="first-name"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  spellCheck={false}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) {
                      setNameError(null);
                    }
                  }}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={
                    nameError ? "name-error" : error ? "join-error" : undefined
                  }
                  className="h-12 w-full rounded-md border border-rule bg-paper-raised px-4 text-base text-ink shadow-none outline-none transition-colors placeholder:text-ink-soft focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
                  placeholder="Sam"
                />
              </div>

              {nameError ? (
                <p
                  id="name-error"
                  className="text-sm leading-6 text-clay"
                  role="alert"
                >
                  {nameError}
                </p>
              ) : null}

              {error ? (
                <p
                  id="join-error"
                  className="text-sm leading-6 text-clay"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || name.trim().length === 0}
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Entering…" : "Enter the Weekend"}
              </button>
            </form>
          </>
        ) : null}

        {view === "welcome" && participant ? (
          <section aria-live="polite">
            <PhotoFeed participant={participant} />
            <Overheard participant={participant} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
