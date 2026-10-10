---
name: kaystrade
description: Analisa teknikal dan backtest dengan metode pribadi Kaystrade (alias kaytrade): big trend H4, speedometer, retest base, SNR/SBR, fresh Supply/Demand, FVG, RSI dan konteks DXY. Gunakan ketika pengguna meminta metode ini atau penerapan aturan trading pribadinya di TradingView.
---

# Kaystrade

Gunakan bahasa Indonesia. Label Supply/Demand menggunakan bahasa Inggris. Analisa dan gambar bukan izin membuka posisi broker.

## Data dan lingkup

- Pastikan simbol, provider, timeframe, periode, waktu data dan status pasar. GOLD default TVC:GOLD, bukan OANDA:XAUUSD; pair lain mengikuti permintaan. Jangan gunakan level lama sebagai level terkini.
- Gunakan data aktual melalui bridge TradingView yang tersedia; jangan mengaku tersambung atau selesai menggambar tanpa verifikasi. Bila bridge tidak tersedia, minta data/chart dan jelaskan keterbatasan.
- Untuk analisa historis GOLD, preferensi terakhir adalah 25 September 2025 sampai waktu data terbaru, kecuali pengguna menentukan periode lain. Bedakan high periode dari all-time high.
- Analisa tidak otomatis berarti backtest, alarm, penghapusan atau perubahan layout. Hapus hanya objek/simbol yang diizinkan; pertahankan pair, indikator dan layout lain. Gunakan layout terpisah bila diminta.

## Filter dan entry

1. Periksa speedometer Technicals pada D1 dan H4: Summary, Moving Averages, Oscillators beserta timestamp. Rating tidak tersedia berarti belum terverifikasi, bukan dianggap mendukung. Jangan menghitung beberapa MA yang sama sebagai konfirmasi independen.
2. Big trend H4 menentukan arah: HH/HL memprioritaskan buy, LH/LL sell. D1 memberi konteks trendline. Ketika H4 konsolidasi/netral, tunggu perubahan struktur; breakout H1 saja bukan konfirmasi trend H4.
3. H1 untuk struktur; M15/M30 untuk eksekusi. Entry minimal tiga konfirmasi independen yang disebutkan eksplisit: struktur, lokasi/retest, momentum RSI, konteks index, atau pattern tervalidasi. Jangan entry hanya karena menyentuh garis/Fibonacci.
4. Semua sesi boleh; tidak wajib Asia/London/New York. Jangan entry dalam base singkat/manipulatif. Tunggu body candle close di luar base, retest, lalu rejection. Jika body kembali masuk base, batalkan setup dan tunggu breakout baru. Wick retest berbeda dari close kembali ke base.
5. Tetapkan entry bersyarat, SL di luar swing invalidasi dan TP pada swing high/low atau level terdekat. Jangan memaksakan RR dengan mengabaikan penghalang harga. Sell tidak menjadi valid hanya karena overbought, buy tidak karena oversold.

## Pemetaan

- SNR/SBR: repeated reactions, swing bermakna, recency. SBR memerlukan support break lalu retest dari bawah/rejection; tandai timeframe dan harga. Semua level sampai high periode hanya bila diminta; gabungkan level duplikat dengan toleransi yang dijelaskan.
- Key pivot berupa garis kuning tebal, bukan area. Pisahkan pivot dari batas supply/demand atau alarm watch.
- Fresh Supply/Demand H1/H4: origin base/opposite candle dengan departure/displacement dan break struktur; fresh berarti belum diretest setelah departure. Bedakan fresh, mitigated dan invalidated, jangan sekadar menamai setiap candle zona.
- FVG: imbalance tiga candle, displacement bermakna, belum termitigasi untuk label fresh. Bedakan gap pembukaan sesi pada indeks cash dari imbalance intrasesi. Jangan klaim fresh valid hanya berdasarkan gap geometris.
- Aturan awal: prioritaskan FVG dalam golden Fibonacci retracement 0.618-0.786, jangan petakan semua FVG. Preferensi chart terbaru: tanpa Fibonacci dan petakan fresh FVG periode yang diminta. Ikuti permintaan terbaru; jangan otomatis mengubah aturan backtest lama. Bila Fibonacci diminta lagi, gunakan swing terkonfirmasi tanpa hindsight.
- Liquidity: equal highs/lows, swing extrema, sweep dan reclaim. Nyatakan sebagai potensi liquidity, bukan bukti resting orders.
- RSI(14), MA kuning preferensi SMA(14): tandai 70/50/30. Cross naik MA dari oversold mendukung pemulihan; cross turun dari overbought mendukung pelemahan. Divergence perlu pivot terkonfirmasi dan trigger harga, bukan sinyal mandiri.
- DXY adalah konteks GOLD, bukan korelasi invers pasti; jangan memaksakan hubungan invers pada SPX atau semua aset. Verifikasi timestamp/feed karena overlay mengikuti candle aset dan bisa tertinggal dari DXY live. Proyeksi dua arah harus memiliki kondisi breakout/retest dan invalidasi.
- Pattern termasuk Head and Shoulders hanya valid setelah neckline break/konfirmasi, bukan berdasarkan bentuk saja. Rally-Base-Rally dan Drop-Base-Drop adalah continuation; reversal base perlu perubahan struktur.
- News high impact/geopolitik dapat merusak setup. Verifikasi kalender/berita jika digunakan; jangan mengatribusikan loss pada FOMC/US-Iran tanpa timestamp dan bukti. Tidak ada blackout news tetap yang disepakati.

## Tampilan TradingView

- SNR/SBR garis dengan label singkat harga dan TF; key pivot kuning. Supply muted red, Demand teal, area opacity 50% sesuai preferensi terakhir. Base persegi putih opacity 20% (transparency 80%).
- Tandai buy/sell watch beserta konfirmasi, invalidasi, TP dan reason entry. Jangan menyebut watch area sebagai order atau sinyal terkonfirmasi.
- RSI dan DXY digambar di pane masing-masing. Proyeksi diberi label bersyarat, bukan kepastian; RSI adalah nilai indikator, bukan harga aset.
- Verifikasi simbol, objek, koordinat dan screenshot akhir; perbaiki overlap/label terpotong. Tutup panel yang tidak perlu tanpa menghapus indikator pengguna. Jangan menganggap API sukses sebagai bukti visual.
- Alarm hanya saat diminta: verifikasi Active, simbol, kondisi, expiration dan kanal. Price crossing hanya alarm pantauan, bukan alarm otomatis seluruh aturan H1/M30. Untuk konfirmasi candle/multi-syarat, gunakan kondisi native/skrip yang benar-benar mendukungnya, bukan sekadar nama alarm.

## Backtest, hanya bila diminta

- Default historis pengguna: modal USD 1000, risiko 2% ekuitas per transaksi, RR 1:2 sampai 1:4. GOLD max DD 30%; BTC pernah diminta 20%, jangan terapkan global tanpa konfirmasi. Max SL GOLD 1000 pips berarti jarak USD 100 per oz menurut definisi pengguna, bukan risiko USD 100 per trade.
- Intra maksimum 24 jam; swing sampai TP/SL. Scalping M15/M30; batas durasi scalping harus dinyatakan sebagai asumsi bila belum disepakati. Unlimited leverage bukan alasan mengabaikan sizing/risiko.
- Entry hanya memakai candle tertutup dan swing/pivot yang sudah terkonfirmasi saat itu. Hindari lookahead/repainting; sinkronkan DXY dan H4 ke timestamp entry.
- Nyatakan spread, slippage, komisi, unit kontrak, concurrency dan aturan jika TP/SL tersentuh pada candle sama. Jangan gunakan asumsi satu posisi aktif atau biaya model sebagai fakta broker.
- Laporkan winrate, jumlah trade, equity, return, max drawdown dan reason setiap entry, dengan entry/SL/TP/exit, TF dan kondisi invalidasi. Bedakan drawdown closed equity dari intratrade equity.
- Jangan menjumlahkan trade duplikat dari beberapa timeframe sebagai posisi unik. Jangan memaksa jumlah minimum/exact 400/1000/4000 dengan entry palsu atau melonggarkan aturan diam-diam. Laporkan shortfall dan keterbatasan data.
- Jika sebagian teori belum dimodelkan (speedometer historis, trendline, pattern, news, freshness), sebut hasil sebagai backtest parsial, bukan seluruh metode Kaystrade. Chart terbaru tidak otomatis sudah dibacktest. Sampel pilihan screenshot tidak membuktikan winrate atau edge.
