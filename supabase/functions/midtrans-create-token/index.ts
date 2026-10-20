// Midtrans Snap Token Creator - JournalingTrade (Sandbox Environment)
// Runs as a Supabase Edge Function.
// Uses Midtrans Sandbox API to create payment tokens safely.

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
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.github.io');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization,content-type,apikey',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
};

const respond = (data: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(data), { status, headers: cors(origin) });

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || '';
  const hdrs   = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: hdrs });
  if (req.method !== 'POST') return new Response(JSON.stringify({ detail: 'Method not allowed' }), { status: 405, headers: hdrs });

  try {
    const auth = req.headers.get('Authorization') || '';
    if (!/^Bearer \S{10,8192}$/.test(auth)) throw new Fail(401, 'Sign in to continue');

    let body: Record<string, unknown> = {};
    const text = await req.text();
    if (text.length > 8192) throw new Fail(413, 'Request too large');
    try { body = JSON.parse(text || '{}'); } catch { throw new Fail(422, 'Invalid JSON'); }

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

    const baseUsd = interval === 'annual' ? PLANS[plan].usdYear : PLANS[plan].usdMonth;
    const taxUsd  = Math.round(baseUsd * 0.11 * 100) / 100; // 11% PPN tax
    const totalUsd = baseUsd + taxUsd;
    const idrAmount = Math.round(totalUsd * RATE_IDR_PER_USD);
    const periodLabel = interval === 'annual' ? 'per year' : 'per month';

    const orderSuffix = Math.floor(Date.now() / 1000);
    const orderId = `jt-${plan}-${interval}-${user.id.slice(0, 8)}-${orderSuffix}`;

    // Midtrans Sandbox Server Key
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || '';
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
          price:    Math.round(baseUsd * RATE_IDR_PER_USD),
          quantity: 1,
          name:     `JournalingTrade ${plan.toUpperCase()} - $${baseUsd} USD ${periodLabel}`,
        },
        {
          id:       `tax-ppn`,
          price:    Math.round(taxUsd * RATE_IDR_PER_USD),
          quantity: 1,
          name:     `PPN 11% ($${taxUsd} USD)`,
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
      custom_field1: user.id,
      custom_field2: plan,
      custom_field3: interval,
    };

    const snapRes = await fetch(SNAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
        'Accept':        'application/json',
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
    if (err instanceof Fail) return respond({ detail: err.message }, err.status, origin);
    console.error('Unexpected error:', err);
    return respond({ detail: 'Payment service error. Try again.' }, 503, origin);
  }
}

if (import.meta.main) Deno.serve(handler);
