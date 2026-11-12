\set ON_ERROR_STOP on
begin;
-- Synthetic writes are rolled back, including links, requests, history and outbox.
do $$
declare emp uuid; mgr uuid; handler uuid; other_handler uuid; admin_id uuid; other_mgr uuid;
 token uuid; request_uuid uuid; v integer; result jsonb; draft jsonb;
begin
 select id into emp from public.profiles where active and role='employee' limit 1;
 select manager_id into mgr from kinetria_private.manager_categories where category_id='catalog' limit 1;
 select id into handler from public.profiles where active and role='handler' limit 1;
 select id into other_handler from public.profiles where active and role='handler' and id<>handler and id not in (select assignee_id from kinetria_private.category_routes where category_id='catalog') limit 1;
 select id into admin_id from public.profiles where active and role='admin' limit 1;
 select id into other_mgr from public.profiles where active and role='manager' and id<>mgr and not exists(select 1 from kinetria_private.manager_categories s where s.manager_id=profiles.id and s.category_id='catalog') limit 1;
 assert emp is not null and mgr is not null and handler is not null and other_handler is not null and admin_id is not null and other_mgr is not null,'Seed demo accounts first';
 assert not has_function_privilege('authenticated','public.telegram_bridge(bigint,text,jsonb)','EXECUTE'),'Bridge must not be exposed to authenticated';
 assert not has_function_privilege('anon','public.telegram_bridge(bigint,text,jsonb)','EXECUTE'),'Bridge must not be exposed to anon';
 assert has_function_privilege('service_role','public.telegram_bridge(bigint,text,jsonb)','EXECUTE');
 assert not has_table_privilege('authenticated','public.telegram_links','SELECT');
 perform set_config('request.jwt.claim.sub',emp::text,true);
 token:=public.telegram_link_token();
 perform public.telegram_bridge(900001,'link',jsonb_build_object('token',token));
 begin
   perform public.telegram_bridge(900001,'link',jsonb_build_object('token',token));
   raise exception 'Reused token accepted';
 exception when raise_exception then
   if SQLERRM='Reused token accepted' then raise; end if;
 end;
 insert into public.telegram_links values(900002,mgr),(900003,handler),(900004,other_handler),(900005,admin_id),(900006,other_mgr);
 draft:=jsonb_build_object('key',gen_random_uuid(),'category','catalog','kind','problem','title','Telegram synthetic test','description','One item has two identifiers; synthetic test only.','proposal','Agree on a catalog identifier.','sentiment',5,'tags',jsonb_build_array('telegram-test'),'files',jsonb_build_array(jsonb_build_object('name','test.txt','size',4,'content','dGVzdA==')));
 result:=public.telegram_bridge(900001,'submit',draft); request_uuid:=(result->>'id')::uuid;
 assert (public.telegram_bridge(900001,'submit',draft)->>'id')::uuid=request_uuid,'Submission must be idempotent';
 assert (select count(*) from public.request_attachments where request_id=request_uuid)=1;
 assert (select count(*) from public.telegram_outbox where request_id=request_uuid)=1;
 result:=public.telegram_bridge(900001,'detail',jsonb_build_object('id',request_uuid)); v:=(result->>'version')::integer;
 begin
   perform public.telegram_bridge(900004,'detail',jsonb_build_object('id',request_uuid));
   raise exception 'Unassigned handler read request';
 exception when sqlstate 'PT404' then null; end;
 begin
   perform public.telegram_bridge(900006,'detail',jsonb_build_object('id',request_uuid));
   raise exception 'Foreign manager read request';
 exception when sqlstate 'PT404' then null; end;
 begin
   perform public.telegram_bridge(900001,'assign',jsonb_build_object('id',request_uuid,'version',v,'assignee',handler));
   raise exception 'Employee assigned handler';
 exception when insufficient_privilege or sqlstate '22023' then null; end;
 -- Invalid deadline rolls back assignment too.
 begin
   perform public.telegram_bridge(900002,'assign',jsonb_build_object('id',request_uuid,'version',v,'assignee',handler,'due','invalid'));
   raise exception 'Invalid date accepted';
 exception when invalid_datetime_format then null; end;
 assert (select version from public.requests where requests.id=request_uuid)=v;
 perform public.telegram_bridge(900002,'assign',jsonb_build_object('id',request_uuid,'version',v,'assignee',handler,'due','2026-12-01'));
 result:=public.telegram_bridge(900003,'detail',jsonb_build_object('id',request_uuid)); v:=(result->>'version')::integer;
 assert result->>'due_at'='2026-12-01';
 assert (select snapshot->>'due_at' from public.telegram_outbox where request_id=request_uuid and event='assigned' order by id desc limit 1)='2026-12-01','Assignment event must contain the confirmed date';
 begin
   perform public.telegram_bridge(900002,'assign',jsonb_build_object('id',request_uuid,'version',v-1,'assignee',other_handler));
   raise exception 'Stale version accepted';
 exception when sqlstate 'PT409' then null; end;
 perform public.telegram_bridge(900003,'review',jsonb_build_object('id',request_uuid,'version',v,'status','review')); v:=v+1;
 begin
   perform public.telegram_bridge(900003,'review',jsonb_build_object('id',request_uuid,'version',v,'status','implemented','message',''));
   raise exception 'Empty decision accepted';
 exception when sqlstate '22023' then null; end;
 perform public.telegram_bridge(900003,'review',jsonb_build_object('id',request_uuid,'version',v,'status','clarification','message','Which identifiers?')); v:=v+1;
 perform public.telegram_bridge(900001,'review',jsonb_build_object('id',request_uuid,'version',v,'action','replied','message','SYN-001 and SYN001')); v:=v+1;
 perform public.telegram_bridge(900003,'review',jsonb_build_object('id',request_uuid,'version',v,'status','implemented','message','Synthetic result: agreed SYN-001; alias SYN001 retained.')); v:=v+1;
 perform public.telegram_bridge(900001,'ack',jsonb_build_object('id',request_uuid,'version',v));
 assert (select acknowledged_at is not null and decision is not null from public.requests where requests.id=request_uuid);
 assert (select count(*) from public.request_events where request_id=request_uuid)>=7;
 -- A second request verifies former handler loses access on reassignment.
 draft:=jsonb_set(draft,'{key}',to_jsonb(gen_random_uuid()));
 result:=public.telegram_bridge(900001,'submit',draft); request_uuid:=(result->>'id')::uuid;
 select version into v from public.requests where requests.id=request_uuid;
 perform public.telegram_bridge(900002,'assign',jsonb_build_object('id',request_uuid,'version',v,'assignee',handler));
 select version into v from public.requests where requests.id=request_uuid;
 perform public.telegram_bridge(900002,'assign',jsonb_build_object('id',request_uuid,'version',v,'assignee',other_handler));
 begin
   perform public.telegram_bridge(900003,'detail',jsonb_build_object('id',request_uuid));
   raise exception 'Former handler retained access';
 exception when sqlstate 'PT404' then null; end;
 assert public.telegram_bridge(900001,'claim','{"update":900001}')='true'::jsonb;
 assert public.telegram_bridge(900001,'claim','{"update":900001}')='"busy"'::jsonb;
 assert public.telegram_bridge(900001,'claim','{"update":900002}')='"busy"'::jsonb;
 perform public.telegram_bridge(900001,'finish','{"update":900001,"done":true}');
 assert public.telegram_bridge(900001,'claim','{"update":900001}')='false'::jsonb;
 perform public.telegram_bridge(900001,'unlink');
 begin
   perform public.telegram_bridge(900001,'list'); raise exception 'Unlinked user retained access';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS Telegram: one-time identity, bridge grants, files, idempotency, RBAC, atomic assignment/deadline, stale version, clarification/reply, decision/ack, reassignment revocation, webhook replay, unlink';
end $$;
rollback;
