"use client";

import { useState } from "react";
import { Overheard } from "@/components/overheard";
import { PhotoFeed } from "@/components/photo-feed";
import type { Participant } from "@/lib/participants";

type HomeSection = "photos" | "overheard";

export function HomeSections({ participant }: { participant: Participant }) {
  const [section, setSection] = useState<HomeSection>("photos");

  function selectSection(next: HomeSection) {
    if (next === section) {
      return;
    }

    setSection(next);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-5 mt-8 bg-background px-5 sm:-mx-8 sm:px-8">
        <nav aria-label="Weekend sections" className="border-b border-rule">
          <div className="flex gap-8">
            <button
              type="button"
              onClick={() => selectSection("photos")}
              aria-current={section === "photos" ? "true" : undefined}
              className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                section === "photos"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted"
              }`}
            >
              Photos
            </button>
            <button
              type="button"
              onClick={() => selectSection("overheard")}
              aria-current={section === "overheard" ? "true" : undefined}
              className={`-mb-px inline-flex h-11 items-center border-b bg-transparent px-0.5 text-xs font-medium tracking-[0.22em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                section === "overheard"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted"
              }`}
            >
              Overheard
            </button>
          </div>
        </nav>
      </div>

      <div hidden={section !== "photos"}>
        <PhotoFeed participant={participant} />
      </div>
      <div hidden={section !== "overheard"}>
        <Overheard participant={participant} />
      </div>
    </>
  );
}
