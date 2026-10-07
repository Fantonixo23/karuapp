-- Politicas de Supabase Realtime para aislamiento por tenant.
--
-- APLICAR A MANO con el rol service_role (SQL editor del dashboard o psql con
-- service key), NO como migracion de node-pg-migrate: toca el schema `realtime`,
-- que es de Supabase, no de la app.
--
-- Requiere ademas activar, en el dashboard del proyecto:
--   Realtime -> Settings -> "Private channels only" = ON
//
-- Como funciona:
--   - El backend emite cada evento con `select realtime.send(payload, evento,
--     'restaurante:<id>', true)` (RealtimeService).
-- - El frontend obtiene un JWT corto en POST /api/auth/realtime-token y lo usa
--   como access_token del canal `restaurante:<id>`.
-- - Esta politica deja leer un topic `restaurante:<id>` solo a quien trae el
--   claim `restaurante_id` igual al id del topic.

alter table realtime.messages enable row level security;

drop policy if exists "karuapp_tenant_messages" on realtime.messages;
create policy "karuapp_tenant_messages"
  on realtime.messages
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'restaurante_id') = split_part(topic, ':', 2)
  );