-- 14 Ekim 2026: çıkışta ödenecek yıllık izin ücreti (4857 md. 59).
-- Kullanılmayan izin günü çıkış tarihindeki bakiyeden kendiliğinden hesaplanır;
-- burada yalnızca "ödendi" işareti ve ödendiği anda kaç gün olduğu saklanır
-- (sonradan izin kaydı düzeltilirse ödenen gün değişmesin diye).

alter table is_girisi
  add column if not exists izin_ucreti_gun integer check (izin_ucreti_gun >= 0),
  add column if not exists izin_ucreti_odendi_at timestamptz;
