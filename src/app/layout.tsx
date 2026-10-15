import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Tastamam kimliği: metin ve başlık Schibsted Grotesk, tarih/TC/tutar
// IBM Plex Mono. İkisi de OFL lisanslı, public repoya girebilir.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Tastamam",
  description: "İşverenin kayıt defteri. Eksiksiz, zamanında.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tastamam",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#151816" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${schibsted.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
