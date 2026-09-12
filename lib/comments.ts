import { supabase } from "@/lib/supabase";

export type PhotoComment = {
  id: string;
  photo_id: string;
  participant_id: string;
  body: string;
  created_at: string;
  authorName: string;
};

export async function getCommentsForPhoto(photoId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, photo_id, participant_id, body, created_at")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return [] as PhotoComment[];
  }

  const participantIds = [
    ...new Set(rows.map((row) => row.participant_id as string)),
  ];
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, name")
    .in("id", participantIds);

  if (participantsError) {
    throw participantsError;
  }

  const nameById = new Map(
    (participants ?? []).map((person) => [
      person.id as string,
      person.name as string,
    ]),
  );

  return rows.map((row) => ({
    id: row.id as string,
    photo_id: row.photo_id as string,
    participant_id: row.participant_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    authorName: nameById.get(row.participant_id as string) ?? "a guest",
  }));
}

export function commentFromRealtimeRow(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== "string" ||
    typeof row.photo_id !== "string" ||
    typeof row.participant_id !== "string" ||
    typeof row.body !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    photo_id: row.photo_id,
    participant_id: row.participant_id,
    body: row.body,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function insertCommentOldestFirst(
  comments: PhotoComment[],
  nextComment: PhotoComment,
) {
  if (comments.some((comment) => comment.id === nextComment.id)) {
    return comments;
  }

  const nextTime = Date.parse(nextComment.created_at) || 0;
  const insertAt = comments.findIndex(
    (comment) => (Date.parse(comment.created_at) || 0) > nextTime,
  );

  if (insertAt === -1) {
    return [...comments, nextComment];
  }

  return [
    ...comments.slice(0, insertAt),
    nextComment,
    ...comments.slice(insertAt),
  ];
}

export async function getCommentWithAuthor(
  row: {
    id: string;
    photo_id: string;
    participant_id: string;
    body: string;
    created_at: string;
  },
  knownAuthorName?: string,
) {
  if (knownAuthorName?.trim()) {
    return {
      ...row,
      authorName: knownAuthorName.trim(),
    } satisfies PhotoComment;
  }

  const { data } = await supabase
    .from("participants")
    .select("name")
    .eq("id", row.participant_id)
    .maybeSingle();

  return {
    ...row,
    authorName: (data?.name as string | undefined)?.trim() || "a guest",
  } satisfies PhotoComment;
}

export async function addComment(
  photoId: string,
  participantId: string,
  body: string,
  authorName: string,
) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Write a note first.");
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      photo_id: photoId,
      participant_id: participantId,
      body: trimmedBody,
    })
    .select("id, photo_id, participant_id, body, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id as string,
    photo_id: data.photo_id as string,
    participant_id: data.participant_id as string,
    body: data.body as string,
    created_at: data.created_at as string,
    authorName: authorName.trim() || "a guest",
  } satisfies PhotoComment;
}
