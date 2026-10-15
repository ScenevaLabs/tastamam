import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ayarlarSatiri as ayarlarSatiri_ } from "@/lib/istek";
import { createClient } from "@/lib/supabase/server";
import { SablonAyarlari, type SablonDurumu } from "@/components/sablon-formlari";
import { ALAN_ACIKLAMASI, SABLONLAR, SABLON_ADLARI } from "@/lib/sablon";
import { formatTarih } from "@/lib/utils";

import { AyarlarForm } from "@/components/ayarlar-form";
import { GelenMaillerForm } from "@/components/gelen-mailler-form";
import { ModullerForm } from "@/components/moduller-form";
import type { Ayarlar } from "@/lib/types";
import { depoAdi, type DepoAdi } from "@/lib/depo";

export default async function AyarlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ms_basarili?: string; ms_hata?: string; g_basarili?: string; g_hata?: string }>;
}) {
  const { ms_basarili, ms_hata, g_basarili, g_hata } = await searchParams;
  // ms_/g_ token'ları istemci bileşenine geçilmemeli — sadece
  // "bağlı mı" bilgisini sunucuda kullanıp temiz bir Ayarlar nesnesi kuruyoruz.
  const supabase = await createClient();
  const [ayarlarSatiri, { data: ozelSablonlar }] = await Promise.all([
    ayarlarSatiri_(),
    // İçerik değil, yalnızca hangi şablonun yüklendiği (0028 yoksa boş döner).
    supabase.from("sablon").select("ad, dosya_adi, yuklendi_at"),
  ]);
  const sablonlar: SablonDurumu[] = SABLON_ADLARI.map((ad) => {
    const o = (ozelSablonlar ?? []).find((x) => x.ad === ad);
    return {
      ad,
      etiket: SABLONLAR[ad].etiket,
      alanlar: SABLONLAR[ad].alanlar.map((a) => ({ ad: a, aciklama: ALAN_ACIKLAMASI[a] ?? "" })),
      ozel: o ? { dosyaAdi: o.dosya_adi as string, yuklendi: formatTarih((o.yuklendi_at as string).slice(0, 10)) } : null,
    };
  });

  const ayarlar: Ayarlar | null = ayarlarSatiri
    ? {
        id: true,
        mali_musavir_email: ayarlarSatiri.mali_musavir_email,
        gonderen_email: ayarlarSatiri.gonderen_email,
        takip_email: ayarlarSatiri.takip_email,
        profil_unvan: ayarlarSatiri.profil_unvan,
        profil_iletisim: ayarlarSatiri.profil_iletisim,
        asgari_ucret_aylik: ayarlarSatiri.asgari_ucret_aylik,
        sirket_unvani: ayarlarSatiri.sirket_unvani,
        sirket_adresi: ayarlarSatiri.sirket_adresi,
        isg_email: ayarlarSatiri.isg_email,
        isg_cc_giris: ayarlarSatiri.isg_cc_giris,
        acik_moduller: ayarlarSatiri.acik_moduller ?? [],
        created_at: ayarlarSatiri.created_at,
        updated_at: ayarlarSatiri.updated_at,
      }
    : null;
  // 0025 uygulanmadıysa sütun yok, alan gösterilmez.
  const puantajBaslangic = (ayarlarSatiri?.puantaj_baslangic as string | undefined)?.slice(0, 7) ?? null;
  const secilenDepo = depoAdi();
  const bagli: Record<DepoAdi, boolean> = {
    supabase: true,
    onedrive: !!ayarlarSatiri?.ms_refresh_token,
    gdrive: !!ayarlarSatiri?.g_refresh_token,
    yerel: true,
  };
  const yerelKok = secilenDepo === "yerel" ? process.env.YEREL_DEPO_KOK?.trim() || null : null;
  const basarili = secilenDepo === "onedrive" ? ms_basarili : g_basarili;
  const hata = secilenDepo === "onedrive" ? ms_hata : g_hata;

  return (
    <>
    <AppHeader aktif="ayarlar" />
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Muhasebeye giden otomatik mailler bu adresler üzerinden gönderilir.
        </p>
      </div>

      <div className="border border-border bg-card p-5">
        <AyarlarForm ayarlar={ayarlar ?? null} />
      </div>

      <div>
        <h2 className="text-[18px] font-bold">Modüller</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Açtığın modüller üst menüde görünür. Kapatınca kayıtlar silinmez, yalnızca menüden kalkar.
        </p>
      </div>
      <div className="border border-border bg-card p-5">
        <ModullerForm acik={ayarlar?.acik_moduller ?? []} puantajBaslangic={puantajBaslangic} />
      </div>

      <div>
        <h2 className="text-[18px] font-bold">Belge şablonları</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İş sözleşmesi ve KVKK metinleri bu şablonlardan, çalışanın ve şirketin bilgileriyle hazırlanır. Örnekler
          yüklü gelir; şirketinin kendi metnini kullanmak istersen örneği indir, Word’de düzenle (süslü
          parantezli alanları koru) ve yükle. Metinleri mali müşavirin ya da avukatınla kontrol et.
        </p>
      </div>
      <div className="border border-border bg-card p-5">
        <SablonAyarlari sablonlar={sablonlar} acikRiza={!!ayarlarSatiri?.kvkk_acik_riza} />
      </div>

      <div>
        <h2 className="text-[18px] font-bold">Belgeler nerede saklanıyor?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Depo kurulumda <code className="font-mono text-[13px]">.env</code> dosyasındaki{" "}
          <code className="font-mono text-[13px]">DEPO_SAGLAYICI</code> ile seçilir. Sonradan değiştirirsen
          eski belgeler kendiliğinden taşınmaz. Ayrıntı: KURULUM.md.
        </p>
      </div>
      <div className="flex flex-col gap-3 border border-border bg-card p-5">
        {basarili && (
          <p className="bg-[var(--ok-soft)] px-3 py-2 text-sm font-medium text-[var(--ok)]">Hesabın bağlandı.</p>
        )}
        {hata && (
          <p className="bg-[var(--warn-soft)] px-3 py-2 text-sm font-medium text-[var(--warn)]">
            Bağlantı başarısız: {hata}
          </p>
        )}
        {DEPOLAR.map((d) => {
          const secili = d.ad === secilenDepo;
          return (
            <div
              key={d.ad}
              className={`flex flex-wrap items-center gap-3 p-4 ${secili ? "border-[1.5px] border-primary" : "border border-border opacity-70"}`}
            >
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                <span className="font-bold">
                  {d.etiket}
                  {secili && <span className="ml-2 text-[13px] font-medium text-primary">kullanımda</span>}
                </span>
                <span className="text-sm text-muted-foreground">{d.aciklama}</span>
                {secili && d.ad === "yerel" && (
                  <span className="mt-1 font-mono text-[13px]">{yerelKok ?? "YEREL_DEPO_KOK tanımlı değil"}</span>
                )}
              </div>
              {secili && d.baglanUrl && (
                <>
                  <span className={`text-sm font-bold ${bagli[d.ad] ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
                    {bagli[d.ad] ? "Bağlı" : "Bağlı değil"}
                  </span>
                  <Link
                    href={d.baglanUrl}
                    className="border-[1.5px] border-primary px-3 py-1.5 text-[13px] font-bold text-primary hover:bg-accent"
                  >
                    {bagli[d.ad] ? "Yeniden bağlan" : `${d.etiket} ile bağlan`}
                  </Link>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-[18px] font-bold">Gelen Kutusu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mali müşavirden referans kodlu gelen PDF ekleri bulur, doğru kişi/dönemi anlar ve
          otomatik olarak doğru kişi klasörüne kaydeder (gerekirse klasörü oluşturur,
          işten ayrılışta açık klasörü giriş-çıkış aralığıyla kapatır) — eksik evrak listesinden
          düşer. Referans kodu olmayan ya da kişisi kesin belirlenemeyen ekler elle onaya kalır.
        </p>
      </div>
      <div className="border border-border bg-card p-5">
        <GelenMaillerForm />
      </div>
    </div>
    </>
  );
}

const DEPOLAR: { ad: DepoAdi; etiket: string; aciklama: string; baglanUrl?: string }[] = [
  {
    ad: "supabase",
    etiket: "Supabase Storage",
    aciklama: "Varsayılan. Belgeler kendi Supabase hesabında, özel bir klasörde durur. Ek kurulum gerekmez.",
  },
  {
    ad: "onedrive",
    etiket: "OneDrive",
    aciklama: "Eklenti. Belgeler OneDrive'daki kişi klasörlerine yazılır.",
    baglanUrl: "/api/auth/microsoft/login",
  },
  {
    ad: "gdrive",
    etiket: "Google Drive",
    aciklama: "Eklenti. Belgeler Google Drive'daki kişi klasörlerine yazılır.",
    baglanUrl: "/api/auth/google/login",
  },
  {
    ad: "yerel",
    etiket: "Bu bilgisayar",
    aciklama:
      "Belgeler, uygulamanın çalıştığı bilgisayardaki bir klasöre yazılır (OneDrive ya da Dropbox eşitleme klasörü de olabilir). Uygulamayı kendi bilgisayarında ya da ofis sunucusunda çalıştırıyorsan seç; Netlify gibi barındırmalarda çalışmaz.",
  },
];
