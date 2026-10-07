(function (root) {
  'use strict';
  const number = value => {
    let text = String(value || '').replace(/[\s\u00a0]/g, '').replace(/[−-]/g, '-');
    if (text.includes(',') && text.includes('.')) {
      text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (text.includes(',')) text = text.replace(',', '.');
    return /^[+-]?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
  };
  const numeric = '[+-]?\\d[\\d ,]*[.,]\\d+';
  const center = line => (line.bbox.y0 + line.bbox.y1) / 2;
  function analyze(pages) {
    const records = [], warnings = [];
    for (const [pageIndex, page] of pages.entries()) {
      const lines = (page.lines || []).filter(line => line.bbox && typeof line.text === 'string');
      const anchors = lines.map(line => ({line, match: line.text.match(/\b([A-Z][A-Z0-9._#-]{2,19})\s*,?\s*(buy|sell)\s+(\d+[.,]\d+)\b/i)})).filter(a => a.match).sort((a,b)=>a.line.bbox.y0-b.line.bbox.y0);
      if (anchors.length) {
        for (let i = 0; i < anchors.length; i++) {
          const {line, match} = anchors[i];
          const row = lines.filter(l => center(l) >= line.bbox.y0 - 3 && center(l) < (anchors[i+1]?.line.bbox.y0 ?? line.bbox.y1 + (line.bbox.y1-line.bbox.y0)*2.5));
          const priceLine = row.find(l=>new RegExp(`(${numeric})\\s*(?:→|->|-|-|-)\\s*(${numeric})`).test(l.text));
          const prices = priceLine?.text.match(new RegExp(`(${numeric})\\s*(?:→|->|-|-|-)\\s*(${numeric})`));
          const dateLine = row.find(l=>/\b20\d{2}[.\/-]\d{2}[.\/-]\d{2}\s+\d{2}:\d{2}(?::\d{2})?/.test(l.text));
          const date = dateLine?.text.match(/\b(20\d{2})[.\/-](\d{2})[.\/-](\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/);
          const profitLine = row.find(l=>l.bbox.x0>line.bbox.x1 && new RegExp(`^\\s*${numeric}\\s*$`).test(l.text));
          let profit = profitLine ? number(profitLine.text) : null;
          const entry = prices ? number(prices[1]) : null, exit = prices ? number(prices[2]) : null;
          const direction = match[2].toLowerCase() === 'buy' ? 'Buy' : 'Sell';
          const notes = [];
          if (profit !== null && profit > 0 && entry !== null && exit !== null && (exit-entry)*(direction==='Buy'?1:-1)<0) {
            profit = null;
            notes.push('Tanda profit tidak konsisten dengan arah harga; periksa screenshot.');
          }
          if (!prices || !date || profit === null) notes.push('Sebagian data belum terbaca.');
          if (row.some(l=>l.confidence !== undefined && l.confidence<60)) notes.push('Ada teks dengan keyakinan OCR rendah.');
          const dateValue = date ? `${date[1]}-${date[2]}-${date[3]}` : null;
          const parsedDate = dateValue ? new Date(dateValue+'T00:00:00Z') : null;
          const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0,10) === dateValue && +date[4].slice(0,2)<24 && +date[4].slice(3,5)<60;
          records.push({kind:'history', page:pageIndex+1, market:match[1].toUpperCase(), direction, volume:number(match[3]), entry, exit,
            date:validDate ? dateValue : null, time:validDate ? date[4] : null, profit, currency:null,
            result:profit===null?null:profit>0?'Win':profit<0?'Loss':'BE', sl:null, tp:null, notes});
        }
        const topPrices = lines.some(l=>center(l)<anchors[0].line.bbox.y0 && new RegExp(`(${numeric})\\s*(?:→|->|-|-|-)\\s*(${numeric})`).test(l.text));
        if (topPrices) warnings.push(`Halaman ${pageIndex+1}: baris terpotong di atas tidak dimasukkan.`);
        warnings.push('Riwayat tidak menampilkan SL/TP atau mata uang akun. Baris identik tetap dipertahankan karena dapat merupakan posisi berbeda.');
        continue;
      }
      const stopLine = lines.find(l=>/\bStop\s*:/i.test(l.text));
      // ponytail: recognize one position tool per chart; group by tool region when multiple tools are needed.
      const targetLine = lines.find(l=>/\bTarget\s*:/i.test(l.text));
      if (/\b(?:GOLD|XAUUSD|EURUSD|GBPUSD|BTCUSD)\b/i.test(page.text) && (stopLine || targetLine || /Alert[\s\S]*Replay/i.test(page.text))) {
        const labelled = (label, text) => number(text.match(new RegExp(label+'\\s*:\\s*([+-]?\\d+(?:[.,]\\d+)?)','i'))?.[1]);
        const stopDistance = labelled('Stop',stopLine?.text||''), targetDistance = labelled('Target',targetLine?.text||'');
        const direction = stopLine && targetLine ? center(stopLine)<center(targetLine)?'Sell':'Buy' : null;
        const axisPrice = label => {
          if (!label) return null;
          const candidates = lines.filter(l=>l.label && l.bbox.x0>label.bbox.x1 && Math.abs(center(l)-center(label))<22 && /^\s*\d[\d ,]*\.\d{2,5}\s*$/.test(l.text));
          candidates.sort((a,b)=>Math.abs(center(a)-center(label))-Math.abs(center(b)-center(label)));
          return candidates.length ? number(candidates[0].text) : null;
        };
        const sl = axisPrice(stopLine), tp = axisPrice(targetLine);
        const pnlLine = lines.find(l=>/Closed\s+Pn[lL]{1,2}/i.test(l.text));
        const entry = axisPrice(pnlLine);
        const header = lines.filter(l=>l.bbox.y0<page.height*.08).map(l=>l.text).join(' ');
        const market = header.match(/\b(GOLD|XAUUSD|EURUSD|GBPUSD|BTCUSD)\b/i)?.[1].toUpperCase() || null;
        const notes = lines.filter(l=>/SELL WATCH|BUY WATCH|SL di|\bSNR\b|\bSBR\b|Supply|dugaan likuiditas/i.test(l.text)).map(l=>l.text.trim());
        records.push({kind:'chart',page:pageIndex+1,market,direction,entry,sl,tp,stopDistance,targetDistance,
          rr:labelled('Risk/reward ratio',page.text),quantity:labelled('Qty',page.text),toolPnl:labelled('Closed Pn[lL]{1,2}',page.text),timeframe:null,notes});
        warnings.push('Chart adalah setup/analisis. Closed PnL dan Qty pada alat TradingView bukan profit broker atau lot akun. Timeframe, tanggal transaksi, dan hasil posisi belum dikonfirmasi.');
      }
    }
    const kinds = new Set(records.map(r=>r.kind));
    return {type:kinds.size>1?'mixed':kinds.size?[...kinds][0]:'text',records,warnings:[...new Set(warnings)]};
  }
  if (typeof module === 'object' && module.exports) module.exports = analyze;
  else root.analyzeTradeScan = analyze;
})(typeof window === 'object' ? window : globalThis);
