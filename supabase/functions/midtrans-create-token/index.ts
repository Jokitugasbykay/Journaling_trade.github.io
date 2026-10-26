// Midtrans Snap Token Creator - JournalingTrade (Sandbox Environment)
// Runs as a Supabase Edge Function.
// Uses Midtrans Sandbox API to create payment tokens safely.

import {customCheckout,CoreFailure,sandboxKey} from './core.ts';
const PROJECT  = 'https://nmddjuqkdyhcobddinkc.supabase.co';
const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

class Fail extends Error { constructor(public status: number, msg: string) { super(msg); } }

const RATE_IDR_PER_USD = 16_000;
const PLANS: Record<string, { usdMonth: number; usdYear: number }> = {
  plus: { usdMonth: 10, usdYear: 100 },
  pro:  { usdMonth: 20, usdYear: 200 },
};

const ALLOWED_ORIGINS = [
  'https://jokitugasbykay.github.io',
  'https://journalingtrade.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const cors = (origin: string) => {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization,content-type,apikey,idempotency-key',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
};

const respond = (data: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(data), { status, headers: cors(origin) });

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || '';
  const hdrs   = cors(origin);
  if(origin && !ALLOWED_ORIGINS.includes(origin))return respond({detail:'Origin not allowed'},403,origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: hdrs });
  if (req.method !== 'POST') return new Response(JSON.stringify({ detail: 'Method not allowed' }), { status: 405, headers: hdrs });

  try {
    const auth = req.headers.get('Authorization') || '';
    if (!/^Bearer \S{10,8192}$/.test(auth)) throw new Fail(401, 'Sign in to continue');

    let body: Record<string, unknown> = {};
    const text = await req.text();
    if (text.length > 8192) throw new Fail(413, 'Request too large');
    try { body = JSON.parse(text || '{}'); } catch { throw new Fail(422, 'Invalid JSON'); }
    if(!body || Array.isArray(body) || typeof body!=='object')throw new Fail(422,'Invalid request');
    if(typeof body.plan!=='string' || body.interval!==undefined && typeof body.interval!=='string')throw new Fail(422,'Invalid plan or interval');
    if(body.billing!==undefined && (!body.billing || Array.isArray(body.billing) || typeof body.billing!=='object' || Object.values(body.billing).some(value=>typeof value!=='string' || value.length>500)))throw new Fail(422,'Invalid billing information');

    const plan     = (body.plan     as string || '').toLowerCase();
    const interval = (body.interval as string || 'monthly').toLowerCase();
    const billing  = (body.billing  as Record<string, string> || {});

    if (!PLANS[plan]) throw new Fail(422, 'Invalid plan. Must be plus or pro');
    if (!['monthly', 'annual'].includes(interval)) throw new Fail(422, 'Invalid interval. Must be monthly or annual');

    const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZGRqdXFrZHloY29iZGRpbmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODgzOTMsImV4cCI6MjEwNjk2NDM5M30.iI-EoBKX1KzKmDoM-M60osV4DsgYSceXQZxqbHHPbnw';
    const userRes = await fetch(PROJECT + '/auth/v1/user', {
      headers: { apikey: apiKey, Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) throw new Fail(401, 'Invalid authentication token');
    const user = await userRes.json();
    if (!user?.id || !user?.email) throw new Fail(401, 'Invalid user data');
    const limitRes=await fetch(PROJECT+'/rest/v1/rpc/journal_rate_limit',{method:'POST',headers:{apikey:apiKey,Authorization:auth,'Content-Type':'application/json'},
      body:JSON.stringify({p_bucket:'pro_api',p_limit:120,p_window_seconds:60}),signal:AbortSignal.timeout(10000)});
    if(!limitRes.ok)throw new Fail(503,'Payment verification is temporarily unavailable');
    if(await limitRes.json()!==true)throw new Fail(429,'Too many payment requests. Try again shortly.');

    const baseUsd = interval === 'annual' ? PLANS[plan].usdYear : PLANS[plan].usdMonth;
    const taxUsd  = 0; // PPN dihapus sesuai permintaan
    const totalUsd = baseUsd + taxUsd;
    const idrAmount = Math.round(totalUsd * RATE_IDR_PER_USD);
    const periodLabel = interval === 'annual' ? 'per year' : 'per month';

    const orderSuffix = Math.floor(Date.now() / 1000);
    const orderId = `jt-${plan}-${interval}-${user.id.slice(0, 8)}-${orderSuffix}`;

    // Midtrans Sandbox Server Key
    const serverKey = await sandboxKey();
    if (!serverKey) throw new Fail(503, 'Payment provider not configured');
    const authHeader = 'Basic ' + btoa(serverKey + ':');

    const customerName = billing.name?.trim() || user.user_metadata?.full_name || user.email;

    const snapPayload = {
      transaction_details: {
        order_id:     orderId,
        gross_amount: idrAmount,
      },
      item_details: [
        {
          id:       `${plan}-${interval}`,
          price:    idrAmount,
          quantity: 1,
          name:     `JournalingTrade ${plan.toUpperCase()} - $${baseUsd} USD ${periodLabel}`,
        }
      ],
      customer_details: {
        email:      user.email,
        first_name: customerName.slice(0, 50),
        billing_address: {
          first_name: customerName.slice(0, 50),
          address:    (billing.address || '').slice(0, 100),
          country_code: billing.country === 'ID' ? 'IDN' : (billing.country || 'IDN'),
        }
      },
      metadata: {journalingtrade:{user_id:user.id,plan,interval}},
      custom_field1: user.id,
      custom_field2: plan,
      custom_field3: interval,
    };

    if(body.action!==undefined)return respond(await customCheckout(body,user.id,serverKey,snapPayload,
      {amount:idrAmount,currency:'IDR',base_usd:baseUsd,tax_usd:taxUsd,total_usd:totalUsd,conversion_rate:RATE_IDR_PER_USD},req.headers.get('Idempotency-Key')),200,origin);

    const snapRes = await fetch(SNAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
        'Accept':        'application/json',
        'X-Override-Notification': PROJECT+'/functions/v1/midtrans-webhook',
      },
      body: JSON.stringify(snapPayload),
      signal: AbortSignal.timeout(15_000),
    });

    const snapData = await snapRes.json();
    if (!snapRes.ok || !snapData.token) {
      console.error('Midtrans error:', snapData);
      throw new Fail(502, snapData.error_messages ? snapData.error_messages.join(', ') : 'Could not create payment session. Try again.');
    }

    return respond({ token: snapData.token, redirect_url: snapData.redirect_url, order_id: orderId }, 200, origin);

  } catch (err) {
    if (err instanceof Fail || err instanceof CoreFailure) return respond({ detail: err.message }, err.status, origin);
    console.error('Unexpected error:', err);
    return respond({ detail: 'Payment service error. Try again.' }, 503, origin);
  }
}

if (import.meta.main) Deno.serve(handler);
