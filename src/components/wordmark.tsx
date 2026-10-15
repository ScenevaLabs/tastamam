import { cn } from "@/lib/utils";

/** Tastamam yazı logosu: "tastamam" + altında çift çizgi (defterde "hesap kapandı"
 *  işareti). Tek renk, currentColor kullanır (marka kuralı). */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span
      className={cn("inline-flex flex-col leading-none text-foreground", className)}
      aria-label="Tastamam"
      role="img"
    >
      <span
        aria-hidden
        className={cn(
          "font-extrabold tracking-[-0.03em]",
          lg ? "text-[44px]" : "text-[22px]"
        )}
      >
        tastamam
      </span>
      <span
        aria-hidden
        className={lg ? "mt-1.5 h-2" : "mt-[3px] h-1"}
        style={{
          borderTop: `${lg ? 3 : 2}px solid currentColor`,
          borderBottom: `${lg ? 3 : 2}px solid currentColor`,
        }}
      />
    </span>
  );
}
