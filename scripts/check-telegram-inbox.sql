begin;
\ir ../supabase/migrations/20261112181447_telegram_async_inbox.sql
-- 100 different users can be admitted without sharing conversational state.
do $$ begin for n in 1..100 loop perform public.telegram_enqueue(990000000+n,990000+n,jsonb_build_object('update_id',990000000+n)); end loop; end $$;
select public.telegram_enqueue(990000001,990001,'{}');
do $$
declare jobs jsonb; job jsonb; first_job jsonb; n integer:=0;
begin
 if (select count(*) from public.telegram_inbox where id between 990000001 and 990000100)<>100 then raise exception 'Deduplication failed'; end if;
 for batch in 1..10 loop
   jobs:=public.telegram_inbox_claim(10);
   if jsonb_array_length(jobs)<>10 then raise exception 'Parallel claim failed'; end if;
   n:=n+jsonb_array_length(jobs);
 end loop;
 if n<>100 or jsonb_array_length(public.telegram_inbox_claim(10))<>0 then raise exception 'Lease isolation failed'; end if;
 -- A subsequent update from an active chat must wait.
 perform public.telegram_enqueue(990000101,990001,'{}');
 if jsonb_array_length(public.telegram_inbox_claim(10))<>0 then raise exception 'Per-chat serialization failed'; end if;
 select jsonb_build_object('id',id,'token',token) into first_job from public.telegram_inbox where id=990000001;
 perform public.telegram_inbox_finish(990000001,gen_random_uuid(),true);
 if (select done from public.telegram_inbox where id=990000001) then raise exception 'Stale token accepted'; end if;
 perform public.telegram_inbox_finish(990000001,(first_job->>'token')::uuid,false);
 if jsonb_array_length(public.telegram_inbox_claim(10))<>0 then raise exception 'Retry head overtaken'; end if;
 update public.telegram_inbox set available_at=now()-interval '1 second' where id=990000001;
 jobs:=public.telegram_inbox_claim(10);job:=jobs->0;
 if (job->>'id')::bigint<>990000001 then raise exception 'Retry lost'; end if;
 perform public.telegram_inbox_finish(990000001,(first_job->>'token')::uuid,true);
 if (select done from public.telegram_inbox where id=990000001) then raise exception 'Expired worker finished new lease'; end if;
 perform public.telegram_inbox_finish(990000001,(job->>'token')::uuid,true);
 if (select payload from public.telegram_inbox where id=990000001)<>'{}'::jsonb then raise exception 'Payload not cleared'; end if;
 if (public.telegram_inbox_claim(10)->0->>'id')::bigint<>990000101 then raise exception 'Next update not released'; end if;
 -- Globally shared slot and chat cooldown.
 if public.telegram_api_slot('990001')<>0 then raise exception 'First slot denied'; end if;
 if public.telegram_api_slot('990002')<=0 then raise exception 'Global limit missing'; end if;
 if public.telegram_api_slot('990001')<900 then raise exception 'Chat limit missing'; end if;
 perform public.telegram_api_slot('990002',30);
 if public.telegram_api_slot('990003')<29000 then raise exception '429 cooldown missing'; end if;
 if has_function_privilege('anon','public.telegram_inbox_claim(integer)','execute') then raise exception 'Public worker access'; end if;
 if has_table_privilege('authenticated','public.telegram_inbox','select') then raise exception 'Payload exposed'; end if;
end $$;
rollback;
