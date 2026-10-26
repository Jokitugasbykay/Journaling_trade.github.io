const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const {PGlite}=await import(process.env.JT_PGLITE_MODULE || 'file:///C:/Users/Maulana%20Riski/Documents/Codex/2026-10-07/bac/pro-db-runtime/node_modules/@electric-sql/pglite/dist/index.js');
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema journal_private;
      create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
      create table journal_private.subscriptions(user_id uuid,provider text,provider_subscription_id text);
      create table journal_private.calls(order_id text);
      create function public.journal_record_subscription(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text[]) returns jsonb language plpgsql as $$begin insert into journal_private.calls values($5);return jsonb_build_object('recorded',true);end$$;`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026010000_custom_checkout_events.sql'),'utf8'));
    const event={user_id:'11111111-1111-4111-8111-111111111111',order_id:'old-order',status:'cancelled'};
    let result=await db.query('select public.journal_record_midtrans_checkout($1::jsonb) as result',[JSON.stringify(event)]);assert.equal(result.rows[0].result.ignored,true);
    await db.query("insert into journal_private.subscriptions values($1,'midtrans','current-order')",[event.user_id]);
    result=await db.query('select public.journal_record_midtrans_checkout($1::jsonb) as result',[JSON.stringify(event)]);assert.equal(result.rows[0].result.ignored,true,'Refund for an older order revoked a current subscription');
    result=await db.query('select public.journal_record_midtrans_checkout($1::jsonb) as result',[JSON.stringify({...event,order_id:'current-order'})]);assert.equal(result.rows[0].result.recorded,true);
    assert.equal((await db.query('select count(*)::int as n from journal_private.calls')).rows[0].n,1);
    await db.exec('set role authenticated');await assert.rejects(()=>db.query('select public.journal_midtrans_sandbox_key()'),/permission denied/);await assert.rejects(()=>db.query('select public.journal_record_midtrans_checkout($1::jsonb)',[JSON.stringify(event)]),/permission denied/);await db.exec('reset role');
    await db.exec('set role anon');await assert.rejects(()=>db.query('select public.journal_record_midtrans_checkout($1::jsonb)',[JSON.stringify(event)]),/permission denied/);await db.exec('reset role');
    console.log('PostgreSQL custom checkout: old-order refund ignored, current-order refund delegated, anonymous/user subscription writes denied.');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
