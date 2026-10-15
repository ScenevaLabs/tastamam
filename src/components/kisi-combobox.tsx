"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Kisi } from "@/lib/types";

export function KisiCombobox({
  kisiler,
  value,
  onChange,
}: {
  kisiler: Kisi[];
  value: Kisi | null;
  onChange: (kisi: Kisi) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return kisiler;
    return kisiler.filter((k) =>
      k.ad_soyad.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [query, kisiler]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start font-normal">
            {value ? value.ad_soyad : "Kişi seç..."}
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="İsim ara..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Kayıtlı kişi bulunamadı.</CommandEmpty>
            <CommandGroup>
              {filtered.map((k) => (
                <CommandItem
                  key={k.id}
                  value={k.id}
                  onSelect={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                >
                  {k.ad_soyad}{" "}
                  <span className="text-muted-foreground">
                    ({k.meslek_adi})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
