alter table ayarlar
  add column ms_refresh_token text,
  add column ms_access_token text,
  add column ms_access_token_expires_at timestamptz;
