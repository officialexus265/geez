-- Chat threads & messages policies (idempotent)

drop policy if exists "Users read own threads" on public.chat_threads;
create policy "Users read own threads"
  on public.chat_threads for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','support','finance')
    )
  );

drop policy if exists "Users insert own threads" on public.chat_threads;
create policy "Users insert own threads"
  on public.chat_threads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own threads" on public.chat_threads;
create policy "Users update own threads"
  on public.chat_threads for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','support')
    )
  );

drop policy if exists "Users read thread messages" on public.chat_messages;
create policy "Users read thread messages"
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('super_admin','admin','support','finance')
          )
        )
    )
  );

drop policy if exists "Users insert thread messages" on public.chat_messages;
create policy "Users insert thread messages"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('super_admin','admin','support')
          )
        )
    )
  );
