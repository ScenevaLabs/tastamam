-- 14 Ekim 2026 (Faz D testi): kapanan ayın puantajı kapanış anındaki haliyle
-- saklanır. Böylece sonradan eklenen kişi, izin ya da dönem değişikliği
-- muhasebeye gönderilmiş ayın görüntüsünü ve Excel'ini değiştirmez.
-- Ay yeniden açılınca boşaltılır, tekrar kapanınca yeniden yazılır.

alter table puantaj_ay
  add column if not exists anlik jsonb;
