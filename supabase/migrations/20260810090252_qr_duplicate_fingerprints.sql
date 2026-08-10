create extension if not exists pgcrypto with schema extensions;

alter table public.lidl_cards
  add column if not exists qr_fingerprint text,
  add column if not exists qr_image_hash text;

update public.lidl_cards
set qr_image_hash = encode(extensions.digest(qr_object_path, 'sha256'), 'hex')
where qr_object_path is not null
  and qr_image_hash is null;

create unique index if not exists lidl_cards_qr_fingerprint_unique_idx
  on public.lidl_cards (qr_fingerprint)
  where qr_fingerprint is not null;

create unique index if not exists lidl_cards_qr_image_hash_unique_idx
  on public.lidl_cards (qr_image_hash)
  where qr_image_hash is not null;
