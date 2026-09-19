"use client";

import { useState } from "react";
import { BookView } from "@/components/book-view";
import { Overheard } from "@/components/overheard";
import { PhotoFeed } from "@/components/photo-feed";
import { isAdminRole } from "@/lib/book";
import type { Participant } from "@/lib/participants";

type HomeSection = "photos" | "overheard" | "book";

export function HomeSections({ participant }: { participant: Participant }) {
  const [section, setSection] = useState<HomeSection>("photos");
  const isAdmin = isAdminRole(participant.role);
  const activeSection = section === "book" && !isAdmin ? "photos" : section;

  function selectSection(next: HomeSection) {
    if (next === "book" && !isAdmin) {
      return;
    }

    if (next === activeSection) {
      return;
    }

    setSection(next);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-5 mt-8 bg-background px-5 sm:-mx-8 sm:px-8">
        <nav aria-label="Weekend sections" className="border-b border-rule">
          <div className={`flex ${isAdmin ? "gap-6 sm:gap-8" : "gap-8"}`}>
            <button
              type="button"
              onClick={() => selectSection("photos")}
              aria-current={activeSection === "photos" ? "true" : undefined}
              className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                activeSection === "photos"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted"
              }`}
            >
              Photos
            </button>
            <button
              type="button"
              onClick={() => selectSection("overheard")}
              aria-current={activeSection === "overheard" ? "true" : undefined}
              className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                activeSection === "overheard"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted"
              }`}
            >
              Overheard
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => selectSection("book")}
                aria-current={activeSection === "book" ? "true" : undefined}
                className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  activeSection === "book"
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted"
                }`}
              >
                Book
              </button>
            ) : null}
          </div>
        </nav>
      </div>

      <div hidden={activeSection !== "photos"}>
        <PhotoFeed participant={participant} />
      </div>
      <div hidden={activeSection !== "overheard"}>
        <Overheard participant={participant} />
      </div>
      {isAdmin && activeSection === "book" ? (
        <BookView participant={participant} />
      ) : null}
    </>
  );
}
