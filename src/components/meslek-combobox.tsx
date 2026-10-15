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
import meslekKodlari from "@/lib/meslek-kodlari.json";

type Meslek = { kod: string; isim: string };

const meslekler = meslekKodlari as Meslek[];

export function MeslekCombobox({
  value,
  onChange,
}: {
  value: Meslek | null;
  onChange: (meslek: Meslek) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return meslekler.slice(0, 50);
    return meslekler
      .filter(
        (m) =>
          m.isim.toLocaleLowerCase("tr-TR").includes(q) || m.kod.includes(q),
      )
      .slice(0, 50);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start font-normal">
            {value ? `${value.isim} (${value.kod})` : "Meslek seç..."}
          </Button>
        }
      />
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Meslek ara..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Meslek bulunamadı.</CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem
                  key={m.kod}
                  value={m.kod}
                  onSelect={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  {m.isim}{" "}
                  <span className="text-muted-foreground">({m.kod})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
