# Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

## Keputusan Scope

F1 + F2 (keduanya P0) adalah **satu user journey rusak**: *"kandidat buka link → bisa interview, ATAU diberi tahu jelas kenapa tidak bisa."* Hari ini tidak satu pun terjadi. Ini titik leverage tertinggi — pintu masuk seluruh produk; fitur lain (Live Monitor, Portfolio, Fit/Gap) baru relevan setelah sesi benar-benar dimulai.

F3 & F4 adalah perbaikan mekanis independen, dibahas singkat di akhir dokumen ini.

**Target revamp: Candidate Invite & Session-Entry Reliability** — backend (`Session#invite_url`, `candidate_info`) + frontend (state pra-interview `InterviewPage`, saat ini cuma `idle`/`complete` jadi tempat pelarian semua kasus).

---

## Acceptance Criteria

| # | Kondisi | Perilaku yang seharusnya |
|---|---|---|
| AC1 | Token valid, sesi `pending`, pertama dibuka | Hardware check → interview mulai normal |
| AC2 | Token tidak ada/salah format | "Link interview ini tidak valid" — **tidak boleh** layar completion |
| AC3 | Sesi sudah `ended` | Layar berbeda "Anda sudah menyelesaikan interview ini" — bukan state generik yang sama dengan AC2/AC4 |
| AC4 | Sesi `failed` | "Ada masalah pada percobaan sebelumnya — hubungi recruiter" — bukan jalan buntu diam-diam |
| AC5 | Gagal jaringan sementara | "Gagal terhubung — Coba lagi", retry otomatis 2x dulu sebelum tampil UI retry |
| AC6 | Assessment di balik sesi sudah dihapus | Sama seperti AC2 — 404, bukan 500 |
| AC7 | Dua tab/browser dibuka bersamaan | Read-only idempotent di kedua tab; hanya satu boleh pegang lock WebSocket. **Di luar scope iterasi ini** — lihat Option B |
| AC8 | `WEB_BASE_URL` belum dikonfigurasi | Backend gagal jelas / log warning, bukan diam-diam keluarkan link yang 404 |

---

## Option A — Perbaikan Terarah (Direkomendasikan)

Perbaiki `invite_url` → frontend; ganti `.catch(() => complete)` dengan state eksplisit (`invalid_link`, `connection_error`) yang 1:1 memetakan apa yang backend sudah bisa beritahukan. Tanpa perubahan schema. Sekalian sambungkan `onError` yang hilang (F6, file & tema sama).

- **Product impact vs cost:** rasio tertinggi — memperbaiki journey #1 paling rusak untuk ~90% kasus nyata, ±1 hari kerja.
- **Maintainability:** risiko rendah — tidak ada tabel/job baru, perubahan terlokalisasi.
- **Belum tercakup:** pembukaan ganda (AC7), assessor masih tidak tahu *kenapa* sesi macet di `pending`.
- **Contextual fit:** kuat untuk deadline case study ini, tidak terhambat desain locking yang butuh review sendiri.

## Option B — Perbaikan Struktural

Semua isi Option A + `first_opened_at`/link-open telemetry yang terlihat assessor + session locking untuk pembukaan bersamaan (AC7 penuh).

- **Product impact vs cost:** nilai jauh lebih tinggi, tapi biaya 2–3x Option A — migrasi baru, locking logic yang harus diuji di bawah konkurensi.
- **Maintainability:** locking adalah liability jangka panjang (stale lock, worker crash mid-session butuh unlock manual).
- **Contextual fit:** tepat untuk skala multi-tenant ke depan, tapi terlalu besar untuk dikerjakan bersamaan dengan membangun test harness dari nol dalam satu iterasi yang sama.

## Keputusan: **Option A**

Memperbaiki kedua P0 lengkap untuk AC1–AC6 & AC8, cukup kecil untuk diselesaikan dengan test coverage sungguhan dalam timeline ini. AC7 didokumentasikan eksplisit sebagai gap yang ditunda — bukan diam-diam diabaikan. **Constraint signal ke Technical Lead:** desain lock untuk akses sesi konkuren adalah pekerjaan masa depan yang nyata, bukan sesuatu yang bisa diimprovisasi di iterasi ini.

## F3 / F4 — Perbaikan Mekanis

- **F3:** rename key `expected_level` → `required_level` di `fit_gap/engine.rb` (frontend sudah "benar" secara kosakata produk). Tambah request spec yang mematok bentuk response.
- **F4:** pisahkan cabang `nil` vs `generating?` di `PortfoliosController#show` jadi `not_started` vs `generating`, dengan empty state frontend yang sesuai.
