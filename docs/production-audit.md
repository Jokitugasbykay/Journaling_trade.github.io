# Audit backend dan frontend

Tanggal: 9 Oktober 2026 WIB. Project: Journaling Trade. Database: **journaltrading** (`nmddjuqkdyhcobddinkc`).

## Ringkasan

- Seluruh **65 negara** di registry memiliki sedikitnya **empat portal yang berhasil memuat judul** pada audit ini. Tiga dataset tambahan — GLOBAL, DEFAULT, dan global_founder — juga memenuhi target. Antarktika menggunakan sumber global; tidak ada klaim bahwa tersedia empat penerbit lokal Antarktika.
- **529 ID sumber unik** diperiksa. Audit endpoint menghasilkan **324 sumber working**. Refresh awal kolektor produksi menghasilkan **322 sumber ok** dan **33.776 artikel tersimpan**. Angka berbeda karena request dilakukan pada waktu berbeda, sebagian sumber memiliki beberapa endpoint, dan batas respons audit adalah 5 MB sedangkan kolektor JSON mendukung 32 MB.
- **674 baris CSS dihapus**, mencakup 120 cabang selector yang tidak lagi dirujuk HTML/JavaScript. Terjemahan modul analisa market yang sudah dihapus dan variabel CSS yang tidak digunakan ikut dibersihkan.
- Bug parser, nilai nol kalender, dan rekomendasi The Fed diperbaiki. Gates aplikasi, parser, serta dua pengujian database dalam transaksi rollback lolos.
- Pengiriman berita dipisahkan menjadi daftar terbaru, daftar per sumber, dan 256 bucket arsip. Pembukaan halaman normal tidak lagi meminta seluruh `berita.json`; cache browser mempertahankan berita tersimpan ketika pembaruan jaringan gagal.
- **Verdict: perlu perbaikan sebelum produksi berbayar penuh.** Penegakan akses berita masih berada di browser. Distribusi data sudah diperkecil; batasan otorisasi file publik tetap terbuka.

## Temuan kritis yang masih terbuka

### [P1] Konten berita belum dilindungi oleh backend

`berita.json` dan berkas `news/` diterbitkan sebagai file publik di GitHub Pages. Pengunjung yang memodifikasi client dapat mengambil file tersebut tanpa mengikuti gate Plus atau region. Verifikasi founder memakai email terkonfirmasi dari `auth.getUser()`, tetapi filter frontend tidak memberikan otorisasi server pada file publik.

Paket dan counter upload di Supabase dilindungi server. OCR tetap berjalan pada perangkat sehingga modifikasi client dapat melewati pemanggilan counter sebelum melakukan OCR lokal.

**Tindakan sebelum penjualan dengan pembatasan konten:** sajikan konten melalui endpoint yang memverifikasi token, entitlement, dan aturan region di server. Bila kuota harus membatasi pemrosesan OCR itu sendiri, pemrosesan harus dilaksanakan oleh server. Endpoint Supabase dan publishable key memang publik; menyamarkannya tidak menyelesaikan masalah ini. [Dokumentasi API keys Supabase](https://supabase.com/docs/guides/api/api-keys).

## Distribusi berita setelah perbaikan

Temuan awal: browser meminta seluruh arsip dengan timeout 15 detik sebelum membatasi tampilan menjadi 500 artikel per saluran. Distribusi sekarang dibangun dari arsip yang tetap utuh:

- `news/index.json`: metadata seluruh sumber dan maksimum 10 judul terbaru per sumber, tanpa body lengkap.
- `news/sources/<id>.json`: maksimum 500 judul terbaru dari sumber yang dipilih, tanpa body lengkap.
- `news/archive/<prefix>.json`: artikel dalam 256 bucket berdasarkan dua karakter pertama ID. Tautan artikel lama tetap dapat diambil; body hanya disimpan jika hak konten tercatat `public-domain` atau `licensed`.
- Browser menyimpan respons melalui Cache API bila tersedia, menampilkan data tersimpan sebelum pembaruan, dan mempertahankannya ketika jaringan gagal. Timeout pembaruan menjadi 30 detik. Pemeriksaan tetap setiap lima menit saat halaman terlihat.
- `berita.json` tetap diterbitkan untuk kompatibilitas, tetapi tidak dibutuhkan oleh jalur normal daftar/pembaca yang baru.

Benchmark lokal pada snapshot **35.647 artikel dan 529 sumber**:

| Berkas | Byte JSON | Byte gzip lokal |
| --- | ---: | ---: |
| Arsip penuh `berita.json` | 19.712.776 | 5.765.661 |
| Daftar awal `news/index.json` | 1.689.478 | 596.096 |
| Daftar sumber terbesar | 335.739 | 58.284 |
| Bucket arsip terbesar | 89.067 | 34.109 |

Build selesai dalam **4,26 detik**. SHA-256 arsip sebelum/sesudah sama. Daftar awal berisi 3.255 judul; ukurannya sekitar 91% lebih kecil daripada JSON arsip penuh. Angka gzip berasal dari kompresi lokal, bukan pengukuran header atau waktu transfer GitHub Pages.

Workflow menguji builder, membangun berkas setelah refresh/rebase, lalu memasukkan hanya `index.json`, `sources/`, dan `archive/` ke artifact Pages. Folder generated `news/` diabaikan Git. Regresi mencakup koneksi lambat, kegagalan refresh, cache tidak tersedia/penuh, respons terlambat, serta pergantian sumber/akun. Browser nyata memeriksa 500 judul per sumber, tautan arsip lama, pemulihan cache saat request feed offline, dan viewport 375px. Cache tidak menegakkan hak akses server dan tidak menjamin seluruh halaman dapat dibuka tanpa jaringan.

## Perbaikan yang selesai

| Temuan | Perbaikan dan bukti |
| --- | --- |
| CSS modul lama tidak memiliki pemakai | 120 cabang selector dihapus setelah pencarian handler HTML, class/id JS, selector dinamis, serta pengujian browser. Class dampak kalender `.d1/.d2/.d3` tetap dirender dengan benar. |
| Teks terjemahan analisa market yang sudah tidak tersedia | Entri terjemahan yang tidak memiliki pemakai dihapus; gates copy dan UI lolos. |
| Audit berhenti akibat atribut HTML tanpa nilai atau URL rusak | Guard pada discovery link dan URL parser; self-test menyertakan atribut `title/type` kosong, IPv6 tidak valid, URL lokal, dan sibling feed yang valid. |
| Satu judul/tag tidak valid dapat menggagalkan feed | Tipe title/date/URL/tag diperiksa sebelum pemrosesan. Baris valid tetap dapat diproses. |
| Link relatif dibentuk dari homepage, bukan halaman feed | HTML parser memakai base halaman feed yang benar. Roya News kini menggunakan portal dan link artikel Arab yang sesuai. |
| Feed Asahi menggunakan link HTTP | Upgrade HTTPS bersifat opt-in untuk feed resmi tersebut; allowlist domain tetap berlaku. Link HTTP sumber lain tetap ditolak. |
| Anchor navigasi muncul sebagai artikel | Label `Read more` dilewati dan prefix `Permalink to` dibersihkan. 46 label lama diperbaiki pada snapshot. Pola URL LBCI mengecualikan halaman kategori. |
| Emoji bintang pada byline penerbit menggagalkan gate copy | Pembersihan teks mencakup rentang simbol tersebut dan berlaku pada metadata arsip saat merge. |
| Angka rilis `0` hilang menjadi kosong | Parser kalender menjaga angka nol, membedakannya dari null, dan melewati baris rusak secara individual. |
| Halaman redirect penerbit dapat diberi hak teks public-domain | Hak public-domain diperiksa kembali terhadap domain respons final. Tes redirect menuju domain lain menolak body lengkap. |
| Artikel pendidikan masuk rekomendasi The Fed karena kata “economic value” | Target bertopik Fed hanya mengambil kandidat bertopik Fed. Penyaringan dilakukan sebelum tokenisasi, kemudian ranking, deduplikasi, dan guard region tetap berlaku. |
| Arsip besar menyebabkan daftar berita timeout atau hilang ketika pembaruan gagal | Daftar awal/per sumber dipisahkan dari arsip, artikel dimuat dari bucket sesuai kebutuhan, dan cache browser digunakan sebagai fallback. Builder menguji kuota 10/500, urutan/deduplikasi, ID/path traversal, hak body, alias artikel lama, serta integritas arsip. |
| Dokumentasi jadwal/server tidak sesuai implementasi | README mencatat cron lima menit dan penggunaan server HTTP lokal. Struktur backup yang tidak ada dihapus dari dokumentasi. |

Pembersihan tidak memangkas library vendor berdasarkan jumlah pemanggil lokal. Index database relasi juga tidak dihapus hanya karena advisor belum mencatat pemakaiannya.

## Cakupan sumber berita

Per negara, endpoint dianggap working hanya jika parser produksi menghasilkan judul yang lolos validasi. URL homepage yang dapat dibuka saja tidak dihitung. RSS, Atom, news sitemap, dan judul pada halaman HTML publik digunakan; tidak ada bypass paywall/CAPTCHA atau judul buatan.

Audit awal: 467 ID unik, 120 working, dan 109 kandidat feed resmi ditemukan. Kandidat tersebut diaktifkan; feed serta penerbit tambahan diperiksa sampai seluruh dataset mencapai target.

### Timur Tengah

| Negara | Portal working saat audit |
| --- | ---: |
| Qatar (QA) | 5 |
| Yordania (JO) | 6 |
| Lebanon (LB) | 4 |
| Irak (IQ) | 5 |
| Kuwait (KW) | 5 |
| Oman (OM) | 4 |
| Bahrain (BH) | 4 |
| Israel (IL) | 5 |
| Arab Saudi (SA) | 5 |
| Uni Emirat Arab (AE) | 4 |

Al Jazeera tetap tersedia. Perintah terbaru untuk minimal empat portal menggantikan pembatasan lama “hanya Al Jazeera”. Kebijakan global/founder serta strict lock negara Asia, termasuk CN/TW, tetap diuji.

Daftar lengkap tiap negara dan endpoint: [laporan sumber](news-source-audit.md), [bukti JSON](news-source-audit.json).

Validasi deployment pertama di runner GitHub menghasilkan 313 sumber `ok`; Denmark, Ethiopia, Irak, dan Sri Lanka saat itu masing-masing hanya memiliki tiga portal yang berhasil diperbarui. Log runner menunjukkan penolakan 403 atau halaman non-RSS dari beberapa penerbit. Empat feed alternatif resmi ditambahkan: B.T., Ethiopia Observer, Shafaq News, dan Lanka News Web. Endpoint alternatif lolos parser dan audit URL; Shafaq memakai URL RSS HTTPS kanonis agar tidak mengikuti redirect HTTP. B.T. memakai upgrade HTTPS opt-in untuk link legacy feed resminya.

Ketersediaan feed dapat berubah. Request yang timeout diperiksa ulang dengan timeout 20 detik dan maksimal enam worker. Status dalam laporan berlaku selama jendela pemeriksaan; bukan jaminan uptime. Sebanyak 196 sumber masih merupakan portal tanpa kolektor otomatis, tiga endpoint blocked, dua unavailable, dan empat tidak menghasilkan judul valid. Dataset portal tersebut tidak dihitung sebagai sumber working.

## Database

- Project journaltrading dikonfirmasi **ACTIVE_HEALTHY**.
- `supabase/test_security.sql` berhasil dalam transaksi rollback: pemisahan row antar pengguna, relasi account milik pengguna lain, akses anon, serta penolakan perubahan paket diuji.
- `supabase/test_access.sql` berhasil dalam rollback: Free 10 upload, penolakan upload ke-11, reset setelah 12 jam, Plus, dan akses anon diuji.
- Advisor security masih memberi WARN **leaked password protection disabled**. Aktifkan sebelum produksi bila paket project mendukungnya; tidak dilakukan upgrade berbayar. [Pengaturan password Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- INFO `RLS Enabled No Policy` pada `journal_private.account_access` sesuai desain deny-by-default melalui RPC.
- INFO index belum terpakai pada `trades_account_idx` dan `trades_strategy_idx` tidak diperlakukan sebagai deadcode; index relasi dipertahankan.

## Pengujian

Lolos:

```text
node js/copy.test.cjs
node js/security.test.cjs
node js/discipline.test.cjs
node js/news-region.test.cjs
node js/news-reader.test.cjs
node js/news-loading.test.cjs
node js/calendar.test.cjs
node js/calendar-countries.test.cjs
node js/fed.test.cjs
python scripts/test_news.py
python scripts/test_news_delivery.py
python scripts/test_macro.py
python scripts/audit_news.py --self-test
```

Browser Chrome dengan mock session: viewport 1366×900 dan 390×900. Home, jurnal kosong, statistik, kalkulator, profil, berita, kalender, pembaca artikel, tombol kembali, dan berita terkait diperiksa. Tidak ditemukan overflow horizontal pada dokumen atau exception aplikasi dalam jalur tersebut. Pengujian ini tidak menggantikan uji beban, pentest, atau pengujian screen reader menyeluruh.

## Prioritas berikutnya

1. Penegakan paket/region berita melalui backend sebelum menjanjikan konten eksklusif berbayar.
2. Pantau ukuran bootstrap dan status feed penerbit; kegagalan koneksi, cache tidak tersedia/penuh, dan pergantian sumber/akun sudah memiliki pemeriksaan regresi.
3. Aktifkan perlindungan password sesuai paket dan verifikasi konfigurasi login/provider produksi.

Tidak ada keputusan upgrade berbayar atau perubahan kredensial dalam audit ini.
