-- 22 Eylül 2026: (1) meslek artık dönem bazlı — aynı kişi farklı
-- projelere farklı meslek koduyla girebiliyor; kisi.meslek_* "son
-- kullanılan meslek" olarak kalır (yeni girişte varsayılan). Mevcut
-- dönemler kişinin kayıtlı mesleğiyle doldurulur.
-- (2) ücretin günlük/aylık ve net/brüt olduğu açıkça tutulur. Eski
-- kayıtlarda ikisi de null — o durumda ucret_tutari eskisi gibi dönemin
-- toplam tutarı sayılır.
-- (3) muhasebe maillerinde geçen şirket unvanı.

alter table is_girisi
  add column meslek_kodu text,
  add column meslek_adi text,
  add column ucret_periyodu text check (ucret_periyodu in ('gunluk', 'aylik')),
  add column ucret_tipi text check (ucret_tipi in ('net', 'brut'));

update is_girisi g
set meslek_kodu = k.meslek_kodu,
    meslek_adi = k.meslek_adi
from kisi k
where g.kisi_id = k.id;

-- (Unvan Ayarlar sayfasından girilir; varsayılan değer yok.)
alter table ayarlar
  add column sirket_unvani text;
