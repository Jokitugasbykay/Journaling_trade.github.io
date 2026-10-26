// Sandbox-only custom QRIS/VA checkout. Provider responses, never browser callbacks, define payment status.
const API='https://api.sandbox.midtrans.com/v2';
const methods=['qris','bca','bni','bri','permata'];
export async function sandboxKey():Promise<string> {
  const configured=Deno.env.get('MIDTRANS_SERVER_KEY');if(configured)return configured;
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)return '';
  const response=await fetch('https://nmddjuqkdyhcobddinkc.supabase.co/rest/v1/rpc/journal_midtrans_sandbox_key',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(7000)});
  if(!response.ok)return '';
  const value=await response.json();return typeof value==='string'?value:'';
}
export function orderOwner(userId:string):string {
  const hex=userId.replaceAll('-','');
  if(!/^[a-f0-9]{32}$/i.test(hex))throw new Error('Invalid user identifier');
  return btoa(String.fromCharCode(...hex.match(/../g)!.map(part=>parseInt(part,16)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeOrder(id:string) {
  const match=/^jtc_([A-Za-z0-9_-]{22})_([pr])([my])_([a-f0-9]{20})$/.exec(id);
  if(!match)return null;
  const hex=Array.from(atob(match[1].replaceAll('-','+').replaceAll('_','/')+'=='),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  const userId=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  if(orderOwner(userId)!==match[1])return null;
  return {userId,plan:match[2]==='p'?'plus':'pro',interval:match[3]==='m'?'monthly':'annual'};
}
export class CoreFailure extends Error {constructor(public status:number,message:string){super(message);}}
function summary(data:any) {
  if(!Number.isSafeInteger(Number(data.gross_amount)) || Number(data.gross_amount)<=0 || data.currency!=='IDR' || typeof data.order_id!=='string' || !['pending','settlement','capture','deny','cancel','expire','refund','partial_refund','chargeback'].includes(data.transaction_status))throw new CoreFailure(502,'Midtrans returned incomplete payment details');
  const action=data.actions?.find((row:any)=>row.name==='generate-qr-code');
  let qr:string|null=null;
  if(action){const url=new URL(action.url);if(url.protocol==='https:' && ['api.sandbox.midtrans.com','api.midtrans.com'].includes(url.hostname) && !url.username && !url.password)qr=url.href;}
  return {order_id:data.order_id,merchant_id:data.merchant_id || null,amount:Number(data.gross_amount),currency:'IDR',environment:'sandbox',
    status:data.transaction_status==='capture' && data.fraud_status!=='accept'?'challenge':data.transaction_status,payment_type:data.payment_type,qr_url:qr,
    va_number:data.va_numbers?.[0]?.va_number || data.permata_va_number || null,bank:data.va_numbers?.[0]?.bank || (data.permata_va_number?'permata':null),
    expires_at:data.expiry_time?String(data.expiry_time).replace(' ','T')+'+07:00':null};
}
export async function customCheckout(body:Record<string,unknown>,userId:string,key:string,payload:any,quote:any,idempotency:string|null) {
  if(body.action==='quote')return {environment:'sandbox',quote,methods};
  const provider=async(path:string,method='GET',body?:unknown)=>{
    const response=await fetch(API+path,{method,headers:{Authorization:'Basic '+btoa(key+':'),'Content-Type':'application/json',Accept:'application/json',
      ...(method==='POST'?{'X-Override-Notification':'https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1/midtrans-webhook'}:{})},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok || !['200','201','202','407'].includes(String(data.status_code)))throw new CoreFailure(response.status===404 || data.status_code==='404'?404:502,'Midtrans could not complete this payment request. Try again or choose another method.');
    return data;
  };
  if(body.action==='status') {
    const id=String(body.order_id || ''),order=decodeOrder(id);
    if(!order || order.userId!==userId)throw new CoreFailure(404,'Payment not found');
    return summary(await provider('/'+encodeURIComponent(id)+'/status'));
  }
  if(body.action!=='charge' || !methods.includes(String(body.payment_method)))throw new CoreFailure(422,'Select a supported payment method');
  if(!idempotency || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotency))throw new CoreFailure(422,'A valid idempotency key is required');
  const plan=body.plan==='plus'?'p':'r',cycle=body.interval==='annual'?'y':'m';
  const id='jtc_'+orderOwner(userId)+'_'+plan+cycle+'_'+idempotency.replaceAll('-','').slice(0,20).toLowerCase();
  let existing:any;
  try{existing=await provider('/'+id+'/status');}catch(error){if(!(error instanceof CoreFailure) || error.status!==404)throw error;}
  if(existing){
    const expected=body.payment_method==='qris'?'qris':'bank_transfer',bank=existing.va_numbers?.[0]?.bank || (existing.permata_va_number?'permata':null);
    if(Number(existing.gross_amount)!==quote.amount || existing.payment_type!==expected || expected==='bank_transfer' && bank!==body.payment_method)throw new CoreFailure(409,'This request already belongs to another payment. Start a new checkout.');
    return summary(existing);
  }
  const charge={...payload,transaction_details:{order_id:id,gross_amount:quote.amount},
    payment_type:body.payment_method==='qris'?'qris':'bank_transfer',
    ...(body.payment_method==='qris'?{qris:{acquirer:'gopay'}}:{bank_transfer:{bank:body.payment_method}})};
  return summary(await provider('/charge','POST',charge));
}
