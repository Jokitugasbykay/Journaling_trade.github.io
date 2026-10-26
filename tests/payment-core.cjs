const assert=require('node:assert/strict');
globalThis.Deno={env:{get:key=>({MIDTRANS_SERVER_KEY:'fixture-sandbox-secret',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'}[key] || '')}};
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',key='33333333-3333-4333-8333-333333333333';
(async()=>{
  const {handler}=await import('../supabase/functions/midtrans-create-token/index.ts');
  const {handler:webhook}=await import('../supabase/functions/midtrans-webhook/index.ts');
  const {decodeOrder}=await import('../supabase/functions/midtrans-create-token/core.ts');
  let owner=uid,auth=true,paid=false,order=null,chargeCount=0,events=[];
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;
    if(path==='/auth/v1/user')return Response.json(auth?{id:owner,email:'fixture@example.test',user_metadata:{}}:{},{status:auth?200:401});
    if(path.endsWith('/journal_rate_limit')){assert.deepEqual(JSON.parse(options.body),{p_bucket:'pro_api',p_limit:120,p_window_seconds:60});return Response.json(true);}
    if(path.endsWith('/journal_record_midtrans_checkout')){events.push(JSON.parse(options.body).p_event);return Response.json({plan:'pro'});}
    if(path==='/v2/charge'){
      assert.equal(options.headers['X-Override-Notification'],'https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1/midtrans-webhook');
      chargeCount++;const payload=JSON.parse(options.body);assert.equal(payload.transaction_details.gross_amount,320000);assert.equal(payload.payment_type,'qris');
      order={order_id:payload.transaction_details.order_id,merchant_id:'fixture-merchant',gross_amount:'320000.00',currency:'IDR',status_code:'201',transaction_id:key,transaction_status:'pending',payment_type:'qris',
        transaction_time:'2026-10-26 10:00:00',actions:[{name:'generate-qr-code',url:'https://api.sandbox.midtrans.com/v2/qris/fixture/qr-code'}]};return Response.json(order);
    }
    if(path.endsWith('/status'))return order?Response.json({...order,status_code:paid?'200':'201',transaction_status:paid?'settlement':'pending',settlement_time:'2026-01-31 10:01:00'}):Response.json({status_code:'404'},{status:404});
    throw new Error('Unexpected request: '+path);
  };
  const send=(body,origin='https://jokitugasbykay.github.io')=>handler(new Request('https://example.test/midtrans-create-token',{method:'POST',headers:{Origin:origin,Authorization:'Bearer fixture-authenticated-token','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)}));
  const selection={plan:'pro',interval:'monthly',billing:{name:'Fixture'},gross_amount:1};
  let response=await send({...selection,action:'quote'});assert.equal(response.status,200);assert.equal((await response.json()).quote.amount,320000);assert.equal(chargeCount,0);
  assert.equal((await send(selection,'https://unrelated.github.io')).status,403);assert.equal((await send([])).status,422);
  auth=false;assert.equal((await send({...selection,action:'charge',payment_method:'qris'})).status,401);auth=true;
  response=await send({...selection,action:'charge',payment_method:'qris'});assert.equal(response.status,200);const created=await response.json();
  assert.equal(created.status,'pending');assert.equal(created.amount,320000);assert.ok(created.order_id.length<=50);assert.equal(decodeOrder(created.order_id).userId,uid);
  assert.equal(decodeOrder(created.order_id).plan,'pro');assert.equal(decodeOrder(created.order_id).interval,'monthly');
  response=await send({...selection,action:'charge',payment_method:'qris'});assert.equal(response.status,200);assert.equal(chargeCount,1,'Retry duplicated a provider charge');
  owner=other;assert.equal((await send({...selection,action:'status',order_id:created.order_id})).status,404);owner=uid;
  assert.equal((await send({...selection,action:'charge',payment_method:'bca'})).status,409);
  const notify=async()=>{
    const payload={order_id:order.order_id,status_code:'200',gross_amount:order.gross_amount,transaction_id:key,transaction_status:paid?'settlement':'pending',transaction_time:order.transaction_time,custom_field1:other,custom_field2:'plus',custom_field3:'annual'};
    payload.signature_key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-512',new TextEncoder().encode(payload.order_id+payload.status_code+payload.gross_amount+'fixture-sandbox-secret'))),b=>b.toString(16).padStart(2,'0')).join('');
    return webhook(new Request('https://example.test/webhook',{method:'POST',body:JSON.stringify(payload)}));
  };
  assert.equal((await notify()).status,200);assert.equal(events.length,0,'Pending payment modified subscription');
  paid=true;assert.equal((await notify()).status,200);assert.equal(events.length,1);assert.equal(events[0].user_id,uid);assert.equal(events[0].plan,'pro');assert.equal(events[0].interval,'monthly');
  assert.equal(events[0].period_start,'2026-01-31T03:01:00.000Z');assert.equal(events[0].period_end,'2026-02-28T03:01:00.000Z');
  assert.equal((await webhook(new Request('https://example.test/webhook',{method:'POST',body:JSON.stringify({order_id:order.order_id,signature_key:'invalid'})}))).status,403);
  console.log('Custom checkout: server quote, sandbox charge, retry idempotency, cross-user denial, method conflict, verified subscription event and pending safety passed (provider fixtures).');
})().catch(error=>{console.error(error);process.exitCode=1;});
