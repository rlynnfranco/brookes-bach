import { convertHeicToJpeg, isHeicFile } from "@/lib/heic";
import { supabase } from "@/lib/supabase";

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
  caption: string | null;
  created_at: string;
};

export type PhotoWithUrl = Photo & {
  signedUrl: string | null;
  uploaderName: string | null;
};

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
) {
  const trimmedCaption = caption.trim();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      participant_id: participantId,
      storage_path: storagePath,
      original_storage_path: originalStoragePath,
      caption: trimmedCaption.length > 0 ? trimmedCaption : null,
    })
    .select(
      "id, participant_id, storage_path, original_storage_path, caption, created_at",
    )
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

  const uploadedPaths: string[] = [];

  try {
    if (isHeicFile(file)) {
      onStage?.("converting");
      const displayFile = await convertHeicToJpeg(file);
      const timestamp = Date.now();
      const originalStoragePath = buildStoragePath(
        participantId,
        file.name,
        timestamp,
      );
      const storagePath = buildStoragePath(
        participantId,
        toJpegFilename(file.name),
        timestamp,
      );

      onStage?.("uploading-original");
      await uploadPhotoFile(originalStoragePath, file);
      uploadedPaths.push(originalStoragePath);

      onStage?.("uploading");
      await uploadPhotoFile(storagePath, displayFile);
      uploadedPaths.push(storagePath);

      onStage?.("saving");
      return await createPhotoRow(
        participantId,
        storagePath,
        caption,
        originalStoragePath,
      );
    }

    onStage?.("uploading");
    const storagePath = await uploadPhotoFile(
      buildStoragePath(participantId, file.name),
      file,
    );
    uploadedPaths.push(storagePath);

    onStage?.("saving");
    return await createPhotoRow(participantId, storagePath, caption, null);
  } catch (error) {
    await removeUploadedPhotos(uploadedPaths);
    throw error;
  }
}

export async function getPhotosNewestFirst() {
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, participant_id, storage_path, original_storage_path, caption, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Photo[];
}

export async function getPhotosWithSignedUrls() {
  const photos = await getPhotosNewestFirst();

  if (photos.length === 0) {
    return [] as PhotoWithUrl[];
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      photos.map((photo) => photo.storage_path),
      SIGNED_URL_SECONDS,
    );

  if (error) {
    throw error;
  }

  const urlByPath = new Map(
    (data ?? []).map((item) => [item.path, item.signedUrl ?? null]),
  );

  const participantIds = [...new Set(photos.map((photo) => photo.participant_id))];
  const { data: participants } = await supabase
    .from("participants")
    .select("id, name")
    .in("id", participantIds);

  const nameById = new Map(
    (participants ?? []).map((person) => [person.id as string, person.name as string]),
  );

  return photos.map((photo) => ({
    ...photo,
    signedUrl: urlByPath.get(photo.storage_path) ?? null,
    uploaderName: nameById.get(photo.participant_id) ?? null,
  }));
}
