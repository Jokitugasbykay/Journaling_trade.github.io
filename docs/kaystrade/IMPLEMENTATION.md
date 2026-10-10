# Implementasi Kaystrade

Spesifikasi utama adalah [SKILL.md](SKILL.md). Versi mesin: `kaystrade-closed-bars-v1` dalam [kaystrade.py](../../services/pro_api/kaystrade.py). Dokumen ini memetakan aturan pribadi ke implementasi deterministik dan batasnya. Ambang angka di bawah adalah asumsi implementasi; spesifikasi tidak menetapkan semuanya sebagai aturan trading baku.

Status: **Implemented but Not Fully Tested**. Pengujian lokal memakai candle sintetis dan beberapa hasil frame yang di-mock. Provider berlisensi, data pasar aktual, bridge TradingView, model lokal yang lolos benchmark, dan deployment gateway belum terverifikasi. Hasil ini tidak membuktikan winrate, edge, profitabilitas, atau kesiapan produksi.

## Alur dan batas data

`market.load_market()` membaca `manifest.json` dan snapshot milik operator dari `PRO_MARKET_ROOT`. Pengguna memilih instrumen/timeframe yang terdaftar; pengguna tidak mengirim URL provider atau path filesystem. Snapshot memuat OHLC, provider, referensi lisensi, waktu, status pasar, Technicals, dan konteks yang tersedia. Tidak ada harga pengganti ketika feed gagal.

`kaystrade.analyze()` mengambil hanya candle yang sudah tutup pada `as_of`, menyusun bukti tiap frame, lalu menghasilkan `MarketSignal`. `worker.process_job()` memberikan bukti tersebut kepada Ollama untuk penjelasan dan menetapkan outcome akhir dari sinyal deterministik. Model tidak menghitung level entry/SL/TP, tidak menjadi model peramalan Kaystrade, dan tidak memiliki alat broker.

Chart TradingView yang di-embed oleh `js/pro.js` dan feed analisis Python adalah dua sumber terpisah. Chart yang tampil tidak membuktikan bahwa Python terhubung ke TradingView atau bahwa data keduanya sama. Sukses HTTP atau event iframe `load` juga tidak membuktikan objek chart sudah digambar dengan benar.

Technicals D1/H4 adalah **rating manual dari operator yang dipercaya**, dengan nilai `buy`, `sell`, atau `neutral`, timestamp, `tradingview_symbol`, dan URL Technicals TradingView. Path URL harus cocok dengan simbol rating, lalu simbol rating harus cocok dengan manifest pada `load_market()`. Tidak ada scraping otomatis atau koneksi langsung ke speedometer. Pemeriksaan URL/simbol/waktu membatasi kesalahan input; pemeriksaan tersebut bukan bukti bahwa isi halaman telah diambil atau diverifikasi secara otomatis.

Penjelasan market hanya boleh mengacu ke panel deterministik untuk angka. `ai.validate_explanation()` menolak angka/persentase dalam prose market kecuali angka pada nama indikator/timeframe yang diizinkan, serta menolak pola entry/SL/TP dan klaim probabilitas Indonesia yang dilarang. Validasi bentuk dan evidence ID tidak menjamin semua interpretasi bahasa model benar; pemeriksaan model aktual tetap diperlukan.

## Pemetaan aturan: data dan lingkup

| Aturan SKILL | Implementasi / batas | Pemeriksaan lokal |
| --- | --- | --- |
| Bahasa Indonesia; label Supply/Demand berbahasa Inggris; analisa bukan izin broker | `ai.explain()` meminta penjelasan Indonesia. `zones()` dan `gaps()` memakai Supply/Demand. `MarketSignal.status` adalah `CONDITIONAL SETUP`; tidak ada eksekusi broker. Nama field/status bukti tetap mengikuti kontrak API. | T4, T5, T11; instruksi bahasa bukan bukti kualitas bahasa model aktual. |
| Pastikan simbol, provider, TF, periode, waktu, status pasar; GOLD default TVC:GOLD; jangan memakai level lama sebagai level terkini | `market.instrument_catalog()`, `Snapshot`, dan `load_market()` memeriksa mapping, metadata, timestamp, umur feed, dan expiry. Mapping TVC:GOLD harus ditetapkan operator untuk GOLD/XAUUSD sesuai preferensi; mesin tidak mengganti provider diam-diam. Rating harus cocok dengan simbol TradingView pada manifest. Periode adalah rentang candle yang disuplai, bukan otomatis seluruh sejarah. | T9 dan tes boundary snapshot; `test_market_snapshot_freshness_and_source_evidence` di `test_platform.py`. |
| Data aktual melalui bridge yang tersedia; bila tidak tersedia jelaskan keterbatasan | Saat ini jalur data memakai snapshot operator, bukan bridge TradingView. Snapshot/manifest yang hilang atau invalid menghasilkan error; tidak ada klaim tersambung atau fallback harga buatan. Provider/producer aktual masih blocker. | Tes missing provider dan freshness di `test_platform.py`; tes sintetis tidak memverifikasi bridge. |
| Historis GOLD mulai 25 September 2025 kecuali periode lain; bedakan high periode dari ATH | `frame_evidence()` mengembalikan `period_high`/`period_low` dari candle tertutup yang tersedia. Tidak ada klaim ATH. Pengambilan periode historis default belum diimplementasikan oleh producer. | T8 membandingkan high dengan rentang input. |
| Analisa bukan otomatis backtest/alarm/perubahan layout; pertahankan objek lain | Mesin menghasilkan JSON. Tidak ada API untuk menghapus objek, mengganti layout pengguna, membuat alarm, atau menjalankan backtest. Layout terpisah dan izin perubahan harus ditangani ketika integrasi chart benar-benar dibuat. | Batas scope; tidak ada tes mutasi chart. |

## Pemetaan aturan: filter dan entry

| Aturan SKILL | Implementasi / batas | Pemeriksaan lokal |
| --- | --- | --- |
| Technicals D1/H4: Summary, MA, Oscillators dan waktu; missing bukan dukungan; jangan menghitung MA yang sama beberapa kali | `TechnicalRating`, `Snapshot.timestamps()`, dan binding sumber pada `load_market()` memvalidasi rating. `analyze()` mensyaratkan ketiga rating pada kedua frame mendukung bias H4. Rating adalah gerbang, bukan tiga atau enam konfirmasi independen. Missing/neutral/konflik menahan trade. | T9, T10 dan tes boundary rating. |
| H4 HH/HL buy, LH/LL sell; netral menunggu; D1 konteks trendline | `structure()` membandingkan dua high dan dua low terakhir yang terkonfirmasi. H4 menetapkan `bias`; netral atau swing tidak cukup menghasilkan NO TRADE. `frame_evidence()` menyediakan trendline D1 sebagai `context_only`. H1 tidak dapat mengganti bias H4. | T2, T8, T9. |
| H1 struktur; M15/M30 eksekusi; minimal tiga konfirmasi independen yang eksplisit | Semua frame H4/D1/H1/eksekusi harus tersedia. Struktur H1 harus searah H4 sebagai gerbang. Eksekusi hanya M15/M30. Jenis konfirmasi: struktur H4/H1, breakout/retest/rejection, momentum RSI, dan Head and Shoulders dengan trigger. DXY tidak dihitung sebagai konfirmasi entry pada versi ini. | T9, T10; T10 memakai mock untuk menguji keputusan, bukan pembentukan semua indikator dari feed nyata. |
| Semua sesi boleh; tunggu close luar base, retest, rejection; close kembali membatalkan | `base_retest()` tidak membatasi sesi. Base tiga candle yang kompak harus diikuti displacement dan close di luar base. Wick yang masuk base dapat menjadi retest; close kembali ke batas/ke dalam base membatalkan. Retest harus terjadi pada candle tertutup terakhir untuk status `confirmed`. | T6 menguji breakout, wick retest, pembatalan, dan data sebelum breakout. Deteksi niat manipulasi belum dimodelkan. |
| Entry bersyarat, SL luar swing invalidasi, TP pada penghalang terdekat; jangan memaksakan RR atau entry hanya karena RSI ekstrem | `analyze()` memakai close candle rejection terakhir sebagai harga referensi, bukan jaminan fill. Base harus searah bias. SL satu tick di luar swing eksekusi/base. TP memilih penghalang terdekat yang valid, termasuk batas Supply/Demand dan FVG yang berlawanan. Entry di dalam zona berlawanan ditahan. Level juga ditahan jika tick, swing, target, urutan harga, atau grid harga tidak valid. RR dihitung dari level yang tersedia; target tidak dipindah untuk mendapatkan RR tertentu. | T10, termasuk regresi penghalang zona dan entry dalam zona; T11. |

Ketiga konfirmasi adalah kategori bukti, bukan jumlah indikator yang mengulang informasi sama. Label Rally-Base-Rally/Drop-Base-Drop tidak menambah satu konfirmasi lagi di atas konfirmasi retest. Rating Technicals tetap hanya gerbang. H1 yang berlawanan tidak dapat dilewati oleh kombinasi pattern, momentum, dan lokasi.

## Pemetaan aturan: level dan konteks

| Aturan SKILL | Implementasi / batas | Pemeriksaan lokal |
| --- | --- | --- |
| SNR/SBR: reaction berulang, swing, recency, break lalu retest dari bawah/rejection, TF/harga, toleransi duplikat | `pivots()` memberi kandidat swing; `levels()` mengelompokkan harga sejenis dalam 0.1 ATR, mencatat jumlah reaction dan timestamp konfirmasi terakhir. Kandidat satu pivot tetap muncul; makna discretionary/recency belum diberi skor. SBR memerlukan close di bawah support lalu candle bearish menyentuh kembali level dari bawah dan close tetap di bawah. Frame menjadi key pembungkus bukti. Pemetaan semua level sampai high periode belum tersedia; output dibatasi. | T2, T3. |
| Key pivot berupa garis kuning tebal, terpisah dari zona/alarm | Data pivot tersedia, tetapi pemilihan key pivot discretionary dan drawing garis kuning belum diimplementasikan. Pivot bukan sinonim Supply/Demand atau alarm. | T2 hanya menguji pivot data; drawing ditunda. |
| Fresh Supply/Demand H1/H4: origin, displacement, break struktur, status fresh/mitigated/invalidated | `zones()` memakai satu candle origin berlawanan/doji, departure minimal satu ATR, dan break swing terkonfirmasi yang belum lebih dahulu dilewati oleh close. Full high/low origin menjadi zona. Sentuhan sesudah departure membuat mitigated; close melewati batas invalidasi membuat invalidated. Bukti dihitung per frame; H1/H4 memberi konteks utama. Base origin multi-candle belum dimodelkan. | T4, termasuk regresi origin yang sudah melewati swing sebelum departure. |
| FVG tiga candle, displacement, freshness; opening gap cash berbeda dari intrasesi | `gaps()` mensyaratkan geometri tiga candle, body tengah minimal satu ATR, arah displacement sesuai gap, dan interval timestamp berturut-turut sama dengan TF. Gap antar-sesi yang memutus interval tidak dihitung sebagai FVG intrasesi. Status fresh/mitigated/invalidated dinilai dari candle setelah pembentukan. Kalender sesi exchange belum tersedia. | T5 menguji displacement, mitigation, invalidation, dan interval yang terputus. |
| Preferensi terbaru tanpa Fibonacci; historis golden 0.618–0.786 jangan diubah diam-diam; Fib baru memakai swing terkonfirmasi | Tidak ada filter atau drawing Fibonacci default. `gaps()` menyediakan status gap; memilih hanya fresh untuk periode yang diminta adalah tindakan chart terpisah. Golden retracement historis belum diimplementasikan sebagai backtest, sehingga mesin tidak mengklaim mereplikasi aturan backtest lama. | Scope; belum ada tes Fib/backtest. |
| Liquidity: equal extrema, swing, sweep/reclaim sebagai potensi, bukan bukti resting orders | `frame_evidence()` menyediakan grup dengan reaction >= 2 dan wick sweep yang close kembali melewati harga pivot. Warning menyebut potensi liquidity. Tidak ada order-book/resting-order data. | T8 memeriksa label/warning dan bentuk field; seluruh pola sweep tidak diuji secara exhaustif. |
| RSI14, SMA14, 70/50/30; cross dari ekstrem; divergence harus pivot dan trigger harga | `rsi_series()` memakai smoothing Wilder; `frame_evidence()` menghitung SMA14 RSI, cross, ekstrem lima nilai RSI terakhir, dan divergence dua pivot terkonfirmasi dengan trigger close harga. Divergence sendiri tidak menambah konfirmasi entry. Warna MA dan garis panel belum digambar otomatis. | T1, T8. T8 hanya memeriksa field divergence/status yang diizinkan, bukan semua contoh divergence valid/invalid. |
| DXY konteks GOLD, bukan invers pasti; verifikasi feed/waktu; proyeksi dua arah bersyarat | `market.correlation()` menggunakan timestamp bersama dan return historis. Konteks DXY memerlukan minimal 31 timestamp bersama dan timestamp candle aset tertutup terakhir; sekadar list tidak kosong tidak cukup. Snapshot menolak harga DXY nonpositif/nonfinite serta waktu future/duplikat/tidak berurutan. DXY tidak menetapkan bias atau mengubah arah aset lain. `analyze()` menyediakan skenario bullish/bearish/no-trade dan invalidasi. Proyeksi harga DXY dan overlay pane belum dimodelkan. | T12 dan boundary snapshot; bukan bukti korelasi invers stabil. |
| Head and Shoulders hanya valid setelah neckline break; continuation base berbeda dari reversal | `head_shoulders()` memerlukan lima pivot bergantian, bahu mendekati sama, head lebih ekstrem, dan crossing close neckline pada candle terakhir. `base_retest()` melabel continuation menurut arah candle sebelum base. Label tersebut adalah heuristik sederhana; reversal tetap membutuhkan gerbang struktur dan konfirmasi, bukan nama pattern saja. | T6, T7, T10. |
| News high impact/geopolitik dapat merusak setup; verifikasi waktu/sumber, jangan atribusi loss tanpa bukti; tidak ada blackout tetap | `Snapshot.timestamps()` mensyaratkan URL HTTPS dan timestamp konteks yang tidak melampaui `as_of`. `analyze()` memperingatkan macro/news yang hilang dan tidak memasang blackout tetap. `ai.explain()` memperlakukan news sebagai bukti tidak tepercaya. Verifikasi kalender, klasifikasi high impact, kausalitas loss, dan penilaian geopolitik belum dimodelkan secara deterministik. | Tes evidence/future timestamp di `test_platform.py`; tidak ada pembuktian kausalitas. |

## Pemetaan aturan: tampilan TradingView

| Aturan SKILL | Implementasi / batas | Pemeriksaan lokal |
| --- | --- | --- |
| SNR/SBR garis harga/TF, key pivot kuning; Supply muted red/Demand teal opacity 50%; base putih opacity 20% | Bukti JSON memuat level, frame, dan batas zona/base. Custom drawing, warna, ketebalan, opacity, dan label chart belum terintegrasi dengan embed TradingView. | Belum ada tes drawing; tes UI transport bukan bukti pemetaan visual. |
| Buy/sell watch dengan konfirmasi, invalidasi, TP, reason; watch bukan order | `MarketSignal` menyediakan levels, confirmations, invalidation conditions, dan status conditional. Tidak ada order broker. Custom watch pada chart ditunda. | T10, T11. |
| RSI/DXY pane masing-masing; proyeksi bersyarat; RSI bukan harga aset | RSI dan konteks lintas pasar adalah field bukti yang berbeda dari entry/SL/TP. Pane, overlay, dan panah proyeksi chart belum diimplementasikan. | T1, T8; belum ada screenshot verifikasi pane. |
| Verifikasi simbol/objek/koordinat/screenshot; perbaiki overlap; tutup panel tanpa menghapus indikator | Mapping simbol dapat diperiksa melalui manifest. Tidak ada bridge objek atau workflow screenshot akhir untuk drawing Kaystrade. Tidak ada klaim bahwa API sukses memverifikasi visual. | Belum terverifikasi pada chart aktual. |
| Alarm hanya bila diminta; verifikasi Active/simbol/kondisi/expiry/kanal; crossing bukan seluruh aturan | Tidak ada pembuatan alarm. Alarm berbasis price crossing atau script multi-syarat harus menjadi pekerjaan terpisah dengan permintaan pengguna dan pemeriksaan aktual. Nama alarm tidak dianggap implementasi aturan candle/retest. | Ditunda; tidak ada tes alarm. |

## Pemetaan aturan: backtest hanya bila diminta

| Aturan SKILL | Status implementasi |
| --- | --- |
| Modal USD 1000, risiko 2%, RR 1:2–1:4; GOLD DD 30%, BTC 20% hanya sesuai permintaan; GOLD 1000 pips = USD 100/oz | Belum ada runner backtest Kaystrade atau sizing transaksi. Default historis ini tidak diterapkan sebagai fakta broker atau gerbang RR analisa snapshot. Mesin menghitung RR aktual tanpa memaksakannya. |
| Intra <= 24 jam, swing hingga TP/SL, scalping M15/M30 dengan asumsi durasi eksplisit; leverage tidak menghapus sizing | M15/M30 dipakai untuk eksekusi analisa. Simulasi holding time, leverage, sizing, dan exit belum tersedia. |
| Candle tertutup/pivot terkonfirmasi saat entry, tanpa lookahead; H4/DXY sinkron | `analyze()` menyaring candle berdasarkan waktu tutup dan `pivots()` menunggu dua candle kanan. Ini menjaga evaluasi snapshot; bukan bukti runner historis bebas lookahead. Replay harus membatasi semua frame, ratings, dan konteks ke setiap timestamp entry. T2/T9 menguji sebagian prasyarat ini. |
| Spread, slippage, komisi, unit kontrak, concurrency, dan TP/SL pada candle sama eksplisit | Belum ada model biaya/kontrak atau simulasi intrabar. Tidak ada asumsi biaya nol, satu posisi aktif, ataupun prioritas TP/SL yang diklaim sebagai fakta broker. |
| Winrate, jumlah trade, equity, return, max DD, reason setiap entry, semua level/exit/TF/invalidasi; closed DD berbeda dari intratrade DD | Tidak ada hasil backtest Kaystrade. Metric jurnal yang ada berasal dari trade pengguna dan bukan backtest metode ini. `MarketSignal` memberi satu assessment snapshot, bukan trade yang sudah terjadi. |
| Hindari trade duplikat lintas TF; jangan memaksa 400/1000/4000; laporkan shortfall | Tidak ada pembangkitan atau penjumlahan posisi historis. Target jumlah trade, deduplikasi replay, dan shortfall menjadi syarat runner jika diminta. |
| Teori belum dimodelkan berarti backtest parsial; chart/screenshot bukan bukti edge | Scope mesin menyatakan deterministik, tanpa RL, probabilitas learned, order otomatis, atau klaim backtest. Speedometer historis, chart discretionary, kalender news, dan fill broker belum tersedia. Setiap runner parsial kelak harus menyebut bagian yang belum dimodelkan. |

## Asumsi dan ambang deterministik

| Bagian | Nilai/aturan aktual |
| --- | --- |
| Waktu candle | `timestamp` adalah waktu pembukaan. Tutup = timestamp + durasi TF: M15 900 detik, M30 1800, H1 3600, H4 14400, D1 86400. Producer harus memakai semantik ini; tidak ada adaptasi kalender sesi/DST exchange. |
| Kecukupan | Minimal 51 candle tertutup pada H4, D1, H1, dan TF terpilih. Snapshot utama menerima 51–10000 candle; ukuran file maksimal 5 MB. Warm-up bukan validasi panjang sejarah pasar. |
| Freshness snapshot | `valid_until` harus belum lewat; `as_of` tidak boleh lebih dari 30 detik di masa depan. Saat pasar terbuka, umur snapshot dan bar terbaru maksimal dua durasi TF. Frame tambahan memakai batas dua durasi frame masing-masing. Status delayed dan `delay_seconds` adalah metadata provider. |
| Rating | D1/H4 saja, satu rating per TF. Timestamp tidak di masa depan dan umur maksimal satu durasi rating. URL HTTPS TradingView memakai path `/symbols/<provider-symbol>/technicals`; simbol rating dan manifest harus sama. Ketiga komponen setiap frame harus buy untuk bias BUY atau sell untuk bias SELL. Rating manual tidak dihitung sebagai konfirmasi independen. |
| Pivot/struktur | Dua candle kiri dan dua kanan; high harus lebih tinggi secara strict, low lebih rendah secara strict dari semua tetangga. Equal highs/lows tidak menjadi pivot strict. Konfirmasi pada waktu tutup candle kanan kedua. Struktur membandingkan dua pivot high dan dua pivot low terakhir. |
| RSI14 | Seed rata-rata gain/loss dari 14 perubahan close; smoothing `(nilai_lama * 13 + perubahan_baru) / 14`. Loss nol/gain positif memberi RSI100; keduanya nol memberi RSI50. SMA14 memakai 14 nilai RSI valid dan tersedia mulai indeks27. |
| Momentum/cross | Bullish: RSI > 50 dan RSI > SMA14; bearish: RSI < 50 dan RSI < SMA14. Nilai sama menjadi neutral. Cross memakai dua nilai terakhir; recovery/weakening mensyaratkan min <= 30 / max >= 70 dalam lima nilai RSI terakhir. |
| ATR14 | TR dari pasangan candle berturut-turut: max(high-low, abs(high-prev_close), abs(low-prev_close)). Seed 14 TR pertama; lalu smoothing Wilder. Candle pertama tidak memiliki TR dalam implementasi ini. ATR dipakai untuk ambang, bukan konfirmasi independen. |
| Merge SNR | Toleransi `0.1 * ATR14` terakhir; hanya jenis pivot sama yang digabung. Harga grup tetap harga pivot pertama, bukan rata-rata. Setiap reaction memperbarui `last_index` dan timestamp. |
| Base | Tiga candle; range gabungan <= 1.5 ATR sebelum base; setiap body <= 0.5 ATR. Departure body >= 1 ATR dan close strict di luar range. Scan origin dibatasi sekitar 100 bar terakhir. |
| Retest | BUY: low menyentuh batas atas base, candle bullish close di atas base. SELL: high menyentuh batas bawah, candle bearish close di bawah. Close menyentuh/masuk batas membatalkan. Retest lama menjadi `older_retest`; hanya retest pada candle terakhir menjadi `confirmed`. |
| Supply/Demand | Satu origin opposite/doji; body departure >= ATR pada origin. Break harus melewati swing terkonfirmasi yang belum lebih dulu ditembus close dan melewati range origin. Zona memakai full high/low origin. Sentuhan wick dihitung sebagai mitigasi; close lewat batas jauh sebagai invalidasi. |
| FVG | Tiga candle berurutan pada durasi TF. Bullish: low candle ketiga > high pertama dan body tengah bullish; bearish kebalikannya. Body tengah >= ATR yang tersedia pada candle tengah. Sentuhan berikutnya berarti mitigated; close lewat batas jauh berarti invalidated. |
| H&S | Lima pivot bergantian; selisih bahu <= 0.5 ATR; head lebih ekstrem > 0.5 ATR. Neckline linear dari dua pivot di antara bahu/head, diekstrapolasi ke bar terakhir; close harus baru crossing dari bar sebelumnya. Ini bukan klasifikasi semua variasi pattern discretionary. |
| Trendline/divergence | Trendline menghubungkan dua pivot low terakhir dan hanya konteks. Divergence memakai dua pivot sejenis dengan RSI valid; trigger bullish close > high candle pivot low terakhir, bearish close < low candle pivot high terakhir. Tidak ada estimasi probabilitas. |
| Liquidity | Equal extrema memakai grup dengan >= 2 reaction. Sweep/reclaim memakai 10 pivot terakhir: wick melampaui pivot, close kembali ke sisi semula. Label selalu potensi. |
| Entry/SL/grid | Entry = close candle eksekusi terakhir yang sudah tutup. BUY SL = min(swing low terakhir, base low) - satu tick; SELL SL = max(swing high terakhir, base high) + satu tick. Entry/SL/TP harus tepat pada kelipatan tick; tidak dibulatkan agar trade terlihat valid. |
| Target/penghalang | Kandidat di TF eksekusi, H1, H4: swing high untuk BUY/low untuk SELL; Resistance/SBR untuk BUY, Support untuk SELL; batas dekat Supply/FVG Supply untuk BUY, Demand/FVG Demand untuk SELL. Zona fresh maupun mitigated yang belum invalidated dipertimbangkan. Jika entry berada dalam zona berlawanan, trade ditahan. Pilih harga di depan entry yang paling dekat. D1 tidak menjadi frame kandidat target versi ini. |
| RR | `abs(TP-entry) / abs(entry-SL)`; level harus positif dan terurut. Tidak ada RR minimum/maksimum pada analisa snapshot. Target nearest memakai bukti yang tersedia, bukan semua level historis sepanjang pasar. |
| Batas output | Per frame: 20 pivot, 30 grup level, 20 zona Supply/Demand, 20 FVG; daftar sweep memakai 10 pivot. Pembatasan ini dapat melewatkan level lama yang masih relevan; pemetaan semua level perlu permintaan dan perubahan scope yang eksplisit. |
| Korelasi/DXY | Minimal 31 timestamp bersama untuk 30 return dan timestamp aset tertutup terakhir harus tersedia pada konteks. Timestamp/harga lintas pasar divalidasi oleh `Snapshot`; minimal sample/latest alignment divalidasi saat analisa. Pearson dari return close-ke-close; nol variasi memberi null meskipun timestamp selaras. Hasil historis tidak membuktikan kausalitas atau inverse DXY/GOLD tetap. |

Ambang body/base/ATR dan tolerance ini dapat berbeda dari pembacaan chart manusia. Pengujian feed nyata harus membandingkan candle, timezone, tick, seed indikator, swing, dan status freshness sebelum menyamakan hasil dengan TradingView. Tidak ada ambang yang dioptimalkan dari profit atau winrate sintetis.

## Indeks pengujian

Semua T1–T12 berada pada [test_kaystrade.py](../../tests/pro/test_kaystrade.py). Nama tes menjadi referensi yang stabil saat nomor baris berubah.

| ID | Tes | Bukti yang diberikan |
| --- | --- | --- |
| T1 | `test_wilder_rsi_and_atr_and_sma` | RSI naik/turun/flat, ATR pada fixture naik dengan range konstan, SMA RSI, threshold dan momentum flat. |
| T2 | `test_confirmed_pivots_have_no_lookahead` | Pivot belum tersedia sebelum dua candle kanan; tie ditolak; HH/HL dan LH/LL dari pivot. |
| T3 | `test_support_merging_reactions_and_sbr` | Merge tolerance, jumlah reaction, dan support break/retest bearish. |
| T4 | `test_supply_demand_requires_displacement_bos_and_freshness` | BOS wajib, swing yang sudah broken ditolak, serta fresh/mitigated/invalidated. |
| T5 | `test_fvg_displacement_mitigation_and_session_gaps` | FVG displacement, mitigasi, invalidasi, dan interval sesi yang terputus. |
| T6 | `test_base_body_breakout_wick_retest_and_cancellation` | Base, close breakout, wick retest/rejection, pembatalan, dan candle sebelum breakout. |
| T7 | `test_neckline_break_required_for_head_shoulders` | Bentuk saja tidak cukup; close crossing neckline diperlukan. |
| T8 | `test_period_high_trendline_liquidity_and_divergence_fields` | High periode input, trendline context-only, warning liquidity, dan schema field divergence. |
| T9 | `test_missing_ratings_neutral_h4_and_unfinished_bar_never_trade` | Rating missing/netral tidak trade; high candle belum tutup tidak masuk evidence. |
| T10 | `test_decision_requires_independent_confirmations_and_nearest_barrier` | Gerbang konfirmasi, target swing/zona terdekat, entry dalam Supply ditahan, SL/tick/RR, momentum yang tidak mendukung, H1 tidak searah, dan base berlawanan. Bukti frame di-mock. |
| T11 | `test_signal_schema_rejects_fabricated_levels_or_rr` | NO TRADE tidak boleh membawa level; schema menolak RR yang tidak sesuai level. |
| T12 | `test_dxy_requires_recent_timestamp_alignment` | DXY sangat lama dan missing timestamp terbaru tidak tersedia; timestamp bersama termasuk candle tertutup terbaru diterima. |
| T13 | `test_sell_levels_choose_nearest_demand` | Jalur SELL: SL di luar swing, Demand terdekat sebelum swing jauh, dan RR deterministik. Bukti frame di-mock. |
| T14 | `test_divergence_needs_price_trigger` | Higher RSI low / lower price low membutuhkan close melewati trigger harga; tanpa trigger hasil none. Seri RSI di-mock, pembentukan pivot memakai candle sintetis. |

Boundary input dan penjelasan tambahan berada pada [test_platform.py](../../tests/pro/test_platform.py). `test_market_snapshot_freshness_and_source_evidence` memeriksa timestamp/freshness, simbol rating berlawanan dengan manifest, serta URL sumber berlawanan dengan simbol rating. `test_ai_evidence_and_validation` memeriksa ID bukti, klaim angka/entry/SL/TP dan probabilitas Indonesia, angka prose market, serta nama RSI14/H4 yang diizinkan. Tes transport frontend tidak menggantikan pemeriksaan feed/provider, drawing chart, atau inference nyata. T10/T12 serta kedua tes boundary ini memetakan regresi hasil review mesin.

Fixture keputusan/level menguji BUY dan SELL serta neckline H&S/inverse H&S. Feed tidak beraturan dan seluruh kombinasi kalender/freshness belum diuji secara exhaustif. Mock `frame_evidence()` memeriksa kontrak keputusan terpisah dari pembentukan indikator, bukan membuktikan satu jalur lengkap dari feed aktual sampai trade valid.

Pemeriksaan lokal yang dapat dijalankan setelah memasang dependensi Pro:

```text
python -m unittest discover -s tests/pro -p test_kaystrade.py -v
python -m unittest discover -s tests/pro -p test_platform.py -v
```

## Blocker runtime/provider dan pekerjaan ditunda

| Bagian | Yang masih diperlukan |
| --- | --- |
| Feed aktual | Producer/provider berizin untuk OHLC M15/M30/H1/H4/D1, manifest simbol, tick, status pasar, expiry, dan referensi lisensi. GOLD mengikuti mapping TVC:GOLD jika itu feed yang disepakati. Refresh snapshot bukan otomatis streaming feed. |
| Technicals | Pengambilan manual operator yang benar untuk simbol/TF/waktu terkait. Scraping speedometer otomatis belum ada; backtest tidak memiliki sejarah speedometer. |
| DXY dan news | Feed DXY bertimestamp selaras serta berita/kalender bersumber dengan hak penggunaan dan timestamp yang dapat diverifikasi. Data hilang menghasilkan warning/unavailable; tidak diberi angka pengganti. |
| LLM lokal | Model komersial yang ditinjau lisensinya, name/digest cocok dengan runtime lokal, dan benchmark tiga structured-output run yang memenuhi timeout. Runtime yang berhasil start tanpa model/benchmark belum berarti AI berfungsi. |
| Gateway/worker | Backend Python dan worker, konfigurasi proyek journaltrading, entitlement/migrasi yang terverifikasi, serta gateway HTTPS. GitHub Pages tidak menjalankan Python/Ollama. Konfigurasi frontend kosong berarti layanan belum terhubung. |
| Chart khusus | Bridge yang benar-benar mendukung objek/pane/layout pengguna, izin perubahan spesifik, dan verifikasi screenshot akhir. Embed saat ini tidak menerapkan custom drawing Kaystrade. |
| Alarm | Permintaan eksplisit dan native/script condition yang mendukung close/retest/multi-syarat; verifikasi status aktif, simbol, expiry, dan kanal. |
| Backtest/Fibonacci | Permintaan eksplisit, data historis, aturan periode/biaya/kontrak/concurrency/exit/sizing, semua asumsi parsial dilaporkan. Fib tidak aktif secara default; aturan golden lama tidak dianggap sudah diuji. |

Lihat [pro-backend.md](../pro-backend.md) untuk konfigurasi dan [PRO_PHASE_REPORTS.md](../PRO_PHASE_REPORTS.md) untuk status integrasi. Dokumen ini tidak menyatakan deployment, provider, model, bridge, alarm, atau backtest telah berhasil.
