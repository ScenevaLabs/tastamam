-- Sabah hatırlatma maili isteğe bağlı (15 Ekim 2026). Kapalıysa takvim yine
-- çalışır, yalnızca mail gitmez.
alter table ayarlar
  add column if not exists hatirlatma_maili boolean not null default true;
