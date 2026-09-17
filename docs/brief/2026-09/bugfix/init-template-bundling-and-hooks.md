---
verity:
  anchors:
    - path: src/cli/commands/init.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: b137658f5773c738870afbb1d8609dd7e7f0289a8813a7c413cbaeabd95b9ae9
        timestamp: 2026-09-17T17:43:50.223Z
    - path: templates/hooks/verity-pre-invocation.cjs
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 7c94ecd7e72f0ae7161895f1bb36fd24524f31c9a05594764077a09fe2224765
        timestamp: 2026-09-17T17:43:50.255Z
    - path: templates/hooks/verity-mutation-guard.cjs
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: a2b5ac7ffc1799854147a72a17dd9090e703079c28add2c6abc39049cd14bf6f
        timestamp: 2026-09-17T17:43:50.272Z
    - path: src/core/anchor/scanner.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: d5ba5a668355215e00c017f80fca326c0f44cb5a7b04d1f6f343f5c1dc064c5d
        timestamp: 2026-09-17T17:43:50.285Z
---

# Brief: Bugfix Verity Init Template Bundling & Portable Agent Hooks

> **Kategori**: bugfix  
> **Status**: Completed  
> **Tanggal**: 2026-09-17  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. Saat Verity dipasang dari npm (`@dimassetoid/verity`) dan dijalankan via CLI binary (`dist/verity.js`), perintah `verity init --skills --agent-hooks` gagal menyalin template hooks dan skills.
     - **Root Cause**: Di `src/cli/commands/init.ts`, resolusi path template di-hardcode dengan `resolve(__dirname, '../../../templates/...')`. Pada binary ter-bundle di `dist/verity.js`, `__dirname` berada di `<pkg>/dist`, sehingga pencarian 3 level ke atas meleset ke luar direktori package npm.
  2. Template hook (`verity-pre-invocation.cjs` dan `verity-mutation-guard.cjs`) meng-hardcode eksekusi `bun run src/cli/index.ts`. Ketika dipasang di proyek konsumen (consumer repo), perintah tersebut crash karena `src/cli/index.ts` hanya ada di repositori internal Verity.
  3. Status 'NOT_FOUND' pada hasil audit Verity tidak terdeteksi oleh `verity-pre-invocation.cjs` karena hanya memeriksa status 'ERROR'.
- **Tujuan Utama**:
  1. Menghadirkan helper resolusi direktori template yang adaptif untuk lingkungan `dist/` (npm bundle) dan `src/` (development).
  2. Menjadikan agent hooks portabel dengan deteksi otomatis runner (`verity` binary, `bunx/npx`, atau `src/cli/index.ts`).
  3. Memastikan `verity init` sukses menyalin hooks dan skills secara deterministik di proyek pengguna.

---

## Scope & Boundaries
### In-Scope
- [ ] Perbaikan path resolution di `src/cli/commands/init.ts` menggunakan fallback adaptif `resolveTemplateDir()`.
- [ ] Refaktor `templates/hooks/verity-pre-invocation.cjs` dan `templates/hooks/verity-mutation-guard.cjs` agar menggunakan runner Verity dinamis dan mengenali status `NOT_FOUND`.
- [ ] Sinkronisasi perbaikan ke `.agents/hooks/` yang telah disalin.
- [ ] Verifikasi via `verity check` dan test suite.

### Out-of-Scope
- Refactor modul parser atau fingerprint AST.
- Publikasi langsung ke npmjs (memerlukan interaksi manual / CI user).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/cli/commands/init.ts:L100-L195` (helper `resolveTemplateDir` dan pembaruan path referensi)
  - `templates/hooks/verity-pre-invocation.cjs:L25-L45` (dynamic runner & NOT_FOUND status check)
  - `templates/hooks/verity-mutation-guard.cjs:L35-L50` (dynamic runner)
  - `.agents/hooks/verity-pre-invocation.cjs` (sinkronisasi)
  - `.agents/hooks/verity-mutation-guard.cjs` (sinkronisasi)
- **Data Model & API Impact**: Tidak ada breaking change pada schema publik atau database; kompatibel penuh ke belakang.

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Template Resolution di Bundle & Dev**:
  - **Given**: CLI dijalankan baik dari `dist/verity.js` maupun `src/cli/index.ts`.
  - **When**: Fungsi `resolveTemplateDir()` dipanggil.
  - **Then**: Mengembalikan path direktori `templates` yang valid dan ada di filesystem tanpa melempar false negatives.
- [ ] **Scenario 2: Portabilitas Runner Hooks**:
  - **Given**: Hook `verity-pre-invocation.cjs` atau `verity-mutation-guard.cjs` dipicu di proyek mana pun.
  - **When**: Hook mencari executable Verity.
  - **Then**: Hook memprioritaskan `src/cli/index.ts` jika di repo lokal Verity, atau fallback ke `verity` CLI di PATH atau `npx/bunx @dimassetoid/verity`.
- [ ] **Scenario 3: Deteksi Missing Anchors**:
  - **Given**: Ada anchor berstatus `NOT_FOUND` pada hasil `verity check`.
  - **When**: `verity-pre-invocation.cjs` memproses output JSON.
  - **Then**: Jumlah anchor hilang terhitung secara akurat dalam pesan awareness.

---

## Definition of Done (DoD) Checklist
- [ ] Helper `resolveTemplateDir` diimplementasikan dengan benar dan aman.
- [ ] Seluruh hook template dan `.agents/hooks/` diperbarui.
- [ ] TypeScript typecheck dan unit tests lolos tanpa error.
- [ ] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/init.ts`
  - `templates/hooks/verity-pre-invocation.cjs`
  - `templates/hooks/verity-mutation-guard.cjs`
  - `src/core/anchor/scanner.ts`