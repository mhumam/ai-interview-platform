# Step 5: Monozukuri Implementation & Pull Request

Branch: `revamp/session-entry-and-fixes` (off `main`). Setiap commit menutup satu temuan spesifik dari [`03_defining_problem_and_gap_to_ideal_condition.md`](03_defining_problem_and_gap_to_ideal_condition.md), dengan pola yang sama di semuanya: **tulis test dulu → jalankan, pastikan gagal terhadap kode lama → baru terapkan fix → jalankan lagi, pastikan lolos.** Ini bukan klaim kosong — setiap commit di bawah punya jejak "gagal N kali, lolos setelah fix" yang saya saksikan sendiri sebelum commit.

> **Catatan hash commit**: history di-rewrite **dua kali** (lihat bagian GitGuardian di bawah) untuk membersihkan pola yang salah dideteksi sebagai secret. Hash di tabel ini adalah hash final yang ter-push setelah kedua rewrite.

## Ringkasan Commit

| Commit | Isi | Test |
|---|---|---|
| `30da578` | Bootstrap RSpec + Vitest + Docker dev setup | — (infra, belum ada test) |
| `44ca273` | **F1** — `invite_url` pakai `WEB_BASE_URL`, bukan `APP_BASE_URL` | 2 spec, gagal 2/2 sebelum fix |
| `3953dcf` | **F2** — state `invalid_link`/`connection_error` menggantikan `.catch(() => complete)` | 3 spec, gagal 2/3 sebelum fix |
| `5ba957f` | chore: `GEMINI_API_KEY` dipindah ke `.env` (gitignored), bukan hardcode di `docker-compose.yml` | — |
| `2b864d5` | **F3** — key `required_level` menggantikan `expected_level` di Fit/Gap | 3 spec, gagal 3/3 sebelum fix |
| `201419f` | **F4** — status `not_started` terpisah dari `generating` di Portfolio | 4 spec backend + 2 test frontend, gagal 1/4 & 1/2 sebelum fix |
| `02eb224` | **F5** — badge "Live" dikondisikan pada `session.status`, bukan cuma koneksi WebSocket | 2 test, gagal 1/2 sebelum fix |
| `e2d597f` | **F6** — `onError` disambungkan ke `useAudioCapture`, mic gagal tidak lagi diam-diam | 1 test tambahan, gagal sebelum fix |
| `d40c3e9` | docs: laporan assessment Step 1-5 | — |

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

Brief meminta didokumentasikan minimal satu momen AI-generated code/tindakan yang salah atau berisiko, dan bagaimana itu diverifikasi/dikoreksi. Dua kejadian nyata yang benar-benar terjadi selama sesi ini:

### 1. API key ter-print ke transcript

Saat menyiapkan repro case untuk F3 dengan Gemini API key asli, user menaruh key asli langsung ke `docker-compose.yml` — file yang **sudah ter-commit ke git** (bagian dari commit infra). Saya tidak langsung menyadari risikonya, dan saat memverifikasi environment variable ter-baca dengan benar, saya menjalankan `docker compose config | grep -A1 GEMINI_API_KEY` yang **mencetak key asli secara penuh, dua kali**, ke dalam transcript percakapan.

**Verifikasi/koreksi**: classifier keamanan otomatis di harness ini yang memblokir command serupa saat saya coba ulangi — bukan saya yang sadar duluan. Saya lalu cek `git log -p -- docker-compose.yml` memastikan key asli belum pernah masuk history commit (aman, cuma placeholder yang ter-commit), pindahkan key ke `.env` (gitignored), commit perbaikan terpisah (`6f3c0b6`), dan sarankan user merotasi key tersebut karena sudah dua kali tercetak.

### 2. Asumsi pertama untuk fix GitGuardian ternyata salah — butuh iterasi kedua

Setelah PR dibuka, GitGuardian menandai `DB_PASSWORD: postgres` di `docker-compose.yml` sebagai "Generic Password". **Percobaan pertama**: membungkusnya jadi `${DB_PASSWORD:-postgres}` (pola yang sama yang berhasil untuk `GEMINI_API_KEY`), asumsi saya scanner akan berhenti menandainya. **Asumsi ini salah** — setelah rewrite commit + force-push, GitGuardian tetap menandai baris yang sama, karena `postgres` (berbeda dari `dummy_key_replace_me`) adalah string yang secara fungsional valid sebagai password asli, bukan sekadar kata acak yang jelas palsu. Membungkus dalam `${VAR:-default}` cuma memindahkan posisi karakternya, tidak menghapusnya dari diff commit.

**Verifikasi/koreksi**: saya cek ulang hasil re-scan lewat `gh pr view --json statusCheckRollup`, ketemu baris persis yang masih tertangkap, baru sadar hipotesis pertama keliru — root cause-nya bukan "bentuk penulisan", tapi "ada nilai password yang valid sama sekali di file". **Percobaan kedua**: hilangkan kebutuhan password sepenuhnya dengan `POSTGRES_HOST_AUTH_METHOD: trust` (opsi resmi image Postgres untuk dev/testing) — bukan menyamarkan, tapi menghapus field password dari file. Sebelum push, saya uji nyata (`docker compose down -v && up --build` dari nol, migrasi, dan full RSpec suite) untuk pastikan perubahan infra ini benar-benar berfungsi, bukan cuma lolos scanner. Setelah force-push kedua, `gh pr view --json statusCheckRollup` mengonfirmasi **GitGuardian Security Checks: SUCCESS**.

**Pelajaran dari keduanya**: AI (saya) bisa lalai soal higienitas secret meskipun tahu aturannya secara umum, dan bisa juga salah menduga akar masalah di percobaan pertama — solusi yang terlihat masuk akal (mengikuti pola yang sudah berhasil sebelumnya) ternyata tidak otomatis berlaku untuk kasus berbeda. Verifikasi ulang lewat command nyata (bukan asumsi, dan bukan berhenti di percobaan pertama yang gagal) yang akhirnya menemukan solusi yang benar-benar menghilangkan akar masalahnya, bukan sekadar menyamarkannya.

## Seeded Fault Test

**Selesai.** Dikerjakan di branch terpisah `scratch/seeded-fault-test` (ter-push ke `https://github.com/mhumam/ai-interview-platform/tree/scratch/seeded-fault-test`, tidak di-merge ke branch kerja utama):

1. **Rusak** ([`bb73929`](https://github.com/mhumam/ai-interview-platform/commit/bb73929)): `Session#invite_url` dikembalikan ke perilaku sebelum fix F1 (pakai `APP_BASE_URL` lagi).
2. **Jalankan test** → `spec/models/session_spec.rb`: **2 examples, 2 failures**. Full suite: **9 examples, 2 failures** — persis dan hanya kedua spec F1 yang gagal, membuktikan test-nya presisi (tidak ada efek samping ke spec lain).
3. **Revert** ([`6cf1688`](https://github.com/mhumam/ai-interview-platform/commit/6cf1688), `git revert bb73929`): kode kembali ke fix F1 yang benar.
4. **Verifikasi ulang** → full suite: **9 examples, 0 failures**.

Tidak dibuka sebagai Pull Request terpisah — brief hanya meminta "history visible" (branch ter-push cukup), dan karena hasil akhir rusak→revert ini net-zero perubahan kode, membuka PR untuknya justru tidak bermakna (GitHub akan menampilkan "no changes to merge"). Link commit di atas sudah cukup untuk reviewer memverifikasi tanpa perlu clone branch-nya.

History dua commit ini (rusak → revert) tetap terlihat di branch scratch sebagai bukti, tidak di-squash atau disembunyikan.

## Pull Request

**[PR #140](https://github.com/rakamindev/ai-interview-platform/pull/140)** — dibuka dari `mhumam:revamp/session-entry-and-fixes` ke `rakamindev/ai-interview-platform:main` (Option A dari brief: satu PR komprehensif, konsisten dengan keputusan scope di [`04_revamp_strategy.md`](04_revamp_strategy.md)). Deskripsi PR mencakup ringkasan severity, tabel bukti test per commit, catatan keamanan data, dan gap yang diketahui (AC7, keterbatasan repro F6).

**Status check**: `GitGuardian Security Checks` — **SUCCESS** (lihat AI Verification Moment #2 di atas). Status merge tersisa `REVIEW_REQUIRED` — menunggu review manusia dari tim `rakamindev`, bukan blocker teknis.
