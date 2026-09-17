---
verity:
  anchors:
    - path: src/cli/commands/init.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: b137658f5773c738870afbb1d8609dd7e7f0289a8813a7c413cbaeabd95b9ae9
        timestamp: 2026-09-17T17:43:49.325Z
    - path: templates/hooks.json
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 5e05de68487fcc09c5e1cd99caa0bfa6ee2b62fc33610cae64022bfd9d22dd58
        timestamp: 2026-09-17T17:43:49.339Z
---

# Brief: Feature Verity Init Hooks Manifest Automation (`.agents/hooks.json`)

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-17  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  Saat pengguna menjalankan `verity init --agent-hooks`, script hook `.agents/hooks/*.cjs` telah disalin, tetapi file manifest pendaftaran hook [`.agents/hooks.json`](file:///home/shironim/Project/verity/.agents/hooks.json) belum dibuat secara otomatis. Akibatnya, Antigravity CLI tidak mengeksekusi hook tersebut secara otomatis tanpa intervensi manual dari pengguna.
- **Tujuan Utama**:
  Mengotomatiskan pembuatan dan penggabungan (*smart merge*) file `.agents/hooks.json` di dalam `verity init` agar Lifecycle Hooks Verity langsung aktif tanpa konfigurasi manual.

---

## Scope & Boundaries
### In-Scope
- [ ] Penambahan file referensi template `templates/hooks.json`.
- [ ] Otomasi pembuatan dan smart merging `.agents/hooks.json` di `src/cli/commands/init.ts:L170-L200`.
- [ ] Penulisan file aktif `.agents/hooks.json` di repositori ini.
- [ ] Penambahan unit test verifikasi `.agents/hooks.json` di `tests/init-command.test.ts`.
- [ ] Kompilasi bundle `bun run build`.
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Perubahan event matcher selain `replace_file_content` dan `write_to_file`.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `templates/hooks.json`
  - `src/cli/commands/init.ts:L170-L200`
  - `.agents/hooks.json`
  - `tests/init-command.test.ts`
- **Data Model & API Impact**: Non-breaking, kompatibel dengan seluruh runtime Antigravity lifecycle hooks.

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Fresh Creation of .agents/hooks.json**:
  - **Given**: Workspace baru tanpa file `.agents/hooks.json`.
  - **When**: `runInitCommand({ agentHooks: true })` atau `{ yes: true }` dijalankan.
  - **Then**: File `.agents/hooks.json` tercipta dengan konfigurasi `verity-pre-invocation` dan `verity-mutation-guard`.
- [ ] **Scenario 2: Safe Merge with Existing Hooks**:
  - **Given**: Workspace memiliki `.agents/hooks.json` dengan hook lain milik pengguna (misal `custom-linter`).
  - **When**: `runInitCommand` dijalankan.
  - **Then**: Hook Verity ditambahkan tanpa menghapus atau merusak hook `custom-linter`.

---

## Definition of Done (DoD) Checklist
- [ ] `templates/hooks.json` dibuat.
- [ ] Logika smart merge terimplementasi di `init.ts`.
- [ ] Unit tests lulus 100% (`bun test`).
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/init.ts`
  - `templates/hooks.json`