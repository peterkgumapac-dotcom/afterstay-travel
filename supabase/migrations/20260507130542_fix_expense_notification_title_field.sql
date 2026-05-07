create or replace function public.handle_expense_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_rec record;
  trip_name text;
begin
  select destination into trip_name from public.trips where id = new.trip_id;

  for member_rec in
    select gm.user_id
    from public.group_members gm
    where gm.trip_id = new.trip_id
      and gm.user_id is not null
      and gm.user_id != coalesce(
        (
          select user_id
          from public.group_members
          where trip_id = new.trip_id
            and name = new.paid_by
          limit 1
        ),
        '00000000-0000-0000-0000-000000000000'::uuid
      )
  loop
    insert into public.notifications (user_id, trip_id, type, title, body, data)
    values (
      member_rec.user_id,
      new.trip_id,
      'expense_added',
      'New expense added',
      coalesce(new.paid_by, 'Someone') || ' spent ₱' || new.amount || ' on ' || coalesce(new.title, 'an expense'),
      jsonb_build_object('expenseId', new.id, 'tripId', new.trip_id)
    );
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_expense_notification() from anon;
revoke execute on function public.handle_expense_notification() from public;
