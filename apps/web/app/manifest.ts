import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studigo",
    short_name: "Studigo",
    description: "Your AI study companion, grounded in your own class materials.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#141b2d",
    icons: []
  };
}
