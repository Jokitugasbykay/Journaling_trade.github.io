(function(){
  'use strict';
  const $=id=>document.getElementById(id),endpoint=(window.JTPRO_CONFIG?.apiBase || '').replace(/\/pro-gateway\/?$/,'')+'/midtrans-custom-checkout';
  let state=null,revision=0,controller=null,timer=null,subscription=null,returnFocus=null;
  const money=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
  function error(message){$('jt-payment-status').setAttribute('role','alert');$('jt-payment-status').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8h.01M11 12h1v5h1"></path></svg><span>' + message + '</span>';}
  function stop(){revision++;controller?.abort();controller=null;clearTimeout(timer);timer=null;subscription?.unsubscribe();subscription=null;state=null;
    for(const id of ['jt-payment-order','jt-payment-merchant','jt-payment-va','jt-payment-expiry','jt-payment-conversion'])if($(id))$(id).textContent='';
    $('jt-payment-qr')?.removeAttribute('src');
  }
  async function request(action,extra={}){
    const own=state,epoch=revision;
    const {data,error}=await window.cloudClient.auth.getSession();
    if(epoch!==revision || own!==state)throw new DOMException('Checkout changed','AbortError');
    if(error || !own || data?.session?.user?.id!==own.owner)throw new Error('Sesi akun berubah. Tutup pembayaran dan masuk kembali.');
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token,'Idempotency-Key':own.key},
      body:JSON.stringify({...own.config,action,...extra}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),credentials:'omit',cache:'no-store'});
    const result=await response.json();
    const latest=await window.cloudClient.auth.getSession();
    if(epoch!==revision || state!==own || latest.data?.session?.user?.id!==own.owner)throw new DOMException('Checkout changed','AbortError');
    if(!response.ok)throw new Error(result.detail || 'Layanan pembayaran belum tersedia. Silakan coba lagi.');
    return result;
  }
  async function working(button,fn){
    if(button.disabled)return;button.disabled=true;const epoch=revision;
    try{await fn();}catch(e){if(epoch===revision && e.name!=='AbortError')error(e.message);}
    finally{if(epoch===revision)button.disabled=false;}
  }
  function showPayment(data){
    state.payment={...state.payment,...data,qr_url:data.qr_url || state.payment?.qr_url,va_number:data.va_number || state.payment?.va_number};
    const payment=state.payment;clearTimeout(timer);
    $('jt-payment-options').hidden=true;$('jt-payment-create').hidden=true;$('jt-payment-other').hidden=true;$('jt-payment-details').hidden=false;
    $('jt-payment-order').textContent=payment.order_id;$('jt-payment-amount').textContent=money(payment.amount);
    $('jt-payment-merchant').textContent=payment.merchant_id?'Merchant Midtrans: '+payment.merchant_id:'';
    const pending=payment.status==='pending',paid=['settlement','capture'].includes(payment.status);
    $('jt-payment-status').setAttribute('role','status');
    const msg = paid?'Pembayaran diterima Midtrans. Akses paket diperbarui setelah verifikasi server.':pending?'Menunggu pembayaran. Status diperiksa otomatis selama halaman ini terbuka.':'Status pembayaran: '+payment.status+'. Anda dapat kembali untuk membuat pembayaran baru.';
    $('jt-payment-status').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8h.01M11 12h1v5h1"></path></svg><span>' + msg + '</span>';
    const image=$('jt-payment-qr');image.hidden=!pending || !payment.qr_url;if(!image.hidden)image.src=payment.qr_url;else image.removeAttribute('src');
    $('jt-payment-va-box').hidden=!pending || !payment.va_number;$('jt-payment-va').textContent=payment.va_number || '';
    $('jt-payment-expiry').textContent=payment.expires_at && Number.isFinite(Date.parse(payment.expires_at))?'Batas pembayaran: '+new Date(payment.expires_at).toLocaleString('id-ID'):'';
    $('jt-payment-check').hidden=!pending;
    if(pending)timer=setTimeout(()=>{if(!document.hidden && state?.payment)working($('jt-payment-check'),checkStatus);else schedule();},15000);
  }
  function schedule(){clearTimeout(timer);if(state?.payment?.status==='pending')timer=setTimeout(()=>{if(!document.hidden)working($('jt-payment-check'),checkStatus);else schedule();},15000);}
  async function checkStatus(){try{showPayment(await request('status',{order_id:state.payment.order_id}));}catch(e){schedule();throw e;}}
  async function open(config){
    stop();controller=new AbortController();const epoch=revision;
    const {data,error:authError}=await window.cloudClient.auth.getSession();
    if(epoch!==revision)return;
    if(authError || !data?.session?.user?.id)throw new Error('Masuk ke akun untuk melanjutkan pembayaran.');
    state={owner:data.session.user.id,config:{plan:config.plan,interval:config.interval,billing:config.billing},key:crypto.randomUUID(),payment:null};
    returnFocus=document.activeElement;
    subscription=window.cloudClient.auth.onAuthStateChange?.((event,session)=>{if(state && session?.user?.id!==state.owner){stop();$('jt-payment-step').hidden=true;window.closeCheckoutModal();}})?.data?.subscription;
    $('checkout-modal').querySelector('.jt-checkout-layout').hidden=true;$('jt-payment-step').hidden=false;
    $('jt-payment-step').focus();$('jt-payment-back').textContent='Kembali';$('jt-payment-options').hidden=false;$('jt-payment-create').hidden=false;$('jt-payment-other').hidden=false;$('jt-payment-details').hidden=true;
    $('jt-payment-create').disabled=true;$('jt-payment-status').textContent='Menyiapkan rincian pembayaran…';$('jt-payment-amount').textContent='—';
    $('jt-payment-plan').textContent=(config.plan==='pro'?'Pro':'Plus')+' · '+(config.interval==='annual'?'Tahunan':'Bulanan');
    if ($('jt-payment-plan-title')) $('jt-payment-plan-title').textContent = config.plan === 'pro' ? 'Paket Pro' : 'Paket Plus';
    if ($('jt-payment-plan-desc')) $('jt-payment-plan-desc').textContent = config.interval === 'annual' ? 'Langganan tahunan' : 'Langganan bulanan';
    if ($('jt-payment-plan-chip')) $('jt-payment-plan-chip').textContent = config.interval === 'annual' ? 'Tahunan' : 'Bulanan';
    try{
      const data=await request('quote');
      if(!data.quote || data.environment!=='sandbox' || !Number.isSafeInteger(data.quote.amount))throw new Error('Checkout kustom belum tersedia di server. Gunakan metode Midtrans lainnya atau coba lagi nanti.');
      state.quote=data.quote;$('jt-payment-amount').textContent=money(data.quote.amount);
      $('jt-payment-conversion').textContent='Tagihan US$'+data.quote.total_usd.toFixed(2)+' · konversi checkout Rp'+data.quote.conversion_rate.toLocaleString('id-ID')+'/USD';
      document.querySelectorAll('input[name="jt-payment-method"]').forEach(input=>{input.disabled=!data.methods.includes(input.value);input.checked=false;});
      $('jt-payment-status').textContent='Pilih metode pembayaran. Ini adalah lingkungan uji Midtrans, bukan pembayaran dengan uang sungguhan.';
    }catch(e){if(epoch===revision && e.name!=='AbortError')error(e.message);}
  }
  function back(){stop();$('jt-payment-step').hidden=true;$('checkout-modal').querySelector('.jt-checkout-layout').hidden=false;$('jt-checkout-pay-btn').focus();}
  function init(){
    $('jt-payment-back').addEventListener('click',back);
    $('jt-payment-options').addEventListener('change',()=>{$('jt-payment-create').disabled=!state?.quote;});
    $('jt-payment-create').addEventListener('click',()=>working($('jt-payment-create'),async()=>{
      const method=document.querySelector('input[name="jt-payment-method"]:checked')?.value;if(!method || !state?.quote)throw new Error('Pilih metode pembayaran terlebih dahulu.');
      $('jt-payment-options').querySelectorAll('input').forEach(input=>input.disabled=true);
      try{const data=await request('charge',{payment_method:method});if(!data.order_id || !Number.isFinite(data.amount) || data.amount!==state.quote.amount)throw new Error('Rincian pembayaran tidak valid. Silakan periksa status sebelum mencoba kembali.');showPayment(data);}
      finally{if(state && !state.payment)$('jt-payment-options').querySelectorAll('input').forEach(input=>input.disabled=false);}
    }));
    $('jt-payment-check').addEventListener('click',()=>working($('jt-payment-check'),checkStatus));
    $('jt-payment-copy').addEventListener('click',()=>working($('jt-payment-copy'),async()=>{await navigator.clipboard.writeText(state.payment.va_number);$('jt-payment-status').textContent='Nomor virtual account disalin.';}));
    $('jt-payment-other').addEventListener('click',()=>{
      const plan = state?.config?.plan || 'pro';
      const interval = state?.config?.interval || 'monthly';
      const stateOrder = state?.payment?.order_id || state?.quote?.order_id || '';
      const modal = $('checkout-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('is-open');
        modal.setAttribute('hidden', '');
      }
      window.openMidtransListModal?.(plan, interval, stateOrder);
    });
    $('jt-payment-qr').addEventListener('error',()=>{if(state)error('QR tidak dapat ditampilkan. Periksa koneksi atau kembali untuk memilih virtual account.');});
    $('checkout-modal').addEventListener('keydown',event=>{
      if(!state)return;
      if(event.key==='Escape'){event.preventDefault();window.closeCheckoutModal();return;}
      if(event.key!=='Tab')return;
      const focusable=Array.from($('checkout-modal').querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')).filter(node=>node.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey && (document.activeElement===first || document.activeElement===$('jt-payment-step'))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    });
  }
  window.JTCustomCheckout={open,close(){stop();if($('jt-payment-step'))$('jt-payment-step').hidden=true;returnFocus?.focus?.();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
