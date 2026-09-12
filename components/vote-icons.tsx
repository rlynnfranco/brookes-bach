import type { ReactNode } from "react";
import type { VoteCategory } from "@/lib/votes";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function TrophyIcon() {
  return (
    <Icon>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5A2.5 2.5 0 0 0 8 8.8" />
      <path d="M16 6h2.5A2.5 2.5 0 0 1 16 8.8" />
      <path d="M12 11v3" />
      <path d="M9 20h6" />
      <path d="M10 17h4v3h-4z" />
    </Icon>
  );
}

function FilmIcon() {
  return (
    <Icon>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M3.5 10h17" />
      <path d="M3.5 14h17" />
      <path d="M8 6v12" />
      <path d="M16 6v12" />
    </Icon>
  );
}

function FlameIcon() {
  return (
    <Icon>
      <path d="M12 19c3.2 0 5-2.2 5-5.2 0-2.8-1.8-4.6-3.2-6.2-.4-.5-1.3-.2-1.3.5 0 .8-.4 1.5-1.1 1.7-1.2.3-2.4-.7-2.4-2.1 0-1.5 1-3 2.4-4.7.2-.3-.1-.7-.5-.6C8.3 3.2 5 6.3 5 11.2 5 15.4 8 19 12 19Z" />
    </Icon>
  );
}

function TelevisionIcon() {
  return (
    <Icon>
      <rect x="3.5" y="6.5" width="17" height="11" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 17.5V20" />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon>
      <path d="M12 6.5c-1.6-1.2-3.6-1.8-6-1.8H4v13.2h2.2c2.3 0 4.2.6 5.8 1.8" />
      <path d="M12 6.5c1.6-1.2 3.6-1.8 6-1.8H20v13.2h-2.2c-2.3 0-4.2.6-5.8 1.8" />
      <path d="M12 6.5v13.2" />
    </Icon>
  );
}

function HeartIcon() {
  return (
    <Icon>
      <path d="M12 19.2 5.8 13A3.8 3.8 0 0 1 12 8.2 3.8 3.8 0 0 1 18.2 13L12 19.2Z" />
    </Icon>
  );
}

export function HeartOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[18px] w-[18px] shrink-0"}
      aria-hidden="true"
    >
      <path d="M12 19.2 5.8 13A3.8 3.8 0 0 1 12 8.2 3.8 3.8 0 0 1 18.2 13L12 19.2Z" />
    </svg>
  );
}

export function HeartFilledIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[18px] w-[18px] shrink-0"}
      aria-hidden="true"
    >
      <path d="M12 19.2 5.8 13A3.8 3.8 0 0 1 12 8.2 3.8 3.8 0 0 1 18.2 13L12 19.2Z" />
    </svg>
  );
}

export function VoteCategoryIcon({ category }: { category: VoteCategory }) {
  switch (category) {
    case "photo_of_weekend":
      return <TrophyIcon />;
    case "a24_or_lifetime":
      return <FilmIcon />;
    case "portrait_on_fire":
      return <FlameIcon />;
    case "wrong_reasons":
      return <TelevisionIcon />;
    case "criterion_collection":
      return <BookIcon />;
    case "brides_favorite":
      return <HeartIcon />;
    default:
      return null;
  }
}
