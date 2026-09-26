const COMMENT_SEEN_KEY_PREFIX = "for_the_record_comment_seen_";

export function commentSeenStorageKey(photoId: string) {
  return `${COMMENT_SEEN_KEY_PREFIX}${photoId}`;
}

export function getCommentSeenAt(photoId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(commentSeenStorageKey(photoId));
}

export function setCommentSeenAt(photoId: string, timestamp: string) {
  window.localStorage.setItem(commentSeenStorageKey(photoId), timestamp);
}

export function isCommentNewerThan(createdAt: string, seenAt: string) {
  const createdTime = Date.parse(createdAt);
  const seenTime = Date.parse(seenAt);

  if (Number.isNaN(createdTime) || Number.isNaN(seenTime)) {
    return false;
  }

  return createdTime > seenTime;
}

export function photoHasUnseenComments(
  photoId: string,
  latestCommentAt: string | null,
) {
  if (!latestCommentAt) {
    return false;
  }

  const seenAt = getCommentSeenAt(photoId);

  if (!seenAt) {
    return true;
  }

  return isCommentNewerThan(latestCommentAt, seenAt);
}

export function latestCommentCreatedAt(comments: { created_at: string }[]) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const comment of comments) {
    const time = Date.parse(comment.created_at);

    if (Number.isNaN(time) || time < latestTime) {
      continue;
    }

    latestTime = time;
    latest = comment.created_at;
  }

  return latest;
}

export function rememberCommentsSeen(
  photoId: string,
  comments: { created_at: string }[],
) {
  const latest = latestCommentCreatedAt(comments);

  if (!latest) {
    return false;
  }

  setCommentSeenAt(photoId, latest);
  return true;
}
