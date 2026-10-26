const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const {PGlite} = await import(process.env.JT_PGLITE_MODULE || 'file:///C:/Users/Maulana%20Riski/Documents/Codex/2026-10-07/bac/pro-db-runtime/node_modules/@electric-sql/pglite/dist/index.js');
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema journal_private;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated, service_role;
      insert into auth.users values ('${owner}'),('${other}');`);
    for (const file of ['20261022010000_founder_groq_daily_quota.sql', '20261026020000_groq_usage_ownership.sql']) {
      await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));
    }
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
    for (const operation of ['get','consume']) {
      await assert.rejects(() => db.query(`select public.journal_${operation}_groq_daily_usage($1)`, [other]), /ownership/);
    }
    for (let used=1; used<=5; used++) {
      const response=await db.query('select public.journal_consume_groq_daily_usage() as usage');
      assert.equal(response.rows[0].usage.used, used);
    }
    await assert.rejects(() => db.query('select public.journal_consume_groq_daily_usage()'), /exhausted/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select public.journal_consume_groq_daily_usage($1) as usage',[other])).rows[0].usage.used,1);
    await db.exec('reset role; set role anon');
    await assert.rejects(() => db.query('select public.journal_get_groq_daily_usage()'), /permission denied/);
    console.log('Groq quota SQL: cross-user calls denied, cap enforced, service role allowed, anonymous access denied.');
  } finally { await db.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
