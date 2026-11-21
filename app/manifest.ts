// Web app manifest: what makes the app installable (name, icon, colors, full screen).
import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Dreams",
    description: "Your day, turned into tonight's dream.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1026",
    theme_color: "#0b1026",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
