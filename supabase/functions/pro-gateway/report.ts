import {PDFDocument, StandardFonts, rgb} from 'npm:pdf-lib@1.17.1';

export async function pdfBytes(preview: Record<string, any>): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  // A4 standard: 595.28 x 841.89 points
  const W = 595.28;
  const H = 841.89;
  const M = 40; // Margin
  const CW = W - 2 * M; // Content width: 515.28 pt

  // Colors
  const cDark = rgb(17 / 255, 24 / 255, 39 / 255);       // #111827
  const cGray = rgb(107 / 255, 114 / 255, 128 / 255);     // #6B7280
  const cLightGray = rgb(156 / 255, 163 / 255, 175 / 255); // #9CA3AF
  const cBgCard = rgb(249 / 255, 250 / 255, 251 / 255);   // #F9FAFB
  const cBorder = rgb(229 / 255, 231 / 255, 235 / 255);   // #E5E7EB
  const cBorderDk = rgb(209 / 255, 213 / 255, 219 / 255); // #D1D5DB
  const cPrimary = rgb(4 / 255, 120 / 255, 87 / 255);     // #047857
  const cPriLight = rgb(236 / 255, 253 / 255, 245 / 255); // #ECFDF5
  const cPriBorder = rgb(167 / 255, 243 / 255, 208 / 255);// #A7F3D0
  const cWarnBg = rgb(255 / 255, 251 / 255, 235 / 255);   // #FFFBEB
  const cWarnBd = rgb(253 / 255, 230 / 255, 138 / 255);   // #FDE68A
  const cWarnTx = rgb(146 / 255, 64 / 255, 14 / 255);     // #92400E

  // Helper text cleaner (Latin text for standard PDF fonts)
  const clean = (val: unknown, fallback = '-'): string => {
    if (val === null || val === undefined || val === '' || val === 'Unavailable' || val === 'Unknown') return fallback;
    return String(val)
      .replace(/[\u2014\u2013]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[^\x20-\x7e]/g, ' ');
  };

  const drawHeader = (page: any) => {
    // Top logo square
    page.drawRectangle({
      x: M,
      y: H - M - 24,
      width: 24,
      height: 24,
      color: cPrimary,
      borderRadius: 6
    });
    // Inner icon text "JT"
    page.drawText('JT', {
      x: M + 5,
      y: H - M - 17,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1)
    });
    // Brand name
    page.drawText('journalingtrade', {
      x: M + 32,
      y: H - M - 16,
      size: 14,
      font: bold,
      color: cDark
    });
    // Right tag
    const tag = 'LAPORAN PERFORMA';
    const tagW = bold.widthOfTextAtSize(tag, 9);
    page.drawText(tag, {
      x: W - M - tagW,
      y: H - M - 16,
      size: 9,
      font: bold,
      color: cGray
    });
  };

  const drawFooter = (page: any, textLeft: string, pageNumber: string) => {
    page.drawLine({
      start: { x: M, y: M + 14 },
      end: { x: W - M, y: M + 14 },
      thickness: 0.8,
      color: cBorder
    });
    page.drawText(clean(textLeft), {
      x: M,
      y: M,
      size: 8.5,
      font: regular,
      color: cGray
    });
    const pnW = regular.widthOfTextAtSize(pageNumber, 8.5);
    page.drawText(pageNumber, {
      x: W - M - pnW,
      y: M,
      size: 8.5,
      font: regular,
      color: cGray
    });
  };

  // =========================================================================
  // PAGE 1
  // =========================================================================
  const page1 = document.addPage([W, H]);
  drawHeader(page1);

  // Big Title
  page1.drawText('Laporan Performa', {
    x: M,
    y: 745,
    size: 26,
    font: bold,
    color: cDark
  });

  // Meta chips
  const periodStr = 'Periode: ' + clean(preview.period || 'Awal - Sekarang');
  const currStr = 'Mata uang: ' + clean(preview.analytics?.currency || 'USD');

  const chip1W = bold.widthOfTextAtSize(periodStr, 8.5) + 16;
  page1.drawRectangle({
    x: M,
    y: 720,
    width: chip1W,
    height: 18,
    color: cPriLight,
    borderColor: cPriBorder,
    borderWidth: 0.8,
    borderRadius: 9
  });
  page1.drawText(periodStr, {
    x: M + 8,
    y: 725,
    size: 8.5,
    font: bold,
    color: cPrimary
  });

  const chip2X = M + chip1W + 8;
  const chip2W = bold.widthOfTextAtSize(currStr, 8.5) + 16;
  page1.drawRectangle({
    x: chip2X,
    y: 720,
    width: chip2W,
    height: 18,
    color: cPriLight,
    borderColor: cPriBorder,
    borderWidth: 0.8,
    borderRadius: 9
  });
  page1.drawText(currStr, {
    x: chip2X + 8,
    y: 725,
    size: 8.5,
    font: bold,
    color: cPrimary
  });

  // Accent horizontal rule line
  page1.drawRectangle({
    x: M,
    y: 708,
    width: CW * 0.4,
    height: 2.5,
    color: cPrimary
  });
  page1.drawRectangle({
    x: M + CW * 0.4,
    y: 708,
    width: CW * 0.6,
    height: 2.5,
    color: cBorder
  });

  // Section 1: Ringkasan
  page1.drawText('RINGKASAN', {
    x: M,
    y: 690,
    size: 9.5,
    font: bold,
    color: cPrimary
  });

  const metrics = preview.analytics?.metrics || {};
  const kpis = [
    { label: 'Net PnL', val: metrics.net_pnl !== undefined ? clean(metrics.net_pnl) : '0', sub: clean(preview.analytics?.currency || 'USD') },
    { label: 'Win rate', val: clean(metrics.win_rate, '-'), sub: metrics.win_rate ? '' : 'Tidak tersedia' },
    { label: 'Profit factor', val: clean(metrics.profit_factor, '-'), sub: metrics.profit_factor ? '' : 'Tidak tersedia' },
    { label: 'Maximum drawdown', val: metrics.maximum_drawdown !== undefined ? clean(metrics.maximum_drawdown) : '0', sub: clean(preview.analytics?.currency || 'USD') }
  ];

  const cardW = (CW - 30) / 4;
  const cardH = 54;
  const cardY = 626;

  kpis.forEach((kpi, idx) => {
    const cx = M + idx * (cardW + 10);
    page1.drawRectangle({
      x: cx,
      y: cardY,
      width: cardW,
      height: cardH,
      color: cBgCard,
      borderColor: cBorder,
      borderWidth: 0.8,
      borderRadius: 8
    });
    page1.drawText(kpi.label, {
      x: cx + 10,
      y: cardY + 38,
      size: 8.5,
      font: bold,
      color: cGray
    });
    const isNA = kpi.val === '-';
    page1.drawText(kpi.val, {
      x: cx + 10,
      y: cardY + 20,
      size: 15,
      font: bold,
      color: isNA ? cLightGray : cDark
    });
    if (kpi.sub) {
      page1.drawText(kpi.sub, {
        x: cx + 10,
        y: cardY + 8,
        size: 7.5,
        font: regular,
        color: cGray
      });
    }
  });

  // Section 2: Analitik performa
  const rowStartY = 598;
  page1.drawText('ANALITIK PERFORMA', {
    x: M,
    y: rowStartY,
    size: 9.5,
    font: bold,
    color: cPrimary
  });

  const rowItems = [
    [
      { label: 'Expectancy', val: clean(metrics.expectancy, 'Tidak tersedia') },
      { label: 'Jumlah trade', val: String(metrics.trade_count ?? 0) },
      { label: 'Konsistensi', val: clean(metrics.consistency, 'Tidak tersedia') },
      { label: 'Rata-rata menang', val: clean(metrics.average_win, 'Tidak tersedia') }
    ],
    [
      { label: 'Rata-rata kalah', val: clean(metrics.average_loss, 'Tidak tersedia') },
      { label: 'Average risk reward', val: clean(metrics.average_risk_reward, 'Tidak tersedia') },
      { label: 'Maximum drawdown (%)', val: clean(metrics.maximum_drawdown_percent, 'Tidak tersedia') },
      { label: 'Mata uang', val: clean(preview.analytics?.currency || 'USD') }
    ]
  ];

  const colW = (CW - 24) / 2;
  const lineH = 17;

  rowItems.forEach((colList, colIdx) => {
    const rx = M + colIdx * (colW + 24);
    colList.forEach((item, rIdx) => {
      const ry = rowStartY - 16 - rIdx * lineH;
      // Label
      page1.drawText(item.label, {
        x: rx,
        y: ry + 4,
        size: 8.5,
        font: regular,
        color: cDark
      });
      // Value
      const isNA = item.val === 'Tidak tersedia';
      const valW = bold.widthOfTextAtSize(item.val, 8.5);
      page1.drawText(item.val, {
        x: rx + colW - valW,
        y: ry + 4,
        size: 8.5,
        font: bold,
        color: isNA ? cLightGray : cDark
      });
      // Divider line
      page1.drawLine({
        start: { x: rx, y: ry },
        end: { x: rx + colW, y: ry },
        thickness: 0.6,
        color: cBorder
      });
    });
  });

  // Section 3: Lima tabel pecahan (2 columns layout)
  const tblSectionY = 492;
  const groups = preview.analytics?.groups || {};

  const renderMiniTable = (title: string, dataRows: any[], tx: number, ty: number, tw: number) => {
    // Heading
    page1.drawText(title, {
      x: tx,
      y: ty,
      size: 8.5,
      font: bold,
      color: cPrimary
    });

    // Table Header
    const thY = ty - 14;
    page1.drawRectangle({
      x: tx,
      y: thY - 2,
      width: tw,
      height: 14,
      color: cBgCard
    });
    page1.drawLine({
      start: { x: tx, y: thY - 3 },
      end: { x: tx + tw, y: thY - 3 },
      thickness: 0.8,
      color: cBorderDk
    });

    const c1 = tx + 4;
    const c2 = tx + tw * 0.42;
    const c3 = tx + tw * 0.64;
    const c4 = tx + tw * 0.84;

    page1.drawText('GRUP', { x: c1, y: thY + 2, size: 7, font: bold, color: cGray });
    page1.drawText('TRADE', { x: c2, y: thY + 2, size: 7, font: bold, color: cGray });
    page1.drawText('NET PNL', { x: c3, y: thY + 2, size: 7, font: bold, color: cGray });
    page1.drawText('WIN %', { x: c4, y: thY + 2, size: 7, font: bold, color: cGray });

    if (!dataRows || !dataRows.length) {
      page1.drawText('Tidak ada data untuk periode ini.', {
        x: tx + 8,
        y: thY - 16,
        size: 7.5,
        font: regular,
        color: cLightGray
      });
      return 36;
    }

    const maxRows = Math.min(dataRows.length, 3);
    for (let i = 0; i < maxRows; i++) {
      const row = dataRows[i];
      const rY = thY - 14 - i * 12;
      page1.drawText(clean(row.label).slice(0, 16), { x: c1, y: rY, size: 7.5, font: regular, color: cDark });
      page1.drawText(clean(row.trade_count), { x: c2, y: rY, size: 7.5, font: regular, color: cDark });
      page1.drawText(clean(row.net_pnl), { x: c3, y: rY, size: 7.5, font: regular, color: cDark });
      page1.drawText(clean(row.win_rate), { x: c4, y: rY, size: 7.5, font: regular, color: cDark });
    }
    return 20 + maxRows * 12;
  };

  // Render left column tables
  let curLeftY = tblSectionY;
  renderMiniTable('PER JAM', groups.hour || [], M, curLeftY, colW);
  curLeftY -= 64;
  renderMiniTable('PER HARI', groups.weekday || [], M, curLeftY, colW);
  curLeftY -= 64;
  renderMiniTable('PER INSTRUMEN', groups.instrument || [], M, curLeftY, colW);

  // Render right column tables
  let curRightY = tblSectionY;
  renderMiniTable('PER SESI', groups.session || [], M + colW + 24, curRightY, colW);
  curRightY -= 64;
  renderMiniTable('PER STRATEGI', groups.strategy || [], M + colW + 24, curRightY, colW);

  // Page 1 Footer
  drawFooter(page1, 'journalingtrade * Laporan performa', 'Halaman 1 / 2');

  // =========================================================================
  // PAGE 2
  // =========================================================================
  const page2 = document.addPage([W, H]);
  drawHeader(page2);

  let p2Y = 746;

  // 1. Aktivitas trading harian
  page2.drawText('AKTIVITAS TRADING HARIAN', {
    x: M,
    y: p2Y,
    size: 9.5,
    font: bold,
    color: cPrimary
  });
  p2Y -= 12;

  const heatmapDays = (preview.heatmap?.days || []).filter((r: any) => r.trade_count);
  const heatBoxH = 68;
  const heatBoxY = p2Y - heatBoxH;

  page2.drawRectangle({
    x: M,
    y: heatBoxY,
    width: CW,
    height: heatBoxH,
    color: cBgCard,
    borderColor: cBorderDk,
    borderWidth: 0.8,
    borderRadius: 8
  });

  if (heatmapDays.length === 0) {
    const emptyMsg = 'Belum ada aktivitas trading pada periode ini.';
    const msgW = regular.widthOfTextAtSize(emptyMsg, 9);
    page2.drawText(emptyMsg, {
      x: M + (CW - msgW) / 2,
      y: heatBoxY + heatBoxH / 2 - 3,
      size: 9,
      font: regular,
      color: cGray
    });
  } else {
    // Show compact summary
    const maxDays = Math.min(heatmapDays.length, 3);
    for (let i = 0; i < maxDays; i++) {
      const dRow = heatmapDays[i];
      const rowY = heatBoxY + heatBoxH - 18 - i * 16;
      page2.drawText(clean(dRow.date), { x: M + 16, y: rowY, size: 8.5, font: bold, color: cDark });
      page2.drawText('Trade: ' + clean(dRow.trade_count), { x: M + 140, y: rowY, size: 8.5, font: regular, color: cDark });
      page2.drawText('Net PnL: ' + clean(dRow.pnl), { x: M + 260, y: rowY, size: 8.5, font: regular, color: cDark });
    }
  }

  p2Y = heatBoxY - 28;

  // 2. Kepatuhan risiko
  page2.drawText('KEPATUHAN RISIKO', {
    x: M,
    y: p2Y,
    size: 9.5,
    font: bold,
    color: cPrimary
  });
  p2Y -= 12;

  const riskOverview = preview.risk?.overview || {};
  const riskTiles = [
    { label: 'Open exposure', val: String(riskOverview.open_exposure ?? 0) },
    { label: 'Daily exposure', val: String(riskOverview.daily_exposure ?? 0) },
    { label: 'Weekly exposure', val: String(riskOverview.weekly_exposure ?? 0) },
    { label: 'Risk per trade', val: clean(riskOverview.risk_per_trade, 'Tidak diketahui') },
    { label: 'Posisi tanpa data', val: String(riskOverview.unknown_positions ?? 0) }
  ];

  const tileW = (CW - 4 * 8) / 5;
  const tileH = 50;
  const tileY = p2Y - tileH;

  riskTiles.forEach((tile, idx) => {
    const tx = M + idx * (tileW + 8);
    page2.drawRectangle({
      x: tx,
      y: tileY,
      width: tileW,
      height: tileH,
      color: cBgCard,
      borderColor: cBorder,
      borderWidth: 0.8,
      borderRadius: 8
    });
    page2.drawText(tile.label, {
      x: tx + 8,
      y: tileY + 34,
      size: 7.5,
      font: bold,
      color: cGray
    });
    const isNA = tile.val === 'Tidak diketahui';
    page2.drawText(tile.val, {
      x: tx + 8,
      y: tileY + 14,
      size: 11.5,
      font: bold,
      color: isNA ? cLightGray : cDark
    });
  });

  // Soft Yellow warning box
  const noteY = tileY - 42;
  page2.drawRectangle({
    x: M,
    y: noteY,
    width: CW,
    height: 32,
    color: cWarnBg,
    borderColor: cWarnBd,
    borderWidth: 0.8,
    borderRadius: 8
  });
  page2.drawText('i  Posisi terbuka tanpa nominal risiko tercatat dihitung sebagai eksposur tidak diketahui.', {
    x: M + 14,
    y: noteY + 11,
    size: 8.5,
    font: regular,
    color: cWarnTx
  });

  p2Y = noteY - 28;

  // 3. Ulasan tersimpan
  page2.drawText('ULASAN TERSIMPAN', {
    x: M,
    y: p2Y,
    size: 9.5,
    font: bold,
    color: cPrimary
  });
  p2Y -= 12;

  const reviewList = preview.reviews || [];
  const revBoxH = 68;
  const revBoxY = p2Y - revBoxH;

  page2.drawRectangle({
    x: M,
    y: revBoxY,
    width: CW,
    height: revBoxH,
    color: cBgCard,
    borderColor: cBorderDk,
    borderWidth: 0.8,
    borderRadius: 8
  });

  if (reviewList.length === 0) {
    const emptyRevMsg = 'Belum ada ulasan tersimpan untuk periode ini.';
    const msgW = regular.widthOfTextAtSize(emptyRevMsg, 9);
    page2.drawText(emptyRevMsg, {
      x: M + (CW - msgW) / 2,
      y: revBoxY + revBoxH / 2 - 3,
      size: 9,
      font: regular,
      color: cGray
    });
  } else {
    const maxRev = Math.min(reviewList.length, 2);
    for (let i = 0; i < maxRev; i++) {
      const rev = reviewList[i];
      const rY = revBoxY + revBoxH - 20 - i * 20;
      page2.drawText(clean(rev.period_start) + ' - ' + clean(rev.period), { x: M + 16, y: rY, size: 8.5, font: bold, color: cDark });
    }
  }

  // Page 2 Footer
  drawFooter(
    page2,
    'Hanya hasil trading yang tercatat. Tidak ada kuota analisis AI yang terpakai.',
    'Halaman 2 / 2'
  );

  document.setTitle('journalingtrade Performance Report');
  document.setCreationDate(new Date());
  return document.save();
}
