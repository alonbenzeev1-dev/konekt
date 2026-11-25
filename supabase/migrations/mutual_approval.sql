-- =====================================================================
--  KONEKT — one-tap mutual approval: "אשר ושתף גם את שלי"
--  respond_request gets an optional share_back flag. For a LinkedIn / Instagram
--  request, approving with share_back = true also records an approved request
--  from the approver to the requester, so BOTH people can open each other's link.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
-- =====================================================================

-- the 2-argument version must go, otherwise calls are ambiguous
drop function if exists public.respond_request(uuid, boolean);
drop function if exists public.respond_request(uuid, boolean, boolean);

create function public.respond_request(request_id uuid, accept boolean, share_back boolean default false)
returns public.connection_requests
language plpgsql volatile security definer set search_path = public
as $$
declare
  req public.connection_requests;
  c   public.chats;
  a   uuid;
  b   uuid;
  mine_has   boolean;
  theirs_has boolean;
begin
  update public.connection_requests
     set status = case when accept and expires_at > now() then 'accepted' else 'expired' end
   where id = request_id
     and receiver_id = auth.uid()
     and status = 'pending'
     and not private.is_blocked(sender_id, receiver_id)
  returning * into req;

  if req.id is null then raise exception 'request not found or already handled'; end if;

  if req.status = 'accepted' and req.kind = 'chat' then
    a := least(req.sender_id, req.receiver_id);
    b := greatest(req.sender_id, req.receiver_id);
    delete from public.chats where user_a = a and user_b = b and expires_at <= now();
    insert into public.chats (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set user_a = excluded.user_a  -- keep the open chat
    returning * into c;
    insert into public.messages (chat_id, sender_id, receiver_id, content)
    values (c.id, req.sender_id, req.receiver_id, req.message);
  end if;

  -- "Approve and share mine too": the person who asked for my link also hands me theirs.
  -- The requester only exposed their own link by asking (the send sheet says so), and only
  -- if they have one. It is recorded as an already-approved request from me to them, so
  -- get_connection_link works for me exactly as it does for any approved request.
  if req.status = 'accepted' and share_back and req.kind in ('linkedin', 'instagram') then
    select case req.kind when 'linkedin' then p.linkedin_url is not null else p.instagram_handle is not null end
      into mine_has   from public.profiles p where p.id = req.receiver_id;
    select case req.kind when 'linkedin' then p.linkedin_url is not null else p.instagram_handle is not null end
      into theirs_has from public.profiles p where p.id = req.sender_id;

    if coalesce(mine_has, false) and coalesce(theirs_has, false) then
      -- my own still-pending request for the same thing is replaced by the approved one
      update public.connection_requests set status = 'expired'
       where sender_id = req.receiver_id and receiver_id = req.sender_id
         and kind = req.kind and status = 'pending';
      if not exists (select 1 from public.connection_requests
                      where sender_id = req.receiver_id and receiver_id = req.sender_id
                        and kind = req.kind and status = 'accepted'
                        and created_at > now() - interval '48 hours') then
        insert into public.connection_requests (sender_id, receiver_id, kind, status)
        values (req.receiver_id, req.sender_id, req.kind, 'accepted');
      end if;
    end if;
  end if;
  return req;
end;
$$;

revoke all on function public.respond_request(uuid, boolean, boolean) from public, anon;
grant execute on function public.respond_request(uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
