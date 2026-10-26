// Midtrans Payment Notification Webhook - JournalingTrade (Sandbox Environment)
// Receives payment status from Midtrans server-to-server.
// Verifies SHA-512 signature, then calls journal_record_subscription RPC to update user plan.

import {decodeOrder,sandboxKey} from '../midtrans-create-token/core.ts';
const PROJECT = 'https://nmddjuqkdyhcobddinkc.supabase.co';

class Fail extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

function mapStatus(txStatus: string, fraudStatus: string): string {
  if (txStatus === 'capture' && fraudStatus === 'accept') return 'active';
  if (txStatus === 'settlement') return 'active';
  if (txStatus === 'pending') return 'trialing';
  if (['cancel', 'deny', 'expire'].includes(txStatus)) return 'cancelled';
  if (txStatus === 'refund') return 'cancelled';
  return 'cancelled';
}

async function sha512hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return respond({ detail: 'Method not allowed' }, 405);

  try {
    // Midtrans Sandbox Server Key
    const serverKey = await sandboxKey();
    if (!serverKey) throw new Fail(503, 'Payment provider not configured');

    const rawBody = await req.text();
    if (rawBody.length > 65536) throw new Fail(413, 'Payload too large');

    let notif: Record<string, unknown>;
    try { notif = JSON.parse(rawBody); }
    catch { throw new Fail(422, 'Invalid JSON'); }

    let { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status,
            transaction_id, transaction_time,
            custom_field1: userId, custom_field2: plan, custom_field3: interval } = notif as Record<string, string>;

    const expectedSig = await sha512hex(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (!signature_key || !timingSafeEqual(signature_key.toLowerCase(), expectedSig.toLowerCase())) {
      console.error('Signature mismatch for order:', order_id);
      throw new Fail(403, 'Invalid webhook signature');
    }

    const decoded=decodeOrder(String(order_id));
    if(String(order_id).startsWith('jtc_') && !decoded)throw new Fail(422,'Invalid checkout order');
    const verified=await fetch('https://api.sandbox.midtrans.com/v2/'+encodeURIComponent(order_id)+'/status',{
      headers:{Authorization:'Basic '+btoa(serverKey+':'),Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!verified.ok)throw new Fail(503,'Payment verification unavailable');
    const actual=await verified.json();
    const stored=actual.metadata?.journalingtrade;
    const owned=decoded || {userId:stored?.user_id || actual.custom_field1,plan:stored?.plan || actual.custom_field2,interval:stored?.interval || actual.custom_field3};
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(owned.userId)) || !['plus','pro'].includes(owned.plan) || !['monthly','annual'].includes(owned.interval))throw new Fail(422,'Verified payment ownership unavailable');
    const base=owned.plan==='plus'?(owned.interval==='annual'?100:10):(owned.interval==='annual'?200:20);
    const actualAmount = Number(actual.gross_amount);
    const isValidAmount =
      (stored?.amount && actualAmount === Number(stored.amount)) ||
      (stored?.rate && actualAmount === Math.round(base * Number(stored.rate))) ||
      ([Math.round(base * 16000), Math.round(base * 1.11 * 16000)].includes(actualAmount)) ||
      (Number.isFinite(actualAmount) && actualAmount >= base * 10000 && actualAmount <= base * 35000);
    if(actual.order_id!==order_id || actual.transaction_id!==transaction_id || !isValidAmount || actual.currency!=='IDR')throw new Fail(403,'Payment details do not match checkout');
    // Pending/failed orders cannot overwrite an existing paid subscription.
    if(!['refund','chargeback'].includes(actual.transaction_status) && actual.transaction_status!=='settlement' && !(actual.transaction_status==='capture' && actual.fraud_status==='accept'))return respond({ok:true,status:actual.transaction_status});
    userId=owned.userId;plan=owned.plan;interval=owned.interval;transaction_status=actual.transaction_status;fraud_status=actual.fraud_status;
    transaction_time=actual.settlement_time || actual.transaction_time;gross_amount=actual.gross_amount;

    if (!userId || !plan || !interval || !transaction_id || !order_id) {
      throw new Fail(422, 'Missing required fields in notification');
    }
    if (!['plus', 'pro'].includes(plan)) throw new Fail(422, 'Invalid plan in notification');
    if (!['monthly', 'annual'].includes(interval)) throw new Fail(422, 'Invalid interval in notification');

    const subStatus = mapStatus(transaction_status, fraud_status || 'accept');
    // Sandbox simulations must not grant paid access on the live application's database by default.
    if(Deno.env.get('MIDTRANS_SANDBOX_ALLOW_ENTITLEMENTS')!=='true')return respond({ok:true,status:subStatus,environment:'sandbox',subscription_applied:false});

    const now = new Date();
    const dated=transaction_time && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(transaction_time)?transaction_time.replace(' ','T')+'+07:00':transaction_time;
    const periodStart = new Date(dated || now.toISOString());
    if(!Number.isFinite(periodStart.getTime()))throw new Fail(422,'Invalid transaction timestamp');
    const periodEnd   = new Date(periodStart);
    const billingDay=periodEnd.getUTCDate();periodEnd.setUTCDate(1);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth()+(interval==='annual'?12:1));
    periodEnd.setUTCDate(Math.min(billingDay,new Date(Date.UTC(periodEnd.getUTCFullYear(),periodEnd.getUTCMonth()+1,0)).getUTCDate()));

    const payloadHash = await sha256hex(JSON.stringify({order_id,transaction_id,transaction_status,gross_amount:String(Number(gross_amount)),userId,plan,interval}));

    // Provider settlement time orders successful events; duplicate status deliveries share one stable hash.
    const eventId = `${transaction_id}-${transaction_status}`;
    const eventTime = !['refund','chargeback'].includes(transaction_status)?periodStart.toISOString():now.toISOString();

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const rpcRes = await fetch(PROJECT + '/rest/v1/rpc/journal_record_midtrans_checkout', {
      method: 'POST',
      headers: {
        'apikey':        serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({p_event:{event_id:eventId,payload_hash:payloadHash,user_id:userId,order_id,
        plan:subStatus==='active'?plan:'free',status:subStatus,interval,period_start:periodStart.toISOString(),period_end:periodEnd.toISOString(),event_at:eventTime}}),
      signal: AbortSignal.timeout(15_000),
    });

    if (!rpcRes.ok) {
      const errData = await rpcRes.json().catch(() => null);
      console.error('RPC error:', errData);
      throw new Fail(502, 'Could not update subscription record');
    }

    return respond({ ok: true, status: subStatus });

  } catch (err) {
    if (err instanceof Fail) return respond({ detail: err.message }, err.status);
    console.error('Webhook error:', err);
    return respond({ detail: 'Webhook processing failed' }, 503);
  }
}

if (import.meta.main) Deno.serve(handler);
