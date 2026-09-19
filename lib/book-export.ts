import type { BookCuration, BookNote, BookNoteGroup, BookPhoto, BookQuote } from "@/lib/book";
import { PHOTO_BUCKET } from "@/lib/photos";
import { supabase } from "@/lib/supabase";

const LARGE_EXPORT_PHOTO_COUNT = 40;
const LARGE_EXPORT_BYTES = 150 * 1024 * 1024;
const ESTIMATED_ORIGINAL_BYTES = 3.5 * 1024 * 1024;
const ESTIMATED_DISPLAY_BYTES = 0.7 * 1024 * 1024;

export type ExportPhoto = {
  sequence: number;
  exportFilename: string;
  photo: BookPhoto;
  printablePath: string | null;
  hasOriginal: boolean;
  hasPrintableSource: boolean;
};

export type ExportNote = {
  note: BookNote;
  group: BookNoteGroup;
  relatedSequence: number | null;
};

export type BookExportManifest = {
  photos: ExportPhoto[];
  quotes: BookQuote[];
  notes: ExportNote[];
};

function extensionFromPath(path: string) {
  const filename = path.split("/").pop() ?? path;
  const lastDot = filename.lastIndexOf(".");

  if (lastDot <= 0) {
    return "jpg";
  }

  return filename.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

function paddedSequence(sequence: number) {
  return String(sequence).padStart(3, "0");
}

export function printablePhotoPath(photo: BookPhoto) {
  return (photo.original_storage_path || photo.storage_path || "").trim() || null;
}

export function buildBookExportManifest(curation: BookCuration): BookExportManifest {
  const selectedPhotos = curation.photos.filter((photo) => photo.include_in_book);
  const photos = selectedPhotos.map((photo, index) => {
    const sequence = index + 1;
    const printablePath = printablePhotoPath(photo);

    return {
      sequence,
      exportFilename: printablePath
        ? `${paddedSequence(sequence)}.${extensionFromPath(printablePath)}`
        : "",
      photo,
      printablePath,
      hasOriginal: Boolean(photo.original_storage_path?.trim()),
      hasPrintableSource: Boolean(printablePath),
    };
  });

  const sequenceByPhotoId = new Map(
    photos.map((item) => [item.photo.id, item.sequence]),
  );

  const quotes = curation.quotes.filter((quote) => quote.include_in_book);
  const notes: ExportNote[] = [];

  for (const group of curation.noteGroups) {
    for (const note of group.notes) {
      if (!note.include_in_book) {
        continue;
      }

      notes.push({
        note,
        group,
        relatedSequence: sequenceByPhotoId.get(group.photoId) ?? null,
      });
    }
  }

  return { photos, quotes, notes };
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

function voteCount(photo: BookPhoto, category: string) {
  return photo.categoryVotes.find((vote) => vote.category === category)?.count ?? 0;
}

function selectedNotesForPhoto(manifest: BookExportManifest, photoId: string) {
  return manifest.notes
    .filter((item) => item.note.photo_id === photoId)
    .map((item) => item.note.body)
    .join(" | ");
}

export function buildExportCsvFiles(manifest: BookExportManifest) {
  const files: { filename: string; content: string }[] = [];

  if (manifest.photos.length > 0) {
    files.push({
      filename: "for-the-record-photos.csv",
      content: toCsv(
        [
          "sequence",
          "export_filename",
          "photo_id",
          "uploaded_by",
          "original_storage_path",
          "display_storage_path",
          "brides_favorite",
          "photo_of_weekend_votes",
          "a24_or_lifetime_votes",
          "portrait_on_fire_votes",
          "wrong_reasons_votes",
          "criterion_collection_votes",
          "caption",
          "margin_notes",
        ],
        manifest.photos.map((item) => [
          item.sequence,
          item.exportFilename,
          item.photo.id,
          item.photo.uploaderName,
          item.photo.original_storage_path,
          item.photo.storage_path,
          item.photo.isBridesFavorite ? "yes" : "no",
          voteCount(item.photo, "photo_of_weekend"),
          voteCount(item.photo, "a24_or_lifetime"),
          voteCount(item.photo, "portrait_on_fire"),
          voteCount(item.photo, "wrong_reasons"),
          voteCount(item.photo, "criterion_collection"),
          item.photo.caption,
          selectedNotesForPhoto(manifest, item.photo.id),
        ]),
      ),
    });
  }

  if (manifest.quotes.length > 0) {
    files.push({
      filename: "for-the-record-quotes.csv",
      content: toCsv(
        ["quote", "said_by", "heart_count"],
        manifest.quotes.map((quote) => [
          quote.quote,
          quote.said_by,
          quote.likeCount,
        ]),
      ),
    });
  }

  if (manifest.notes.length > 0) {
    files.push({
      filename: "for-the-record-notes.csv",
      content: toCsv(
        ["note", "participant", "related_photo_sequence", "related_photo_id"],
        manifest.notes.map((item) => [
          item.note.body,
          item.note.authorName,
          item.relatedSequence,
          item.note.photo_id,
        ]),
      ),
    });
  }

  return files;
}

export function downloadExportManifest(manifest: BookExportManifest) {
  const files = buildExportCsvFiles(manifest);

  files.forEach((file, index) => {
    window.setTimeout(() => {
      const blob = new Blob([file.content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, index * 150);
  });

  return files.map((file) => file.filename);
}

export type PhotoZipProgress =
  | { kind: "photo"; current: number; total: number }
  | { kind: "packaging" };

function zipManifestName(filename: string) {
  return filename.replace(/^for-the-record-/, "");
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function estimatePhotoExportBytes(manifest: BookExportManifest) {
  return manifest.photos.reduce((total, item) => {
    if (!item.hasPrintableSource) {
      return total;
    }

    return total + (item.hasOriginal ? ESTIMATED_ORIGINAL_BYTES : ESTIMATED_DISPLAY_BYTES);
  }, 0);
}

export function isLargePhotoExport(manifest: BookExportManifest) {
  return (
    manifest.photos.length >= LARGE_EXPORT_PHOTO_COUNT ||
    estimatePhotoExportBytes(manifest) >= LARGE_EXPORT_BYTES
  );
}

export async function downloadBookPhotosZip(
  manifest: BookExportManifest,
  onProgress: (progress: PhotoZipProgress) => void,
) {
  const missing = manifest.photos.find((item) => !item.hasPrintableSource || !item.printablePath);

  if (missing) {
    const sequence = paddedSequence(missing.sequence);
    throw new Error(
      `Photo ${sequence} has no printable file. Remove it from the book or restore its source, then try again.`,
    );
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const photosFolder = zip.folder("photos");

  if (!photosFolder) {
    throw new Error("We couldn’t prepare the photo archive. Please try again.");
  }

  for (const [index, item] of manifest.photos.entries()) {
    onProgress({
      kind: "photo",
      current: index + 1,
      total: manifest.photos.length,
    });

    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .download(item.printablePath as string);

    if (error || !data) {
      throw new Error(
        `Could not download ${item.exportFilename || paddedSequence(item.sequence)}. Please try again.`,
      );
    }

    photosFolder.file(item.exportFilename, data, { compression: "STORE" });
  }

  for (const file of buildExportCsvFiles(manifest)) {
    zip.file(zipManifestName(file.filename), file.content);
  }

  onProgress({ kind: "packaging" });

  const archive = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });

  triggerBrowserDownload(archive, "for-the-record-photos.zip");
}
