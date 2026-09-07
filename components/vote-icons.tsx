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

function SmileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M8.6 14c.8 1.3 2 2 3.4 2s2.6-.7 3.4-2" />
    </Icon>
  );
}

function QuestionIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4 1-1.4 1.9" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

function FrameIcon() {
  return (
    <Icon>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="m8 15 2.6-3.2 2.2 2.4L16 11l4 4" />
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
    case "funniest":
      return <SmileIcon />;
    case "most_concerning":
      return <QuestionIcon />;
    case "best_composition":
      return <FrameIcon />;
    case "peoples_choice":
      return <BookIcon />;
    case "brides_favorite":
      return <HeartIcon />;
    default:
      return null;
  }
}
