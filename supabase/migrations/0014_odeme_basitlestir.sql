-- Faz 11 revize (29 Ağustos 2026): ayrı ödeme tablosu (tutar/vade elle
-- girilen, çoklu kayıt) yerine her iş dönemine tek bir ödeme durumu.
-- Kullanıcı tutar/vadeyi zaten kendi ön muhasebe programında takip
-- ediyor -- burada tek soru: sözleşmedeki tutar bankadan gönderildi mi.
drop table if exists odeme;

alter table is_girisi
  add column odeme_durumu text not null default 'yok'
    check (odeme_durumu in ('yok', 'var', 'yoksayildi')),
  add column odeme_tarihi date;
