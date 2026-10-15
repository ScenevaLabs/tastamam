"use client";

import { useState, useTransition } from "react";
import {
  gelenMailleriTara,
  gelenEkiDosyala,
  gelenEkiYoksay,
  type GelenEkOnerisi,
  type OtomatikDosyalananSonuc,
  type OtomatikHataSonuc,
} from "@/app/gelen-mail-actions";
import { Button } from "@/components/ui/button";
import { DONEM_BELGE_TIPLERI, DONEM_BELGE_ETIKETLERI, KOK_BELGE_ETIKETLERI } from "@/lib/types";

const KISA_TARIH_SAAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function EkKarti({
  ek,
  onIslendi,
}: {
  ek: GelenEkOnerisi;
  onIslendi: (token: string) => void;
}) {
  const ilkAday = ek.adaylar[0];
  const [seciliIsGirisiId, setSeciliIsGirisiId] = useState(ilkAday?.isGirisiId ?? "");
  const seciliAday = ek.adaylar.find((a) => a.isGirisiId === seciliIsGirisiId);
  const [belgeTipi, setBelgeTipi] = useState<string>(
    ek.tahminBelgeTipi ??
      (seciliAday?.tip === "cikis" ? "istenayrilis_bildirgesi" : "isegiris_bildirgesi"),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function dosyala() {
    setError(null);
    if (!seciliIsGirisiId) {
      setError("Bir kişi/dönem seç.");
      return;
    }
    const formData = new FormData();
    formData.set("token", ek.token);
    formData.set("is_girisi_id", seciliIsGirisiId);
    formData.set("belge_tipi", belgeTipi);
    startTransition(async () => {
      const result = await gelenEkiDosyala(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onIslendi(ek.token);
    });
  }

  function atla() {
    startTransition(async () => {
      await gelenEkiYoksay(ek.token);
      onIslendi(ek.token);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <div className="text-sm font-semibold">{ek.dosyaAdi}</div>
        <div className="text-xs text-muted-foreground">
          {ek.konu} · {ek.gonderenEmail} · {KISA_TARIH_SAAT.format(new Date(ek.tarih))}
        </div>
        {ek.neden && <div className="mt-1 text-xs text-[var(--warn)]">{ek.neden}</div>}
      </div>

      {ek.adaylar.length === 0 ? (
        <p className="text-xs text-[var(--warn)]">
          Eşleşme bulunamadı — ne konudaki referans kodu ne de belge içeriğindeki TC kimlik no
          kayıtlı bir kişiyle örtüştü. Mali müşavirden orijinal konuyu koruyarak (Yanıtla) cevap
          vermesini rica edin, ya da belge taranmış/görüntü olabilir.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ek.eslesmeYontemi === "tc" && (
            <p className="text-xs text-muted-foreground">
              Referans kodu yok — belge içeriğindeki TC kimlik no ile eşleştirildi, hangi
              döneme ait olduğunu doğrula.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <select
            value={seciliIsGirisiId}
            onChange={(e) => {
              setSeciliIsGirisiId(e.target.value);
              const a = ek.adaylar.find((x) => x.isGirisiId === e.target.value);
              if (!ek.tahminBelgeTipi) {
                setBelgeTipi(
                  a?.tip === "cikis" ? "istenayrilis_bildirgesi" : "isegiris_bildirgesi",
                );
              }
            }}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {ek.adaylar.map((a) => (
              <option key={a.isGirisiId} value={a.isGirisiId}>
                {a.kisiAdSoyad} — {a.donemOzeti}
              </option>
            ))}
          </select>
          <select
            value={belgeTipi}
            onChange={(e) => setBelgeTipi(e.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {DONEM_BELGE_TIPLERI.map((tip) => (
              <option key={tip} value={tip}>
                {DONEM_BELGE_ETIKETLERI[tip]}
              </option>
            ))}
          </select>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {ek.adaylar.length > 0 && (
          <Button type="button" size="xs" disabled={isPending} onClick={dosyala}>
            {isPending ? "Dosyalanıyor..." : "Dosyala"}
          </Button>
        )}
        <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={atla}>
          Atla
        </Button>
      </div>
    </div>
  );
}

export function GelenMaillerForm() {
  const [otomatikDosyalanan, setOtomatikDosyalanan] = useState<OtomatikDosyalananSonuc[] | null>(
    null,
  );
  const [otomatikHatali, setOtomatikHatali] = useState<OtomatikHataSonuc[]>([]);
  const [manuelGerekli, setManuelGerekli] = useState<GelenEkOnerisi[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function tara() {
    setError(null);
    startTransition(async () => {
      const result = await gelenMailleriTara();
      if (result.error) {
        setError(result.error);
        return;
      }
      setOtomatikDosyalanan(result.otomatikDosyalanan);
      setOtomatikHatali(result.otomatikHatali);
      setManuelGerekli(result.manuelGerekli);
    });
  }

  function ekKaldir(token: string) {
    setManuelGerekli((prev) => prev.filter((e) => e.token !== token));
  }

  const hicbirSeyYok =
    otomatikDosyalanan !== null &&
    otomatikDosyalanan.length === 0 &&
    otomatikHatali.length === 0 &&
    manuelGerekli.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={tara} disabled={isPending} className="self-start">
        {isPending ? "Taranıyor..." : "Gelen mailleri kontrol et"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {hicbirSeyYok && (
        <p className="text-sm text-muted-foreground">
          Mali müşavirden son 30 gün içinde PDF ekli mail bulunamadı.
        </p>
      )}

      {otomatikDosyalanan !== null && otomatikDosyalanan.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--ok)]/30 bg-[var(--ok-soft)] p-4">
          <p className="text-xs font-semibold text-[var(--ok)]">
            {otomatikDosyalanan.length} belge otomatik dosyalandı
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-[var(--ok)]">
            {otomatikDosyalanan.map((s, i) => (
              <li key={i}>
                {s.kisiAdSoyad} — {s.belgeTipi in DONEM_BELGE_ETIKETLERI
                  ? DONEM_BELGE_ETIKETLERI[s.belgeTipi as keyof typeof DONEM_BELGE_ETIKETLERI]
                  : KOK_BELGE_ETIKETLERI[s.belgeTipi as keyof typeof KOK_BELGE_ETIKETLERI]} ({s.dosyaAdi})
              </li>
            ))}
          </ul>
        </div>
      )}

      {otomatikHatali.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--warn)]/30 bg-[var(--warn-soft)] p-4">
          <p className="text-xs font-semibold text-[var(--warn)]">
            {otomatikHatali.length} belge otomatik dosyalanamadı
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-[var(--warn)]">
            {otomatikHatali.map((s, i) => (
              <li key={i}>
                {s.dosyaAdi}: {s.hata}
              </li>
            ))}
          </ul>
        </div>
      )}

      {manuelGerekli.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Bu {manuelGerekli.length} ek otomatik eşleştirilemedi, elle kontrol gerekiyor:
          </p>
          {manuelGerekli.map((ek) => (
            <EkKarti key={ek.token} ek={ek} onIslendi={ekKaldir} />
          ))}
        </div>
      )}
    </div>
  );
}
