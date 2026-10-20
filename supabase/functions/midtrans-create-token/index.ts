// Midtrans Snap Token Creator – JournalingTrade
// Runs as a Supabase Edge Function. Server Key lives in MIDTRANS_SERVER_KEY env secret.
// Never expose Server Key to the browser.

const PROJECT  = 'https://nmddjuqkdyhcobddinkc.supabase.co';
const SITE     = 'https://jokitugasbykay.github.io';
const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions'; // switch to production later

class Fail extends Error { constructor(public status: number, msg: string) { super(msg); } }

// Price catalogue (in IDR – Midtrans requires IDR)
// USD display prices are converted server-side using a fixed rate to avoid
// live FX dependency. Adjust RATE or move to a lookup when going live.
const RATE_IDR_PER_USD = 16_000; // 1 USD = Rp 16.000 (adjust as needed)
const PLANS: Record<string, { usdMonth: number; usdYear: number }> = {
  plus: { usdMonth: 10, usdYear: 100 },
  pro:  { usdMonth: 20, usdYear: 200 },
};

const cors = (origin: string) => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
  'Access-Control-Allow-Origin': origin === SITE ? origin : SITE,
  'Access-Control-Allow-Headers': 'authorization,content-type,apikey',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
});

const respond = (data: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(data), { status, headers: cors(origin) });

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || '';
  const hdrs   = cors(origin);

  if (origin && origin !== SITE) return new Response(JSON.stringify({ detail: 'Origin not allowed' }), { status: 403, headers: hdrs });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: hdrs });
  if (req.method !== 'POST') return new Response(JSON.stringify({ detail: 'Method not allowed' }), { status: 405, headers: hdrs });

  try {
    // 1. Auth check
    const auth = req.headers.get('Authorization') || '';
    if (!/^Bearer \S{10,8192}$/.test(auth)) throw new Fail(401, 'Sign in to continue');

    // 2. Parse request body
    let body: Record<string, unknown> = {};
    const text = await req.text();
    if (text.length > 4096) throw new Fail(413, 'Request too large');
    try { body = JSON.parse(text || '{}'); } catch { throw new Fail(422, 'Invalid JSON'); }

    const plan     = (body.plan     as string || '').toLowerCase();
    const interval = (body.interval as string || 'monthly').toLowerCase();
    if (!PLANS[plan]) throw new Fail(422, 'Invalid plan. Must be plus or pro');
    if (!['monthly', 'annual'].includes(interval)) throw new Fail(422, 'Invalid interval. Must be monthly or annual');

    // 3. Verify JWT and get user info from Supabase
    const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const userRes = await fetch(PROJECT + '/auth/v1/user', {
      headers: { apikey: apiKey, Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) throw new Fail(401, 'Invalid authentication token');
    const user = await userRes.json();
    if (!user?.id || !user?.email) throw new Fail(401, 'Invalid user data');

    // 4. Calculate price in IDR
    const usdAmount = interval === 'annual' ? PLANS[plan].usdYear : PLANS[plan].usdMonth;
    const idrAmount = usdAmount * RATE_IDR_PER_USD;
    const periodLabel = interval === 'annual' ? 'per year' : 'per month';

    // 5. Build idempotency key from user+plan+interval+date
    // This prevents duplicate transactions on double-click
    const dateKey   = new Date().toISOString().slice(0, 13); // hour-level
    const orderId   = `jt-${plan}-${interval}-${user.id.slice(0, 8)}-${dateKey.replace(/[^0-9]/g, '')}`;

    // 6. Get Midtrans Server Key from environment
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || '';
    if (!serverKey) throw new Fail(503, 'Payment provider not configured');
    const authHeader = 'Basic ' + btoa(serverKey + ':');

    // 7. Create Snap transaction
    const snapPayload = {
      transaction_details: {
        order_id:     orderId,
        gross_amount: idrAmount,
      },
      item_details: [{
        id:       `${plan}-${interval}`,
        price:    idrAmount,
        quantity: 1,
        name:     `JournalingTrade ${plan.charAt(0).toUpperCase() + plan.slice(1)} – $${usdAmount} USD ${periodLabel}`,
      }],
      customer_details: {
        email:      user.email,
        first_name: (user.user_metadata?.full_name || user.email).split(' ')[0],
      },
      custom_field1: user.id,   // stored in notification for webhook mapping
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
      throw new Fail(502, 'Could not create payment session. Try again.');
    }

    return respond({ token: snapData.token, redirect_url: snapData.redirect_url, order_id: orderId }, 200, origin);

  } catch (err) {
    if (err instanceof Fail) return respond({ detail: err.message }, err.status, origin);
    console.error('Unexpected error:', err);
    return respond({ detail: 'Payment service error. Try again.' }, 503, origin);
  }
}

if (import.meta.main) Deno.serve(handler);
