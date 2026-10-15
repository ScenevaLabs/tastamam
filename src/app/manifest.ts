import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tastamam",
    short_name: "Tastamam",
    description: "İşverenin kayıt defteri. Eksiksiz, zamanında.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f0",
    theme_color: "#f3f5f0",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
