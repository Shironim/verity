---
verity:
  anchors:
    - path: src/cli/commands/init.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: b137658f5773c738870afbb1d8609dd7e7f0289a8813a7c413cbaeabd95b9ae9
        timestamp: 2026-09-17T17:43:49.636Z
    - path: templates/hooks.json
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 5e05de68487fcc09c5e1cd99caa0bfa6ee2b62fc33610cae64022bfd9d22dd58
        timestamp: 2026-09-17T17:43:49.653Z
---

# Brief: Bugfix Verity Init Path Hijack & Hook Command Resolution

> **Kategori**: bugfix  
> **Status**: Completed  
> **Tanggal**: 2026-09-17  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. **Template Directory Hijacking**: Pada `src/cli/commands/init.ts`, resolusi `templatesDir` menyertakan `resolve(process.cwd(), 'templates')`. Jika consumer project memiliki folder `templates/` (misal Django, Flask, Express, Email Templates), Verity keliru mengidentifikasi folder tersebut sebagai asset bawaan Verity. Hal ini menyebabkan kegagalan penyalinan `instructions.md`, `pre-commit-hook.sh`, dan `hooks/`.
  2. **Hook Execution Path Mismatch**: Pada `templates/hooks.json` dan fallback config di `src/cli/commands/init.ts`, command hook didaftarkan sebagai `node hooks/verity-pre-invocation.cjs` dan `node hooks/verity-mutation-guard.cjs`. Namun file tersebut disalin ke `.agents/hooks/`. Ketika agent runner mengeksekusi hook dengan CWD workspace root, Node.js gagal menemukan file (`MODULE_NOT_FOUND`). Command yang benar dan robust dari workspace root adalah `node .agents/hooks/...`.
  3. **Robust Smart Merging**: Memastikan penggabungan `.agents/hooks.json` mempertahankan konfigurasi hook pengguna yang sudah ada tanpa overwrite destruktif.

- **Tujuan Utama**:
  1. Memperbaiki resolusi `templatesDir` agar tidak membajak folder `templates/` milik pengguna, dan memverifikasi integritas template sebelum menggunakannya.
  2. Memperbaiki path perintah hook pada `templates/hooks.json` dan fallback `init.ts` menjadi `node .agents/hooks/verity-pre-invocation.cjs` dan `node .agents/hooks/verity-mutation-guard.cjs`.
  3. Memastikan unit test memvalidasi path eksekusi yang tepat dan resolusi template yang aman.

---

## Scope & Boundaries
### In-Scope
- [x] Refaktor helper resolusi template di `src/cli/commands/init.ts:L55-L70` dengan validasi penanda Verity (misal memastikan `instructions.md` ada) dan menghapus fallback `process.cwd()/templates` yang tidak aman.
- [x] Perbaikan path perintah di `templates/hooks.json` dan fallback konfigurasi `init.ts:L110-L150` ke `node .agents/hooks/...`.
- [x] Sinkronisasi file manifest `.agents/hooks.json` pada workspace jika ada.
- [x] Penambahan/pembaruan unit test di `tests/init-command.test.ts`.
- [x] Sinkronisasi index manifest via `bun run verity index` atau regenerasi `docs/brief/INDEX.md`.

### Out-of-Scope
- Modifikasi logika fingerprinting AST di core scanner.
- Perubahan protokol event hook Antigravity selain penyesuaian path command.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/init.ts:L55-L160` (Template directory resolution & hook command paths)
  - `templates/hooks.json:L6,L15,L27` (Command path update ke `.agents/hooks/`)
  - `tests/init-command.test.ts:L15-L50` (Pengujian isolasi path & hook config)
- **Data Model & API Impact**: Kompatibel penuh, non-breaking.

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: Aman Terhadap Folder templates/ di Consumer Project**:
  - **Given**: Consumer repo memiliki folder `./templates` berisi file non-Verity.
  - **When**: `runInitCommand` dijalankan.
  - **Then**: Verity menyelesaikan `templatesDir` dari bundle package internalnya (`dist/` atau `src/`), bukan dari `./templates` milik consumer project.
- [x] **Scenario 2: Path Eksekusi Hook yang Benar**:
  - **Given**: Workspace baru yang menjalankan `runInitCommand({ agentHooks: true })`.
  - **When**: `.agents/hooks.json` dibuat.
  - **Then**: Field `command` pada seluruh hook mengarah ke `node .agents/hooks/verity-*.cjs`.

---

## Definition of Done (DoD) Checklist
- [x] Bugfix di `src/cli/commands/init.ts` diterapkan.
- [x] `templates/hooks.json` diperbarui.
- [x] Unit tests lulus 100% (`bun test`).
- [x] Status brief diubah menjadi `Completed` dan disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/init.ts`
  - `templates/hooks.json`