# Laporan tes billing di production (Dodo test mode)

Tanggal: 8 Oktober 2026. Lingkungan: https://mixetape.com (production) dengan Dodo Payments **test mode**. 
Login akun uji lewat OTP yang dikirim ke `qa-*@mixetape.com` → Cloudflare Email Routing → worker `mixetape-qa-inbox` (KV, 1 jam). 
Webhook diuji dua cara: **asli** dari Dodo (checkout, ganti paket, batal lewat API Dodo) dan **bertanda tangan** dengan secret webhook (payload lolos skema resmi plugin) untuk kasus yang tidak bisa dipicu langsung.

**Hasil: 45 dari 45 skenario lolos.** Unit test: 191 lolos.


## Akun & akses

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S01 | Daftar baru lewat OTP (Cloudflare Email Routing → inbox QA) | login berhasil, nama terisi dari email | qa-1, qa-2, qa-3, qa-billing: login OK, nama = 'qa-1', 'qa-2', 'qa-3', 'qa-billing' | ✅ Lolos |  |
| S02 | Tanpa paket: buat post (REST) | 402 plan_required | 402 plan_required | ✅ Lolos |  |
| S03 | Tanpa paket: retry post | 402 plan_required | 402 plan_required | ✅ Lolos |  |
| S04 | Tanpa paket: halaman Billing | 200, menampilkan 'No plan yet' | 200, 'No plan yet' tampil | ✅ Lolos |  |
| S05 | Belum login: halaman Billing | redirect (307) | 307 | ✅ Lolos |  |
| S06 | Belum login: buat checkout | 401 | 401 | ✅ Lolos |  |

## Checkout & manipulasi

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S07a | Checkout lama (/dodopayments/checkout) | 404 | 404 | ✅ Lolos |  |
| S07b | Checkout + kode diskon | 400 | 400 unknown_field | ✅ Lolos |  |
| S07c | Checkout + trial 365 hari | 400 | 400 unknown_field | ✅ Lolos |  |
| S07d | Checkout + referenceId user lain | 400 | 400 unknown_field | ✅ Lolos |  |
| S07e | Checkout + return_url asing | 400 | 400 unknown_field | ✅ Lolos |  |
| S07f | Checkout produk di luar katalog | 400 | 400 invalid_field | ✅ Lolos |  |
| S07g | Checkout Creator + add-on akun | 400 | 400 invalid_field | ✅ Lolos |  |
| S07h | Checkout Studio yearly + add-on bulanan | 400 | 400 invalid_field | ✅ Lolos |  |
| S07i | Checkout 3× paket yang sama | 400 | 400 invalid_field | ✅ Lolos |  |
| S07j | Checkout add-on negatif | 400 | 400 invalid_field | ✅ Lolos |  |
| S08a | Checkout sah: Studio monthly | 200 + URL checkout | 200 URL | ✅ Lolos |  |
| S08b | Checkout sah: Studio yearly + 25 akun | 200 + URL checkout | 200 URL | ✅ Lolos |  |
| S09 | Checkout Creator monthly dari pricing (UI) | halaman Dodo, trial 7 hari | Dodo test checkout: 'Creator (monthly)', '7 day free trial, trial ends 15/10/2026', nama & email terisi | ✅ Lolos | dijalankan dari localhost dengan key test |
| S10 | Bayar kartu test 4242 → webhook asli ke production | langganan tersimpan: creator/monthly/active/15, customer id | sub tersimpan untuk qa-1: creator, monthly, active, 15 akun, tagihan pertama 15-10, dodo_customer_id terisi | ✅ Lolos | user dicocokkan lewat email (referenceId = id lokal) |

## Selama trial / paket aktif

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S11 | Trial aktif: buat post | guard lolos (404 akun tidak ada, bukan 402) | 404 not_found | ✅ Lolos |  |
| S12 | Trial aktif: checkout kedua | 409 (arahkan ke portal) | 409 You already have a plan. Change or resume it from Billing. | ✅ Lolos |  |
| S13 | Trial aktif: buka portal Dodo | 200 + URL portal | 200 URL | ✅ Lolos |  |
| S14 | Trial aktif: halaman Billing | Creator monthly, 0 of 15 akun | tampil sesuai | ✅ Lolos |  |
| S15 | Ganti paket via Dodo API → Studio yearly + 25 akun (webhook asli) | plan=studio, period=yearly, accounts=125 | plan=studio, period=yearly, accounts=125, status=active (webhook asli plan_changed) | ✅ Lolos | API change-plan Dodo: mode prorated_immediately & difference_immediately → 500 dari Dodo saat trial; do_not_bill → 200 |

## Webhook: urutan & keamanan

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S16 | Webhook terlambat: 'cancelled' bertanggal 1 jam lalu | diabaikan, status tetap active | HTTP 200; status=active | ✅ Lolos |  |
| S17 | Webhook duplikat (event sama dikirim ulang) | 200, data tidak berubah | HTTP 200; plan=creator, accounts=15, status=active | ✅ Lolos |  |
| S18 | Webhook dengan tanda tangan salah | 400, ditolak | 400 {"message":"Webhook Error: No matching signature found"} | ✅ Lolos |  |
| S19 | Webhook tanpa header tanda tangan | 400 | 400 | ✅ Lolos |  |
| S20 | Webhook produk di luar katalog | 200, tidak disimpan | HTTP 200; baris=0 | ✅ Lolos |  |
| S21 | Webhook untuk user yang tidak dikenal | 200, tidak disimpan | HTTP 200; baris=0 | ✅ Lolos |  |

## Batas akun & pembayaran gagal

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S22 | qa-2: Creator aktif (webhook bertanda tangan) | plan=creator, accounts=15 | HTTP 200; plan=creator, accounts=15 | ✅ Lolos |  |
| S23 | qa-2: 16 channel terhubung, paket 15 | 402 plan_limit_reached | 402 plan_limit_reached | ✅ Lolos |  |
| S24 | qa-2: 15 channel terhubung, paket 15 | guard lolos (404) | 404 not_found | ✅ Lolos |  |
| S25 | qa-2: pembayaran gagal (on_hold) | status on_hold, buat post 402 | status=on_hold; 402 plan_required | ✅ Lolos |  |
| S25b | qa-2: pesan saat on_hold | 402 dengan pesan 'on hold' (bukan 'needs a plan') | 402 Your plan is on hold, so scheduling is paused. Pay the open invoice or | ✅ Lolos |  |
| S26 | qa-2: on_hold lalu checkout baru | 409 (bayar tagihan di portal, bukan langganan kedua) | 409 You already have a plan. Change or resume it from Billing. | ✅ Lolos |  |
| S27 | qa-2: halaman Billing saat on_hold | status on hold + tombol portal | tampil sesuai | ✅ Lolos |  |
| S28 | qa-2: tagihan dibayar (renewed → active) | guard lolos lagi (404) | HTTP 200; 404 | ✅ Lolos |  |

## Pembatalan & trial ulang

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S29 | Batal di akhir periode (Dodo API, webhook asli) | cancel_at_period_end=1, masih boleh publish, Billing 'Ends on' | API 200; flag=1, status=active, buat post 404, 'Ends on' tampil | ✅ Lolos |  |
| S30 | Batal sekarang (Dodo API, webhook asli) | status cancelled, buat post 402 | API 200; status=cancelled, buat post 402 plan_required | ✅ Lolos |  |
| S31 | Setelah batal: checkout lagi | 200 (diizinkan), tanpa trial | 200, URL dibuat; halaman Dodo tanpa baris '7 day free trial', total langsung ditagih | ✅ Lolos | trial hanya sekali per user |

## Guard saat publish & akun exempt

| No | Skenario | Diharapkan | Hasil | Status | Catatan |
|---|---|---|---|---|---|
| S32 | qa-3: jadwalkan post saat paket aktif | 201/200, post scheduled | 201 e6557d69-b6c6-45b0-be6a-156e9749dfa0 | ✅ Lolos |  |
| S33 | qa-3: langganan batal sebelum jam tayang | post gagal dengan alasan paket (tidak dikirim ke platform) | status=failed; error=Scheduling posts needs a plan. Start the 7-day free trial at https://mixetape.com/pricing. | ✅ Lolos |  |
| S34 | Akun pemilik (exempt) setelah guard dipasang | pipeline tetap bisa membuat & menerbitkan post, tidak ada yang gagal karena paket | exempt=inurhuda00@gmail.com; post dibuat sejak 05-10: 8; jatuh tempo sejak 05-10: failed 1, published 7; gagal karena paket: 0 | ✅ Lolos |  |

## Bug yang ditemukan saat tes (sudah diperbaiki & di-deploy)

| No | Bug | Dampak | Perbaikan | Commit |
|---|---|---|---|---|
| B1 | User yang daftar lewat OTP namanya kosong; Dodo menolak customer tanpa nama | **Semua checkout user OTP gagal (500)** | Nama awal = bagian depan email; checkout mengisi nama kosong | `0c40318` |
| B2 | Better Auth *menggabungkan* body hasil hook, bukan mengganti | Field dari browser (kode diskon, trial, return_url) bisa lolos ke Dodo | Checkout hanya menerima `slug` dan `product_cart`, selain itu 400 | `c9d2ba8` |
| B3 | Endpoint checkout lama plugin (`/dodopayments/checkout`) tidak lewat guard | Bisa membuat link bayar dengan produk/harga dari browser | Diblokir (404) | `96b819f` |
| B4 | Trial bisa diminta berkali-kali lewat panggilan langsung | Trial gratis berulang | Trial dihitung di server: hanya untuk user yang belum pernah berlangganan | `96b819f` |
| B5 | Post terjadwal tetap terbit setelah langganan batal | Jadwalkan banyak post saat trial, lalu batal = publish gratis | Paket dicek ulang saat post akan terbit; retry juga butuh paket | `96b819f` |
| B6 | Webhook datang tidak berurutan bisa menimpa status baru | Status langganan salah | Simpan waktu event; event lebih lama diabaikan | `96b819f` |
| B7 | Langganan on_hold/paused tetap bisa checkout lagi | Langganan ganda | Diarahkan ke portal (409) | `96b819f` |
| B8 | Pesan saat on_hold bilang "needs a plan" | Membingungkan | Pesan menyebut paket on hold / dijeda | `72e32a7` |

## Catatan dari sisi Dodo

| Hal | Detail | Saran |
|---|---|---|
| Ganti paket saat trial | API `change-plan` Dodo membalas **500** untuk mode `prorated_immediately` dan `difference_immediately` saat langganan masih trial; `do_not_bill` berhasil | Coba lagi ganti paket dari portal Dodo setelah trial berakhir; kalau tetap 500, laporkan ke Dodo |
| Mata uang | Checkout tampil dalam IDR (Adaptive Currency) dari harga USD | Sesuai pengaturan Dodo, tidak perlu diubah |

## Belum diuji / di luar cakupan

| Hal | Alasan |
|---|---|
| Perpanjangan otomatis setelah trial 7 hari (charge pertama) | Baru terjadi 15-10-2026; tagihan akan memicu `subscription.renewed` |
| Kartu yang gagal saat perpanjangan (kartu test 4000 0000 0000 0341) | Butuh menunggu tanggal tagih berikutnya |
| Live mode | Belum dibuat produk & key live |

## Data uji yang tertinggal di production

| Data | Keterangan |
|---|---|
| User `qa-1`, `qa-2`, `qa-3`, `qa-billing` @mixetape.com | Akun uji; login hanya lewat inbox QA |
| Langganan qa-1 (asli, Dodo test), qa-2 (sintetis, active), qa-3 (sintetis, cancelled) | Bisa dihapus kapan saja |
| 1 post gagal milik qa-3 | Bukti S33 |
| Worker `mixetape-qa-inbox` + 7 aturan Email Routing `qa-*@` | Dipakai untuk tes berikutnya |
