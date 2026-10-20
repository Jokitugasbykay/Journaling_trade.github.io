// Unit tests for Midtrans payment gateway integration
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

console.log('Running Payment Gateway integration checks...');

// 1. Verify index.html CSP & Buttons
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(html.includes('https://app.sandbox.midtrans.com'), 'CSP must include Midtrans sandbox script/frame/connect domain');
assert.ok(html.includes('https://app.midtrans.com'), 'CSP must include Midtrans production script/frame/connect domain');
assert.ok(html.includes('id="jt-plus-subscribe-btn"'), 'index.html must have Plus subscribe button');
assert.ok(html.includes('id="jt-pro-subscribe-btn"'), 'index.html must have Pro subscribe button');
assert.ok(!html.includes('data-i18n="plusSoon"'), 'Plus soon placeholder button must be removed');
assert.ok(!html.includes('data-i18n="proSoon"'), 'Pro soon placeholder button must be removed');
assert.ok(html.includes('js/payment.js'), 'index.html must include js/payment.js script');

console.log('PASS: index.html CSP, subscribe buttons, and script tag verified');

// 2. Verify payment.js contents
const paymentJs = fs.readFileSync(path.join(root, 'js', 'payment.js'), 'utf8');
assert.ok(paymentJs.includes('midtrans-create-token'), 'payment.js must reference token creation endpoint');
assert.ok(paymentJs.includes('Mid-client-elKqYJoLSaZC9Sip'), 'payment.js must contain Client Key');
assert.ok(paymentJs.includes('app.sandbox.midtrans.com/snap/snap.js'), 'payment.js must load Snap.js');
assert.ok(paymentJs.includes('window.jtPayment'), 'payment.js must export window.jtPayment');

console.log('PASS: js/payment.js client setup verified');

// 3. Verify Edge Function: midtrans-create-token
const createTokenTs = fs.readFileSync(path.join(root, 'supabase', 'functions', 'midtrans-create-token', 'index.ts'), 'utf8');
assert.ok(createTokenTs.includes('MIDTRANS_SERVER_KEY'), 'midtrans-create-token must read MIDTRANS_SERVER_KEY');
assert.ok(createTokenTs.includes('app.sandbox.midtrans.com/snap/v1/transactions'), 'midtrans-create-token must call Snap API');
assert.ok(createTokenTs.includes('custom_field1: user.id'), 'midtrans-create-token must attach user.id to custom_field1');

console.log('PASS: supabase/functions/midtrans-create-token verified');

// 4. Verify Edge Function: midtrans-webhook
const webhookTs = fs.readFileSync(path.join(root, 'supabase', 'functions', 'midtrans-webhook', 'index.ts'), 'utf8');
assert.ok(webhookTs.includes('MIDTRANS_SERVER_KEY'), 'midtrans-webhook must read MIDTRANS_SERVER_KEY');
assert.ok(webhookTs.includes('SHA-512'), 'midtrans-webhook must verify SHA-512 signature');
assert.ok(webhookTs.includes('journal_record_subscription'), 'midtrans-webhook must invoke journal_record_subscription RPC');

console.log('PASS: supabase/functions/midtrans-webhook verified');

console.log('All Midtrans Payment Gateway assertions passed successfully!');
