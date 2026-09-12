import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";
import { createDisplayAndThumbnailJpegs } from "@/lib/image";
import { supabase } from "@/lib/supabase";

const PHOTO_COLUMNS =
  "id, participant_id, storage_path, original_storage_path, thumbnail_storage_path, caption, created_at";
const SIGNED_URL_BATCH_SIZE = 100;
const DISPLAY_PROCESSING_ERROR =
  "The original was saved, but we couldn't prepare a viewing version. Please try again.";

export const PHOTO_BUCKET = "bach-photos";
const SIGNED_URL_SECONDS = 60 * 60;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ACCEPTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

export const LAST_SEEN_PHOTOS_STORAGE_KEY = "brookes_bach_last_seen_photos_at";

export function getLastSeenPhotosAt() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_SEEN_PHOTOS_STORAGE_KEY);
}

export function setLastSeenPhotosAt(timestamp = new Date().toISOString()) {
  window.localStorage.setItem(LAST_SEEN_PHOTOS_STORAGE_KEY, timestamp);
}

export function isPhotoNewerThan(createdAt: string, lastSeenAt: string) {
  const createdTime = Date.parse(createdAt);
  const lastSeenTime = Date.parse(lastSeenAt);

  if (Number.isNaN(createdTime) || Number.isNaN(lastSeenTime)) {
    return false;
  }

  return createdTime > lastSeenTime;
}

export const PHOTO_ACCEPT =
  "image/heic,image/heif,image/jpeg,image/png,image/webp,.heic,.heif,.jpg,.jpeg,.png,.webp";

export type PhotoUploadStage =
  | "converting"
  | "uploading-original"
  | "uploading"
  | "saving";

export type Photo = {
  id: string;
  participant_id: string;
  storage_path: string;
  original_storage_path: string | null;
  thumbnail_storage_path: string | null;
  caption: string | null;
  created_at: string;
};

export type PhotoWithUrl = Photo & {
  signedUrl: string | null;
  thumbnailUrl: string | null;
  uploaderName: string | null;
};

export function galleryStoragePath(photo: Photo) {
  return photo.thumbnail_storage_path || photo.storage_path;
}

export function bookStoragePath(photo: Photo) {
  return photo.original_storage_path || photo.storage_path;
}

export function isAcceptedImage(file: File) {
  if (file.type && ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  const extension = getExtension(file.name);
  return extension ? ACCEPTED_IMAGE_EXTENSIONS.has(extension) : false;
}

export function toSafeFilename(filename: string) {
  const trimmed = filename.trim() || "photo";
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const extension = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";
  const safeBase =
    base
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "photo";
  const safeExtension =
    extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  return `${safeBase}.${safeExtension}`;
}

export function buildStoragePath(
  participantId: string,
  filename: string,
  timestamp = Date.now(),
) {
  return `${participantId}/${timestamp}-${toSafeFilename(filename)}`;
}

function getExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }

  return filename.slice(lastDot + 1).toLowerCase();
}

function toJpegFilename(filename: string) {
  const safeName = toSafeFilename(filename);
  const base = safeName.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

async function uploadPhotoFile(storagePath: string, file: File) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function createPhotoRow(
  participantId: string,
  storagePath: string,
  caption: string,
  originalStoragePath: string | null = null,
  thumbnailStoragePath: string | null = null,
) {
  const trimmedCaption = caption.trim();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      participant_id: participantId,
      storage_path: storagePath,
      original_storage_path: originalStoragePath,
      thumbnail_storage_path: thumbnailStoragePath,
      caption: trimmedCaption.length > 0 ? trimmedCaption : null,
    })
    .select(PHOTO_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Photo;
}

export async function removeUploadedPhotos(storagePaths: string[]) {
  const paths = storagePaths.filter(Boolean);

  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

export async function addPhoto(
  participantId: string,
  file: File,
  caption: string,
  onStage?: (stage: PhotoUploadStage) => void,
) {
  if (!isAcceptedImage(file)) {
    throw new Error("Please choose a JPEG, PNG, WebP, or HEIC image.");
  }

  const timestamp = Date.now();
  const originalStoragePath = buildStoragePath(
    participantId,
    file.name,
    timestamp,
  );
  const displayStoragePath = buildStoragePath(
    participantId,
    `display-${toJpegFilename(file.name)}`,
    timestamp,
  );
  const thumbnailStoragePath = buildStoragePath(
    participantId,
    `thumb-${toJpegFilename(file.name)}`,
    timestamp,
  );
  const derivedPaths: string[] = [];

  try {
    onStage?.("uploading-original");
    await uploadPhotoFile(originalStoragePath, file);

    onStage?.("converting");
    const sourceForDisplay = isHeicFile(file)
      ? await convertHeicToJpeg(file)
      : file;

    let displayFile: File;
    let thumbnailFile: File | null;

    try {
      const versions = await createDisplayAndThumbnailJpegs(
        sourceForDisplay,
        toSafeFilename(file.name).replace(/\.[^.]+$/, "") || "photo",
      );
      displayFile = versions.displayFile;
      thumbnailFile = versions.thumbnailFile;
    } catch {
      throw new Error(DISPLAY_PROCESSING_ERROR);
    }

    onStage?.("uploading");

    try {
      await uploadPhotoFile(displayStoragePath, displayFile);
      derivedPaths.push(displayStoragePath);
    } catch {
      throw new Error(DISPLAY_PROCESSING_ERROR);
    }

    let savedThumbnailPath: string | null = null;

    if (thumbnailFile) {
      try {
        await uploadPhotoFile(thumbnailStoragePath, thumbnailFile);
        derivedPaths.push(thumbnailStoragePath);
        savedThumbnailPath = thumbnailStoragePath;
      } catch {
        savedThumbnailPath = null;
      }
    }

    onStage?.("saving");
    return await createPhotoRow(
      participantId,
      displayStoragePath,
      caption,
      originalStoragePath,
      savedThumbnailPath,
    );
  } catch (error) {
    await removeUploadedPhotos(derivedPaths);
    throw error;
  }
}

export async function getPhotosNewestFirst() {
  const { data, error } = await supabase
    .from("photos")
    .select(PHOTO_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Photo[];
}

async function createSignedUrlMap(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const urlByPath = new Map<string, string | null>();

  for (let index = 0; index < unique.length; index += SIGNED_URL_BATCH_SIZE) {
    const batch = unique.slice(index, index + SIGNED_URL_BATCH_SIZE);
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(batch, SIGNED_URL_SECONDS);

    if (error) {
      throw error;
    }

    for (const item of data ?? []) {
      if (item.path) {
        urlByPath.set(item.path, item.signedUrl ?? null);
      }
    }
  }

  return urlByPath;
}

function withSignedUrls(
  photo: Photo,
  urlByPath: Map<string, string | null>,
  uploaderName: string | null,
): PhotoWithUrl {
  const displayUrl = urlByPath.get(photo.storage_path) ?? null;

  return {
    ...photo,
    signedUrl: displayUrl,
    thumbnailUrl: urlByPath.get(galleryStoragePath(photo)) ?? displayUrl,
    uploaderName,
  };
}

export async function getPhotosWithSignedUrls() {
  const photos = await getPhotosNewestFirst();

  if (photos.length === 0) {
    return [] as PhotoWithUrl[];
  }

  const urlByPath = await createSignedUrlMap(
    photos.flatMap((photo) => [photo.storage_path, galleryStoragePath(photo)]),
  );

  const participantIds = [...new Set(photos.map((photo) => photo.participant_id))];
  const { data: participants } = await supabase
    .from("participants")
    .select("id, name")
    .in("id", participantIds);

  const nameById = new Map(
    (participants ?? []).map((person) => [person.id as string, person.name as string]),
  );

  return photos.map((photo) =>
    withSignedUrls(
      photo,
      urlByPath,
      nameById.get(photo.participant_id) ?? null,
    ),
  );
}

export function photoFromRealtimeRow(value: unknown): Photo | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== "string" ||
    typeof row.participant_id !== "string" ||
    typeof row.storage_path !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    participant_id: row.participant_id,
    storage_path: row.storage_path,
    original_storage_path:
      typeof row.original_storage_path === "string"
        ? row.original_storage_path
        : null,
    thumbnail_storage_path:
      typeof row.thumbnail_storage_path === "string"
        ? row.thumbnail_storage_path
        : null,
    caption: typeof row.caption === "string" ? row.caption : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function insertPhotoNewestFirst(
  photos: PhotoWithUrl[],
  nextPhoto: PhotoWithUrl,
) {
  if (photos.some((photo) => photo.id === nextPhoto.id)) {
    return photos;
  }

  const nextTime = Date.parse(nextPhoto.created_at) || 0;
  const insertAt = photos.findIndex(
    (photo) => (Date.parse(photo.created_at) || 0) < nextTime,
  );

  if (insertAt === -1) {
    return [...photos, nextPhoto];
  }

  return [...photos.slice(0, insertAt), nextPhoto, ...photos.slice(insertAt)];
}

export async function getPhotoWithSignedUrl(photo: Photo) {
  const urlByPath = await createSignedUrlMap([
    photo.storage_path,
    galleryStoragePath(photo),
  ]);

  const { data: participant } = await supabase
    .from("participants")
    .select("name")
    .eq("id", photo.participant_id)
    .maybeSingle();

  return withSignedUrls(
    photo,
    urlByPath,
    (participant?.name as string | undefined) ?? null,
  );
}
