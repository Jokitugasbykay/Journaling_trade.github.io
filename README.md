# journalingtrade

> **Discipline in Every Execution. Clarity in Every Trade.**  
> Platform jurnal trading modern, analitik statistik berbasis probabilitas, kalkulator risiko, dan kalender makro ekonomi.

---

##  Struktur Repositori

```text
Journaling trade/
├── css/
│   └── style.css            # Stylesheet tema gelap modern (OpenAI Astra & Minimalist Glassmorphism)
├── js/
│   └── app.js               # Logika kalkulasi, penyimpanan lokal (localStorage), dan manajemen UI
├── backup/
│   └── index.html.bak       # Arsip data backup sebelum pembaruan arsitektur
├── index.html               # Halaman antarmuka utama (Entry point)
├── .gitignore               # Konfigurasi pengabaian berkas sistem & backup
└── README.md                # Dokumentasi proyek
```

---

##  Cara Menjalankan

Aplikasi ini dibangun menggunakan arsitektur **Client-Side Open Source**. Jurnal tamu tersimpan lokal; login dan sinkronisasi memakai Supabase.

1. **Buka Langsung di Browser**:
   - Cukup klik dua kali (*double-click*) berkas `index.html` pada File Explorer Anda, atau klik kanan lalu pilih **Open with Google Chrome / Edge / Firefox**.
2. **Atau Melalui Local Server**:
   ```bash
   npx serve .
   ```

---

##  Fitur & Modul Utama

1. **Beranda & Akses Awal**:
   - Panduan singkat dalam bahasa Indonesia dan Inggris: mengenali market, mengatur risiko, mencatat atau mengimpor trade, dan mengevaluasi hasil.
   - Tombol Minat menuju paket. Tombol Coba membuka jurnal manual, statistik, kalkulator, dan profil. Berita ekonomi memerlukan Plus atau Pro.
   - Halaman /login/ dibuka pada tab browser tersendiri. Setelah login pertama, nama panggilan wajib disimpan sebelum membuka jurnal. Pilihan bahasa Indonesia/English berada di menu Masuk.
   - Paket Free ($0), Plus ($10/bulan atau $100/tahun), dan Pro ($20/bulan atau $200/tahun). Label penghematan tahunan 17% dibulatkan dari 16,67%.
   - Free memiliki 10 upload setiap 12 jam untuk akun login. Kuota dimulai pada upload pertama dan disimpan di Supabase; berkas yang terlalu besar atau formatnya tidak didukung tidak mengurangi kuota. Plus/Pro mendapat upload tanpa batas dan akses berita ekonomi. Pro tetap coming soon untuk penjualan publik; checkout pembayaran belum diaktifkan.
2. **Jurnal Trading**:
   - Formulir entri cepat (*Quick Entry*), mode tempel teks (*Paste Mode*), dan formulir penuh (*Full Form*).
   - **PDF/PNG/JPG** mengenali riwayat posisi (market, arah, lot, tanggal/waktu, entry, exit, profit) dan setup TradingView (label entry, SL, TP, jarak stop/target, R:R, Qty/PnL alat). Hasil dan teks OCR dapat disimpan dan dibuka kembali secara lokal. Riwayat lengkap bisa dimasukkan ke jurnal lewat tombol impor setelah memilih mata uang profit (USD/IDR). Profit aktual digunakan pada jurnal dan statistik; SL/TP, risiko, serta R:R yang belum diketahui ditandai kosong. Scan yang sama tidak diimpor dua kali ke akun yang sama.
   - Data yang tidak terlihat tetap kosong. Baris terpotong dilewati; posisi identik tidak digabung. Qty/PnL alat chart bukan lot/profit broker. Satu alat posisi per chart didukung; tema lain atau teks buram dapat hanya menghasilkan teks OCR. Gambar maksimal 12 megapiksel, berkas maksimal 10 MB.
   - **CSV/TXT** dapat ditinjau sebelum impor. Excel perlu diekspor ke CSV terlebih dahulu.
   - PDF.js 5.4.296 dan Tesseract.js 6.0.1 dimuat dari CDN saat scan diperlukan. Gunakan server HTTP/HTTPS dan koneksi internet untuk memuat library; pemindaian berlangsung di browser.
   - Tabel riwayat posisi trading dengan perhitungan otomatis rasio R:R, Net P/L USD, dan estimasi Rupiah (IDR).
3. **Statistik & Analitik Kinerja**:
   - Kalkulasi otomatis Win Rate, Total Net Profit, Profit Factor, Max Drawdown, dan rata-rata R-Multiple.
   - Grafik pertumbuhan modal kurva ekuitas (*Equity Curve*) interaktif.
4. **Kalkulator Risiko Institusional**:
   - Kalkulator ukuran lot dari persentase toleransi risiko saldo akun.
   - Kalkulator nilai pip berdasarkan spesifikasi kontrak instrumen.
   - Evaluasi kelayakan rasio Risk to Reward (R:R) sebelum membuka posisi.
5. **Berita & Kalender Ekonomi**:
   - Kalender rilis data makro ekonomi (CPI, NFP, Suku Bunga) dengan filter dampak pasar.
   - Berita dari Investing.com, CNBC, Kontan, Reuters, Al Jazeera, Bloomberg, dan berita publik Trade With FNC. Filter kategori berdasarkan bagian artikel, judul, dan tag penerbit; filter sumber dapat digabung dengan kategori.
   - Kurs jual/beli USD dan BI-Rate berasal dari halaman resmi Bank Indonesia. Konversi jurnal memakai titik tengah kurs transaksi USD BI, dihitung sebagai (jual + beli) / 2. Tanggal publikasi BI ditampilkan; data tersimpan diberi status saat pengambilan gagal.
   - GitHub Actions mengambil dan menerbitkan berita setiap 30 menit setiap hari; jadwal GitHub dapat tertunda. Browser memeriksa pembaruan setiap 5 menit. Waktu pemeriksaan dan status sumber ditampilkan.
   - CME FedWatch dan CME Markets tersedia melalui halaman resmi yang diperbarui oleh CME. Judul artikel mengikuti bahasa penerbit.
   - Modul Market Analysis dan dataset sinyal trading telah dihapus.
6. **Profil & Multi-Akun Broker**:
   - Pengaturan identitas trader dan kurs konversi USD ke IDR.
   - Pengelolaan multi-akun broker simultan.
   - Ekspor & impor data cadangan (*Backup & Restore*) berbasis JSON/CSV yang aman di penyimpanan lokal perangkat.

## Pembaruan rapor dan kurs
Rapor dihitung dari jurnal akun aktif, termasuk kelengkapan SL, rata-rata risiko yang tercatat, dan drawdown. Data psikologi tidak disimpulkan dari profit. Kurs USD/IDR diperbarui otomatis saat aplikasi dibuka dan setiap jam saat terlihat. Sumber Kurs Transaksi BI menerbitkan kurs setiap hari kerja; tanggal data ditampilkan di Profil. Kurs tersimpan digunakan jika jaringan gagal, dan kurs manual dapat diatur.

## Pembaruan tampilan dan data

Hero desktop memenuhi layar awal; panduan forex muncul setelah menggulir. Rapor dihitung dari transaksi akun aktif dan diperbarui saat data disimpan. Kurs referensi USD/IDR menggunakan titik tengah kurs transaksi USD Bank Indonesia pada awal penggunaan dan diperiksa setiap jam; sumber menerbitkan kurs setiap hari kerja. Waktu sumber ditampilkan pada Profil. Jika jaringan gagal, kurs tersimpan tetap digunakan.

Pemeriksaan rapor: `node js/discipline.test.cjs`.

## Auth dan paket Supabase

Project aplikasi: `nmddjuqkdyhcobddinkc` (`journaltrading`). Tidak memakai project JOKIIN. Role paket dan kuota hanya dapat diubah oleh server; frontend membaca/mengurangi kuota melalui RPC `journal_access`. SQL yang diterapkan ada di `supabase/access.sql`; jalankan `supabase/test_access.sql` untuk memeriksa kuota tanpa menyimpan perubahan pengujian.

Login Google memakai redirect di tab login, dengan PKCE dan penyimpanan sesi khusus project. Pengaturan yang masih perlu diisi oleh pemilik:

1. Buat OAuth Web Client khusus Journaling Trading di Google Cloud. Origin: `https://jokitugasbykay.github.io`.
2. Authorized redirect URI: `https://nmddjuqkdyhcobddinkc.supabase.co/auth/v1/callback`.
3. Masukkan Client ID dan Client Secret pada provider Google di Supabase project journaltrading, lalu aktifkan provider. Client Secret tidak boleh masuk ke repository.
4. Pada Supabase Auth URL Configuration, gunakan Site URL `https://jokitugasbykay.github.io/Journaling_trade.github.io/` dan izinkan redirect `https://jokitugasbykay.github.io/Journaling_trade.github.io/login/`.

## Keamanan

Library auth disimpan lokal dengan versi tetap dan pemeriksaan integritas. URL project dan publishable key tetap publik karena browser menghubungi Supabase langsung. Baca [audit keamanan](SECURITY_AUDIT.md) untuk pemeriksaan dan batasan yang masih ada.
