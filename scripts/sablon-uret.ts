// Uygulamayla gelen örnek şablonları üretir: npx tsx scripts/sablon-uret.ts
// Çıktı templates/ altına yazılır ve repoya girer; kullanıcı Ayarlar'dan
// kendi şablonunu yükleyerek bunların yerine kendi metnini kullanabilir.
// Yer tutucular {AD} biçiminde (docxtemplater). Metinlerde hiçbir şirkete ya da
// kişiye ait bilgi yoktur; şirket ve çalışan bilgileri belge üretilirken dolar.
//
// Belirli süreli sözleşme (templates/sozlesme-belirli-sureli.docx) Word'de
// hazırlanmış ayrı bir dosyadır, bu betik onu üretmez.

import { writeFileSync } from "node:fs";
import { docxPaketle, imzaTablosu, paragraf, tablo } from "../src/lib/docx";

const baslik = (m: string) => paragraf(m, { kalin: true, ortala: true, boyut: 13, sonra: 240 });
const ara = (m: string) => paragraf(m, { kalin: true, sonra: 80 });
const metin = (m: string) => paragraf(m, { sonra: 160 });

// ── Belirsiz süreli iş sözleşmesi ───────────────────────────────────

const belirsiz = [
  baslik("BELİRSİZ SÜRELİ İŞ SÖZLEŞMESİ"),
  ara("TARAFLAR:"),
  metin(
    "İşbu iş sözleşmesi, {SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} (bundan sonra “İşveren” olarak anılacaktır) ile {ADRES} adresinde ikamet eden {TC} T.C. kimlik numaralı {AD_SOYAD} (bundan sonra “İşçi” olarak anılacaktır) arasında, tarafların kendi istek ve serbest iradeleriyle, 4857 sayılı İş Kanunu’nun 8. ve 11. maddeleri gereğince aşağıdaki şartlarla “BELİRSİZ SÜRELİ İŞ SÖZLEŞMESİ” olarak yapılmıştır.",
  ),
  ara("SÖZLEŞMENİN SÜRESİ:"),
  metin(
    "Bu iş sözleşmesi {IMZA_TARIHI} tarihinde imzalanmış olup İşçi {BASLAMA_TARIHI} tarihinde işe başlayacaktır. Sözleşme belirsiz sürelidir.",
  ),
  ara("DENEME SÜRESİ:"),
  metin(
    "Sözleşmenin ilk 2 (iki) ayı deneme süresidir. Deneme süresi içinde taraflar sözleşmeyi bildirim süresine gerek olmaksızın ve tazminatsız feshedebilir; İşçinin çalıştığı günler için ücret ve diğer hakları saklıdır (4857 sayılı Kanun md. 15).",
  ),
  ara("YAPILACAK İŞİN KONUSU:"),
  metin(
    "İşçi, İşverenin işyerinde “{MESLEK}” olarak çalışacak; yürürlükteki mevzuata, bu sözleşmeye ve işyerinde uygulanan çalışma koşullarına ve kurallarına uygun biçimde iş görmeyi taahhüt eder. İşveren de iş görme ediminin karşılığında bu sözleşmede kararlaştırılan ücreti ödeyecektir.",
  ),
  ara("ÜCRET:"),
  metin(
    "İşveren, İşçiye bu sözleşme kapsamındaki çalışmasına karşılık {UCRET} net ücret ödeyecektir. Ücret, işyerinde uygulanan usul ve tarihlerde banka yoluyla ödenir; ücret en geç ayda bir ödenir (4857 sayılı Kanun md. 32).",
  ),
  ara("ÇALIŞMA SÜRELERİ:"),
  metin(
    "Haftalık çalışma süresi en çok 45 saattir ve haftanın çalışılan günlerine bölünerek uygulanır; günlük çalışma süresi 11 saati aşamaz. İşin niteliğine göre işe başlama ve bitiş saatleri ile ara dinlenmeleri Kanun’daki süreler gözetilerek İşveren belirler. Fazla çalışma, İşçinin onayı alınarak ve Kanun’daki sınırlar içinde yaptırılır.",
  ),
  ara("ÇALIŞMA YERİ VE KOŞULLARI:"),
  metin(
    "İşveren, İşçiyi ücret ve özlük hakları saklı kalmak kaydıyla, 4857 sayılı Kanun hükümleri çerçevesinde ve İşçinin özel durumunu gözeterek işyerinin bulunduğu il içindeki diğer işyerlerinde görevlendirebilir. Çalışma koşullarında esaslı değişiklik ancak İşçiye yazılı olarak bildirilip İşçinin yazılı kabulüyle yapılabilir (4857 sayılı Kanun md. 22).",
  ),
  ara("ÖZEL HÜKÜMLER:"),
  metin(
    "İşçi, işe giriş sırasında verdiği bilgilerin doğru ve eksiksiz olduğunu; adres, medeni hal ve aile durumundaki değişiklikleri 15 gün içinde İşverene bildireceğini kabul eder. Adres değişikliği bildirilmezse özlük dosyasındaki adrese yapılan tebligatlar geçerli sayılır.",
  ),
  metin(
    "İşçi, kendisine yazılı olarak bildirilen işyeri kurallarına, görev tanımına ve işle ilgili talimatlara uymakla yükümlüdür.",
  ),
  metin(
    "İşçi, iş sağlığı ve güvenliği konusunda kendisine verilen eğitim, bilgilendirme ve talimatlara uyar; düzenlenen eğitimlere katılır ve iş kazası riski gördüğünde durumu derhal amirine bildirir (6331 sayılı Kanun md. 19).",
  ),
  metin(
    "İşçi, 6098 sayılı Türk Borçlar Kanunu’nun 396. maddesi gereğince işi özenle yapmak ve İşverenin haklı menfaatlerini korumakla yükümlüdür. İşçi, iş ilişkisi süresince ve sona erdikten sonra, işi sırasında öğrendiği üretim ve iş sırlarını kendi ya da başkası yararına kullanamaz ve açıklayamaz.",
  ),
  metin(
    "İşçi, kendisine teslim edilen araç, gereç ve malzemeyi özenle kullanır; iş sözleşmesi sona erdiğinde teslim aldığı demirbaşları eksiksiz iade eder.",
  ),
  metin(
    "İşçi iş sözleşmesi devam ettiği sürece İşverenin yazılı onayı olmadan İşverenle rekabet eden bir işte çalışmayacağını kabul eder.",
  ),
  metin(
    "İşverenin sözleşme gereği olmaksızın teşvik amacıyla yaptığı süreklilik arz etmeyen ödemeler kazanılmış hak niteliğinde değildir.",
  ),
  metin(
    "İşçinin kişisel verileri, ayrıca verilen aydınlatma metninde açıklanan amaçlarla ve 6698 sayılı Kişisel Verilerin Korunması Kanunu’na uygun olarak işlenir.",
  ),
  ara("FESİH VE TAZMİNATLAR:"),
  metin(
    "Taraflardan biri sözleşmeyi feshetmek isterse, 4857 sayılı Kanun’un 17. maddesindeki bildirim sürelerine uyarak karşı tarafa yazılı bildirimde bulunur. Bildirim süresine uyulmaması ve Kanun’un 24. ya da 25. maddesindeki haklı bir nedenin bulunmaması halinde, fesheden taraf ihbar tazminatı öder. Kıdem tazminatı, yürürlükteki mevzuata göre hak kazanılması halinde ödenir.",
  ),
  ara("SON HÜKÜMLER:"),
  metin(
    "Bu sözleşmede yer almayan hususlarda 4857 sayılı İş Kanunu, 6098 sayılı Türk Borçlar Kanunu, 6331 sayılı İş Sağlığı ve Güvenliği Kanunu ve ilgili diğer mevzuat uygulanır. Uyuşmazlıklarda işverenin merkezinin bulunduğu yer mahkemeleri ve icra daireleri yetkilidir.",
  ),
  metin(
    "Bu sözleşme {IMZA_TARIHI} tarihinde 2 (iki) nüsha olarak düzenlenmiş, taraflarca okunup kabul edilerek imzalanmıştır.",
  ),
  paragraf("", { sonra: 240 }),
  imzaTablosu("İŞVEREN VEYA VEKİLİ", "İŞÇİ"),
].join("");

// ── KVKK aydınlatma metni ───────────────────────────────────────────
// Yapı kullanıcının örneğinden; amaçlar istihdama göre. Kural: aydınlatma
// ile açık rıza ayrı metin, burada yalnızca "okudum" alınır (MEVZUAT.md §8).

const aydinlatma = [
  baslik("ÇALIŞAN AYDINLATMA METNİ"),
  metin(
    "6698 sayılı Kişisel Verilerin Korunması Kanunu (“Kanun”) ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ gereğince; İşverende çalışan kişilerin adı, soyadı, T.C. kimlik numarası, doğum yeri ve tarihi, adresi, telefon numarası, e-posta adresi, eğitim ve askerlik bilgileri, ücret ve banka hesap bilgileri, adli sicil kaydı, sağlık raporları ve iş kazası kayıtları gibi kişiyi tanıtan her türlü bilgi ve belge kişisel veri kapsamındadır.",
  ),
  metin(
    "Bu kişisel veriler, “Veri Sorumlusu” sıfatıyla {SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} (“İşveren”) tarafından aşağıda açıklanan kapsamda işlenir.",
  ),
  ara("1. Kişisel Verilerin Hangi Amaçla İşleneceği"),
  metin(
    "İş sözleşmesinin kurulması ve yürütülmesi; işe giriş ve işten ayrılış bildirgeleri başta olmak üzere sosyal güvenlik ve vergi mevzuatından doğan bildirimlerin yapılması; ücret ve diğer ödemelerin hesaplanması ve ödenmesi; puantaj, yıllık izin ve fazla çalışma kayıtlarının tutulması; işe giriş ve periyodik sağlık muayeneleri, eğitimler ve iş kazası bildirimleri dahil iş sağlığı ve güvenliği yükümlülüklerinin yerine getirilmesi; özlük dosyasının mevzuatta öngörülen süre boyunca saklanması ve yetkili kurumların bilgi ve belge taleplerinin karşılanması.",
  ),
  ara("2. İşlenen Kişisel Verilerin Kimlere ve Hangi Amaçla Aktarılabileceği"),
  metin(
    "Kişisel verileriniz, yukarıdaki amaçlarla ve gerektiği ölçüde; Sosyal Güvenlik Kurumu, Gelir İdaresi Başkanlığı, Çalışma ve Sosyal Güvenlik Bakanlığı ve diğer yetkili kamu kurum ve kuruluşlarına; İşverenin hizmet aldığı mali müşavir, iş güvenliği uzmanı, işyeri hekimi ve ortak sağlık güvenlik birimine; ücret ödemesi için bankalara ve hukuki uyuşmazlık halinde yargı mercilerine aktarılabilir.",
  ),
  ara("3. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi"),
  metin(
    "Kişisel verileriniz işe giriş sırasında ve iş ilişkisi süresince sizden, ilgili kamu kurumlarından ve işyeri kayıtlarından sözlü, yazılı ve elektronik yollarla toplanır. Hukuki sebepler: Kanun’un 5. maddesinin 2. fıkrasındaki kanunlarda açıkça öngörülmesi (a), sözleşmenin kurulması ve ifası (c), veri sorumlusunun hukuki yükümlülüğü (ç) ve meşru menfaat (f) sebepleri; sağlık verileri için Kanun’un 6. maddesinin 3. fıkrası kapsamında istihdam, iş sağlığı ve güvenliği ve sosyal güvenlik alanlarındaki hukuki yükümlülükler.",
  ),
  ara("4. Veri Sahibinin Kanun’un 11. Maddesinde Sayılan Hakları"),
  metin(
    "Kanun’un 11. maddesi uyarınca, yazılı olarak veya Kişisel Verileri Koruma Kurulu’nun belirlediği diğer yöntemlerle İşverene başvurarak; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, Kanun’un 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme, bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.",
  ),
  paragraf("", { sonra: 120 }),
  metin(
    "Kişisel verilerimin kim tarafından, hangi amaçla işleneceği, kimlere ve hangi amaçla aktarılabileceği, toplama yöntemi ve hukuki sebebi ile Kanun’un 11. maddesindeki haklarım konusunda hazırlanan bu Aydınlatma Metnini okudum ve bilgi edindim.",
  ),
  paragraf("", { sonra: 120 }),
  metin("Adı Soyadı: {AD_SOYAD}"),
  metin("T.C. Kimlik No: {TC}"),
  metin("Tarih: {TARIH}"),
  metin("İmza:"),
].join("");

// ── Açık rıza beyanı (isteğe bağlı) ─────────────────────────────────
// Yalnızca rızaya dayanan ek işlemler; vermemek iş ilişkisini etkilemez.

const riza = [
  baslik("AÇIK RIZA BEYANI"),
  metin(
    "{SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} (“İşveren”) tarafından, Çalışan Aydınlatma Metni ile kişisel verilerimin işlenmesi hakkında bilgilendirildim. Aşağıdaki işlem, iş sözleşmesinin yürütülmesi ya da kanuni bir yükümlülük için gerekli değildir ve yalnızca açık rızama dayanır.",
  ),
  ara("Rızaya dayanan işlem"),
  metin(
    "Fotoğraf, görüntü ve ses kayıtlarımın; İşverenin tanıtım faaliyetlerinde, internet sitesinde, kurumsal sosyal medya hesaplarında, basılı ve görsel yayınlarında ve İşverenin müşterileri için yürüttüğü işlerde (film, reklam ve video çekimleri dahil) kullanılması ve yayınlanması.",
  ),
  metin(
    "Bu rızayı vermemem ya da daha sonra geri almam, iş ilişkime hiçbir şekilde etki etmez. Rızamı İşverene yazılı olarak bildirerek her zaman geri alabilirim; geri alma, o tarihten sonraki işlemler için geçerli olur.",
  ),
  paragraf("", { sonra: 120 }),
  metin("☐  Açık rıza veriyorum.          ☐  Açık rıza vermiyorum."),
  paragraf("", { sonra: 120 }),
  metin("Adı Soyadı: {AD_SOYAD}"),
  metin("T.C. Kimlik No: {TC}"),
  metin("Tarih: {TARIH}"),
  metin("İmza:"),
].join("");

// ── Fazla çalışma onay belgesi (Fazla Çalışma Yön. md. 9) ──────────

const fazlaCalisma = [
  baslik("FAZLA ÇALIŞMA ONAY BELGESİ"),
  metin(
    "{SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} (“İşveren”) işyerinde çalışmaktayım. 4857 sayılı İş Kanunu’nun 41. maddesi ve İş Kanununa İlişkin Fazla Çalışma ve Fazla Sürelerle Çalışma Yönetmeliği gereğince, ihtiyaç duyulduğunda yılda toplam 270 saati aşmamak üzere fazla çalışma ve fazla sürelerle çalışma yapmayı kabul ediyorum.",
  ),
  metin(
    "Fazla çalışmada saat ücretimin yüzde elli, fazla sürelerle çalışmada yüzde yirmi beş fazlası ödenir. İstersem ücret yerine fazla çalıştığım her saat için bir saat otuz dakika, fazla sürelerle çalıştığım her saat için bir saat on beş dakika serbest zamanı altı ay içinde kullanabilirim.",
  ),
  metin("Bu onayı, otuz gün önceden İşverene yazılı olarak bildirmek kaydıyla geri alabileceğimi biliyorum."),
  paragraf("", { sonra: 120 }),
  metin("Adı Soyadı: {AD_SOYAD}"),
  metin("T.C. Kimlik No: {TC}"),
  metin("Tarih: {TARIH}"),
  metin("İmza:"),
].join("");

// ── Çalışma belgesi (4857 md. 28) ───────────────────────────────────

const calismaBelgesi = [
  baslik("ÇALIŞMA BELGESİ"),
  metin(
    "{AD_SOYAD} (T.C. Kimlik No: {TC}), {SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} işyerinde {BASLAMA_TARIHI} ile {BITIS_TARIHI} tarihleri arasında “{MESLEK}” olarak çalışmıştır.",
  ),
  metin("Bu belge, 4857 sayılı İş Kanunu’nun 28. maddesi gereğince işten ayrılışında işçiye verilmiştir."),
  paragraf("", { sonra: 120 }),
  metin("Tarih: {TARIH}"),
  paragraf("", { sonra: 240 }),
  imzaTablosu("İŞVEREN VEYA VEKİLİ", "TESLİM ALAN İŞÇİ"),
].join("");

// ── Zimmet tutanağı ─────────────────────────────────────────────────
// Eşya satırı {#ESYALAR}…{/ESYALAR} döngüsüyle tekrarlanır (docxtemplater).

const zimmet = [
  baslik("ZİMMET TUTANAĞI"),
  metin(
    "{SIRKET_ADRESI} adresinde bulunan {SIRKET_UNVANI} (“İşveren”) tarafından, {TC} T.C. kimlik numaralı {AD_SOYAD} adlı çalışana aşağıdaki eşyalar sağlam ve çalışır halde teslim edilmiştir.",
  ),
  tablo(
    [4200, 2600, 2200],
    [
      [
        { metin: "Eşya", kalin: true, golge: true },
        { metin: "Seri / demirbaş no", kalin: true, golge: true },
        { metin: "Teslim tarihi", kalin: true, golge: true },
      ],
      [{ metin: "{#ESYALAR}{ESYA}" }, { metin: "{SERI_NO}" }, { metin: "{VERILIS}{/ESYALAR}" }],
    ],
  ),
  paragraf("", { sonra: 160 }),
  metin(
    "Çalışan, bu eşyaları özenle kullanacağını, işten ayrılırken ya da istendiğinde eksiksiz iade edeceğini ve kendi kusuruyla doğan zararları karşılayacağını kabul eder.",
  ),
  metin("Tarih: {TARIH}"),
  paragraf("", { sonra: 240 }),
  imzaTablosu("TESLİM EDEN (İŞVEREN)", "TESLİM ALAN (ÇALIŞAN)"),
].join("");

const cikti = process.argv[2] ?? "templates";
writeFileSync(`${cikti}/sozlesme-belirsiz-sureli.docx`, docxPaketle(belirsiz));
writeFileSync(`${cikti}/kvkk-aydinlatma.docx`, docxPaketle(aydinlatma));
writeFileSync(`${cikti}/kvkk-acik-riza.docx`, docxPaketle(riza));
writeFileSync(`${cikti}/fazla-calisma-onayi.docx`, docxPaketle(fazlaCalisma));
writeFileSync(`${cikti}/calisma-belgesi.docx`, docxPaketle(calismaBelgesi));
writeFileSync(`${cikti}/zimmet-tutanagi.docx`, docxPaketle(zimmet));
console.log("Şablonlar yazıldı:", cikti);
