import type { PuantajKodu } from "@/lib/mevzuat";

// Puantaj kodlarının renkleri (onaylı mockup, marka/ekranlar-v1/Puantaj).
export const KOD_STIL: Record<PuantajKodu, string> = {
  Ç: "text-foreground",
  HT: "bg-muted text-muted-foreground",
  GT: "bg-muted text-muted-foreground",
  Yİ: "bg-accent font-medium text-primary",
  R: "bg-[var(--warn-soft)] font-medium text-[var(--warn)]",
  Üİ: "bg-[var(--warn-soft)] font-medium text-[var(--warn)]",
  Dİ: "bg-[var(--warn-soft)] font-medium text-[var(--warn)]",
  D: "bg-[var(--warn)] font-medium text-white dark:text-background",
};
