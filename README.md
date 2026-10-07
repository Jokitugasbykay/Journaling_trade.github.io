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

Aplikasi ini dibangun menggunakan arsitektur **Client-Side Open Source**. Anda tidak memerlukan database server ataupun konfigurasi backend yang rumit.

1. **Buka Langsung di Browser**:
   - Cukup klik dua kali (*double-click*) berkas `index.html` pada File Explorer Anda, atau klik kanan lalu pilih **Open with Google Chrome / Edge / Firefox**.
2. **Atau Melalui Local Server**:
   ```bash
   npx serve .
   ```

---

##  Fitur & Modul Utama

1. **Beranda & Akses Awal**:
   - Panduan berbahasa Indonesia dengan 28 bagian dan lebih dari 11.000 kata tentang dasar forex, penggunaan jurnal, evaluasi, psikologi, dan latihan. Seluruh materi terbuka di bawah hero tanpa daftar isi.
   - Tombol Minat menuju paket. Tombol Coba membuka akses Jurnal, Statistik, Kalkulator, Berita Ekonomi, dan Profil.
   - Saat pertama masuk dengan profil lokal, hanya Beranda yang dapat dibuka. Pilihan bahasa Indonesia/English berada di menu Masuk.
   - Paket Free ($0), Plus ($10/bulan atau $100/tahun), dan Pro ($20/bulan atau $200/tahun). Label penghematan tahunan 17% dibulatkan dari 16,67%.
   - Login Google tampil sebagai tombol belum tersedia. Profil lokal bukan autentikasi cloud; semua profil di browser ini memakai penyimpanan yang sama. Pembayaran Plus/Pro belum dibuka.
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
   - Pembatasan analitik institusional Pro.
6. **Profil & Multi-Akun Broker**:
   - Pengaturan identitas trader dan kurs konversi USD ke IDR.
   - Pengelolaan multi-akun broker simultan.
   - Ekspor & impor data cadangan (*Backup & Restore*) berbasis JSON/CSV yang aman di penyimpanan lokal perangkat.

## Pembaruan rapor dan kurs
Rapor dihitung dari jurnal akun aktif, termasuk kelengkapan SL, rata-rata risiko yang tercatat, dan drawdown. Data psikologi tidak disimpulkan dari profit. Kurs USD/IDR diperbarui otomatis saat aplikasi dibuka dan setiap jam saat terlihat. Sumber ExchangeRate-API memperbarui data sekali sehari; waktu data ditampilkan di Profil. Kurs tersimpan digunakan jika jaringan gagal, dan kurs manual dapat diatur.

## Pembaruan tampilan dan data

Hero desktop memenuhi layar awal; panduan forex muncul setelah menggulir. Rapor dihitung dari transaksi akun aktif dan diperbarui saat data disimpan. Kurs referensi USD/IDR diambil otomatis dari ExchangeRate-API pada awal penggunaan dan diperiksa setiap jam; sumber memperbarui kurs harian, bukan per detik. Waktu sumber ditampilkan pada Profil. Jika jaringan gagal, kurs tersimpan tetap digunakan.

Pemeriksaan rapor: `node js/discipline.test.cjs`.
