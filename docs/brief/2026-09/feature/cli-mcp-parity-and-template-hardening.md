---
verity:
  anchors:
    - path: src/cli/commands/status.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 74c7e5a2a579971a8c8a52e961cf11739becdb66d859032448f20e6ecf800b12
        timestamp: 2026-09-17T17:27:34.941Z
    - path: src/cli/commands/diff.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 775e81cbc3bdf6c8b47f030378476e03d5882f547ef3b7a4342ec4d42b7a78d0
        timestamp: 2026-09-17T17:27:34.959Z
    - path: src/cli/index.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 4837002446e3c2dcddab54c31ee3c1ca674b3268fd50dd6386b02335a1a04d34
        timestamp: 2026-09-17T17:27:34.974Z
    - path: src/mcp/tools.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 385f413283547a6bfb8d83f0147817b18f442737aa0e97fa4b03ddc36f18b080
        timestamp: 2026-09-17T17:27:35.000Z
    - path: templates/pre-commit-hook.sh
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 0b8a396bc3281bab1e93b8364f6e6e2dcadf05a7f44b5663488ce359661c9a6b
        timestamp: 2026-09-17T17:27:35.011Z
    - path: templates/instructions.md
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 0e7f6d71b7397fc38cbdbdf7b82b27d8b950a1e7202e6d0691cace5cd7af7343
        timestamp: 2026-09-17T17:27:35.020Z
---

# Brief: Feature CLI & MCP Full Parity, Template Hardening, and Architecture Cleanup

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-18  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. **Asimetri CLI vs MCP**:
     - Developer manusia di CLI kehilangan perintah `verity status` (melihat kesehatan repositori secara cepat) dan `verity diff` (melihat perbedaan git diff sejak baseline commit untuk anchor yang STALE).
     - AI Agent di MCP kehilangan kemampuan `verity_init` untuk menginisialisasi lingkungan Verity secara terprogram melalui antarmuka native MCP.
  2. **Code Smells pada MCP Tools**:
     - `process.cwd()` di-hardcode di seluruh handler MCP tanpa opsi `cwd`, membatasi fleksibilitas pada lingkungan multi-root workspace.
  3. **Templates Tertinggal (*Outdated Templates*)**:
     - `templates/pre-commit-hook.sh` belum mendukung fallback eksekusi via `bunx @dimassetoid/verity` pada lingkungan Bun murni.
     - `templates/instructions.md` belum mencantumkan `verity_find`, `verity_init`, serta format path brief hibrida `docs/brief/YYYY-MM/[category]/[slug].md`.

- **Tujuan Utama**:
  1. Menghadirkan kesetaraan fitur 100% (*full parity*) antara CLI dan MCP.
  2. Mengimplementasikan perintah CLI `verity status` (`src/cli/commands/status.ts`) dan `verity diff` (`src/cli/commands/diff.ts`).
  3. Mengimplementasikan MCP tool `verity_init` pada `src/mcp/tools.ts`.
  4. Mendukung parameter opsional `cwd` pada semua handler MCP.
  5. Memperbarui dan menyelaraskan `templates/pre-commit-hook.sh` dan `templates/instructions.md`.
  6. Menambahkan automated unit tests untuk seluruh kapabilitas baru.

---

## Scope & Boundaries
### In-Scope
- [x] Pembuatan `src/cli/commands/status.ts` dan pendaftaran `verity status` di `src/cli/index.ts`.
- [x] Pembuatan `src/cli/commands/diff.ts` dan pendaftaran `verity diff` di `src/cli/index.ts`.
- [x] Pendaftaran `verity_init` dan opsi `cwd` di `src/mcp/tools.ts`.
- [x] Pembaruan template `templates/pre-commit-hook.sh` (dukungan `bunx`).
- [x] Pembaruan template `templates/instructions.md` (tabel MCP tools lengkap & format path baru).
- [x] Ekspor perintah baru di `src/index.ts`.
- [x] Unit tests di `tests/cli-mcp-parity.test.ts`.

### Out-of-Scope
- Perubahan protokol format token AST fingerprinting.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/status.ts`
  - `src/cli/commands/diff.ts`
  - `src/cli/index.ts`
  - `src/mcp/tools.ts`
  - `templates/pre-commit-hook.sh`
  - `templates/instructions.md`
  - `src/index.ts`
  - `tests/cli-mcp-parity.test.ts`
- **Data Model & API Impact**: Kompatibel penuh, memperluas antarmuka pengguna CLI dan AI agent MCP.

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: CLI verity status**:
  - **Given**: Repositori yang memiliki registered anchors.
  - **When**: `verity status` dijalankan.
  - **Then**: Menampilkan ringkasan Git HEAD, jumlah brief, dan total anchor.
- [x] **Scenario 2: CLI verity diff**:
  - **Given**: Anchor kode yang mengalami modifikasi sejak baseline provenance commit.
  - **When**: `verity diff <spec-file|target>` dijalankan.
  - **Then**: Menampilkan output git diff akurat antara commit baseline dan HEAD saat ini.
- [x] **Scenario 3: MCP verity_init**:
  - **Given**: AI Agent memanggil MCP tool `verity_init`.
  - **When**: Argumen dieksekusi.
  - **Then**: Workspace terinisialisasi secara deterministik sama seperti CLI `verity init`.
- [x] **Scenario 4: Template Hardening**:
  - **Given**: Consumer repo tanpa Node/npm (Bun-only).
  - **When**: `templates/pre-commit-hook.sh` dijalankan.
  - **Then**: Menggunakan `bunx @dimassetoid/verity` dengan benar.

---

## Definition of Done (DoD) Checklist
- [x] `verity status` terimplementasi di CLI.
- [x] `verity diff` terimplementasi di CLI.
- [x] `verity_init` terdaftar di MCP Server.
- [x] Opsi `cwd` didukung di seluruh MCP tools.
- [x] `templates/pre-commit-hook.sh` dan `templates/instructions.md` diperbarui.
- [x] Unit tests lulus 100% (`bun test`).
- [x] Brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/status.ts`
  - `src/cli/commands/diff.ts`
  - `src/cli/index.ts`
  - `src/mcp/tools.ts`
  - `templates/pre-commit-hook.sh`
  - `templates/instructions.md`
