---
verity:
  anchors:
    - path: src/core/git/client.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: aa8edd1c90e62dc95c76d59791b053f63c4c843f1c0400ac2a8b82fdc6215807
        timestamp: 2026-09-17T16:36:33.929Z
    - path: src/core/anchor/scanner.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: d5ba5a668355215e00c017f80fca326c0f44cb5a7b04d1f6f343f5c1dc064c5d
        timestamp: 2026-09-17T16:36:33.944Z
    - path: src/cli/commands/check.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 1666bd29e6f3c74052de02705b509b4a71b16da91f8a77441e3060ed0ed6bc15
        timestamp: 2026-09-17T16:36:33.956Z
    - path: src/cli/commands/link.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 7a8717a92c0e9c693cb11c2f877f97d2721c169fe9c87df5629a922af33d96f7
        timestamp: 2026-09-17T16:36:33.978Z
---

# Brief: Verity Scalability & Enterprise Edge-Case Hardening
 
> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  
 
---
 
## Overview & Problem Statement
- **Konteks & Alasan**: Seiring berkembangnya proyek perangkat lunak menjadi ratusan atau ribuan file kode dan puluhan berkas spesifikasi, pendekatan audit brute-force (memindai dan mem-parse ulang seluruh file secara sinkron) menimbulkan bottleneck I/O disk. Selain itu, penautan file-level pada modul bersama (*shared hubs*) menimbulkan fenomena *cascading STALE* (perubahan 1 baris pada modul shared memicu false-positive staleness pada banyak brief sekaligus), dan pemindahan lokasi file (*file move/rename*) menghasilkan status `NOT_FOUND` alih-alih pelacakan relokasi.
- **Tujuan Utama**: 
  1. Mengimplementasikan **Git-Diff Scoped Auditing** ($O(\text{changed})$ alih-alih $O(\text{total})$) pada `verity check` sehingga hanya file yang termutasi pada working tree/commit aktif yang di-parse ulang.
  2. Mengimplementasikan **Centralized Anchor Registry** (`.verity/manifest.json`) untuk mereduksi ribuan operasi baca file markdown menjadi 1 kali pembacaan index terkompresi.
  3. Menambahkan **Git File Move & Rename Detection** via `git status -M` / `git log --follow` agar file kode yang dipindahkan dapat dideteksi dan direkonsiliasi secara otomatis.
  4. Menambahkan **Shared Module Guardrail** pada `verity link` yang menganjurkan penggunaan *symbol-level anchor* (`file.ts#symbol`) untuk file dengan relasi multi-brief guna mencegah false-positive cascading STALE.
  5. Menjaga prinsip **Zero-LLM Cost** pada engine lokal dan melindungi context window AI Agent dari *context rot*.
 
---
 
## Scope & Boundaries
### In-Scope
- [x] Implementasi Git-Diff filter di `src/core/git/client.ts` dan `src/cli/commands/check.ts` (`git diff --name-only <baseline>`):
  - Memfilter anchor target yang tidak tersentuh dalam git diff agar langsung ditandai `OK` berbasis snapshot cache.
- [x] Implementasi Centralized Registry Cache di `.verity/manifest.json`:
  - Menyimpan inverse index: `targetPath -> Anchor[]` terkompresi.
  - Mempercepat eksekusi scanner tanpa pembacaan rekursif file `.md` berulang.
- [x] Implementasi Git Move / Rename Tracking di `src/core/git/client.ts`:
  - Mendeteksi kesamaan konten jika file berstatus `NOT_FOUND` tetapi ada file baru dengan Git similarity $\ge 80\%$.
  - Menampilkan status informatif: `[MOVED] Target relocated to 'new/path.ts'`.
- [x] Validasi Shared Hub Guardrail pada `src/cli/commands/link.ts`:
  - Memberi warning interaktif / log saat user mengikat file bersama tanpa symbol identifier.
- [x] Test suite komprehensif di `tests/scalability-and-edge-cases.test.ts`.
- [x] Verifikasi automated test (`bun test`) dan validasi drift (`verity check`).
 
### Out-of-Scope
- Evaluasi semantik prosa naratif menggunakan LLM (Verity tetap 100% deterministik tanpa biaya token API).
- Parsing struktur syntax tree di luar AST boundary yang sudah didukung.
 
---
 
## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/git/client.ts` (penambahan `getChangedFilesSince`, `detectRenamedFiles`)
  - `src/core/anchor/scanner.ts` (integrasi centralized manifest reader)
  - `src/cli/commands/check.ts` (integrasi diff-scoped audit & skip unmutated files)
  - `src/cli/commands/link.ts` (shared module warning & registry cache update)
  - `tests/scalability-and-edge-cases.test.ts` (automated test suite)
- **Data Model & API Impact**:
  - Struktur baru pada `.verity/manifest.json`.
  - Penambahan status report `MOVED` pada `StalenessStatus` (`'OK' | 'STALE' | 'NOT_FOUND' | 'MOVED' | 'ERROR'`).
 
---
 
## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: Git-Diff Scoped Auditing**:
  - **Given**: Repositori memiliki 100 anchor terdaftar, namun hanya 1 file kode yang dimodifikasi di git working tree.
  - **When**: `verity check` dieksekusi.
  - **Then**: Verity hanya mem-parse 1 file yang berubah tersebut, melewatkan 99 file lainnya, dan selesai dalam waktu $< 50\text{ms}$.
- [x] **Scenario 2: Centralized Registry Cache Hit**:
  - **Given**: Berkas `.verity/manifest.json` sudah terbentuk.
  - **When**: `AnchorScanner.scan()` dipanggil tanpa path spesifik.
  - **Then**: Scanner membaca registry JSON instan tanpa melakukan rekursi disk pada seluruh file `.md`.
- [x] **Scenario 3: Git File Move Detection**:
  - **Given**: Sebuah file target kode dipindahkan jalurnya (git mv `src/old.ts` `src/new.ts`).
  - **When**: `verity check` dieksekusi.
  - **Then**: Verity mendeteksi status `MOVED` dan memberikan saran pembaruan path alih-alih sekadar `NOT_FOUND`.
- [x] **Scenario 4: Shared Hub Warning pada Link**:
  - **Given**: Sebuah file kode sudah terikat pada 3 atau lebih brief.
  - **When**: Pengguna menjalankan `verity link` pada file tersebut tanpa menyertakan target symbol (`#symbol`).
  - **Then**: Verity menampilkan pesan peringatan anjuran penggunaan anchor simbolik untuk mencegah cascading STALE.
 
---
 
## Definition of Done (DoD) Checklist
- [x] Metode `getChangedFilesSince` dan `detectRenamedFiles` terimplementasi di `GitClient`.
- [x] `AnchorScanner` mendukung pembacaan dan pembaruan `.verity/manifest.json`.
- [x] `verity check` mendukung filter diff-scoped audit.
- [x] Seluruh skenario pengujian di `tests/scalability-and-edge-cases.test.ts` PASS.
- [x] `bun test` 100% pass di seluruh test suite.
- [x] Provenance brief disegel via `verity link` dan manifest `INDEX.md` disinkronkan.
 
---
 
## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/core/git/client.ts`
  - `src/core/anchor/scanner.ts`
  - `src/cli/commands/check.ts`
  - `src/cli/commands/link.ts`