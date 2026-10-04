# Draf submission review platform

Teks siap-tempel untuk form review tiap platform, plus naskah video demo. Teks yang dikirim
ke platform ditulis dalam bahasa Inggris; catatan untuk kamu dalam bahasa Indonesia.
Pasangan dokumen ini: [PRODUCTION-REVIEWS.md](PRODUCTION-REVIEWS.md) (apa saja yang perlu
dan statusnya).

> Sebelum mengirim, cek ulang angka perkiraan (user, post per hari) agar sesuai rencana
> kamu. Platform memakai angka itu untuk menentukan kuota.

---

## 0. Yang dipakai semua platform

**Deskripsi singkat app (≤ 120 karakter):**

> Schedule and publish videos and posts to your own social accounts, from one place or through AI agents.

**Deskripsi panjang:**

> mixetape (https://mixetape.com) is a social media scheduler. A creator or business signs in,
> connects their own accounts (YouTube, Facebook Pages, Instagram, Threads, TikTok, Pinterest,
> Bluesky, Mastodon) and schedules posts for them — from the mixetape workspace, or through an
> AI agent they authorize with an API key. mixetape holds each post until shortly before its
> time, publishes it to the account the user chose, and reports back its status, comments and
> analytics. Each user only ever reaches the accounts they connected themselves; mixetape never
> posts anything the user did not schedule, and deletes a platform's data when access is
> revoked.

**Akun demo untuk reviewer:** buat satu akun mixetape khusus review (mis. `review@mixetape.com`)
yang sudah menyambungkan akun uji tiap platform. Login mixetape memakai kode email, jadi
siapkan alamat yang bisa kamu teruskan kodenya ke reviewer, atau aktifkan login Google
dengan akun uji. Jangan pakai akun pribadi.

---

## 1. Google: verifikasi OAuth (YouTube)

**Sudah diisi oleh Claude (4 Okt 2026), di Google Auth Platform project `mixetape`:**
- Branding: link privacy diperbaiki ke `/privacy` dan terms ke `/terms` (sebelumnya `/privacy-policy` dan `/tos`, keduanya 404).
- Data Access: justifikasi scope `youtube.force-ssl` (848/1000 karakter).
- Status: **In production**, user cap **13/100**. Batas ini hanya berlaku selama app belum terverifikasi; hitungannya tidak direset, jadi submit sebelum mendekati 100.
- Client spectro: redirect/origin `spectro.hanssn.workers.dev` dihapus; authorized domain sekarang hanya `mixetape.com`.

**Yang tersisa:** rekam video di bawah, lalu Verification Center → submit (tempel link video).

**Video demo (YouTube, unlisted), naskah:**
1. Buka `https://mixetape.com`, klik Sign in, login (tampilkan URL di address bar).
2. Channels → Connect → YouTube. Tampilkan layar consent Google; **zoom ke address bar**
   supaya `client_id=50575334904-9942e…` terlihat; tampilkan dua scope (`youtube.force-ssl`,
   `yt-analytics.readonly`); Allow.
3. Kembali ke mixetape: channel YouTube muncul di Channels.
4. Library → upload video → Publish ke channel YouTube itu dengan judul, deskripsi,
   thumbnail, playlist dan caption (file .srt), dijadwalkan beberapa menit lagi.
5. Publish: post terjadwal → setelah waktunya, status Sent; buka link → video di YouTube Studio
   dengan thumbnail, playlist dan caption terpasang.
6. Komentar: tampilkan daftar komentar video di mixetape dan balas satu komentar.
7. Analytics: tampilkan views/watch time video dan channel (scope `yt-analytics.readonly`).
8. Tampilkan juga tombol login Google di mixetape.com (client "google") dan di
   spectro.mixetape.com (client spectro); keduanya hanya openid/email/profile.

---

## 2. YouTube: Audit & Quota Extension Form

Form: https://support.google.com/youtube/contact/yt_api_form

| Field | Draf jawaban |
|---|---|
| Project number | `50575334904` |
| API client / website | https://mixetape.com |
| Use case | Scheduling and publishing videos to the user's own YouTube channel, then managing them (thumbnails, playlists, captions, comments, analytics). |
| Who are the users | Independent creators and small businesses who schedule videos for their own channels, alone or through an AI agent they control. |
| How the data is used | Only to publish what the user scheduled and to show them its status, comments and analytics. No data is sold, shared, or used for training. Revoked access → the channel's data is deleted within 7 days. |
| Expected volume | _(isi)_ e.g. 300 uploads/day at launch, 1,000/day in 6 months |
| Quota requested | `videos.insert`: _(isi, mis. 1,000/day)_; other units: _(mis. 200,000/day)_ |
| Per-endpoint justification | `videos.insert` 1 per scheduled video · `thumbnails.set` 50 per video with a custom thumbnail · `playlistItems.insert` 50 per playlist · `captions.insert` 400 per caption track · `commentThreads.insert` 50 per first comment · `videos.list` 1 to confirm a video went public · `videos.update` 50 when the user edits a live video |
| Privacy policy / ToS | https://mixetape.com/privacy · https://mixetape.com/terms |
| Demo credentials | akun demo reviewer (lihat bagian 0) |

**Perkiraan unit per post YouTube:** 1 `videos.insert` + 50 (thumbnail) + 50 (playlist) +
2 (`videos.list`) ≈ 100 unit di luar bucket upload. 300 post/hari ≈ 30.000 unit/hari.

---

## 3. Meta App Review (Facebook, Instagram, Threads)

**Sudah diisi oleh Claude (4 Okt 2026):**
- App Settings → Basic: Domain `mixetape.com`, Terms `https://mixetape.com/terms`, **Data Deletion = callback** `https://mixetape.com/api/connect/facebook/data-deletion`, ikon app, kategori "Bisnis dan Halaman". (Privacy sudah benar.)
- Facebook Login for Business: Deauthorize + Data deletion callback.
- Instagram (Business login settings): Deauthorize + Data deletion callback.
- Threads: Uninstall + Delete callback.

**Masih dari kamu:** Business Verification, akun demo reviewer, satu screencast per
permission, lalu Submit dan ubah app ke **Live**.

### Facebook Pages: deskripsi per permission

Untuk setiap permission, tempel deskripsi lalu unggah screencast yang menunjukkan langkah
"Show in video".

| Permission | Description to paste | Show in video |
|---|---|---|
| `pages_show_list` | We list the Pages the person manages when they connect Facebook, so they can choose which Pages mixetape publishes to. | Connect Facebook → pick a Page in mixetape's dialog |
| `pages_manage_posts` | We publish the videos, photos, albums and Reels the person schedules in mixetape to the Page they chose, at the time they chose. | Schedule a post to the Page → it appears on the Page |
| `pages_read_engagement` | We read the status and link of the posts mixetape published, to show the person whether each one went live. | Publish page in mixetape shows the post as Sent with its link |
| `pages_read_user_content` | We read comments on the Page's posts published through mixetape, so the person can see them in mixetape. | Open the post's comments in mixetape |
| `pages_manage_engagement` | The person replies to and hides comments on their posts from mixetape. | Reply to a comment from mixetape → reply shows on Facebook |
| `read_insights` | We show the person the reach and engagement of their Page and of the posts mixetape published. | Analytics for the Page and a post |
| `business_management` | Lets the person connect Pages owned through their business portfolio, which otherwise do not appear when they connect. | Connect a Page owned by a business portfolio |

### Instagram: deskripsi per permission

| Permission | Description to paste | Show in video |
|---|---|---|
| `instagram_business_basic` | We read the connected professional account's id, username and picture to show which account the person connected. | Connect Instagram → account shows in Channels |
| `instagram_business_content_publish` | We publish the Reels, photos and carousels the person schedules in mixetape to their account at the time they chose. | Schedule a Reel → it appears on Instagram |
| `instagram_business_manage_comments` | The person reads and replies to comments on their posts, and can post a first comment, from mixetape. | Show comments, reply from mixetape |
| `instagram_business_manage_insights` | We show the person the reach and engagement of the posts mixetape published. | Post analytics in mixetape |

### Threads: deskripsi per permission (masing-masing di-review terpisah)

| Permission | Description to paste | Show in video |
|---|---|---|
| `threads_basic` | We read the connected profile's id, username and picture to show which profile the person connected. | Connect Threads → profile in Channels |
| `threads_content_publish` | We publish the posts, images, videos and carousels the person schedules in mixetape to their Threads profile. | Schedule a post → it appears on Threads |
| `threads_read_replies` | We show the replies to the person's posts in mixetape. | Replies listed in mixetape |
| `threads_manage_replies` | The person replies to and hides replies on their posts from mixetape, and can post a first reply. | Reply / hide from mixetape |
| `threads_manage_insights` | We show the person the views and engagement of their posts and profile. | Post and profile analytics in mixetape |

**Naskah screencast Meta (satu rekaman bisa dipotong per permission):** login mixetape →
Channels → Connect Facebook (tunjukkan dialog izin Meta, pilih Page) → Connect Instagram →
Connect Threads → Library: unggah video dan gambar → Publish ke Page, Instagram, dan Threads →
Publish: semua terjadwal → setelah terbit, buka tiap post di platformnya → kembali ke
mixetape: komentar/balasan (balas satu), analytics. Rekam dengan akun yang **bukan** admin
app (akun demo), karena reviewer ingin melihat alur orang biasa.

---

## 4. TikTok: App review + audit Content Posting API

**Penjelasan produk & scope** (sudah diisi di form Production):

> mixetape is a social publishing platform. A user signs in to mixetape.com and connects their own TikTok account with Login Kit (user.info.basic) to identify the account. They then schedule a video in mixetape; at the scheduled time mixetape uploads it to that account with the Content Posting API Direct Post (video.publish; video.upload is included with the product) and checks its publish status. video.list reads the user's own public videos so mixetape can show view, like, comment and share counts for the posts it published. Each user can only access their own account, and mixetape only posts what the user scheduled.

**Naskah video demo (Sandbox `mixetape-sandbox`, akun target ditambahkan dulu):** login
mixetape.com → Channels → Connect TikTok → layar izin TikTok (tunjukkan scope) → kembali, akun
muncul → Library: unggah video vertikal → Publish ke TikTok (privacy SELF_ONLY), jadwal 2 menit
lagi → Publish: status Sent → buka TikTok, video ada (privat) → mixetape: analytics video.

**Draf jawaban audit Content Posting API** (setelah app disetujui):

| Pertanyaan | Draf |
|---|---|
| Product | Social media scheduler (web, https://mixetape.com) |
| Who posts | Creators and small businesses posting to their own TikTok accounts |
| Content source | Videos the user uploads to mixetape or renders with their own tools; mixetape does not create or source content |
| User controls | User picks account, caption, privacy level (from creator_info options), comments/duet/stitch settings, AI-generated label, and time; can cancel before it goes out |
| Creators posting per day | _(isi, mis. 50 at launch → 500 in 6 months)_ |
| Posts per creator per day | _(isi, mis. 1–3)_ |

⚠️ Setelah video demo direkam: kembalikan `mixetape-tiktok-client-key/secret` ke kredensial
**Production** dan rotate secret Sandbox.

---

## 5. Pinterest: upgrade ke Standard access

**Draf alasan upgrade:**

> mixetape (https://mixetape.com) lets creators and businesses schedule image, carousel and
> video Pins to their own boards, alongside their other social accounts. Users connect their
> own Pinterest account through OAuth (boards:read/write, pins:read/write, user_accounts:read);
> mixetape creates the Pins they schedule at the time they choose and shows their analytics.
> We only act on the authenticated user's own boards and Pins and store tokens encrypted.
> We need Standard access so the Pins our users schedule are public, and to publish video Pins,
> which the Sandbox does not allow.

**Naskah video demo (Sandbox cukup):** login mixetape.com → Channels → Connect Pinterest →
layar izin Pinterest → akun muncul → buat board lewat mixetape → Library: unggah gambar →
Publish ke board itu → Pin muncul di Pinterest (profil sendiri) → mixetape: status Sent.
