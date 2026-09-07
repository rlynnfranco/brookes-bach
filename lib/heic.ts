const JPEG_QUALITY = 0.92;

export function isHeicFile(file: File) {
  const type = file.type.toLowerCase();

  if (type === "image/heic" || type === "image/heif") {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "heic" || extension === "heif";
}

export async function convertHeicToJpeg(file: File) {
  const { heicTo } = await import("heic-to");

  try {
    const jpegBlob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    const displayName = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;

    return new File([jpegBlob], displayName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    throw new Error(
      "We couldn't convert this iPhone photo for the feed. Please try again.",
    );
  }
}
