(() => {
  'use strict';
  const panel = document.getElementById('fomc-panel');
  let data, failed = false, countdownTimer, refreshTimer;
  const text = (en, id) => window.JTI18n?.text(id, en) ?? (document.documentElement.lang === 'id' ? id : en);
  const locale = () => window.JTI18n?.locale || (document.documentElement.lang === 'id' ? 'id-ID' : 'en-GB');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(locale(), {timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}) + ' WIB' : text('Unavailable','Tidak tersedia');
  const links = {
    fed:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    cme:'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
    beans:'https://growbeansprout.com/tools/fedwatch',
    monitor:'https://www.investing.com/central-banks/fed-rate-monitor',
    tariffs:'https://taxfoundation.org/research/federal-tax/trump-tariffs-trade-war/',
    nyfed:'https://libertystreeteconomics.newyorkfed.org/2026/10/how-fast-do-tariffs-pass-through-into-consumer-prices/',
    pipeline:'https://libertystreeteconomics.newyorkfed.org/2026/07/more-tariff-pass-through-is-in-the-pipeline/'
  };
  const link = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
  function nextMeeting(now = Date.now()) {
    return data?.meetings?.filter(m => /^\d{4}-\d{2}-\d{2}$/.test(m.date) && Date.parse(m.decisionAt) > now).sort((a,b) => Date.parse(a.decisionAt)-Date.parse(b.decisionAt))[0];
  }
  function tick() {
    const meeting = nextMeeting();
    if (!meeting) { clearInterval(countdownTimer); countdownTimer=null; window.renderFedWatch(); return; }
    if (panel.dataset.meeting !== meeting.date) { window.renderFedWatch(); return; }
    let seconds = Math.max(0, Math.floor((Date.parse(meeting.decisionAt)-Date.now())/1000));
    const values = [Math.floor(seconds/86400), Math.floor(seconds%86400/3600), Math.floor(seconds%3600/60), seconds%60];
    panel.querySelectorAll('.fomc-clock b').forEach((el,i) => { el.textContent = String(values[i]).padStart(2,'0'); });
  }
  function probability(source, meeting) {
    const rows = source.distribution;
    const valid = source.meetingDate === meeting.date && Number.isFinite(Date.parse(source.asOf)) && Date.parse(source.asOf) <= Date.now()+600000 && Array.isArray(rows) && rows.length && rows.every(r => Number.isFinite(r.probability) && r.probability>=0 && r.probability<=100 && Number.isFinite(r.lower) && Number.isFinite(r.upper) && r.lower<r.upper) && Math.abs(rows.reduce((n,r)=>n+r.probability,0)-100)<=0.3;
    if (!valid) return `<p>${text('No verified snapshot for this meeting.','Belum ada snapshot terverifikasi untuk rapat ini.')}</p>`;
    const stale = failed || source.status !== 'ok' || Date.now()-Date.parse(source.asOf)>3600000;
    const target = data.currentTarget;
    const referenceValid = target && /^\d{4}-\d{2}-\d{2}$/.test(target.asOf) && target.asOf < meeting.date && !data.meetings.some(m => m.date > target.asOf && Date.parse(m.decisionAt) <= Date.now());
    const outcome = r => !referenceValid ? '' : r.lower === target.lower && r.upper === target.upper ? text('Hold', 'Tetap') : r.lower >= target.upper ? text('Hike', 'Naik') : r.upper <= target.lower ? text('Cut', 'Turun') : '';
    return `<p class="fomc-meta">${text('As of','Data per')} ${escape(date(source.asOf))} · ${stale ? text('Saved snapshot','Snapshot tersimpan') : text('Latest retrieved snapshot','Snapshot terbaru yang diambil')}</p>
      <dl class="fomc-distribution">${rows.map(r => `<div><dt>${outcome(r) ? escape(outcome(r)) + ' · ' : ''}${r.lower.toFixed(2)}% ${text('to', 'sampai')} ${r.upper.toFixed(2)}%</dt><dd>${r.probability.toFixed(1)}%</dd></div>`).join('')}</dl>`;
  }
  function analysis() {
    return `<details class="fomc-analysis" open><summary>${text('Policy briefing: tariffs, inflation and the Fed','Kajian kebijakan: tarif, inflasi, dan Fed')}</summary>
      <p class="fomc-meta">${text('Research context dated 8 October 2026. Probability snapshots above refresh separately.','Konteks riset per 8 Oktober 2026. Snapshot probabilitas di atas diperbarui terpisah.')}</p>
      <div class="fomc-analysis-grid">
        <article><h4>${text('Read the probabilities correctly','Membaca probabilitas')}</h4><p>${text('CME-derived odds describe futures pricing, not a Fed promise. The hold/hike/cut labels use the last available official target range. Compare the same meeting and target-rate range at the same timestamp. Beansprout and Investing may share underlying futures inputs, so they are not independent votes. A change in the distribution can reflect new data, contract pricing or assumptions; averaging mismatched snapshots adds false precision.','Probabilitas berbasis CME menggambarkan harga futures, bukan janji Fed. Label tetap/naik/turun memakai rentang resmi terakhir yang tersedia. Bandingkan rapat, rentang suku bunga, dan waktu data yang sama. Beansprout dan Investing dapat memakai futures yang sama, sehingga bukan suara independen. Perubahan distribusi bisa berasal dari data baru, harga kontrak, atau asumsi; rata-rata snapshot berbeda waktu memberikan presisi semu.')}</p><p>${link(links.cme,'CME FedWatch')} · ${link(links.monitor,'Investing Fed Rate Monitor')}</p></article>
        <article><h4>${text('Tariffs: price level versus inflation','Tarif: tingkat harga dan inflasi')}</h4><p>${text('Tariffs raise import costs, but consumer prices depend on margins, inventories, supplier substitution and demand. New York Fed research dated 6 October describes gradual pass-through. A higher price level need not mean permanently higher inflation: annual inflation may ease once the initial increase drops out of the comparison. Repeated tariff changes or persistent wage and expectation effects can extend the pressure.','Tarif menaikkan biaya impor, tetapi harga konsumen juga bergantung pada margin, persediaan, penggantian pemasok, dan permintaan. Riset New York Fed tanggal 6 Oktober menjelaskan penerusan biaya bertahap. Tingkat harga yang lebih tinggi tidak selalu berarti inflasi tinggi permanen: inflasi tahunan dapat turun setelah kenaikan awal keluar dari perbandingan. Perubahan tarif berulang atau efek upah dan ekspektasi dapat memperpanjang tekanan.')}</p><p>${link(links.nyfed,'New York Fed · 6 Oct 2026')} · ${link(links.tariffs,'Tax Foundation tariff tracker')}</p></article>
        <article><h4>${text('Why delayed pass-through matters','Mengapa jeda penerusan biaya penting')}</h4><p>${text('The New York Fed’s July survey found some regional firms still planning price increases after paying tariffs. That is evidence of a possible pipeline, not a national inflation forecast or a fresh October observation. Tax Foundation estimates describe modelled policy effects, not reported CPI. Assess realised prices, service inflation and inflation expectations before treating a tariff headline as evidence for a particular rate decision.','Survei Juli New York Fed menemukan sebagian perusahaan regional masih merencanakan kenaikan harga setelah membayar tarif. Ini menunjukkan kemungkinan tekanan tertunda, bukan proyeksi inflasi nasional atau observasi baru pada Oktober. Estimasi Tax Foundation adalah hasil model kebijakan, bukan angka CPI aktual. Periksa harga aktual, inflasi jasa, dan ekspektasi sebelum menyimpulkan keputusan suku bunga dari satu berita tarif.')}</p><p>${link(links.pipeline,'New York Fed · 9 Jul 2026')}</p></article>
        <article><h4>${text('What would change the policy balance?','Apa yang mengubah pertimbangan kebijakan?')}</h4><p>${text('Sticky core PCE, broad price increases and rising expectations would strengthen the case for restraint. Softer hiring, higher unemployment and weaker demand would increase the cost of tightening. A hold can allow more evidence to arrive without ruling out a later move. Read the statement, vote, projections when scheduled, and press conference together. CNBC and other current Fed headlines below add reporting context; commentary is not another probability model.','Core PCE yang bertahan tinggi, kenaikan harga meluas, dan ekspektasi meningkat memperkuat alasan pembatasan. Perekrutan melemah, pengangguran naik, dan permintaan turun meningkatkan biaya pengetatan. Menahan suku bunga memberi waktu mengumpulkan bukti tanpa menutup perubahan berikutnya. Baca pernyataan, suara, proyeksi jika dijadwalkan, serta konferensi pers bersama. Berita Fed terkini di bawah, termasuk CNBC, menambah konteks pelaporan; komentar bukan model probabilitas tambahan.')}</p><p>${link(links.fed,text('Official FOMC releases','Rilis FOMC resmi'))}</p></article>
      </div></details>`;
  }
  window.renderFedWatch = function () {
    if (!panel || panel.hidden) return;
    const meeting = nextMeeting();
    if (!meeting) { panel.innerHTML = `<p>${text('The official FOMC schedule is unavailable.','Jadwal FOMC resmi tidak tersedia.')} ${link(links.fed,'Federal Reserve')}</p>`; return; }
    panel.dataset.meeting = meeting.date;
    const meetingDate = new Date(meeting.date+'T12:00:00Z').toLocaleDateString(locale(),{dateStyle:'long',timeZone:'UTC'});
    panel.innerHTML = `<div class="fomc-hero"><div><p class="fomc-eyebrow">FEDWATCH</p><h3>${text('The next FOMC decision','Keputusan FOMC berikutnya')}</h3><p>${escape(meetingDate)} · ${text('US meeting date','Tanggal rapat AS')}</p><p class="fomc-meta">${text('Expected release','Perkiraan rilis')}: ${escape(date(meeting.decisionAt))} · 14:00 New York</p>${link(links.fed,text('Official meeting schedule','Jadwal rapat resmi'))}${data.scheduleStatus !== 'ok' ? `<p>${text('Saved schedule; refresh unavailable.','Jadwal tersimpan; pembaruan tidak tersedia.')}</p>`:''}</div><div><p>${text('Countdown to the decision','Hitung mundur keputusan')}</p><div class="fomc-clock">${[text('DAYS','HARI'),text('HRS','JAM'),text('MIN','MNT'),text('SEC','DTK')].map(label=>`<div><b>00</b><span>${label}</span></div>`).join('')}</div></div></div>
      <h3>${text('FOMC rate probabilities','Probabilitas suku bunga FOMC')}</h3><p class="fomc-meta">${text('Target-range probabilities for this meeting. Snapshots can have different update times.','Probabilitas rentang suku bunga untuk rapat ini. Waktu pembaruan snapshot dapat berbeda.')}</p>
      <div class="fomc-sources">${(data.probabilities||[]).filter(s=>[links.beans,links.monitor].includes(s.url)).map(s=>`<article><h4>${link(s.url,s.name)}</h4>${probability(s,meeting)}</article>`).join('')}</div>
      <p>${link(links.cme,text('Open the live CME FedWatch tool','Buka CME FedWatch live'))}</p>${analysis()}`;
    tick();
    if (!countdownTimer) countdownTimer = setInterval(()=>{if(!panel.hidden)tick();},1000);
  };
  async function refresh() {
    try {
      const response = await fetch('fomc.json?t='+Date.now(), {signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('FOMC feed unavailable');
      const next = await response.json();
      if (!Array.isArray(next.meetings) || !Array.isArray(next.probabilities)) throw new Error('Invalid FOMC feed');
      data=next; failed=false;
    } catch { failed=true; }
    window.renderFedWatch();
  }
  // Fetch only after the authenticated news view selects The Fed.
  new MutationObserver(()=>{
    if (panel.hidden) return;
    if (!refreshTimer) { refresh(); refreshTimer=setInterval(refresh,60000); }
    else window.renderFedWatch();
  }).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if (!panel.hidden) { refresh(); refreshTimer=setInterval(refresh,60000); }
})();
