# Review platform untuk production mixetape

Dokumen kerja: apa yang harus disetujui tiap platform supaya mixetape bisa dipakai **siapa
saja** (SaaS), bukan hanya akun kamu sendiri; cara submit; dan kuota yang perlu dinaikkan.
Status per 4 Oktober 2026.

> Ringkasnya: **Bluesky dan Mastodon sudah siap production.** Lima platform lain
> (YouTube, Facebook, Instagram, Threads, TikTok, Pinterest) masih dalam mode
> uji/development dan butuh review. Pinterest sudah Trial: connect jalan, Pin lewat API Sandbox. Hampir semua minta **video demo** alur lengkap di
> mixetape.com.
>
> Teks siap-tempel untuk setiap form dan naskah video demonya ada di
> [PRODUCTION-SUBMISSIONS.md](PRODUCTION-SUBMISSIONS.md).

## Ringkasan

| Platform | Status sekarang | Yang dibutuhkan untuk production | Kuota / batas yang perlu diperhatikan |
|---|---|---|---|
| YouTube | Consent screen **In production**, user cap 13/100; justifikasi scope sudah diisi | Verifikasi OAuth Google (scope sensitif) + audit YouTube API untuk kuota lebih | 100 upload/hari **per project**, dibagi semua user |
| Facebook Pages | Development mode; App Settings + callback sudah diisi | Meta App Review (Advanced Access) + Business Verification | Rate limit per Page, cukup |
| Instagram | Development mode (hanya Instagram Tester) | Meta App Review + Business Verification | 100 post/24 jam per akun IG |
| Threads | Development mode (hanya Threads Tester) | Meta App Review per permission + app di-publish | 250 post/24 jam per profil |
| TikTok | App draft, belum tersimpan | Audit Content Posting API | Sebelum audit: hanya privat, maks 5 user/24 jam |
| Pinterest | **Trial access**, connect jalan; Pin hanya lewat API Sandbox | Upgrade ke Standard (video demo) | Trial: 1.000 request/hari, Pin hanya terlihat oleh pembuat, tanpa video Pin |
| Bluesky | **Production** | Tidak ada review | Batas tulis per akun (lihat bawah) |
| Mastodon | **Production** | Tidak ada review | 300 request/5 menit, 30 upload media/30 menit |
| Login Google | Jalan | Verifikasi brand jika consent screen menampilkan logo/nama | — |
| Login GitHub | Jalan | Tidak ada | — |

## Prasyarat bersama (siapkan sekali, dipakai semua review)

- [x] **Privacy Policy**: https://mixetape.com/privacy (sudah menyebut mixetape layanan publik).
- [x] **Terms of Service**: https://mixetape.com/terms.
- [x] **Domain terverifikasi**: `mixetape.com` sudah diverifikasi di TikTok (DNS TXT) dan Google Search Console (`google-site-verification` di DNS).
- [x] **Penghapusan data**. Halaman instruksi https://mixetape.com/data-deletion sudah ada, plus callback Meta untuk deauthorize dan data deletion (Facebook, Instagram, Threads). URL yang harus diisi di dashboard Meta ada di bagian [URL callback Meta](#url-callback-meta).
- [ ] **Akun demo untuk reviewer**. Meta dan Google sering minta login yang bisa dipakai reviewer. Siapkan akun mixetape khusus review (email + kode login), jangan akun pribadi.
- [ ] **Video demo per platform**. Rekam layar (Cmd+Shift+5), tampilkan address bar `mixetape.com`, alur: login → Channels → Connect platform → setujui izin → jadwalkan post → post terbit di platform → (jika diminta) analytics/komentar. Satu video per platform; Meta minta per permission.
- [ ] **Business Verification Meta** untuk entitas bisnis kamu (dokumen legal + domain/email bisnis). Ini yang paling lama (bisa 1–2+ minggu), mulai duluan.

---

## YouTube (Google)

**Yang mixetape minta:**
- `https://www.googleapis.com/auth/youtube.force-ssl`, scope **sensitif**: upload, edit, playlist, caption, komentar.
- `https://www.googleapis.com/auth/yt-analytics.readonly`: analytics.

### 1. Verifikasi OAuth app (wajib agar user lain bisa connect)

**Sudah dikerjakan (4 Okt 2026):** Audience **In production** (user cap **13/100**, seumur
project); Branding: privacy/terms diperbaiki ke `/privacy` dan `/terms` (sebelumnya 404);
Data Access: justifikasi `youtube.force-ssl` tersimpan. Verification Center: *data access
verified*, **branding belum tampil** (perlu submit ulang setelah masalah di bawah beres).

> ⚠️ **Masalah project bersama.** Project Google `mixetape` (50575334904) punya tiga OAuth
> client: **youtube**, **google login**, dan **spectro.mixetape.com**. Client spectro memakai
> redirect `spectro.hanssn.workers.dev`, sehingga authorized domain `hanssn.workers.dev`
> harus tetap ada, padahal domain itu tidak bisa kamu verifikasi (milik Cloudflare). Google
> juga meminta video demo mencakup **semua** client di project. Saran: pindahkan spectro ke
> project Google sendiri (atau pakai `spectro.mixetape.com` saja), hapus `hanssn.workers.dev`,
> lalu submit verifikasi.

Tanpa verifikasi, user lain melihat layar "Google hasn't verified this app", dan app dengan
scope sensitif dibatasi **100 user**. Kalau consent screen masih berstatus **Testing**,
refresh token **kedaluwarsa setiap 7 hari**. Cek statusnya di Google Cloud Console →
**Google Auth Platform → Audience**; harus **In production**.

Cara submit:
1. Google Cloud Console (project OAuth client YouTube) → **Google Auth Platform → Branding**: isi nama app, logo, homepage `https://mixetape.com`, privacy, terms, domain terotorisasi `mixetape.com`.
2. **Data Access**: pastikan hanya dua scope di atas yang terdaftar, masing-masing dengan alasan penggunaan.
3. **Verification Center → Submit for verification.**
4. Siapkan **video demo (YouTube, unlisted)** yang menunjukkan: consent screen Google dengan client ID terlihat di URL, lalu setiap fitur yang memakai `youtube.force-ssl` (upload video terjadwal, set thumbnail, playlist, caption, balas komentar) dan analytics.
5. Jawab email dari tim verifikasi Google. Biasanya beberapa hari sampai beberapa minggu.

### 2. Kuota YouTube Data API (wajib sebelum banyak user)

Default per **Google Cloud project** per hari:
- **100 `videos.insert`** (upload) dalam bucket sendiri;
- 100 `search.list`;
- **10.000 unit** untuk endpoint lain (`thumbnails.set` 50, `videos.update` 50, `playlistItems.insert` 50, `captions.insert` 400, `videos.list` 1, …).

Semua channel di mixetape memakai satu project, jadi **100 upload/hari dibagi seluruh
user**. Untuk SaaS ini harus dinaikkan.

Cara menaikkan:
1. Isi **YouTube API Services – Audit and Quota Extension Form**: https://support.google.com/youtube/contact/yt_api_form
2. Isi: Project number, use case (scheduler: menjadwalkan video user ke channel mereka sendiri), perkiraan volume (upload/hari, user aktif), alasan per endpoint, link privacy dan terms, screenshot alur OAuth, akun demo.
3. Ini sekaligus **audit kepatuhan** YouTube API Services Terms. Tidak ada jalur instan; balasan bisa berminggu-minggu dan bisa ditolak.
4. Setelah disetujui, audit ulang berkala (form yang sama).

**Kebutuhan kuota (perkiraan, untuk diisi di form):** setiap post YouTube dari mixetape
memakai 1 `videos.insert`, +50 bila ada thumbnail, +50 per playlist, +400 per caption, +50
per komentar pertama, dan beberapa `videos.list` (1 unit) untuk konfirmasi live. Contoh: 300
upload/hari dengan thumbnail dan playlist berarti 300 upload + ±30.000 unit.

---

## Meta: Facebook Pages, Instagram, Threads

Satu app Meta **"mixetape"** (App ID `1634991808197377`), saat ini **development mode**:
hanya akun dengan role di app (admin/tester) yang bisa connect.

### Langkah umum Meta

1. **Business Verification** (App Settings → Basic → "Verify business", atau di Business Manager → Security Center). Wajib untuk Advanced Access.
2. **App Settings → Basic:** privacy URL, terms URL, **Data Deletion Request URL** (lihat [URL callback Meta](#url-callback-meta)), ikon app, kategori, contact email.
3. **App Review → Permissions and Features:** minta **Advanced Access** untuk setiap permission di bawah. Setiap permission butuh:
   - deskripsi cara mixetape memakainya;
   - **screencast** yang menunjukkan permission itu dipakai sungguhan (login → izin → fitur jalan);
   - instruksi uji + akun demo untuk reviewer.
4. Setelah disetujui: **ubah app ke Live** (toggle di atas dashboard).

> Meta menolak permission yang diminta tapi tidak terlihat dipakai di video. Jangan minta
> lebih dari yang dipakai, dan tunjukkan setiap permission dipakai di video.

### URL callback Meta

**Sudah diisi semua (4 Okt 2026)**, termasuk App Settings → Basic (domain, terms, ikon,
kategori). Sisa dari kamu: Business Verification, akun demo, screencast, Submit.

Isi di dashboard app Meta "mixetape". Semua sudah live dan memverifikasi `signed_request`
dengan secret app masing-masing.

| Di mana | Kolom | URL |
|---|---|---|
| App Settings → Basic | Data Deletion Request URL (pilih "callback") | `https://mixetape.com/api/connect/facebook/data-deletion` |
| Facebook Login for Business → Settings | Deauthorize callback URL | `https://mixetape.com/api/connect/facebook/deauthorize` |
| Instagram → API setup with Instagram login → Business login settings | Deauthorize callback URL | `https://mixetape.com/api/connect/instagram/deauthorize` |
| (sama) | Data deletion request URL | `https://mixetape.com/api/connect/instagram/data-deletion` |
| Threads use case → Pengaturan | Uninstall Callback URL | `https://mixetape.com/api/connect/threads/deauthorize` |
| (sama) | Delete Callback URL | `https://mixetape.com/api/connect/threads/data-deletion` |

Kalau sebuah kolom meminta *instructions URL* (bukan callback), isi dengan
`https://mixetape.com/data-deletion`.

Yang terjadi saat Meta memanggil:
- **Deauthorize/uninstall:** token channel milik orang itu dihapus, dan channel tampil "reconnect" (webhook `account.reconnect_needed` terkirim).
- **Data deletion:** channel milik orang itu dan post-nya dihapus seketika. Meta menerima kode konfirmasi, dan orang itu bisa mengeceknya di `https://mixetape.com/data-deletion?code=…` (berlaku 90 hari).

Catatan: Page Facebook yang tersambung **sebelum 3 Oktober 2026** belum menyimpan ID user
Facebook yang memberi izin, sehingga callback tidak bisa mencocokkannya. Connect ulang
Page-Page itu sekali, dan ID-nya tersimpan.

### Facebook Pages

Permission yang mixetape minta (semua perlu Advanced Access):

| Permission | Dipakai untuk | Tunjukkan di video |
|---|---|---|
| `pages_show_list` | Daftar Page saat connect | Pilih Page di dialog Connect |
| `pages_manage_posts` | Publish video/foto/album/Reel | Jadwalkan post → terbit di Page |
| `pages_read_engagement` | Status post | Post terlihat "Sent" + link |
| `pages_read_user_content` | Membaca komentar | Lihat komentar di mixetape |
| `pages_manage_engagement` | Balas/moderasi komentar | Balas komentar dari mixetape |
| `read_insights` | Analytics Page/post | Halaman analytics |
| `business_management` | Page yang dimiliki business portfolio | Connect Page milik portfolio |

Kuota: rate limit Graph API per Page dan per app (Business Use Case). Untuk volume
scheduler biasa tidak perlu pengajuan.

### Instagram (Instagram API with Instagram Login)

App Instagram terpisah: **Instagram App ID `1626189502544800`**. Permission:
`instagram_business_basic`, `instagram_business_content_publish`,
`instagram_business_manage_comments`, `instagram_business_manage_insights`. Semuanya perlu
Advanced Access, dengan alur submit yang sama (use case "Manage messaging & content on
Instagram").
- Hanya akun **Business/Creator**, bukan akun personal.
- Batas: **100 post via API per 24 jam per akun IG** (termasuk carousel). Tidak bisa dinaikkan.

### Threads

Use case **"Access the Threads API"**, Threads App ID `2346883052716565`. Permission:
`threads_basic`, `threads_content_publish`, `threads_read_replies`,
`threads_manage_replies`, `threads_manage_insights`.
- Sekarang hanya **Threads Tester** (`@nurhudai_`) yang bisa connect.
- Production: **setiap permission di-review terpisah** (satu screencast per permission), lalu app harus **Live**. Review biasanya 2–4 minggu.
- Lengkapi di Pengaturan use case Threads: **Uninstall Callback URL** dan **Delete Callback URL** (lihat [URL callback Meta](#url-callback-meta)).
- Batas: **250 post/24 jam per profil**, 1.000 balasan/24 jam.

---

## TikTok

App **"mixetape"** (App ID `7691589825782401045`), status **Draft**: belum bisa disimpan
karena belum ada video demo.

**Yang sudah terisi:** ikon, deskripsi, Terms dan Privacy URL, platform Web, domain
`mixetape.com` terverifikasi, Login Kit (redirect
`https://mixetape.com/api/connect/tiktok/callback`), Content Posting API dengan **Direct
Post** aktif, scope `user.info.basic`, `video.publish`, `video.upload`, `video.list`,
penjelasan scope.

**⚠️ Kondisi sekarang:** secret `mixetape-tiktok-client-key` dan
`mixetape-tiktok-client-secret` di Cloudflare Secrets Store berisi kredensial **SANDBOX**
(untuk rekam demo). Setelah demo selesai, ganti dengan kredensial **Production** dari
halaman app → Credentials, dan rotate secret sandbox.

Langkah:
1. Sandbox `mixetape-sandbox` → **Target Users → Add account** (akun TikTok kamu).
2. **Rekam demo** di mixetape.com: login → Connect TikTok (sandbox) → izinkan → jadwalkan video → video terbit (privat) di TikTok → tampilkan analytics (`video.list`). Video harus menunjukkan **semua** produk dan scope yang dipilih.
3. Upload video demo di form Production → **Save** → **Submit for review** (App review).
4. Setelah app disetujui, ajukan **audit Content Posting API** (Direct Post): tulis jenis produk, siapa usernya, dari mana kontennya, dan perkiraan jumlah creator yang posting per hari. TikTok menetapkan batas creator dari angka ini, jadi **isi perkiraan yang realistis tapi cukup longgar**.

Batas:
- **Sebelum audit:** semua post hanya **`SELF_ONLY`** (privat), maks **5 user posting per 24 jam**.
- **Sesudah audit:** batasan privat hilang; jumlah creator per hari sesuai hasil audit.
- Selalu: 6 request/menit per token user; sekitar 15 post/hari per creator (gabungan semua app).

---

## Pinterest

App **"mixetape"** (App ID `1618233`). Tier **Trial access** (disetujui; App secret sudah diisi ke
`mixetape-pinterest-app-secret`).

**Hasil uji 4 Oktober 2026:**
- Connect berhasil: akun **@hanskaii** tersambung, board terbaca.
- Membuat Pin di production **ditolak** Pinterest (403): *"Apps with Trial access may not create
  Pins in production … use API Sandbox"*. Ini berlaku untuk Pin gambar maupun video.
- Karena itu mixetape sekarang punya var `PINTEREST_SANDBOX` (`wrangler.jsonc`, nilai `"true"`):
  semua panggilan Pinterest, termasuk OAuth, diarahkan ke `api-sandbox.pinterest.com`.
  Sudah di-deploy (versi `225eafcc`).
- Setelah connect ulang dan membuat board Sandbox "mixetape test", **Pin gambar terbit**
  (Pin `840625086750271539`), termasuk Pin dari URL frame video
  (`media.mixetape.com/cdn-cgi/media/mode=frame…`, Pin `840625086750271541`).

**Batasan Sandbox (Trial):**
- Token, board, dan Pin Sandbox **terpisah dari production**. Token production tidak berlaku di
  Sandbox dan sebaliknya, jadi akun Pinterest harus **connect ulang** setelah deploy.
- Board production tidak muncul. Buat board baru lewat mixetape (`create_collection`) sebelum
  menjadwalkan Pin.
- **Tidak bisa membuat video Pin.** mixetape menolak post video Pinterest dengan pesan yang jelas
  selama mode Sandbox aktif. Pin gambar dan carousel jalan.
- Pin dan board hanya terlihat oleh pemilik akun (di profil Pinterest sendiri). Batas 1.000
  request/hari per app.

**Langkah ke production:**
1. ~~Deploy, connect ulang Pinterest, buat board Sandbox, terbitkan Pin gambar uji.~~ Selesai 4 Okt.
2. Rekam **video demo**: login mixetape.com → Channels → Connect Pinterest → izinkan → jadwalkan
   Pin → Pin muncul di Pinterest (Sandbox cukup untuk demo).
3. Halaman app di developers.pinterest.com → minta **upgrade ke Standard**. Syarat: patuh
   Developer Guidelines + video demo di atas.
4. Setelah Standard disetujui: hapus `PINTEREST_SANDBOX` dari `wrangler.jsonc`, deploy, lalu
   **connect ulang** akun Pinterest (token Sandbox tidak berlaku di production). Pin jadi publik,
   video Pin jalan, rate limit per user per menit.

Akun personal dan business sama-sama bisa connect di mixetape; analytics Pinterest
kemungkinan hanya untuk akun business.

---

## Bluesky: sudah production

- Tidak ada review. mixetape adalah OAuth client publik dengan metadata di https://mixetape.com/api/connect/bluesky/client-metadata.json; kuncinya di secret `mixetape-bluesky-private-key` (kid `mixetape-2026-10-03`).
- **Video butuh email akun Bluesky yang sudah dikonfirmasi**; tanpa itu post video ditolak dengan pesan yang jelas.
- Batas tulis per akun: 5.000 poin/jam dan 35.000 poin/hari (satu post = 3 poin); 3.000 request/5 menit per IP. Upload video juga dibatasi harian per akun. Tidak bisa dinaikkan, dan untuk scheduler jauh dari cukup.
- Kalau kunci di-rotate: buat kid baru dan deploy. Akun Bluesky yang sudah tersambung harus connect ulang.

## Mastodon: sudah production

- Tidak ada review. mixetape mendaftarkan dirinya otomatis ke setiap server saat user connect pertama kali.
- Batas (default Mastodon, tiap server bisa berbeda): **300 request/5 menit**, upload media **30/30 menit** per akun. Server tertentu bisa memblokir app; itu kebijakan server masing-masing.

## Login ke mixetape (Google & GitHub)

- **Google login** (`openid`, `email`, `profile`): scope non-sensitif. Tidak perlu verifikasi penuh, tapi kalau consent screen memakai logo/nama app, Google meminta **brand verification**. Kalau project login sama dengan project YouTube, verifikasi YouTube di atas sudah mencakupnya.
- **GitHub login:** tidak perlu review.

---

## Urutan kerja yang disarankan

1. **Mulai Business Verification Meta sekarang** (paling lama). ~~Halaman `/data-deletion` + callback~~ sudah.
2. **TikTok:** rekam demo (sandbox) → submit app → kembalikan kredensial production → ajukan audit Content Posting.
3. **YouTube:** ~~consent screen *In production*~~ → putuskan soal client spectro → rekam demo → submit verifikasi OAuth → isi form audit dan kuota.
4. **Meta:** setelah business verified dan data deletion siap, submit App Review untuk Facebook, Instagram, dan Threads sekaligus (video per permission) → app Live.
5. **Pinterest:** ~~tunggu Trial~~ → ~~isi secret~~ → ~~deploy mode Sandbox + uji Pin gambar~~ → rekam demo → minta Standard → matikan Sandbox + connect ulang.

Video demo bisa dibuat sekali dengan alur yang mirip lalu dipotong per platform. Aku bisa
menjalankan alurnya di browser sementara kamu merekam, seperti rencana TikTok sebelumnya.

## Sumber

- YouTube: [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) · [Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form) · [OAuth 2.0 for Web Server Applications](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- Meta: [Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview/) · [Advanced Access & App Review (ringkasan)](https://singhamandeep.com/what-is-meta-advanced-access/) · [Threads API App Review](https://singhamandeep.com/threads-api-app-review-permissions/)
- TikTok: [Content Posting API: audit & limits (ringkasan)](https://www.outstand.so/blog/tiktok-content-posting-api)
- Pinterest: [Access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/) · [API Sandbox](https://developers.pinterest.com/docs/developer-tools/sandbox/)
- Mastodon: [Rate limits](https://docs.joinmastodon.org/api/rate-limits/)
- Bluesky: [Rate limits (diskusi atproto)](https://github.com/bluesky-social/atproto/discussions/2366)

Beberapa angka (Meta, TikTok) berasal dari ringkasan pihak ketiga, bukan dokumen resmi.
Cek ulang di dashboard masing-masing saat submit, karena platform bisa mengubah aturannya.
