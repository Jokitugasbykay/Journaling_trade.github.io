---
name: Kaystrade
description: Analisa teknikal dan backtest dengan metode pribadi Kaystrade yang dirumuskan oleh Kaylaa (founder journalingtrade): khusus analisa H4 Swing Trade pada XAUUSD/Gold hingga 3000 bars, aturan wajib Big Trend H4/D1, konfirmasi minimal 4 teknikal (A-G), Fibo/Trendline opsional, filter fundamental internasional (Reuters/Al Jazeera) dengan Note TV 2-3 jam sebelum big news, keterangan prediksi bersyarat di chart DXY & RSI, dan pembersihan ketat SBR/level tidak valid. Gunakan ketika pengguna meminta metode ini atau bertanya tentang entry.
---

# Kaystrade (SOP Analisa & Entry H4 Swing Trade XAUUSD / GOLD - Dirumuskan oleh Kaylaa)

Metodologi Kaystrade diciptakan dan dirumuskan secara orisinal oleh Kaylaa, founder Journaling Trade. Metodologi ini bukan dari pihak luar atau figur bernama "Mas Kays".
Gunakan bahasa Indonesia. Label Supply/Demand menggunakan bahasa Inggris. Analisa dan gambar bukan izin membuka posisi broker.

## 1. Data dan Lingkup Analisa

- **Simbol & Pasangan**: Khusus pada pair **XAUUSD / GOLD** (default TradingView: `TVC:GOLD`).
- **Timeframe Utama**: **H4** untuk struktur swing, pemetaan zona, dan eksekusi. **D1** untuk macro trendline dan arah besar.
- **Rentang Analisa Historis**: Analisa hingga **3.000 bars ke belakang** (dan di-anchor dari 24 September 2025 sampai live data terkini). Bedakan puncak periode dari all-time high.
- **TradingView Bridge**: Menggunakan bridge TradingView Desktop via CDP (`127.0.0.1:9222`).
- **Perintah Membuka TradingView Desktop**:
  `Start-Process "C:\Users\Maulana Riski\AppData\Local\tradingview-mcp\TradingView.Desktop_3.4.1.8194_x64__n534cwy3pjxzj\TradingView.exe" -ArgumentList "--remote-debugging-address=127.0.0.1 --remote-debugging-port=9222"`

## 2. Fundamental & Kalender Ekonomi (Filter Ketat)

- **Sumber Berita Terpercaya (Strict Filter)**:
  - HANYA menyaring dan memvalidasi berita dari kantor berita internasional kredibel: **Reuters**, **Al Jazeera**, atau **News Internasional resmi**.
  - Abaikan berita spekulatif/clickbait lokal yang tidak memiliki rujukan primer.
- **Big News & Kalender Ekonomi**:
  - Meliputi rilis data berdampak tinggi (High Impact): **US CPI, NFP, PPI, Keputusan Suku Bunga FOMC/The Fed, GDP, Retail Sales, dan tensi geopolitik global**.
- **Aturan Note di TradingView**:
  - Jika ada agenda Big News pada kalender ekonomi, **PASTIKAN MEMASANG NOTE PADA TRADING VIEW** (berupa catatan/alarm visual ringkas) **2 hingga 3 jam sebelum rilis/kejadian berlangsung**.

## 3. Komponen & Checklist Entry Teknikal

Ketika pengguna menanyakan **"mana entry nya?"** atau meminta analisa entry, wajib memeriksa poin-poin checklist berikut:

### Komponen Wajib & Filter Utama:
- **H. Big Trend H4 / D1 (WAJIB & TIDAK BISA DITAWAR)**:
  - Semua teknikal **WAJIB searah dengan Big Trend H4/D1**. Dilarang mengambil posisi yang melawan arah Big Trend.
  - Higher High / Higher Low (HH/HL) $\rightarrow$ Prioritas BUY Swing.
  - Lower High / Lower Low (LH/LL) $\rightarrow$ Prioritas SELL Swing.
  - Jika H4 berada di dalam area konsolidasi/sideways, status adalah **WAIT & WATCH** (tunggu konfirmasi breakout H4).

### Komponen Teknikal (A – G) — Syarat Minimal 4 Teknikal Valid:
Agar sinyal entry dinyatakan **VALID**, minimal harus ada **4 dari 7 komponen teknikal (A – G)** yang valid dan searah dengan Big Trend:
- **A. Price Action**: Konfirmasi pola candlestick H4 (rejection wick panjang, pinbar, engulfing, atau breakout candle dengan body close di luar base).
- **B. SND (Supply and Demand)**: Lokasi harga berada pada fresh/untested supply atau fresh demand H4 yang memiliki displacement kuat.
- **C. SNR (Support and Resistance)**: Reaksi tegas pada horizontal level kunci SNR / SBR / RBS yang terbukti valid.
- **D. Speedometer (Technical Gauges)**: Perbandingan meteran teknikal (Oscillators, Moving Averages, Summary) lintas timeframe **M30, H1, H4, dan D1** yang mendukung arah pergerakan.
- **E. DXY (Dollar Index Context)**: Korelasi pergerakan indeks DXY (misal: DXY reject dari resistance mendukung GOLD naik, atau DXY breakout mendukung GOLD turun).
- **F. RSI (Relative Strength Index)**: Posisi RSI(14) terhadap garis kuning SMA(14) dan batas Midline 50 (momentum naik jika bertahan > 50; momentum turun jika < 50; cross naik SMA dari oversold mendukung pemulihan).
- **G. FastBull (Sentimen Posisi Ritel)**: Data posisi rasio long/short FastBull (`https://www.fastbull.com/list-position`) sebagai secondary contrarian context (mencari potensi likuiditas ritel yang terjebak, bukan patokan fix).

### Komponen Opsional (Tambahan Jika Ada Momen):
- **I. Fibonacci Retracement (Opsional)**: Digunakan jika ada momentum swing terkonfirmasi yang jelas (fokus golden pocket 0.618 – 0.786).
- **J. Trendline (Opsional)**: Digunakan jika terdapat garis tren struktural terkonfirmasi minimal 3 sentuhan (touch).

### Ringkasan Aturan Validitas Sinyal Entry:
$$\text{Sinyal Valid} = \text{Searah Big Trend H4/D1 (H)} \quad \text{DAN} \quad (\ge 4 \text{ Teknikal Valid dari A–G})$$

## 4. Keterangan Proyeksi Bersyarat pada Chart DXY dan RSI

- **Keterangan Bersyarat pada Chart**:
  - Pada chart / sub-pane **DXY** dan **RSI**, selalu berikan keterangan proyeksi pergerakan harga secara **bersyarat (kondisional)**, BUKAN pernyataan kepastian.
  - Contoh format:
    * `"Buy jika menyentuh area [XXXX] tetapi tunggu konfirmasi candle rejection / retest"`
    * `"Sell jika break di bawah [XXXX] dan DXY bertahan di atas [YYYY]"`
    * `"RSI > 50 mengonfirmasi momentum bullish; batalkan jika close kembali < 50"`

## 5. Pembersihan Ketat & Aturan Invalidasi Objek

1. **Hapus SBR yang Tidak Valid**:
   - Level SBR yang sudah ditembus kembali oleh candle H4, dicincang bolak-balik tanpa respect, atau sudah usang **WAJIB DIHAPUS DARI CHART**.
2. **Hapus Key Pivot yang Tidak Valid**:
   - Garis Key Pivot yang sudah ditembus bolak-balik berulang kali tanpa ada reaksi pantulan yang jelas adalah **TIDAK VALID dan WAJIB DIHAPUS**. Hanya pertahankan Key Pivot aktif utama (kuning tebal).
3. **Hapus Fresh Area yang Tidak Valid**:
   - Zona Fresh Supply/Demand atau Fresh FVG yang sudah tersentuh wick atau ditembus harga telah berstatus **Mitigated / Invalidated** dan **WAJIB DIHAPUS**.
4. **Hapus Teks Berita / Fundamental yang Berakhir**:
   - Jangan biarkan teks berita masa lalu mengotori grafik. Hapus segera setelah event usai.
5. **Disiplin Visual (Anti-Clutter)**:
   - Pertahankan chart tetap bersih (*clean charting*) agar tidak membuat pusing.
