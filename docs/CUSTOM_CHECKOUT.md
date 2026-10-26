# Checkout kustom — sandbox

UI QRIS dan virtual account menggunakan modal gelap Journalingtrade. Kartu dan metode lain tetap menggunakan Snap. Nama/identitas merchant di aplikasi bank mengikuti akun Midtrans; branding merchant bersama tidak diubah.

## Alur

1. Pengguna memilih paket/periode dan menyetujui ketentuan.
2. `midtrans-custom-checkout` memvalidasi JWT menggunakan Supabase Auth. Quote dihitung server menggunakan katalog, pajak, dan konversi yang sudah ada; browser tidak menentukan jumlah tagihan.
3. Membuka modal hanya membaca quote. Setelah metode dipilih dan pengguna menekan tombol pembayaran uji, server membuat instruksi Core API sandbox.
4. Order mengikat UUID pemilik, paket/periode, dan idempotency key. Retry dengan key sama mengembalikan order sebelumnya; jumlah/metode yang tidak cocok ditolak. Pemilik lain tidak dapat membaca order.
5. Browser menampilkan QR/VA dari Midtrans dan memeriksa status setiap 15 detik selama checkout terbuka. Penutupan/pergantian akun membatalkan request dan polling serta membersihkan detail yang ditampilkan.
6. Header `X-Override-Notification` mengarahkan notifikasi transaksi aplikasi ini ke webhook Journalingtrade tanpa mengganti pengaturan global merchant. Webhook memverifikasi signature, lalu membaca status authoritative dari Midtrans. Order Core mengikat pemilik melalui order ID; Snap menggunakan metadata yang dibaca kembali dari provider. Metadata notifikasi browser tidak memberikan akses.
7. Pembayaran pending/gagal tidak mengubah langganan yang sudah ada. Event sukses memiliki hash stabil dan waktu settlement provider. Refund order lama tidak membatalkan langganan yang berasal dari order baru.

QRIS dan VA adalah pembayaran satu kali untuk periode paket; UI tidak mengklaim debit/perpanjangan otomatis. Tanggal akhir periode dibatasi ke tanggal terakhir bulan tujuan bila diperlukan.

## Konfigurasi server

- Hanya proyek journaltrading `nmddjuqkdyhcobddinkc`.
- `MIDTRANS_SERVER_KEY` di environment mendapat prioritas. Kredensial sandbox yang sebelumnya ada di source function dipindahkan ke Vault dengan nama `journalingtrade_midtrans_sandbox`.
- Getter Vault `journal_midtrans_sandbox_key()` hanya dapat dieksekusi `service_role`; tidak dikirim ke frontend atau repository.
- Migration `20261026010000_custom_checkout_events.sql` menambahkan getter dan wrapper event. Tidak mereset tabel, mengubah RLS data jurnal, atau mengganti merchant.
- Webhook mengabaikan perubahan entitlement dari simulasi sandbox secara default. `MIDTRANS_SANDBOX_ALLOW_ENTITLEMENTS=true` hanya untuk pengujian eksplisit pada lingkungan terisolasi; tidak diaktifkan dalam sesi ini.
- Semua URL transaksi tetap `api.sandbox.midtrans.com`; tidak ada aktivasi pembayaran produksi.

## Pemeriksaan yang dijalankan

- `node --experimental-transform-types tests/payment-core.cjs`: quote server, request charge, idempotency, method conflict, cross-user denial, timezone dan akhir bulan, signature, pending safety dan event ownership. Provider adalah fixture.
- `node tests/payment-sql.cjs`: PostgreSQL/PGlite, refund order lama/current dan larangan eksekusi RPC sensitif oleh anon/authenticated.
- `node tests/payment-ui.cjs`: UI browser desktop/mobile, pemilihan metode, tidak membuat charge saat membuka modal, status pending/paid, pergantian akun, Escape, dan overflow. Provider adalah fixture.
- Tes kontrak payment dan copy/security/discipline repository.
- Backend hosted: health mengonfirmasi `sandbox` dan `configured:true`; request quote tanpa login ditolak 401; origin asing ditolak 403. SQL hosted mengonfirmasi getter hanya untuk backend dan RPC event tidak dapat dipanggil pengguna.

Uji hosted dengan akun Auth sementara juga lulus: login, quote, BCA VA, retry idempotent, status pending, pembuatan QRIS, serta pengambilan gambar QR dari Midtrans sandbox asli (`scripts/smoke_custom_checkout.py`). Tidak ada transaksi uang sungguhan. Belum dibuktikan dalam sesi ini: settlement/refund melalui notifikasi provider dan setiap channel bank lainnya. Tes fixture tidak diklaim sebagai bukti tersebut. Channel yang belum diaktifkan ditangani sebagai error provider. Aktivasi uang sungguhan tetap memerlukan persetujuan dan konfigurasi produksi tersendiri.

Rollback UI: kembalikan handler ke Snap dan lepaskan pemanggilan `JTCustomCheckout`; endpoint Snap dipertahankan. Jangan menghapus data langganan atau Vault untuk rollback tampilan.
