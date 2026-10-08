# Audit backend dan frontend

Tanggal: 9 Oktober 2026 WIB. Project: Journaling Trade. Database: **journaltrading** (`nmddjuqkdyhcobddinkc`).

## Ringkasan

- Seluruh **65 negara** di registry memiliki sedikitnya **empat portal yang berhasil memuat judul** pada audit ini. Tiga dataset tambahan — GLOBAL, DEFAULT, dan global_founder — juga memenuhi target. Antarktika menggunakan sumber global; tidak ada klaim bahwa tersedia empat penerbit lokal Antarktika.
- **525 ID sumber unik** diperiksa. Audit endpoint menghasilkan **320 sumber working**. Refresh kolektor produksi menghasilkan **322 sumber ok** dan **33.776 artikel tersimpan**. Angka berbeda karena request dilakukan pada waktu berbeda, sebagian sumber memiliki beberapa endpoint, dan batas respons audit adalah 5 MB sedangkan kolektor JSON mendukung 32 MB.
- **674 baris CSS dihapus**, mencakup 120 cabang selector yang tidak lagi dirujuk HTML/JavaScript. Terjemahan modul analisa market yang sudah dihapus dan variabel CSS yang tidak digunakan ikut dibersihkan.
- Bug parser, nilai nol kalender, dan rekomendasi The Fed diperbaiki. Gates aplikasi, parser, serta dua pengujian database dalam transaksi rollback lolos.
- **Verdict: perlu perbaikan sebelum produksi berbayar penuh.** Penegakan akses berita masih berada di browser, dan ukuran arsip berita membutuhkan perbaikan distribusi data.

## Temuan kritis yang masih terbuka

### [P1] Konten berita belum dilindungi oleh backend

`berita.json` diterbitkan sebagai file publik di GitHub Pages. Pengunjung yang memodifikasi client dapat mengambil file tersebut tanpa mengikuti gate Plus atau region. Verifikasi founder memakai email terkonfirmasi dari `auth.getUser()`, tetapi filter frontend tidak memberikan otorisasi server pada file publik.

Paket dan counter upload di Supabase dilindungi server. OCR tetap berjalan pada perangkat sehingga modifikasi client dapat melewati pemanggilan counter sebelum melakukan OCR lokal.

**Tindakan sebelum penjualan dengan pembatasan konten:** sajikan konten melalui endpoint yang memverifikasi token, entitlement, dan aturan region di server. Bila kuota harus membatasi pemrosesan OCR itu sendiri, pemrosesan harus dilaksanakan oleh server. Endpoint Supabase dan publishable key memang publik; menyamarkannya tidak menyelesaikan masalah ini. [Dokumentasi API keys Supabase](https://supabase.com/docs/guides/api/api-keys).

### [P1] Seluruh arsip diunduh untuk membuka berita

Snapshot setelah refresh berukuran **18.604.083 byte**; hasil gzip lokal sekitar **5.433.236 byte**. Browser meminta seluruh arsip dengan timeout 15 detik, lalu membatasi tampilan menjadi 500 artikel per saluran. Arsip terus bertambah dan diminta kembali setiap lima menit ketika halaman terlihat.

Ini berisiko menyebabkan timeout dan penggunaan memori tinggi pada koneksi/perangkat terbatas. Pengujian desktop/mobile lokal tidak mensimulasikan seluruh kondisi jaringan pengguna.

**Tindakan sebelum trafik produksi besar:** pisahkan respons daftar terbaru dari arsip dan muat artikel/region yang dibutuhkan melalui endpoint atau berkas terpisah. Tetap simpan arsip untuk mempertahankan riwayat; jangan menghapus riwayat sebagai cara mengurangi ukuran respons.

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
| Irak (IQ) | 4 |
| Kuwait (KW) | 5 |
| Oman (OM) | 4 |
| Bahrain (BH) | 4 |
| Israel (IL) | 5 |
| Arab Saudi (SA) | 5 |
| Uni Emirat Arab (AE) | 4 |

Al Jazeera tetap tersedia. Perintah terbaru untuk minimal empat portal menggantikan pembatasan lama “hanya Al Jazeera”. Kebijakan global/founder serta strict lock negara Asia, termasuk CN/TW, tetap diuji.

Daftar lengkap tiap negara dan endpoint: [laporan sumber](news-source-audit.md), [bukti JSON](news-source-audit.json).

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
node js/calendar.test.cjs
node js/calendar-countries.test.cjs
node js/fed.test.cjs
python scripts/test_news.py
python scripts/test_macro.py
python scripts/audit_news.py --self-test
```

Browser Chrome dengan mock session: viewport 1366×900 dan 390×900. Home, jurnal kosong, statistik, kalkulator, profil, berita, kalender, pembaca artikel, tombol kembali, dan berita terkait diperiksa. Tidak ditemukan overflow horizontal pada dokumen atau exception aplikasi dalam jalur tersebut. Pengujian ini tidak menggantikan uji beban, pentest, atau pengujian screen reader menyeluruh.

## Prioritas berikutnya

1. Penegakan paket/region berita melalui backend sebelum menjanjikan konten eksklusif berbayar.
2. Respons daftar terbaru yang lebih kecil, pemuatan konten sesuai kebutuhan, serta pengujian koneksi lambat.
3. Aktifkan perlindungan password sesuai paket dan verifikasi konfigurasi login/provider produksi.

Tidak ada keputusan upgrade berbayar atau perubahan kredensial dalam audit ini.
