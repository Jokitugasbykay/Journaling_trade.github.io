# journalingtrade

> **Discipline in Every Execution. Clarity in Every Trade.**  
> Platform jurnal trading modern, analitik statistik berbasis probabilitas, kalkulator risiko, dan kalender makro ekonomi.

---

## 📁 Struktur Repositori

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

## 🚀 Cara Menjalankan

Aplikasi ini dibangun menggunakan arsitektur **Client-Side Open Source**. Anda tidak memerlukan database server ataupun konfigurasi backend yang rumit.

1. **Buka Langsung di Browser**:
   - Cukup klik dua kali (*double-click*) berkas `index.html` pada File Explorer Anda, atau klik kanan lalu pilih **Open with Google Chrome / Edge / Firefox**.
2. **Atau Melalui Local Server**:
   ```bash
   npx serve .
   ```

---

## 🛠️ Fitur & Modul Utama

1. **Beranda (Showcase Stage)**:
   - Header editorial modern dengan tipografi bold kontras tinggi.
   - Panggung showcase tablet interaktif dengan kartu harga bertingkat (*Tier Card* putih yang diangkat).
   - Sakelar harga bulanan (*Monthly*) & tahunan (*Annual*) dinamis.
   - 4 kartu pasar mengambang (*Floating Market Cards*): **XAUUSD**, **EURUSD**, **GBPUSD**, **BTCUSD** dilengkapi grafik sparkline SVG real-time.
2. **Jurnal Trading**:
   - Formulir entri cepat (*Quick Entry*), mode tempel teks (*Paste Mode*), dan formulir penuh (*Full Form*).
   - Dukungan unggah & impor berkas jurnal multi-format: **PDF**, **TXT**, **Excel/CSV**, dan tangkapan layar **PNG**.
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
