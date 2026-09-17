---
verity:
  anchors:
    - path: src/cli/commands/check.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 1666bd29e6f3c74052de02705b509b4a71b16da91f8a77441e3060ed0ed6bc15
        timestamp: 2026-09-17T16:36:34.621Z
---

# Brief: Cache-Hit Manifest Sync & Local Pre-Commit Hook Activation

> **Kategori**: refactor  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Dari hasil evaluasi pengujian empiris terakhir sistem Verity, ditemukan dua area penyempurnaan minor:
  1. Pada pemanggilan `verity check --quick --sync-index` saat working tree bersih dan cache valid (cache-hit), eksekusi melakukan early return sebelum memicu regenerasi manifest `docs/brief/INDEX.md`. Akibatnya, sinkronisasi index terlewat pada skenario cache hit.
  2. File template git hook `templates/pre-commit-hook.sh` belum terpasang aktif di `.git/hooks/pre-commit` pada repositori lokal, sehingga gatekeeper level VCS belum otomatis aktif di repo ini.
- **Tujuan Utama**: 
  1. Memperbarui `runCheckCommand` di `src/cli/commands/check.ts` agar tetap menjalankan `manifestGen.generateAndSync()` saat `options.syncIndex` bernilai true, meskipun dalam kondisi cache-hit `--quick`.
  2. Memasang dan mengaktifkan executable pre-commit hook ke `.git/hooks/pre-commit` di repositori ini.
  3. Menambahkan unit/integration test yang memvalidasi perilaku `--quick --sync-index` pada cache hit.

---

## Scope & Boundaries
### In-Scope
- [x] Modifikasi alur `runCheckCommand` pada cabang `options.quick` di `src/cli/commands/check.ts:L33-L67` untuk memproses `syncIndex`.
- [x] Pemasangan git hook aktif: salin `templates/pre-commit-hook.sh` ke `.git/hooks/pre-commit` dengan izin executable (`chmod +x`).
- [x] Penambahan pengujian integrasi di `tests/cli-commands.test.ts:L85-L115` untuk memverifikasi fungsionalitas `check --quick --sync-index`.
- [x] Verifikasi seluruh test suite (`bun test`) dan validasi drift (`verity check`).
- [x] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Perubahan arsitektur AST parser (`TypeScriptParser`, `VueSfcParser`, `PhpParser`).
- Modifikasi lifecycle hooks eksternal Antigravity (`verity-derived-shield`, `verity-anchor-guard`, dll).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/check.ts:L33-L67` (logika evaluasi cache hit dan sinkronisasi index)
  - `tests/cli-commands.test.ts:L85-L115` (test case CLI cache hit + sync index)
  - `.git/hooks/pre-commit` (pemasangan hook git lokal)
- **Data Model & API Impact**: None (internal CLI flag handling & repository tooling).

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: Manifest Sync pada Cache Hit**:
  - **Given**: Cache `.verity/cache.json` valid dan working tree git dalam kondisi bersih (clean).
  - **When**: Pengguna menjalankan `verity check --quick --sync-index`.
  - **Then**: Sistem mengenali `[CACHE HIT]`, namun tetap mengeksekusi `generateAndSync()` untuk memperbarui `docs/brief/INDEX.md` tanpa melewatinya.
- [x] **Scenario 2: Git Pre-Commit Hook Active**:
  - **Given**: Berkas `.git/hooks/pre-commit` telah dipasang dan memiliki mode executable.
  - **When**: Git pre-commit dijalankan saat seluruh spec valid.
  - **Then**: Hook mengembalikan exit code 0 dan mengizinkan commit berlanjut.

---

## Definition of Done (DoD) Checklist
- [x] Logika `syncIndex` pada cache-hit terimplementasi di `src/cli/commands/check.ts`.
- [x] Hook `.git/hooks/pre-commit` terpasang dan executable.
- [x] Unit & integration test lulus tanpa kegagalan (`bun test`).
- [x] Tidak ada regresi pada fungsionalitas `--quick` maupun `--sync-index` reguler.
- [x] Provenance disegel via `verity link` dan manifest disinkronkan via `verity index`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/check.ts`