// Unit tests for Midtrans payment gateway integration and checkout modal
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

console.log('Running Payment Gateway integration & Checkout Modal checks...');

// 1. Verify index.html CSP, Buttons & Checkout Modal
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(html.includes('https://app.sandbox.midtrans.com'), 'CSP must include Midtrans sandbox script/frame/connect domain');
assert.ok(html.includes('https://app.midtrans.com'), 'CSP must include Midtrans production script/frame/connect domain');
assert.ok(html.includes('id="jt-plus-subscribe-btn"'), 'index.html must have Plus subscribe button');
assert.ok(html.includes('id="jt-pro-subscribe-btn"'), 'index.html must have Pro subscribe button');
assert.ok(html.includes('id="checkout-modal"'), 'index.html must have #checkout-modal');
assert.ok(html.includes('Atur paket Anda'), 'index.html checkout modal must have title Atur paket Anda');
assert.ok(html.includes('id="jt-card-monthly"'), 'checkout modal must have monthly plan card');
assert.ok(html.includes('id="jt-card-annual"'), 'checkout modal must have annual plan card');
assert.ok(html.includes('id="jt-checkout-pay-btn"'), 'checkout modal must have Berlangganan pay button');
assert.ok(html.includes('js/payment.js'), 'index.html must include js/payment.js script');

console.log('PASS: index.html CSP, subscribe buttons, and #checkout-modal verified');

// 2. Verify payment.js contents
const paymentJs = fs.readFileSync(path.join(root, 'js', 'payment.js'), 'utf8');
assert.ok(paymentJs.includes('midtrans-create-token'), 'payment.js must reference token creation endpoint');
assert.ok(paymentJs.includes('Mid-client-eIKqYJoLSaZC9Sip'), 'payment.js must contain validated Client Key');
assert.ok(paymentJs.includes('openCheckoutModal'), 'payment.js must define openCheckoutModal');
assert.ok(paymentJs.includes('executeCheckoutPayment'), 'payment.js must define executeCheckoutPayment');
assert.ok(paymentJs.includes('app.sandbox.midtrans.com/snap/snap.js'), 'payment.js must load Snap.js');
assert.ok(paymentJs.includes('window.jtPayment'), 'payment.js must export window.jtPayment');

console.log('PASS: js/payment.js client setup and checkout modal logic verified');

// 3. Verify Edge Function: midtrans-create-token
const createTokenTs = fs.readFileSync(path.join(root, 'supabase', 'functions', 'midtrans-create-token', 'index.ts'), 'utf8');
const coreTs=fs.readFileSync(path.join(root,'supabase/functions/midtrans-create-token/core.ts'),'utf8');
assert.ok(createTokenTs.includes('await sandboxKey()') && coreTs.includes('MIDTRANS_SERVER_KEY'), 'checkout must use the backend secret loader');
assert.ok(!/Mid-server-[A-Za-z0-9_-]+/.test(createTokenTs+coreTs), 'sandbox server keys must not be embedded in source');
assert.ok(createTokenTs.includes('app.sandbox.midtrans.com/snap/v1/transactions'), 'midtrans-create-token must call Snap API');
assert.ok(createTokenTs.includes('taxUsd'), 'midtrans-create-token must calculate 11% PPN tax');

console.log('PASS: supabase/functions/midtrans-create-token verified');

// 4. Verify Edge Function: midtrans-webhook
const webhookTs = fs.readFileSync(path.join(root, 'supabase', 'functions', 'midtrans-webhook', 'index.ts'), 'utf8');
assert.ok(webhookTs.includes('await sandboxKey()'), 'midtrans-webhook must use the same backend secret loader');
assert.ok(webhookTs.includes('SHA-512'), 'midtrans-webhook must verify SHA-512 signature');
assert.ok(webhookTs.includes('journal_record_subscription'), 'midtrans-webhook must invoke journal_record_subscription RPC');

console.log('PASS: supabase/functions/midtrans-webhook verified');

console.log('All Midtrans Payment Gateway and Checkout Modal assertions passed successfully!');
