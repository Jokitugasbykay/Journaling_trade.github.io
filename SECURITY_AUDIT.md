# Audit keamanan Journaling Trading

Tanggal: 8 Oktober 2026. Ruang lingkup: kode aplikasi, riwayat Git lokal, dependensi yang digunakan, dan database project journaltrading. Audit ini bukan sertifikasi keamanan atau uji penetrasi menyeluruh.

## Standards

| Temuan | Status setelah perbaikan |
| --- | --- |
| Jurnal pengguna sebelumnya dapat terbawa ke akun cloud kosong | Diperbaiki: cache dipisahkan per user ID; impor jurnal tamu meminta konfirmasi |
| Sync yang masih berjalan dapat memakai state akun baru | Diperbaiki: payload diambil sebelum await dan akun diperiksa setelah setiap request |
| Reset menghapus storage tetapi menyisakan data di memori | Diperbaiki: loadData mengosongkan state sebelum membaca ulang |
| Callback penyimpanan nickname dan restore backup melewati pergantian akun | Diperbaiki: callback lama ditolak jika pemilik sudah berubah |
| Handler tanpa pemanggil | Dihapus: toggleBillingCycle, openQuickTrade, openProfileModal |
| CSS ticker lama dan banner komentar dekoratif | Dihapus; ticker aktif tetap memakai TradingView |

## Spec

| Temuan | Status setelah perbaikan |
| --- | --- |
| Riwayat scan dan teks dokumen memakai storage bersama | Diperbaiki: namespace user ID dan preview dibersihkan saat pergantian akun |
| Kalender membuat data contoh saat jaringan gagal dan menampilkan label Live | Dihapus; sekarang menampilkan waktu sumber, data tersimpan, atau unavailable |
| URL CDN library Supabase tampil pada HTML | Library versi tetap disimpan lokal dengan SHA-384 integrity dan lisensi MIT |
| Endpoint project terlihat dari browser | Tetap terlihat. Pengguna belum memiliki hosting backend dan meminta menyelesaikan audit terlebih dahulu |

Ditambahkan Content Security Policy dan kebijakan referrer. CSP membatasi sumber script, koneksi, iframe, dan melarang object. `unsafe-inline` masih diperlukan oleh handler HTML yang ada; CSP belum merupakan kebijakan tanpa inline script.

## Pengujian dan bukti

- `node js/security.test.cjs`: isolasi namespace, penolakan sync/nickname/restore lama, integritas library, dan penghapusan fallback kalender.
- `node js/copy.test.cjs`, `node js/discipline.test.cjs`, `python scripts/test_news.py`: lolos.
- Uji browser dengan akun mock A, logout dari tab lain, lalu akun B kosong: jurnal A tidak terlihat/tidak diunggah ke B; scan A tidak tampil di B. Tampilan mobile, ticker, dan kegagalan feed kalender diperiksa.
- `supabase/test_security.sql`: lolos pada database dalam transaksi rollback. SELECT/UPDATE/INSERT antar pengguna, relasi account_id milik orang lain, akses anon, dan izin ubah paket diuji tanpa menyimpan data pengujian.
- `supabase/test_access.sql`: lolos dalam rollback, termasuk upload ke-11, reset 12 jam, dan akses Plus.
- Request REST dengan publishable key tanpa login: tabel trades mengembalikan 0 baris; journal_access ditolak HTTP 401.
- Semua lima tabel aplikasi memakai RLS. Policy UPDATE memiliki USING dan WITH CHECK. Fungsi kuota memakai auth.uid dan search_path kosong; izin EXECUTE anon dicabut. Fungsi trigger signup tidak dapat dijalankan oleh anon/authenticated.
- 55 revisi Git lokal diperiksa untuk pola secret key, JWT lengkap, private key, dan password provisioning sebelumnya: tidak ditemukan kecocokan. Ini bukan jaminan bahwa semua bentuk rahasia telah terdeteksi.
- `npm audit` pada lockfile sementara untuk supabase-js 2.86.0, tesseract.js 6.0.1 dan pdfjs-dist 5.4.296 beserta dependensi yang di-resolve: 0 advisory. Lockfile pemeriksaan ada di workspace audit, bukan dependensi runtime aplikasi.
- EXPLAIN ANALYZE query trades dengan user ID kosong memakai trades_user_opened_idx; waktu eksekusi 0,116 ms, hasil 0 baris. Ini bukan benchmark beban produksi. Index relasi tidak dihapus hanya karena belum tercatat dipakai.

## Batasan yang belum selesai

1. **Endpoint dan publishable key bukan rahasia.** Browser tetap terhubung langsung ke Supabase. Untuk menyembunyikan endpoint dari client perlu backend gateway. Menyimpan SDK lokal atau mengubah nama variabel tidak menyembunyikan request Network. [Dokumentasi API keys](https://supabase.com/docs/guides/getting-started/api-keys).
2. **Akses Plus dan kuota scan belum tahan modifikasi client.** Paket/counter dilindungi database, tetapi berita.json masih file publik dan OCR berjalan di perangkat. Client yang dimodifikasi dapat membaca feed atau melewati pemanggilan counter. Penegakan penuh memerlukan backend untuk konten dan pemrosesan.
3. **Leaked password protection belum aktif.** Advisor Supabase memberikan WARN. Fitur tersebut tersedia pada paket Supabase Pro atau lebih tinggi; tidak dilakukan upgrade berbayar. [Pengaturan password](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
4. **Cache perangkat tidak terenkripsi.** Namespace mencegah aplikasi mencampur akun, tetapi pengguna yang memiliki akses ke profil browser/DevTools masih bisa membaca localStorage. Ini mencakup jurnal, backup, scan, dan sesi auth. Password founder yang sama dan pernah dibagikan melalui chat sebaiknya diganti melalui pengaturan akun; audit ini tidak mengubahnya.
5. **Google OAuth masih membutuhkan konfigurasi provider.** Tidak memakai project JOKIIN dan tidak memasukkan OAuth secret ke repo.

Info advisor `RLS Enabled No Policy` untuk tabel private account_access adalah deny-by-default yang disengaja; tidak ditambahkan policy yang membuka tabel. Data diakses melalui fungsi terkontrol. Tidak ditemukan temuan XSS terkonfirmasi pada jalur render yang diperiksa; escaping, allowlist URL berita, safeId, dan pencegahan formula CSV dipertahankan.

## Migrasi cache lama

Cache cloud lama yang sebelumnya memakai key tamu diarsipkan dalam `fncjt_legacy_backup` sebelum dipindahkan ke namespace akun. Arsip hanya lokal dan tidak masuk Git. Data server tetap diambil dari akun yang sedang login. Jika storage penuh dan arsip tidak dapat disimpan, migrasi berhenti sebelum menghapus key lama. Jurnal/scan tamu yang tidak pernah dipakai untuk cloud tetap berada pada namespace tamu.

Ringkasan: bug pemisahan akun, callback lama, reset, scan, dan fallback kalender diperbaiki; endpoint publik dan keterbatasan backend dicatat secara eksplisit.
