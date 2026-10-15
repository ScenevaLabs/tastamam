# Tastamam mevzuat kuralları (onaylandı 13 Ekim 2026)

Uygulamanın hesapladığı her süre, oran ve eşik bu listeden gelir. Kodda
`web/src/lib/mevzuat.ts` olarak durur (her kuralın yanında kaynak
ve kontrol tarihi). Kaynaklar mevzuat.gov.tr ve Resmî Gazete'nin güncel
metinleri; "güven" sütunu metnin nereden okunduğunu gösterir.
Bu liste hukuki danışmanlık değildir; uygulama README'sinde de böyle yazacak.

## 1. SGK bildirimleri

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| İşe giriş bildirgesi | Çalışma başlamadan **önce** (en geç bir önceki gün) | 5510 md. 8/1 | yüksek |
| İstisna: inşaat, balıkçılık, tarım | En geç çalışmaya başladığı gün | 5510 md. 8/1-a | yüksek |
| İstisna: SGK'ya ilk kez bildirilen işyeri | İlk sigortalının başlangıcından itibaren 1 ay içinde başlayanlar o ayın sonuna kadar | 5510 md. 8/1-b | yüksek |
| İşten ayrılış bildirgesi | Sözleşmenin sona erdiği tarihten itibaren **en geç 10 gün** | 5510 md. 9 | yüksek |
| İş kazası bildirimi | Kazadan sonraki **3 iş günü** (kaza işyeri dışındaysa öğrenildiği günden) | 5510 md. 13, 6331 md. 14 | yüksek |
| Meslek hastalığı bildirimi | Öğrenildiği günden itibaren 3 iş günü | 5510 md. 14 | yüksek |
| Aylık prim ve hizmet belgesi (MUHSGK) | İzleyen ayın 26'sı | SSİY md. 102/3 | yüksek |
| Belge ve kayıt saklama | İlgili yılı izleyen yılbaşından itibaren **10 yıl** | 5510 md. 86/2 | yüksek |

İdari para cezaları (2026, brüt asgari ücret 33.030 TL üzerinden):
- İşe giriş bildirgesi geç verilirse ya da hiç verilmezse sigortalı başına 33.030 TL. Denetimde tespit edilirse 66.060 TL.
- İşten ayrılış bildirgesi geç verilirse sigortalı başına 3.303 TL.
- Bildirge 30 gün içinde kendiliğinden verilir ve ceza 15 günde ödenirse dörtte bir oranında uygulanır.

(5510 md. 102. Oranlar yüksek güven, TL tutarları orta. Uygulama ceza tutarı göstermeyecek, sadece süreyi gösterecek; BRAND.md kuralı gereği korkutma yok.)

## 2. Puantaj ve çalışma süreleri

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| Çalışma sürelerini belgeleme yükümlülüğü | "uygun araçlarla belgelemek zorundadır" | Çalışma Süreleri Yönetmeliği md. 9 | yüksek |
| Haftalık çalışma | En çok 45 saat; günde en çok 11 saat | 4857 md. 63 | yüksek |
| Günlük normal süre (uygulama varsayımı) | 45 saat / 6 gün = 7,5 saat (Cumartesi iş günü). Bu yüzden çalışılan güne en çok 3,5 saat, hafta tatili ya da genel tatilde çalışılan güne en çok 11 saat fazla çalışma yazılır; rapor, izin ve devamsızlık gününe yazılmaz (14 Ekim 2026) | 4857 md. 63, Fazla Çalışma Yön. md. 8 | orta (işyerinin dağılımına bağlı) |
| Ara dinlenme | 4 saate kadar 15 dk, 4–7,5 saat (dahil) 30 dk, 7,5 saatten fazla 1 saat; çalışma süresinden sayılmaz. Uygulamada eşik giriş–çıkış arasındaki brüt süreye göre seçilir (net süreye göre seçmek sınırda çelişiyor; brüt okuma işçi lehine) (14 Ekim 2026) | 4857 md. 68 | yüksek (kural) / orta (eşik yorumu) |
| Puantajın imzalatılması | Zorunlu değil; süreler "uygun araçlarla" belgelenir. İşçi imzalı çizelge fazla çalışma uyuşmazlığında yazılı delil sayılır (Yargıtay yerleşik uygulaması). Uygulamada aylık çizelge giriş–çıkış saatleriyle üretilir, imzalı nüsha dönem klasörüne gider (14 Ekim 2026) | Çalışma Süreleri Yön. md. 9 | orta (içtihat, avukatla teyit) |
| Denkleştirme süresi | 2 ay (TİS ile 4 ay) | 4857 md. 63 | yüksek |
| Hafta tatili | 7 günlük dönem içinde kesintisiz en az 24 saat | 4857 md. 46 | yüksek |

Not: Önceki araştırmada "md. 67" diye geçen dayanak yanlıştı (md. 67 ara dinlenmesiyle ilgili).

Puantaj kodları ve SGK eksik gün eşlemesi:

| Puantaj | Anlamı | SGK eksik gün kodu |
|---|---|---|
| Ç | Çalıştı | — |
| HT | Hafta tatili | — |
| GT | Genel tatil | — |
| Yİ | Yıllık izin (ücretli) | — |
| R | Rapor (istirahat) | 01 İstirahat |
| Üİ | Ücretsiz izin | 21 Diğer ücretsiz izin |
| D | Devamsızlık | 15 Devamsızlık |
| Dİ | Ücretsiz doğum izni | 19 |

Kodlar resmi SGK formundan alındı (orta güven). "Diğer" kodu formda 14, bazı kaynaklarda 13 geçiyor; uygulamada bu kodu kullanmıyoruz. Eşleme muhasebeciye giden Excel'de "öneri" olarak yer alır, son kararı mali müşavir verir.

## 3. Genel tatiller (2429 sayılı Kanun)

- **Sabit:** 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim. 28 Ekim saat 13.00'ten itibaren yarım gün.
- **Ramazan Bayramı:** 3,5 gün, arife 13.00'ten itibaren.
- **Kurban Bayramı:** 4,5 gün, arife 13.00'ten itibaren.

| Yıl | Bayram | Arife (yarım gün) | Bayram günleri |
|---|---|---|---|
| 2026 | Ramazan | 19 Mart | 20–22 Mart |
| 2026 | Kurban | 26 Mayıs | 27–30 Mayıs |
| 2027 | Ramazan | 8 Mart | 9–11 Mart |
| 2027 | Kurban | 15 Mayıs | 16–19 Mayıs |

Kaynak: Diyanet takvimi, yüksek güven. 2028 ve sonrası yılı geldikçe eklenir.

## 4. Yıllık izin

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| Hak kazanma | Deneme süresi dahil en az 1 yıl çalışma | 4857 md. 53 | yüksek |
| Süre | 1–5 yıl (5 dahil) **14**; 5'ten fazla, 15'ten az **20**; 15 ve üstü **26** iş günü | 4857 md. 53 | yüksek |
| Yaş alt sınırı | 18 yaş ve altı, 50 yaş ve üstü en az 20 gün | 4857 md. 53 | yüksek |
| Yer altı işleri | Süreler 4'er gün artar | 4857 md. 53 | yüksek |
| İzne denk gelen tatiller | Hafta tatili, ulusal bayram, genel tatil izinden düşülmez | 4857 md. 56 | yüksek |
| Bölme | İşveren bölemez; anlaşmayla bölünebilir, bir parça en az **10 gün** | 4857 md. 56 | yüksek |
| Yol izni | İzni başka yerde geçirecek işçiye istek ve belgeyle toplam 4 güne kadar ücretsiz. Uygulamada izni izleyen ilk iş günlerine yazılır, puantajda Üİ (SGK 21) olarak eksik gün sayılır; işbaşı bu günlerden sonradır (14 Ekim 2026) | 4857 md. 56 | yüksek |
| Çıkışta izin ücreti | Sözleşme hangi nedenle biterse bitsin kullanılmayan yıllık izin günleri, son ücret üzerinden ödenir. Uygulamada gün çıkış tarihindeki bakiyeden hesaplanır (çıkıştan sonraya taşan izin kullanılmış sayılmaz, uyarı verilir), günlük ücret aylıkta /30, ücret girilmemişse asgari ücret / 30; ödenince işaretlenir (14 Ekim 2026) | 4857 md. 59 | yüksek |
| İzin kayıt belgesi | İşveren tutmak zorunda. Alanlar: işe giriş, izne hak kazanma tarihi, kıdem, süre, başlangıç ve dönüş tarihi, çalışılmayan günler ve nedenleri, işçinin imzası | 4857 md. 56, Yıllık Ücretli İzin Yön. md. 20 + EK-I | orta-yüksek |
| Çalışılmış sayılan süreler | Kaza ve hastalık (sınırlı), doğum izni, hafta tatili ve genel tatiller, kullanılan yıllık izin vb. | 4857 md. 55 | yüksek |
| Kapsam dışı | Mevsimlik ve kampanya işleri | 4857 md. 53 | yüksek |

## 5. Fazla çalışma

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| Tanım | Haftalık 45 saati aşan çalışma | 4857 md. 41 | yüksek |
| Ücret | Saat ücreti %50 fazlası (fazla sürelerle çalışmada %25) | 4857 md. 41 | yüksek |
| Yıllık sınır | Kişi başına **270 saat** | 4857 md. 41, Yön. md. 5 | yüksek |
| Yuvarlama | Yarım saatten az süre yarım saat, yarım saati aşan süre bir saat sayılır | Yön. md. 5 | yüksek |
| İşçi onayı | Yazılı. **Sözleşme yapılırken ya da ihtiyaç doğduğunda** alınır, özlük dosyasında saklanır. İşçi 30 gün önceden yazılı bildirimle geri alabilir | Fazla Çalışma Yön. md. 9 (2017 değişikliği) | yüksek |
| Yasak | 18 yaş altı, sağlığı elvermeyen (raporlu), gebe, yeni doğum yapmış, emziren, kısmi süreli çalışanlara fazla çalışma yaptırılamaz | Yön. md. 8 | yüksek |
| Belge | Fazla çalışma saatleri belgelenir, imzalı nüsha özlükte saklanır, ücret pusulasında gösterilir | Yön. md. 10 | yüksek |
| Serbest zaman | Fazla çalışma saati başına 1,5 saat, 6 ay içinde kullanılır | 4857 md. 41 | yüksek |

**Düzeltme:** "Her yıl başında onay alınır" kuralı 2017'de kaldırıldı. Takvimdeki "1 Ocak'ta tüm çalışanlardan onay al" maddesi çıkarılacak; yerine iş girişinde onay belgesi ve geri alma takibi gelecek.

## 6. İş girişi, çıkışı ve özlük

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| Özlük dosyası | Kimlik bilgileri ve kanunlara göre düzenlenmesi gereken her belge; istendiğinde yetkiliye gösterilir. Saklama süresi 4857'de yok, 5510 md. 86'daki 10 yıl uygulanır | 4857 md. 75 | yüksek |
| Çalışma belgesi | Ayrılan işçiye işin türü ve süresini gösteren belge verilir; geç verilirse tazminat doğar | 4857 md. 28 | yüksek |
| Ücret hesap pusulası | İmzalı ya da işyeri işaretli. Dönem, ekler ve kesintiler ayrı ayrı gösterilir | 4857 md. 37 | yüksek |
| Esaslı değişiklik | Yazılı bildirim; işçi 6 iş günü içinde yazılı kabul etmezse bağlamaz | 4857 md. 22 | yüksek |
| Fesih bildirimi | İşveren yazılı yapar, sebebi açık yazar; davranış ya da verim nedeniyle fesihte önce savunma alınır | 4857 md. 19 | yüksek |
| İhbar süreleri | 6 aydan az kıdem 2 hafta; 6 ay–1,5 yıl 4 hafta; 1,5–3 yıl 6 hafta; 3 yıldan fazla 8 hafta | 4857 md. 17 | yüksek |
| Engelli istihdamı | Özel sektörde 50 ve üzeri işçide %3. Aynı ildeki işyerleri toplanır; yarımdan az kesir dikkate alınmaz, yarım ve üzeri tama yuvarlanır | 4857 md. 30 | yüksek |
| Çıkış nedeni | SGK kod listesi kullanılacak (01–05 en sık; tam liste 01–50) | SGK e-sigorta | yüksek |

## 7. İSG

| Kural | Az tehlikeli | Tehlikeli | Çok tehlikeli | Dayanak | Güven |
|---|---|---|---|---|---|
| Temel eğitim süresi | 8 ders saati | 12 | 16 | İSG Eğitimleri Yön. (RG 2.4.2026) md. 13 | yüksek |
| Temel eğitim tekrarı | 3 yılda bir | 2 yılda bir | yılda bir | aynı yön. md. 14/1 | yüksek |
| Tekrar eğitimi süresi | en az 8 ders saati | 8 | 8 | md. 14/2 | yüksek |
| Periyodik sağlık muayenesi | 5 yılda bir | 3 yılda bir | yılda bir | İşyeri Hekimi Yön. md. 9 | yüksek |
| Risk değerlendirmesi yenileme | 6 yıl | 4 yıl | 2 yıl | Risk Değerlendirmesi Yön. md. 12 | yüksek |
| Acil durum planı yenileme | 6 yıl | 4 yıl | 2 yıl | Acil Durumlar Yön. md. 14 | yüksek |

Diğer İSG kuralları:
- İşe başlama eğitimi: işe başlamadan önce, yüz yüze, **en az 2 saat** (md. 7).
- Yeni çalışanın temel eğitimi: işe başladıktan sonra **en geç 3 ay** içinde (md. 8).
- Altı aydan uzun ara verene işe dönmeden önce bilgi yenileme eğitimi (md. 18). İş kazası ya da meslek hastalığı sonrası işe dönüşte ek eğitim (md. 19). İkisinde de saat belirtilmiyor, uygulama süre koymayacak.
- Çocuk, genç ve gebe çalışanlarda sağlık muayenesi en geç 6 ayda bir.
- Tehlikeli ve çok tehlikeli işlerde işe uygunluk raporu olmadan işe başlatılamaz (6331 md. 15).
- Gece postasında çalışacak kadın işçi için işe başlamadan önce rapor alınır; gebelikten doğuma ve emzirmede doğumdan sonra 1 yıl gece çalışması yasak (orta güven).
- İş kazası ve meslek hastalığının kaydı tutulur, ramak kalalar da incelenir (6331 md. 14). Kazadan sonra risk değerlendirmesi süre beklenmeden yenilenir.
- Tatbikat yılda en az bir kez.

## 8. KVKK

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| İK verisinin hukuki sebebi | Sözleşmenin ifası ve hukuki yükümlülük; sağlık verisi için istihdam ve İSG yükümlülüğü | 6698 md. 5/2-c, ç; md. 6/3-f | yüksek |
| Aydınlatma | Veri sorumlusu, amaç, aktarım, toplama yöntemi ve hukuki sebep, haklar | 6698 md. 10 | yüksek |
| Aydınlatma ile rıza | **Ayrı metinler.** Rızaya dayanmayan işlemler için çalışandan açık rıza istenmez, yalnızca "okudum, bilgi edindim" alınır | KVK Kurulu İlke Kararı 2026/347 (RG 24.3.2026) | yüksek |
| Periyodik imha | En fazla 6 ayda bir | Silme Yön. md. 11 | yüksek |
| Talep üzerine silme | En geç 30 gün | Silme Yön. md. 12 | yüksek |
| İmha kayıtları | En az 3 yıl saklanır | Silme Yön. md. 7 | yüksek |
| VERBİS istisnası | 50'den az çalışan ve 100 milyon TL'den az bilanço (özel nitelikli veri işlemek ana faaliyet değilse) | Kurul kararları 2018/87, 2023/1154, 2025/1572, 2025/2393 | yüksek / orta |

**Düzeltme:** Plandaki "aydınlatma ve açık rıza, imzalı ikisi" yerine şu gelecek: aydınlatma metni + "okudum" kaydı. Açık rıza yalnızca rızaya dayalı ek işlemler için ve isteğe bağlı olacak.

## 9. BES otomatik katılım

| Kural | Değer | Dayanak | Güven |
|---|---|---|---|
| Kapsam | 45 yaşını doldurmamış çalışanlar işe başlayınca otomatik dahil edilir; 45 ve üstü isterse | 4632 ek md. 2 | yüksek |
| Katkı | Prime esas kazancın %3'ü | aynı | yüksek |
| Aktarım | En geç ücret ödeme gününü izleyen iş günü | aynı | yüksek |
| Cayma | Bildirimden itibaren 2 ay | aynı | yüksek |

Uygulama yalnızca "BES'e dahil / caydı" kaydını ve cayma süresini tutar. Kesinti bordroda yapılır.

## 10. 2026 sayısal değerleri (her yıl güncellenir)

| Değer | 2026 | Kaynak | Güven |
|---|---|---|---|
| Brüt asgari ücret (aylık) | 33.030 TL (günlük 1.101) | Asgari Ücret Tespit Komisyonu 2025/1, RG 26.12.2025 | yüksek |
| Net asgari ücret (aylık) | 28.075,50 TL | hesap | orta |
| PEK alt / üst sınır | 33.030 / 297.270 TL | 5510 md. 82 | yüksek / orta |

## Doğrulanamayanlar (koda "kontrol edilmeli" notuyla girer)

1. SGK "Diğer" eksik gün kodu: 13 mü, 14 mü? Uygulamada kullanılmıyor.
2. 23–29 arası eksik gün kodları ve 2026'daki doğum izni değişikliğiyle yeni bir kod gelip gelmediği.
3. Yıllık izin yönetmeliği EK-I alanlarında 2004'ten sonra değişiklik olup olmadığı.
4. Gece çalışan kadın işçi yönetmeliği md. 7 resmi metinden okunamadı.
5. İSG eğitimlerinin tekrar periyodunun hangi tarihten başlayarak sayıldığı yönetmelikte açık değil. Uygulama son eğitim tarihinden sayacak.
6. BES yönetmeliğinin güncel birleştirilmiş metni okunamadı.
