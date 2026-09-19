import {
  galleryStoragePath,
  getSignedUrlsByPath,
  type Photo,
} from "@/lib/photos";
import { getQuotesWithLikes, type QuoteWithLikes } from "@/lib/quotes";
import { supabase } from "@/lib/supabase";
import {
  BRIDES_FAVORITE_CATEGORY,
  GUEST_VOTE_CATEGORIES,
  type VoteCategory,
} from "@/lib/votes";

const BOOK_PHOTO_COLUMNS =
  "id, participant_id, storage_path, original_storage_path, thumbnail_storage_path, caption, created_at, include_in_book";

export type BookCategoryVote = {
  category: VoteCategory;
  label: string;
  count: number;
};

export type BookPhoto = {
  id: string;
  caption: string | null;
  created_at: string;
  storage_path: string;
  original_storage_path: string | null;
  uploaderName: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  include_in_book: boolean;
  isBridesFavorite: boolean;
  totalVotes: number;
  categoryVotes: BookCategoryVote[];
};

export type BookQuote = QuoteWithLikes;

export type BookNote = {
  id: string;
  photo_id: string;
  body: string;
  created_at: string;
  authorName: string;
  include_in_book: boolean;
};

export type BookNoteGroup = {
  photoId: string;
  thumbnailUrl: string | null;
  uploaderName: string | null;
  notes: BookNote[];
};

export type BookCuration = {
  photos: BookPhoto[];
  quotes: BookQuote[];
  noteGroups: BookNoteGroup[];
};

const CATEGORY_LABELS = new Map<VoteCategory, string>([
  ...GUEST_VOTE_CATEGORIES.map((category) => [category.value, category.label] as const),
  [BRIDES_FAVORITE_CATEGORY.value, BRIDES_FAVORITE_CATEGORY.label],
]);

export function isAdminRole(role: string) {
  return role === "admin";
}

function compareNewestFirst(left: string, right: string) {
  return (Date.parse(right) || 0) - (Date.parse(left) || 0);
}

export function rankBookPhotos(photos: BookPhoto[]) {
  return [...photos].sort((left, right) => {
    if (left.isBridesFavorite !== right.isBridesFavorite) {
      return left.isBridesFavorite ? -1 : 1;
    }

    if (left.totalVotes !== right.totalVotes) {
      return right.totalVotes - left.totalVotes;
    }

    return compareNewestFirst(left.created_at, right.created_at);
  });
}

export function rankBookQuotes(quotes: BookQuote[]) {
  return [...quotes].sort((left, right) => {
    if (left.likeCount !== right.likeCount) {
      return right.likeCount - left.likeCount;
    }

    return compareNewestFirst(left.created_at, right.created_at);
  });
}

function rankBookNoteGroups(
  groups: BookNoteGroup[],
  photoRankById: Map<string, number>,
) {
  return [...groups].sort((left, right) => {
    const leftRank = photoRankById.get(left.photoId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = photoRankById.get(right.photoId) ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.photoId.localeCompare(right.photoId);
  });
}

async function getBookPhotoRows() {
  const { data, error } = await supabase
    .from("photos")
    .select(BOOK_PHOTO_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as (Photo & { include_in_book: boolean | null })[];
}

async function getNameByParticipantId(participantIds: string[]) {
  const uniqueIds = [...new Set(participantIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("participants")
    .select("id, name")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((person) => [person.id as string, person.name as string]),
  );
}

function buildPhotoVoteSummary(votes: { photo_id: string; category: string }[]) {
  const countsByPhoto = new Map<string, Map<string, number>>();

  for (const vote of votes) {
    const byCategory = countsByPhoto.get(vote.photo_id) ?? new Map<string, number>();
    byCategory.set(vote.category, (byCategory.get(vote.category) ?? 0) + 1);
    countsByPhoto.set(vote.photo_id, byCategory);
  }

  return countsByPhoto;
}

function toBookPhoto(
  photo: Photo & { include_in_book: boolean | null },
  thumbnailUrl: string | null,
  displayUrl: string | null,
  uploaderName: string | null,
  countsByCategory: Map<string, number> | undefined,
): BookPhoto {
  const categoryVotes: BookCategoryVote[] = [];
  let totalVotes = 0;

  for (const [category, count] of countsByCategory ?? []) {
    totalVotes += count;

    if (category === BRIDES_FAVORITE_CATEGORY.value || count <= 0) {
      continue;
    }

    categoryVotes.push({
      category: category as VoteCategory,
      label: CATEGORY_LABELS.get(category as VoteCategory) ?? category,
      count,
    });
  }

  categoryVotes.sort((left, right) => {
    const leftIndex = GUEST_VOTE_CATEGORIES.findIndex(
      (category) => category.value === left.category,
    );
    const rightIndex = GUEST_VOTE_CATEGORIES.findIndex(
      (category) => category.value === right.category,
    );

    return (
      (leftIndex === -1 ? GUEST_VOTE_CATEGORIES.length : leftIndex) -
      (rightIndex === -1 ? GUEST_VOTE_CATEGORIES.length : rightIndex)
    );
  });

  return {
    id: photo.id,
    caption: photo.caption,
    created_at: photo.created_at,
    storage_path: photo.storage_path,
    original_storage_path: photo.original_storage_path,
    uploaderName,
    thumbnailUrl,
    displayUrl,
    include_in_book: Boolean(photo.include_in_book),
    isBridesFavorite: (countsByCategory?.get(BRIDES_FAVORITE_CATEGORY.value) ?? 0) > 0,
    totalVotes,
    categoryVotes,
  };
}

async function getBookNotes(photoIds: string[]) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, photo_id, participant_id, body, include_in_book, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return [] as BookNote[];
  }

  const nameById = await getNameByParticipantId(
    rows.map((row) => row.participant_id as string),
  );
  const knownPhotoIds = new Set(photoIds);

  return rows
    .filter((row) => knownPhotoIds.has(row.photo_id as string))
    .map((row) => ({
      id: row.id as string,
      photo_id: row.photo_id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      authorName: nameById.get(row.participant_id as string) ?? "a guest",
      include_in_book: Boolean(row.include_in_book),
    }));
}

function groupBookNotes(
  notes: BookNote[],
  photos: BookPhoto[],
): BookNoteGroup[] {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const notesByPhoto = new Map<string, BookNote[]>();

  for (const note of notes) {
    const group = notesByPhoto.get(note.photo_id) ?? [];
    group.push(note);
    notesByPhoto.set(note.photo_id, group);
  }

  const groups = [...notesByPhoto.entries()].map(([photoId, groupedNotes]) => {
    const photo = photoById.get(photoId);

    return {
      photoId,
      thumbnailUrl: photo?.thumbnailUrl ?? null,
      uploaderName: photo?.uploaderName ?? null,
      notes: groupedNotes,
    };
  });

  const photoRankById = new Map(photos.map((photo, index) => [photo.id, index]));

  return rankBookNoteGroups(groups, photoRankById);
}

export async function getBookCuration(participantId: string): Promise<BookCuration> {
  const [photoRows, votesResult, quotes] = await Promise.all([
    getBookPhotoRows(),
    supabase.from("photo_votes").select("photo_id, category"),
    getQuotesWithLikes(participantId),
  ]);

  if (votesResult.error) {
    throw votesResult.error;
  }

  const urlByPath = await getSignedUrlsByPath(
    photoRows.flatMap((photo) => [galleryStoragePath(photo), photo.storage_path]),
  );
  const nameById = await getNameByParticipantId(
    photoRows.map((photo) => photo.participant_id),
  );
  const voteSummary = buildPhotoVoteSummary(
    (votesResult.data ?? []) as { photo_id: string; category: string }[],
  );

  const photos = rankBookPhotos(
    photoRows.map((photo) =>
      toBookPhoto(
        photo,
        urlByPath.get(galleryStoragePath(photo)) ?? null,
        urlByPath.get(photo.storage_path) ?? null,
        nameById.get(photo.participant_id) ?? null,
        voteSummary.get(photo.id),
      ),
    ),
  );

  const notes = await getBookNotes(photos.map((photo) => photo.id));

  return {
    photos,
    quotes: rankBookQuotes(quotes),
    noteGroups: groupBookNotes(notes, photos),
  };
}

export async function setPhotoBookInclusion(
  photoId: string,
  shouldInclude: boolean,
) {
  const { error } = await supabase.rpc("set_photo_book_inclusion", {
    target_photo_id: photoId,
    should_include: shouldInclude,
  });

  if (error) {
    throw error;
  }
}

export async function setQuoteBookInclusion(
  quoteId: string,
  shouldInclude: boolean,
) {
  const { error } = await supabase.rpc("set_quote_book_inclusion", {
    target_quote_id: quoteId,
    should_include: shouldInclude,
  });

  if (error) {
    throw error;
  }
}

export async function setCommentBookInclusion(
  commentId: string,
  shouldInclude: boolean,
) {
  const { error } = await supabase.rpc("set_comment_book_inclusion", {
    target_comment_id: commentId,
    should_include: shouldInclude,
  });

  if (error) {
    throw error;
  }
}
