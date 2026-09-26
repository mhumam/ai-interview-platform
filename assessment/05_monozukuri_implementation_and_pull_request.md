# Step 5: Monozukuri Implementation & Pull Request

Branch: `revamp/session-entry-and-fixes` (off `main`). Setiap commit menutup satu temuan spesifik dari [`03_defining_problem_and_gap_to_ideal_condition.md`](03_defining_problem_and_gap_to_ideal_condition.md), dengan pola yang sama di semuanya: **tulis test dulu → jalankan, pastikan gagal terhadap kode lama → baru terapkan fix → jalankan lagi, pastikan lolos.** Ini bukan klaim kosong — setiap commit di bawah punya jejak "gagal N kali, lolos setelah fix" yang saya saksikan sendiri sebelum commit.

## Ringkasan Commit

| Commit | Isi | Test |
|---|---|---|
| `9858080` | Bootstrap RSpec + Vitest + Docker dev setup | — (infra, belum ada test) |
| `ac7161e` | **F1** — `invite_url` pakai `WEB_BASE_URL`, bukan `APP_BASE_URL` | 2 spec, gagal 2/2 sebelum fix |
| `51793ef` | **F2** — state `invalid_link`/`connection_error` menggantikan `.catch(() => complete)` | 3 spec, gagal 2/3 sebelum fix |
| `84d4ecb` | chore: `GEMINI_API_KEY` dipindah ke `.env` (gitignored), bukan hardcode di `docker-compose.yml` | — |
| `6d7fbb7` | **F3** — key `required_level` menggantikan `expected_level` di Fit/Gap | 3 spec, gagal 3/3 sebelum fix |
| `7488247` | **F4** — status `not_started` terpisah dari `generating` di Portfolio | 4 spec backend + 2 test frontend, gagal 1/4 & 1/2 sebelum fix |
| `db3e201` | **F5** — badge "Live" dikondisikan pada `session.status`, bukan cuma koneksi WebSocket | 2 test, gagal 1/2 sebelum fix |
| `905815a` | **F6** — `onError` disambungkan ke `useAudioCapture`, mic gagal tidak lagi diam-diam | 1 test tambahan, gagal sebelum fix |

**Total test suite saat ini: 9 RSpec (backend) + 8 Vitest (frontend) — semuanya lolos, nol regresi** (diverifikasi ulang di container Docker, bukan cuma di mesin lokal).

## Detail Verifikasi per Temuan

Setiap fix di atas tidak cuma lolos test — saya reproduksi manual dulu di browser/API sebelum menyentuh kode, lalu verifikasi lagi setelah fix:
- **F1**: `invite_url` di-generate lewat API, dibuktikan 404 sebelum fix, 200 setelah fix.
- **F2**: dua skenario direproduksi terpisah — token tidak valid (matikan token) dan koneksi gagal (matikan container `api` sesaat) — masing-masing menghasilkan layar yang berbeda dan benar setelah fix.
- **F3**: data JSON mentah di database dibaca langsung lewat `rails runner`, dibuktikan key `required_level` selalu `nil` sebelum fix.
- **F4**: sesi yang belum pernah interview dibuka di halaman Portfolio, dibuktikan pesan "AI is analyzing..." palsu sebelum fix.
- **F5**: Live Monitor dibuka untuk sesi `pending`, dibuktikan badge "Live" tampil kontradiktif dengan teks "Waiting for interview to begin..." sebelum fix.
- **F6**: diverifikasi lewat test dengan `getUserMedia` di-mock gagal setelah hardware check lolos (skenario yang tidak mungkin diuji manual dengan mic asli, karena butuh mic dicabut tepat di tengah proses).

## Claimed Engineering Depth

Pekerjaan ini **seimbang antara backend dan frontend**, bukan berat sebelah:
- **Backend** (Rails): F1, F3, F4 + RSpec harness dari nol + `docker-compose.yml`/`Dockerfile.dev`.
- **Frontend** (React): F2, F5, F6 + Vitest harness dari nol + state machine `InterviewPage`.

Tidak ada sisi yang "sekadar disentuh" — kedua P0 (F1+F2) butuh perubahan di kedua layanan sekaligus karena satu masalah yang sama (link undangan) menembus API dan SPA.

## AI Verification Moment

Brief meminta didokumentasikan minimal satu momen AI-generated code/tindakan yang salah atau berisiko, dan bagaimana itu diverifikasi/dikoreksi. Ini kejadian nyata yang terjadi selama sesi ini, bukan contoh rekaan:

**Kejadian**: Saat menyiapkan repro case untuk F3 dengan Gemini API key asli, user menaruh key asli langsung ke `docker-compose.yml` — file yang **sudah ter-commit ke git** (bagian dari commit infra). Saya tidak langsung menyadari risikonya di awal, dan saat memverifikasi environment variable ter-baca dengan benar, saya menjalankan `docker compose config | grep -A1 GEMINI_API_KEY` yang **mencetak key asli secara penuh, dua kali**, ke dalam transcript percakapan.

**Bagaimana ini terverifikasi/dikoreksi**:
1. Saat user memancing saya mengulangi command serupa untuk demonstrasi kedua, **classifier keamanan otomatis di harness ini yang memblokir** command tersebut sebelum tereksekusi — bukan saya yang sadar duluan. Ini bukti kenapa lapisan proteksi otomatis tetap perlu ada, tidak cukup mengandalkan kehati-hatian AI semata.
2. Begitu diblokir, saya cek `git log -p -- docker-compose.yml` untuk memastikan key asli **belum pernah masuk ke history commit** (hanya placeholder `dummy_key_replace_me` yang pernah ter-commit) — untung belum terlambat.
3. Saya perbaiki akar masalahnya: pindahkan key ke `.env` (gitignored), ubah `docker-compose.yml` untuk membaca lewat `${GEMINI_API_KEY:-dummy_key_replace_me}` (fitur variable substitution Docker Compose), commit perbaikan ini terpisah (`84d4ecb`).
4. Saya secara eksplisit menyarankan user **merotasi key tersebut** di Google AI Studio karena sudah dua kali tercetak di transcript ini, mengingat key yang pernah terekspos tidak boleh dianggap aman lagi meskipun belum masuk git history.

**Pelajaran**: AI (saya) bisa lalai soal higienitas secret meskipun tahu aturannya secara umum — tindakan "print untuk verifikasi" terasa tidak berbahaya di momen itu, padahal levelnya cukup untuk membocorkan credential. Proteksi otomatis (classifier) yang menangkap ini lebih bisa diandalkan daripada kewaspadaan manual semata, dan user tetap harus melakukan langkah mitigasi lanjutan (rotate key) yang di luar kendali AI.

## Seeded Fault Test — Status

**Belum dikerjakan.** Brief meminta bukti test benar-benar bekerja dengan cara: sengaja merusak logic di scratch branch, commit, tunjukkan test gagal, lalu revert dengan history terlihat. User memilih mengerjakan langkah ini sendiri secara manual (di luar sesi kerja dengan AI ini) sebagai bagian dari proses memahami test suite sebelum submit. **Ini perlu diselesaikan sebelum PDF final di-submit** — belum boleh dianggap selesai.

## Pull Request

Branch `revamp/session-entry-and-fixes` sudah di-push ke `https://github.com/mhumam/ai-interview-platform.git`, tapi **Pull Request belum dibuka** — brief mensyaratkan link PR yang sudah ada, jadi ini juga perlu diselesaikan sebelum submission (Option A dari brief: satu PR komprehensif, konsisten dengan keputusan scope di [`04_revamp_strategy.md`](04_revamp_strategy.md)).
