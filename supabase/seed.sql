-- Tastamam örnek verisi (demo). Kişiler, şirket ve TC numaraları kurgudur.
-- Gerçek bir kurulumda ÇALIŞTIRMA; yalnızca denemek ya da ekran görüntüsü
-- almak için boş bir Supabase projesinde kullan:
--   npx supabase db push --include-seed   (ya da SQL Editor'e yapıştır)

update ayarlar set
  sirket_unvani = 'Örnek Yapım Ltd. Şti.',
  sirket_adresi = 'Örnek Mah. Defter Sok. No:1 Kadıköy / İstanbul',
  mali_musavir_email = 'musavir@example.com',
  gonderen_email = 'ik@example.com',
  isg_email = 'isg@example.com',
  acik_moduller = array['puantaj', 'izin']
where id = true;

insert into kisi (id, ad_soyad, tc_kimlik_no, meslek_kodu, meslek_adi, adres) values
  ('00000000-0000-4000-8000-000000000001', 'Ayşe Demir',    '99000000010', '3521.21', 'Montajcı (Kurgucu)',            'Örnek Mah. 1. Sok. No:3 Kadıköy / İstanbul'),
  ('00000000-0000-4000-8000-000000000002', 'Murat Kaya',    '99000000020', '3521.02', 'Kameraman',                     null),
  ('00000000-0000-4000-8000-000000000003', 'Elif Şahin',    '99000000030', '4110.03', 'Büro Memuru (Genel)',           null),
  ('00000000-0000-4000-8000-000000000004', 'Can Yıldız',    '99000000040', '3521.03', 'Kameraman Yardımcısı',          null),
  ('00000000-0000-4000-8000-000000000005', 'Deniz Aydın',   '99000000050', '3521.02', 'Kameraman',                     null),
  ('00000000-0000-4000-8000-000000000006', 'Zeynep Arslan', '99000000060', '4311.06', 'Ön Muhasebeci',                 null),
  ('00000000-0000-4000-8000-000000000007', 'Burak Öztürk',  '99000000070', '2163.03', 'Tasarımcı-Kostüm',              null),
  ('00000000-0000-4000-8000-000000000008', 'Selin Koç',     '99000000080', '7531.07', 'Kostümcü (Sahne Ve Stüdyo)',    null);

insert into is_girisi (id, kisi_id, durum, giris_tarihi, cikis_tarihi, cikis_nedeni, ucret_tutari, ucret_periyodu, ucret_tipi, meslek_kodu, meslek_adi, odeme_durumu, odeme_tarihi) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'aktif', '2021-11-03', null, null, 48500, 'aylik', 'net', '3521.21', 'Montajcı (Kurgucu)', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'pasif', '2026-09-01', '2026-10-07', 'Proje/sözleşme bitişi', 1400, 'gunluk', 'net', '3521.02', 'Kameraman', 'yok', null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'aktif', '2025-06-02', null, null, 1250, 'gunluk', 'net', '4110.03', 'Büro Memuru (Genel)', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'aktif', '2026-07-15', null, null, 1400, 'gunluk', 'net', '3521.03', 'Kameraman Yardımcısı', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'aktif', '2023-10-20', null, null, 42000, 'aylik', 'net', '3521.02', 'Kameraman', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'aktif', '2019-01-11', null, null, 52000, 'aylik', 'net', '4311.06', 'Ön Muhasebeci', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 'aktif', '2024-03-04', null, null, 1600, 'gunluk', 'net', '2163.03', 'Tasarımcı-Kostüm', 'yoksayildi', null),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 'aktif', '2026-10-12', null, null, 1250, 'gunluk', 'net', '7531.07', 'Kostümcü (Sahne Ve Stüdyo)', 'yoksayildi', null),
  -- Önceki dönem: aynı kişi farklı tarihlerde yeniden işe girebiliyor.
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000003', 'pasif', '2024-03-11', '2024-04-30', 'Proje/sözleşme bitişi', 1000, 'gunluk', 'net', '4110.03', 'Büro Memuru (Genel)', 'var', '2024-05-03');

-- Özlük evrakı: çoğu tam, birkaç eksik (ana sayfadaki "N eksik" örnekleri için).
insert into kisi_belge (kisi_id, belge_tipi, durum)
select k.id, t.tip, 'var'
from kisi k
cross join (values ('adli_sicil'), ('askerlik_durum'), ('ikametgah'), ('mezuniyet'), ('nufus_kayit'), ('kimlik')) as t(tip)
where k.id::text like '00000000-0000-4000-8000-%';

update kisi_belge set durum = 'yok'
where (kisi_id = '00000000-0000-4000-8000-000000000003' and belge_tipi = 'ikametgah')
   or (kisi_id = '00000000-0000-4000-8000-000000000008' and belge_tipi in ('ikametgah', 'mezuniyet', 'kimlik'));

update kisi_belge set durum = 'yoksayildi'
where belge_tipi = 'askerlik_durum'
  and kisi_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
                  '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
                  '00000000-0000-4000-8000-000000000008');

insert into is_girisi_belge (is_girisi_id, belge_tipi, durum)
select g.id, t.tip, 'var'
from is_girisi g
cross join (values ('isegiris_bildirgesi'), ('sozlesme'), ('imzali_ciktisi')) as t(tip)
where g.id::text like '10000000-0000-4000-8000-%';

insert into is_girisi_belge (is_girisi_id, belge_tipi, durum) values
  ('10000000-0000-4000-8000-000000000009', 'istenayrilis_bildirgesi', 'var'),
  ('10000000-0000-4000-8000-000000000009', 'ibraname', 'var');

insert into isg_belge (kisi_id, belge_tipi, durum, alinma_tarihi, gecerlilik_tarihi) values
  ('00000000-0000-4000-8000-000000000001', 'isg_egitim_sertifikasi', 'var', '2025-11-15', '2027-11-15'),
  ('00000000-0000-4000-8000-000000000003', 'isg_egitim_sertifikasi', 'var', '2025-06-10', '2027-06-10'),
  ('00000000-0000-4000-8000-000000000004', 'isg_egitim_sertifikasi', 'var', '2026-07-22', '2028-07-22'),
  ('00000000-0000-4000-8000-000000000005', 'isg_egitim_sertifikasi', 'var', '2024-11-02', '2026-11-02'),
  ('00000000-0000-4000-8000-000000000006', 'isg_egitim_sertifikasi', 'var', '2025-01-20', '2027-01-20'),
  ('00000000-0000-4000-8000-000000000007', 'isg_egitim_sertifikasi', 'var', '2024-03-18', '2026-03-18');

-- Doğum tarihleri: yıllık izinde yaş kuralını göstermek için biri 50 üstü, biri 18 yaşında.
update kisi set dogum_tarihi = v.d::date
from (values
  ('00000000-0000-4000-8000-000000000001', '1990-04-12'),
  ('00000000-0000-4000-8000-000000000003', '1996-09-30'),
  ('00000000-0000-4000-8000-000000000004', '2008-02-03'),
  ('00000000-0000-4000-8000-000000000005', '1988-12-01'),
  ('00000000-0000-4000-8000-000000000006', '1974-06-21'),
  ('00000000-0000-4000-8000-000000000007', '1993-01-15')
) as v(id, d)
where kisi.id = v.id::uuid;

-- Yıllık izinler (gün: Pazar ve genel tatiller hariç).
insert into yillik_izin (kisi_id, baslangic, bitis, gun, form_durumu, dosya_adi) values
  ('00000000-0000-4000-8000-000000000005', '2026-10-05', '2026-10-09', 5, 'var', '2026.10.05_DenizAydın_yillik_izin.pdf'),
  ('00000000-0000-4000-8000-000000000007', '2026-09-14', '2026-09-18', 5, 'yok', null),
  ('00000000-0000-4000-8000-000000000003', '2026-08-17', '2026-08-21', 5, 'var', '2026.08.17_ElifŞahin_yillik_izin.pdf'),
  ('00000000-0000-4000-8000-000000000001', '2026-08-03', '2026-08-07', 5, 'var', '2026.08.03_AyşeDemir_yillik_izin.pdf'),
  -- Önceki yıllar (bakiyede "devreden" doğru görünsün diye).
  ('00000000-0000-4000-8000-000000000001', '2023-07-10', '2023-07-21', 10, 'var', null),
  ('00000000-0000-4000-8000-000000000001', '2024-07-22', '2024-08-02', 11, 'var', null),
  ('00000000-0000-4000-8000-000000000001', '2025-07-21', '2025-08-01', 11, 'var', null),
  ('00000000-0000-4000-8000-000000000005', '2025-08-11', '2025-08-15', 5, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2020-08-03', '2020-08-15', 12, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2021-08-02', '2021-08-14', 12, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2022-08-01', '2022-08-13', 12, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2023-08-07', '2023-08-19', 12, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2024-08-05', '2024-08-17', 12, 'var', null),
  ('00000000-0000-4000-8000-000000000006', '2025-08-04', '2025-08-23', 18, 'var', null);

-- Ekim 2026 puantajında elle girilen günler.
insert into puantaj_gun (kisi_id, tarih, kod, fazla_saat) values
  ('00000000-0000-4000-8000-000000000003', '2026-10-07', 'R', 0),
  ('00000000-0000-4000-8000-000000000004', '2026-10-13', 'R', 0),
  ('00000000-0000-4000-8000-000000000007', '2026-10-02', 'Üİ', 0),
  ('00000000-0000-4000-8000-000000000007', '2026-10-08', 'D', 0),
  ('00000000-0000-4000-8000-000000000002', '2026-10-05', null, 2);

-- Bir çalışanın yıllık fazla çalışması 270 saat sınırına yaklaşsın (uyarı örneği):
-- 2026'da her Salı ve Perşembe 3 saat.
insert into puantaj_gun (kisi_id, tarih, kod, fazla_saat)
select '00000000-0000-4000-8000-000000000001', g::date, null, 3
from generate_series('2026-01-01'::date, '2026-10-12'::date, '1 day') as g
where extract(isodow from g) in (2, 4)
  and g::date not in ('2026-01-01', '2026-04-23', '2026-05-19', '2026-05-28', '2026-07-15');

-- Eylül 2026 kapanmış ve muhasebeye gönderilmiş.
insert into puantaj_ay (ay, kapandi_at, gonderildi_at) values
  ('2026-09-01', '2026-10-01 09:12+03', '2026-10-01 09:12+03');

-- ── Faz D paket 1 (0026): İSG, iş kazası, takvim ─────────────────────
update ayarlar set
  acik_moduller = array['puantaj', 'izin', 'isg', 'takvim'],
  isg_tehlike_sinifi = 'tehlikeli',
  hatirlatma_gun = 3,
  takip_email = 'takip@example.com'
where id = true;

-- Önümüzdeki hafta işe başlayacak iki kişi (takvimde SGK giriş bildirgesi).
insert into kisi (id, ad_soyad, tc_kimlik_no, meslek_kodu, meslek_adi) values
  ('00000000-0000-4000-8000-000000000009', 'Mert Ateş', '99000000090', '3521.03', 'Kameraman Yardımcısı'),
  ('00000000-0000-4000-8000-000000000010', 'Emre Tunç', '99000000100', '7411.01', 'Elektrikçi (Genel)');
insert into is_girisi (id, kisi_id, durum, giris_tarihi, ucret_tutari, ucret_periyodu, ucret_tipi, meslek_kodu, meslek_adi, odeme_durumu) values
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000009', 'aktif', '2026-10-21', 1400, 'gunluk', 'net', '3521.03', 'Kameraman Yardımcısı', 'yoksayildi'),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010', 'aktif', '2026-10-21', 1500, 'gunluk', 'net', '7411.01', 'Elektrikçi (Genel)', 'yoksayildi');

-- İşe başlama eğitimi (oryantasyon) ve sağlık raporları.
insert into isg_belge (kisi_id, belge_tipi, durum, alinma_tarihi) values
  ('00000000-0000-4000-8000-000000000001', 'oryantasyon_formu', 'var', '2021-11-03'),
  ('00000000-0000-4000-8000-000000000003', 'oryantasyon_formu', 'var', '2025-06-02'),
  ('00000000-0000-4000-8000-000000000004', 'oryantasyon_formu', 'var', '2026-07-15'),
  ('00000000-0000-4000-8000-000000000005', 'oryantasyon_formu', 'var', '2023-10-20'),
  ('00000000-0000-4000-8000-000000000006', 'oryantasyon_formu', 'var', '2019-01-11'),
  ('00000000-0000-4000-8000-000000000007', 'oryantasyon_formu', 'var', '2024-03-04'),
  ('00000000-0000-4000-8000-000000000001', 'saglik_raporu', 'var', '2024-10-28'),
  ('00000000-0000-4000-8000-000000000003', 'saglik_raporu', 'var', '2025-05-30'),
  ('00000000-0000-4000-8000-000000000004', 'saglik_raporu', 'var', '2026-07-10'),
  ('00000000-0000-4000-8000-000000000005', 'saglik_raporu', 'var', '2023-10-24'),
  ('00000000-0000-4000-8000-000000000006', 'saglik_raporu', 'var', '2025-01-15'),
  ('00000000-0000-4000-8000-000000000007', 'saglik_raporu', 'var', '2024-03-01');

insert into isyeri_belge (tip, yapilma_tarihi, dosya_adi) values
  ('risk_degerlendirmesi', '2024-03-12', '2024.03.12_risk.pdf'),
  ('acil_durum_plani', '2024-03-12', '2024.03.12_acil.pdf'),
  ('tatbikat', '2025-11-20', '2025.11.20_tatbikat.pdf');

-- Can Yıldız'ın 12 Ekim kazası: haber verildi, tutanak ve rapor yüklendi,
-- SGK bildirimi bekliyor. İstirahat puantaja R olarak düşer.
delete from puantaj_gun where kisi_id = '00000000-0000-4000-8000-000000000004' and tarih = '2026-10-13';
insert into is_kazasi (kisi_id, tur, olay_tarihi, olay_saati, yer, aciklama, yaralanma, saglik_kurulusu,
  istirahat_bas, istirahat_bit, taniklar, haber_verildi_at, tutanak_dosya, rapor_dosya) values
  ('00000000-0000-4000-8000-000000000004', 'is_kazasi', '2026-10-12', '14:20', 'Stüdyo 2, ışık iskelesi',
   'Işık iskelesine çıkarken merdivenin ayağı kaydı, yaklaşık 1,5 metreden düştü.', 'Sol bilekte burkulma',
   'Örnek Devlet Hastanesi acil servis', '2026-10-13', '2026-10-15', 'Deniz Aydın, Ayşe Demir',
   '2026-10-12 16:05+03', '2026.10.12_canyildiz_kaza_tutanak.pdf', '2026.10.12_canyildiz_kaza_rapor.pdf');
insert into is_kazasi (kisi_id, tur, olay_tarihi, yer, aciklama, taniklar, haber_verildi_at, tutanak_dosya) values
  ('00000000-0000-4000-8000-000000000007', 'ramak_kala', '2026-08-26', 'Kostüm deposu',
   'Üst raftan düşen kutu Burak''ın yanına düştü, kimse yaralanmadı. Raf sabitlendi.', 'Selin Koç',
   '2026-08-26 11:30+03', '2026.08.26_burakozturk_kaza_tutanak.pdf');

-- ── Faz D paket 2 (0029): koşullu belgeler, ücret pusulası, KVKK ────
-- Takip Eylül 2026'dan başlasın (eski aylar için pusula istenmesin).
update ayarlar set belge_takip_baslangic = '2026-09-01', kvkk_acik_riza = true where id = true;

-- Ayşe Demir'in fazla çalışma onayı imzalı; Murat Kaya'nınki yok (puantajda uyarı).
insert into is_girisi_belge (is_girisi_id, belge_tipi, durum) values
  ('10000000-0000-4000-8000-000000000001', 'fazla_calisma_onayi', 'var');

-- KVKK aydınlatma metni: çoğu imzalı, yeni başlayanlarda eksik.
insert into kisi_belge (kisi_id, belge_tipi, durum)
select k.id, 'kvkk_aydinlatma', 'var' from kisi k
where k.id::text in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007');

-- Eylül 2026 ücret pusulaları: çoğu imzalı.
insert into ucret_pusulasi (kisi_id, ay, dosya_adi) values
  ('00000000-0000-4000-8000-000000000001', '2026-09-01', '2026.09.01_aysedemir_ucret_pusulasi.pdf'),
  ('00000000-0000-4000-8000-000000000003', '2026-09-01', '2026.09.01_elifsahin_ucret_pusulasi.pdf'),
  ('00000000-0000-4000-8000-000000000005', '2026-09-01', '2026.09.01_denizaydin_ucret_pusulasi.pdf'),
  ('00000000-0000-4000-8000-000000000006', '2026-09-01', '2026.09.01_zeyneparslan_ucret_pusulasi.pdf');

-- ── Faz D paket 3 (0030): durumlar ve zimmet ─────────────────────────
update kisi set engelli = true where id = '00000000-0000-4000-8000-000000000006';
update kisi set bes_katilim = '2021-11-03' where id = '00000000-0000-4000-8000-000000000001';
update kisi set bes_katilim = '2026-10-12' where id = '00000000-0000-4000-8000-000000000008';

insert into kisi_durum (kisi_id, tur, baslangic, bitis, tamamlandi, notu) values
  ('00000000-0000-4000-8000-000000000005', 'gece_raporu', '2024-11-20', '2026-11-20', null, 'Gece çekimleri için'),
  ('00000000-0000-4000-8000-000000000007', 'kosul_degisikligi', '2026-10-12', null, null, 'Çalışma saatleri 09.00–18.00 yerine 10.00–19.00');

insert into zimmet (kisi_id, esya, seri_no, verilis, iade) values
  ('00000000-0000-4000-8000-000000000004', 'Dizüstü bilgisayar', 'DB-0042', '2026-07-15', null),
  ('00000000-0000-4000-8000-000000000004', 'Stüdyo giriş kartı', null, '2026-07-15', null),
  ('00000000-0000-4000-8000-000000000002', 'Telsiz', 'TS-07', '2026-09-01', null),
  ('00000000-0000-4000-8000-000000000001', 'Kurgu istasyonu anahtarı', null, '2021-11-03', '2024-05-10');
