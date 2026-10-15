"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Tarih alanı + takvim ikonu. Tarih elle yazılabilir ya da ikona basınca
 *  tarayıcının takvimi açılır (showPicker; desteklemeyen tarayıcıda alana odaklanır). */
export function TarihInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const ref = useRef<HTMLInputElement>(null);

  function takvimiAc() {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <div className={cn("flex w-full max-w-[200px] items-stretch", className)}>
      <Input
        ref={ref}
        type="date"
        className="h-10 rounded-r-none font-mono [&::-webkit-calendar-picker-indicator]:hidden"
        {...props}
      />
      <button
        type="button"
        onClick={takvimiAc}
        aria-label="Takvimden seç"
        className="flex w-10 shrink-0 items-center justify-center rounded-r-[var(--radius)] border border-l-0 border-input bg-muted text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <CalendarDays className="size-[18px]" />
      </button>
    </div>
  );
}
