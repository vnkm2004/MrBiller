-- All support operations go through the Edge Function so it can validate
-- a visitor token or an authenticated shop/admin before returning any data.
create policy "deny direct access to support conversations"
  on public.support_conversations for all to anon, authenticated
  using (false)
  with check (false);

create policy "deny direct access to support messages"
  on public.support_messages for all to anon, authenticated
  using (false)
  with check (false);
