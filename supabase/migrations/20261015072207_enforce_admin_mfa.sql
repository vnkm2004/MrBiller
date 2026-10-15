-- Admin accounts can identify themselves at AAL1 through their own app_admins
-- row, but data access across shops requires a verified MFA session (AAL2).
create policy "administrator access requires aal2"
  on public.shops as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.shop_memberships as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.store_settings as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.products as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.invoices as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.custom_units as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "administrator access requires aal2"
  on public.activity_log as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (
      select 1 from public.app_admins a
      where a.user_id = (select auth.uid())
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );
