---
verity:
  anchors:
    - path: src/cli/commands/init.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: b137658f5773c738870afbb1d8609dd7e7f0289a8813a7c413cbaeabd95b9ae9
        timestamp: 2026-09-17T17:43:49.925Z
    - path: templates/instructions.md
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 0e7f6d71b7397fc38cbdbdf7b82b27d8b950a1e7202e6d0691cace5cd7af7343
        timestamp: 2026-09-17T17:43:49.949Z
---

# Brief: Verity Agent Onboarding Kit & Project Initializer (`verity init`)

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  Untuk mengadopsi Verity pada proyek baru atau repositori pengguna, diperlukan cara onboarding 1-langkah (serupa dengan pola `codegraph init` atau `eslint --init`). Tanpa wizard inisialisasi otomatis, pengguna dan coding agent harus membuat direktori `docs/brief`, manifest `INDEX.md`, Git pre-commit hook, dan menyalin panduan agent secara manual yang rentan terhadap human error.
- **Tujuan Utama**:
  1. Mengimplementasikan perintah `verity init` (`src/cli/commands/init.ts`) dengan flag `--yes`, `--hook`, dan `--template`.
  2. Otomatis membuat struktur folder `docs/brief/`, template brief, dan manifest awal `INDEX.md`.
  3. Menyediakan opsi instalasi Git pre-commit hook (`.git/hooks/pre-commit`) untuk menjaga gerbang integritas secara lokal sebelum commit.
  4. Menyediakan template panduan agent siap pakai di `templates/instructions.md` (kompatibel dengan Antigravity, Cursor, Claude Code, OpenCode).

---

## Scope & Boundaries
### In-Scope
- [x] Pembuatan modul `src/cli/commands/init.ts` untuk memproses alur inisialisasi direktori dan konfigurasi proyek.
- [x] Registrasi sub-command `verity init` pada `src/cli/index.ts`.
- [x] Penyediaan template bawaan: `templates/instructions.md` dan skrip git hook `templates/pre-commit-hook.sh`.
- [x] Dukungan non-destruktif (tidak menimpa file spesifikasi atau hook yang sudah ada kecuali diminta via flag).
- [x] Unit dan integration test di `tests/init-command.test.ts` menggunakan isolasi direktori sementara (`tmpdir`).
- [x] Verifikasi dan pengujian manual via CLI `bun run src/cli/index.ts init --help`.

### Out-of-Scope
- Konfigurasi multi-target build cross-compile binary (Milestone 4).
- Parser PHP AST (Milestone 5).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/init.ts` (new)
  - `templates/instructions.md` (new)
  - `templates/pre-commit-hook.sh` (new)
  - `src/cli/index.ts:L30-L90`
  - `tests/init-command.test.ts` (new)
- **Data Model & API Impact**:
  - CLI command: `verity init [--yes|-y] [--hook] [--template <agent>] [--dir <path>]`

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Project Initialization in Clean Workspace**:
  - **Given**: Direktori baru atau direktori proyek tanpa folder `docs/brief`.
  - **When**: Pengguna menjalankan `verity init --yes`.
  - **Then**: Folder `docs/brief/` terbentuk, manifest `docs/brief/INDEX.md` dihasilkan, dan `AGENTS.md` / `instructions.md` terpasang.
- [ ] **Scenario 2: Pre-Commit Hook Installation**:
  - **Given**: Repositori git yang belum memiliki pre-commit hook Verity.
  - **When**: Pengguna menjalankan `verity init --hook`.
  - **Then**: File executable `.git/hooks/pre-commit` terbuat dan memuat skrip pemeriksaan `verity check --ci`.
- [ ] **Scenario 3: Non-Destructive Guardrail**:
  - **Given**: Repositori yang sudah memiliki file spesifikasi di `docs/brief`.
  - **When**: `verity init` dijalankan ulang.
  - **Then**: File yang sudah ada tidak ditimpa secara diam-diam.

---

## Definition of Done (DoD) Checklist
- [ ] Perintah `verity init` terimplementasi di `src/cli/commands/init.ts`.
- [ ] Template `instructions.md` dan `pre-commit-hook.sh` tersedia.
- [ ] Sub-command `init` terdaftar di `src/cli/index.ts` dan terdokumentasi di `--help`.
- [ ] Unit test `tests/init-command.test.ts` lulus di `bun test`.
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/init.ts`
  - `templates/instructions.md`