import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Etik Hacker raporu (30 Ağu + 12 Eki 2026): clickjacking koruması ve
  // framework ifşası. Sayfa hiçbir yerde iframe içinde kullanılmıyor.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Sözleşme şablonu (templates/sozlesme-sablonu.docx) fs.readFile ile
  // okunuyor — Netlify'ın serverless fonksiyon paketine otomatik dahil
  // olmayabileceği için elle belirtildi (Faz 10).
  // @napi-rs/canvas de aynı nedenle elle eklendi: pdf-parse'ın Node
  // canvas/DOMMatrix sağlamak için runtime'da require ettiği bu paketi,
  // hiçbir kendi kodumuz doğrudan import etmediği için Next'in statik
  // file-tracing'i "kullanılmıyor" sanıp deploy paketinden düşürüyordu —
  // Netlify prod'da "Cannot find module '@napi-rs/canvas'" hatasına yol
  // açtı (31 Ağustos 2026).
  outputFileTracingIncludes: {
    "/*": ["./templates/**", "./node_modules/@napi-rs/canvas*/**"],
  },
  experimental: {
    serverActions: {
      // Taranmış/fotoğraflanmış evrak yüklemeleri varsayılan 1MB sınırını aşabiliyor.
      bodySizeLimit: "20mb",
    },
    // proxy.ts (Next.js 16 middleware) her isteğin gövdesini ayrıca kendi
    // varsayılan 10MB sınırıyla buffer'lıyor — bu, serverActions.bodySizeLimit'ten
    // bağımsız bir katman. Aşılırsa gövde sessizce kırpılıp Server Action'da
    // "Unexpected end of form" hatasına yol açıyor (10MB üstü bir evrak
    // yüklerken bulundu).
    proxyClientMaxBodySize: "20mb",
  },
  // pdf-parse (pdfjs-dist) worker dosyasını Turbopack bundle'ından ayrı,
  // gerçek node_modules yolundan çözmesi gerekiyor — bundle'lanırsa
  // "Setting up fake worker failed" hatası veriyor (Faz 6, gelen mail
  // PDF'lerinden TC kimlik no okuma). @napi-rs/canvas da aynı nedenle
  // external: pdf-parse'ın metin çıkarma adımı Node'da DOMMatrix/canvas
  // sağlamak için bunu runtime'da require ediyor, native .node dosyası
  // bundle'lanırsa bulunamıyor (Netlify prod'da "DOMMatrix is not defined"
  // hatasına yol açtığı görüldü — REF kodu olmayan gerçek bir SGK PDF'i
  // TC kimlik no eşleştirmesi için metne çevrilirken).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
