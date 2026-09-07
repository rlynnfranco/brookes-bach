import { supabase } from "@/lib/supabase";

export const GUEST_VOTE_CATEGORIES = [
  { value: "photo_of_weekend", label: "Photo of the Weekend", emoji: "🏆" },
  { value: "funniest", label: "Funniest Photo", emoji: "😂" },
  { value: "most_concerning", label: "Most Concerning Without Context", emoji: "🤨" },
  { value: "best_composition", label: "Best Composition", emoji: "🎨" },
  { value: "peoples_choice", label: "People’s Choice for the Book", emoji: "📖" },
] as const;

export const BRIDES_FAVORITE_CATEGORY = {
  value: "brides_favorite",
  label: "Bride’s Favorite",
  emoji: "❤️",
} as const;

export type VoteCategory =
  | (typeof GUEST_VOTE_CATEGORIES)[number]["value"]
  | typeof BRIDES_FAVORITE_CATEGORY.value;

export type PhotoVote = {
  id: string;
  photo_id: string;
  participant_id: string;
  category: VoteCategory;
};

export function canVoteInCategory(role: string, category: VoteCategory) {
  if (category === BRIDES_FAVORITE_CATEGORY.value) {
    return role === "bride";
  }

  return true;
}

export function getVisibleVoteCategories(role: string) {
  if (role === "bride") {
    return [...GUEST_VOTE_CATEGORIES, BRIDES_FAVORITE_CATEGORY];
  }

  return [...GUEST_VOTE_CATEGORIES];
}

export async function getMyVotesForPhoto(
  photoId: string,
  participantId: string,
) {
  const { data, error } = await supabase
    .from("photo_votes")
    .select("id, photo_id, participant_id, category")
    .eq("photo_id", photoId)
    .eq("participant_id", participantId);

  if (error) {
    throw error;
  }

  return (data ?? []) as PhotoVote[];
}

export async function addVote(
  photoId: string,
  participantId: string,
  category: VoteCategory,
) {
  const { error } = await supabase.from("photo_votes").insert({
    photo_id: photoId,
    participant_id: participantId,
    category,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function removeVote(
  photoId: string,
  participantId: string,
  category: VoteCategory,
) {
  const { error } = await supabase
    .from("photo_votes")
    .delete()
    .eq("photo_id", photoId)
    .eq("participant_id", participantId)
    .eq("category", category);

  if (error) {
    throw error;
  }
}

export async function toggleVote(
  photoId: string,
  participantId: string,
  category: VoteCategory,
  isSelected: boolean,
) {
  if (isSelected) {
    await removeVote(photoId, participantId, category);
    return false;
  }

  await addVote(photoId, participantId, category);
  return true;
}
