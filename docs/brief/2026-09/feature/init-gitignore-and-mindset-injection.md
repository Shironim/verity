---
verity:
  anchors:
    - path: src/cli/commands/init.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: b137658f5773c738870afbb1d8609dd7e7f0289a8813a7c413cbaeabd95b9ae9
        timestamp: 2026-09-17T17:43:50.571Z
    - path: templates/hooks/verity-pre-invocation.cjs
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 7c94ecd7e72f0ae7161895f1bb36fd24524f31c9a05594764077a09fe2224765
        timestamp: 2026-09-17T17:43:50.598Z
---

# Brief: Feature Verity Init Auto-Gitignore & Spec-Driven Mindset Injection

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-17  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. Saat pengguna menjalankan `verity init` pada suatu proyek, folder `.agents/` (memuat hooks & skills) dan `.verity/` (memuat cache manifest) saat ini belum secara otomatis didaftarkan ke file `.gitignore`. Hal ini berisiko mengotori git tree tim dengan artefak lokal AI agent.
  2. Arahan engineering mindset (`[ENGINEERING MANDATE]`) sebelumnya dikonfigurasi di level global OS, sehingga membebani seluruh proyek non-Verity. Seharusnya arahan mindset ini melekat (*co-located*) di hook proyek lokal Verity (`verity-pre-invocation.cjs`) dan otomatis aktif saat proyek di-init.
- **Tujuan Utama**:
  1. `verity init` secara otomatis mendeteksi dan memperbarui `.gitignore` agar mengabaikan `.agents/` dan `.verity/`.
  2. Hook `templates/hooks/verity-pre-invocation.cjs` secara konsisten menyuntikkan `[VERITY SPEC-DRIVEN MANDATE]` ke agent prompt bersamaan dengan drift awareness.

---

## Scope & Boundaries
### In-Scope
- [ ] Penambahan step otomatisasi `.gitignore` di `src/cli/commands/init.ts:L210-L245`.
- [ ] Pembaruan tipe return `runInitCommand` mencakup field `gitignoreUpdated: boolean`.
- [ ] Pengayaan template `templates/hooks/verity-pre-invocation.cjs` dan `.agents/hooks/verity-pre-invocation.cjs` dengan Verity Spec-Driven Mandate.
- [ ] Penambahan unit test untuk auto-gitignore di `tests/cli-commands.test.ts`.
- [ ] Rebuild binary distribusi (`bun run build`).
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Modifikasi git hooks pre-commit yang sudah stabil.
- Perubahan pada hook global OS `~/.gemini/hooks/`.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/init.ts:L62-L75`, `L215-L250`
  - `templates/hooks/verity-pre-invocation.cjs:L30-L70`
  - `.agents/hooks/verity-pre-invocation.cjs`
  - `tests/cli-commands.test.ts`
- **Data Model & API Impact**: Non-breaking, field baru `gitignoreUpdated` bersifat opsional/aditif pada output init.

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Auto-add to existing .gitignore**:
  - **Given**: Proyek memiliki file `.gitignore` tanpa entri `.agents/` atau `.verity/`.
  - **When**: `runInitCommand({ cwd: targetDir })` dijalankan.
  - **Then**: File `.gitignore` ditambahkan entri `.agents/` dan `.verity/`, serta mengembalikan `gitignoreUpdated: true`.
- [ ] **Scenario 2: Idempotent .gitignore**:
  - **Given**: Proyek memiliki `.gitignore` yang sudah memuat `.agents/` dan `.verity/`.
  - **When**: `runInitCommand` dijalankan ulang.
  - **Then**: File `.gitignore` tidak diubah ulang dan tidak ada entri duplikat.
- [ ] **Scenario 3: Mandate Injection on Every Turn**:
  - **Given**: Hook `verity-pre-invocation.cjs` dipanggil oleh AI Agent environment.
  - **When**: Hook selesai membaca status drift.
  - **Then**: Menghasilkan `injectSteps` dengan teks `[VERITY SPEC-DRIVEN MANDATE]` baik saat ada drift maupun tidak ada drift.

---

## Definition of Done (DoD) Checklist
- [ ] Logika `.gitignore` terimplementasi dan idempotent.
- [ ] Hook pre-invocation template dan lokal terupdate.
- [ ] Seluruh unit test lolos tanpa kegagalan (`bun test`).
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/init.ts`
  - `templates/hooks/verity-pre-invocation.cjs`