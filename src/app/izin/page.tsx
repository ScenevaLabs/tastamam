import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { IzinFormu, type IzinKisisi } from "@/components/izin-formu";
import { IzinSatiri } from "@/components/izin-satiri";
import { CikisIzinSatiri, type CikisIzni } from "@/components/cikis-izin-satiri";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { cikisIzinHesabi, gunlukUcret, izinBakiyesi, kidemMetni, type IzinBakiyesi } from "@/lib/izin";
import { YILLIK_IZIN } from "@/lib/mevzuat";
import type { IsGirisi, YillikIzin } from "@/lib/types";
import { formatTarih, ucretMetni } from "@/lib/utils";

type KisiSatiri = {
  id: string;
  ad_soyad: string;
  dogum_tarihi: string | null;
  is_girisi: Pick<
    IsGirisi,
    | "id"
    | "giris_tarihi"
    | "cikis_tarihi"
    | "ucret_tutari"
    | "ucret_periyodu"
    | "ucret_tipi"
    | "izin_ucreti_gun"
    | "izin_ucreti_odendi_at"
  >[];
};

export default async function IzinSayfasi() {
  const supabase = await createClient();
  if (!(await acikModuller()).includes("izin")) {
    return <ModulKapali aktif="izin" ad="Yıllık izin" />;
  }
  const bugun = bugunIso();

  const [{ data: kisiler }, { data: izinler }, ayarlar] = await Promise.all([
    supabase
      .from("kisi")
      .select(
        "id, ad_soyad, dogum_tarihi, is_girisi(id, giris_tarihi, cikis_tarihi, ucret_tutari, ucret_periyodu, ucret_tipi, izin_ucreti_gun, izin_ucreti_odendi_at)",
      )
      .returns<KisiSatiri[]>(),
    supabase.from("yillik_izin").select("*").order("baslangic", { ascending: false }).returns<YillikIzin[]>(),
    ayarlarSatiri(),
  ]);
  const asgariUcretAylik = Number(ayarlar?.asgari_ucret_aylik ?? 28075.5);

  // Çıkışı girilmiş (geçmiş ya da ileri tarihli) dönemler: çıkış günündeki
  // bakiye ücret olarak ödenir (md. 59); çıkıştan sonraya taşan izin uyarılır.
  const cikislar: CikisIzni[] = [];
  const tasanIzin = new Map<string, string>(); // izin id → çıkış tarihi
  for (const k of kisiler ?? []) {
    const kisiIzinleri = (izinler ?? []).filter((i) => i.kisi_id === k.id);
    for (const d of k.is_girisi) {
      if (!d.cikis_tarihi) continue;
      // Bu döneme ait izinler: girişten sonra, bir sonraki dönemin girişinden önce
      // başlayanlar (tamamen çıkıştan sonraya düşen kayıt da yakalanır).
      const sonrakiGiris = k.is_girisi
        .map((x) => x.giris_tarihi)
        .filter((g) => g > d.giris_tarihi)
        .sort()[0];
      const h = cikisIzinHesabi({
        donemler: k.is_girisi,
        cikisTarihi: d.cikis_tarihi,
        dogumTarihi: k.dogum_tarihi,
        izinler: kisiIzinleri.filter(
          (i) => i.baslangic >= d.giris_tarihi && (!sonrakiGiris || i.baslangic < sonrakiGiris),
        ),
      });
      if (!h) continue;
      for (const t of h.tasanlar) tasanIzin.set(t.id, d.cikis_tarihi);
      if (h.kalan === 0 && h.tasanlar.length === 0 && !d.izin_ucreti_odendi_at) continue;
      cikislar.push({
        isGirisiId: d.id,
        kisiId: k.id,
        adSoyad: k.ad_soyad,
        cikisTarihi: d.cikis_tarihi,
        kalan: h.kalan,
        gunlukUcret: gunlukUcret(d.ucret_tutari, d.ucret_periyodu, asgariUcretAylik),
        ucretAciklama:
          d.ucret_tutari == null
            ? "ücret girilmemiş, asgari ücret / 30"
            : `${ucretMetni(d.ucret_tutari, d.ucret_periyodu, d.ucret_tipi)}${d.ucret_periyodu === "aylik" ? " / 30" : ""}`,
        odendiGun: d.izin_ucreti_gun ?? null,
        odendiAt: d.izin_ucreti_odendi_at ?? null,
        tasanlar: h.tasanlar,
      });
    }
  }
  // Ödenmemişler önce, sonra çıkış tarihine göre yeniden eskiye.
  cikislar.sort((a, b) => Number(!!a.odendiAt) - Number(!!b.odendiAt) || b.cikisTarihi.localeCompare(a.cikisTarihi));

  const ad = new Map((kisiler ?? []).map((k) => [k.id, k.ad_soyad]));
  const bakiyeler = (kisiler ?? [])
    .map((k) => ({
      kisi: k,
      b: izinBakiyesi({
        donemler: k.is_girisi,
        dogumTarihi: k.dogum_tarihi,
        izinler: (izinler ?? []).filter((i) => i.kisi_id === k.id),
        bugun,
      }),
    }))
    .filter((x): x is { kisi: KisiSatiri; b: IzinBakiyesi } => x.b !== null)
    .sort((a, b) => b.b.kidemGun - a.b.kidemGun);

  const formKisileri: IzinKisisi[] = bakiyeler.map(({ kisi, b }) => ({
    id: kisi.id,
    adSoyad: kisi.ad_soyad,
    kalan: b.buYilHak === null && b.devreden === 0 ? null : b.kalan,
  }));
  const dogumTarihiEksik = bakiyeler.filter(({ kisi }) => !kisi.dogum_tarihi);

  return (
    <>
      <AppHeader aktif="izin" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Yıllık izin</h1>
          <p className="mt-1 text-muted-foreground">
            Bu sayfa yıllık izin kayıt belgesi yerine geçer. Hak ediş kıdeme göre kendiliğinden hesaplanır: 1–5 yıl 14
            gün, 5–15 yıl 20 gün, 15 yıl ve üstü 26 gün. 18 yaş altı ve 50 yaş üstü en az 20 gün. Önceki dönemler kıdeme
            eklenir; kullanılmayan izin çıkışta ödendiği için yeni döneme devretmez.
          </p>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            {YILLIK_IZIN.kademeler.dayanak} · {YILLIK_IZIN.kayitBelgesi.dayanak}
          </p>
        </div>

          <section className="min-w-0">
            <h2 className="mb-3 text-[18px] font-bold">İzin bakiyeleri</h2>
            {bakiyeler.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktif çalışan yok.</p>
            ) : (
              <div className="overflow-x-auto border border-border bg-card">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="text-left text-[13px] text-muted-foreground">
                      <th className="border-b border-border px-4 py-2.5 font-medium">Çalışan</th>
                      <th className="border-b border-border px-3 py-2.5 font-medium">Kıdem</th>
                      <th className="border-b border-border px-3 py-2.5 text-right font-medium">Bu yılın hakkı</th>
                      <th className="border-b border-border px-3 py-2.5 text-right font-medium">Devreden</th>
                      <th className="border-b border-border px-3 py-2.5 text-right font-medium">Kullanılan</th>
                      <th className="border-b border-border px-3 py-2.5 text-right font-medium">Kalan</th>
                      <th className="border-b border-border px-4 py-2.5 font-medium">Sonraki hak ediş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bakiyeler.map(({ kisi, b }) => {
                      const hakYok = b.buYilHak === null && b.devreden === 0;
                      const cikis = kisi.is_girisi.find((d) => d.cikis_tarihi && d.cikis_tarihi >= bugun)?.cikis_tarihi;
                      return (
                        <tr key={kisi.id} className="border-b border-border/60 last:border-b-0">
                          <td className="px-4 py-2.5 font-medium">
                            <Link href={`/kisi/${kisi.id}`} className="hover:text-primary">
                              {kisi.ad_soyad}
                            </Link>
                            {cikis && (
                              <span className="block text-[12px] font-normal text-[var(--warn)]">
                                Çıkış {formatTarih(cikis, false)}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 text-muted-foreground">{kidemMetni(b.etkinBaslangic, bugun)}</td>
                          <td className="px-3 text-right font-mono">{b.buYilHak ?? "—"}</td>
                          <td className="px-3 text-right font-mono">{hakYok ? "—" : b.devreden}</td>
                          <td className="px-3 text-right font-mono">{hakYok ? "—" : b.kullanilan}</td>
                          <td
                            className={`whitespace-nowrap px-3 text-right font-bold ${
                              hakYok ? "font-medium text-muted-foreground" : b.kalan < 0 ? "text-[var(--warn)]" : ""
                            }`}
                          >
                            {hakYok ? "Hak yok" : `${b.kalan} gün`}
                          </td>
                          <td className="whitespace-nowrap px-4 font-mono text-[13px]">
                            {formatTarih(b.sonrakiHakEdis)}{" "}
                            <span className="text-muted-foreground">+{b.sonrakiHakGun}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {dogumTarihiEksik.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {dogumTarihiEksik.length} kişinin doğum tarihi girilmemiş, yaş kuralı (18 altı, 50 üstü en az 20 gün)
                onlara uygulanamadı:{" "}
                {dogumTarihiEksik.map(({ kisi }, i) => (
                  <span key={kisi.id}>
                    {i > 0 && ", "}
                    <Link href={`/kisi/${kisi.id}`} className="text-primary hover:underline">
                      {kisi.ad_soyad}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </section>


        <section>
          <h2 className="mb-3 text-[18px] font-bold">İzin kaydı ekle</h2>
          <div className="border border-border bg-card p-4 sm:p-5">
            <IzinFormu kisiler={formKisileri} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-bold">Son izinler</h2>
          {(izinler ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz izin kaydı yok.</p>
          ) : (
            <div className="border border-border bg-card">
              {(izinler ?? []).slice(0, 50).map((i) => (
                <IzinSatiri
                  key={i.id}
                  izin={i}
                  adSoyad={ad.get(i.kisi_id) ?? "Bilinmeyen kişi"}
                  cikisTarihi={tasanIzin.get(i.id)}
                />
              ))}
            </div>
          )}
        </section>

        {cikislar.length > 0 && (
          <section>
            <h2 className="mb-1 text-[18px] font-bold">Çıkışta ödenecek izin</h2>
            <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
              İş sözleşmesi biten çalışanın kullanmadığı yıllık izin günleri, çıkış tarihindeki ücretinden ödenir. Gün
              çıkış günündeki bakiyeden hesaplanır; ücret girilmemişse asgari ücret esas alınır. Ödeyince işaretle.{" "}
              <span className="font-mono text-[12px]">4857 md. 59</span>
            </p>
            <div className="border border-border bg-card">
              {cikislar.map((c) => (
                <CikisIzinSatiri key={c.isGirisiId} c={c} bugun={bugun} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
