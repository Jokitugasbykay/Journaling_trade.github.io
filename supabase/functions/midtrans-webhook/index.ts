// Midtrans Payment Notification Webhook – JournalingTrade
// Receives payment status from Midtrans server-to-server.
// Verifies SHA-512 signature, then calls journal_record_subscription RPC to update user plan.
// No auth header needed – Midtrans signs the payload.

const PROJECT = 'https://nmddjuqkdyhcobddinkc.supabase.co';

class Fail extends Error { constructor(public status: number, msg: string) { super(msg); } }

// Map Midtrans transaction_status + fraud_status to our subscription status
function mapStatus(txStatus: string, fraudStatus: string): string {
  if (txStatus === 'capture' && fraudStatus === 'accept') return 'active';
  if (txStatus === 'settlement') return 'active';
  if (txStatus === 'pending') return 'trialing'; // pending payment
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

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return respond({ detail: 'Method not allowed' }, 405);

  try {
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY') || '';
    if (!serverKey) throw new Fail(503, 'Payment provider not configured');

    // 1. Parse raw body (must keep raw for signature verification)
    const rawBody = await req.text();
    if (rawBody.length > 65536) throw new Fail(413, 'Payload too large');

    let notif: Record<string, unknown>;
    try { notif = JSON.parse(rawBody); }
    catch { throw new Fail(422, 'Invalid JSON'); }

    // 2. Verify Midtrans signature
    // signature_key = SHA-512(order_id + status_code + gross_amount + server_key)
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status,
            payment_type, transaction_id, transaction_time,
            custom_field1: userId, custom_field2: plan, custom_field3: interval } = notif as Record<string, string>;

    const expectedSig = await sha512hex(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (!signature_key || signature_key.toLowerCase() !== expectedSig.toLowerCase()) {
      console.error('Signature mismatch for order:', order_id);
      throw new Fail(403, 'Invalid webhook signature');
    }

    // 3. Validate required fields
    if (!userId || !plan || !interval || !transaction_id || !order_id) {
      throw new Fail(422, 'Missing required fields in notification');
    }
    if (!['plus', 'pro'].includes(plan)) throw new Fail(422, 'Invalid plan in notification');
    if (!['monthly', 'annual'].includes(interval)) throw new Fail(422, 'Invalid interval in notification');

    // 4. Determine subscription status
    const subStatus = mapStatus(transaction_status, fraud_status || 'accept');

    // 5. Compute period dates
    const now = new Date();
    const periodStart = new Date(transaction_time || now.toISOString());
    const periodEnd   = new Date(periodStart);
    if (interval === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 6. Hash payload for idempotency
    const payloadHash = await sha256hex(rawBody);

    // 7. Call journal_record_subscription RPC using service role key
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const rpcRes = await fetch(PROJECT + '/rest/v1/rpc/journal_record_subscription', {
      method: 'POST',
      headers: {
        'apikey':        serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({
        p_provider:         'midtrans',
        p_event_id:         transaction_id,
        p_payload_hash:     payloadHash,
        p_user_id:          userId,
        p_subscription_id:  order_id,
        p_plan:             subStatus === 'active' ? plan : 'free',
        p_status:           subStatus,
        p_interval:         interval,
        p_period_start:     periodStart.toISOString(),
        p_period_end:       periodEnd.toISOString(),
        p_event_at:         periodStart.toISOString(),
        p_countries:        [],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!rpcRes.ok) {
      const errData = await rpcRes.json().catch(() => null);
      console.error('RPC error:', errData);
      throw new Fail(502, 'Could not update subscription record');
    }

    console.log(`Subscription updated: user=${userId} plan=${plan} status=${subStatus} order=${order_id}`);
    return respond({ ok: true });

  } catch (err) {
    if (err instanceof Fail) return respond({ detail: err.message }, err.status);
    console.error('Webhook error:', err);
    return respond({ detail: 'Webhook processing failed' }, 503);
  }
}

if (import.meta.main) Deno.serve(handler);
