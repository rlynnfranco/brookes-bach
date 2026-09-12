const DISPLAY_MAX_EDGE = 1800;
const THUMBNAIL_MAX_EDGE = 700;
const DISPLAY_JPEG_QUALITY = 0.88;
const THUMBNAIL_JPEG_QUALITY = 0.8;

function scaledSize(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height);

  if (longEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeImage(source: Blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      return await createImageBitmap(source);
    }
  }

  return loadHtmlImage(source);
}

function loadHtmlImage(source: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn’t read this photo."));
    };
    image.src = url;
  });
}

function canvasToJpegFile(
  image: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  quality: number,
  filename: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("We couldn’t prepare this photo for viewing.");
  }

  context.drawImage(image, 0, 0, width, height);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("We couldn’t prepare this photo for viewing."));
          return;
        }

        resolve(
          new File([blob], filename, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        );
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function createDisplayAndThumbnailJpegs(
  source: Blob,
  baseFilename: string,
) {
  const image = await decodeImage(source);
  const { width, height } = image;
  const displaySize = scaledSize(width, height, DISPLAY_MAX_EDGE);
  const thumbnailSize = scaledSize(width, height, THUMBNAIL_MAX_EDGE);

  try {
    const displayFile = await canvasToJpegFile(
      image,
      displaySize.width,
      displaySize.height,
      DISPLAY_JPEG_QUALITY,
      `${baseFilename}-display.jpg`,
    );

    let thumbnailFile: File | null = null;

    try {
      thumbnailFile = await canvasToJpegFile(
        image,
        thumbnailSize.width,
        thumbnailSize.height,
        THUMBNAIL_JPEG_QUALITY,
        `${baseFilename}-thumb.jpg`,
      );
    } catch {
      thumbnailFile = null;
    }

    return { displayFile, thumbnailFile };
  } finally {
    if ("close" in image) {
      image.close();
    }
  }
}
