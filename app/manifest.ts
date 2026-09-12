import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "For the Record",
    short_name: "For the Record",
    description: "A private record of Brooke’s weekend.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe6",
    theme_color: "#f4efe6",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
