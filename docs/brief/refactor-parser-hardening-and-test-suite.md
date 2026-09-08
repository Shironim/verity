---
verity:
  anchors:
    - path: src/core/parser/mixed/vue.ts
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: 47d611b593eb2a2dc6f5a0bdc12b47cb5248920bd3cf4e3d37f14f42673714ba
        timestamp: 2026-09-08T10:28:30.119Z
    - path: src/core/fingerprint/normalizer.ts
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: 022b76b906fac40e70c3530b9543192b4fb0404263cc0f4636be3c8bd8c0680f
        timestamp: 2026-09-08T10:28:30.129Z
---

# Brief: Parser Hardening, Vue SFC Clean Bundling, & Automated Test Suite

> **Kategori**: refactor  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Bundle CLI dan binary standalone Verity harus bebas dari dependensi compiler template eksternal tak terpakai (@vue/compiler-sfc full build membawa parser compiler runtime ganda). Selain itu, normalisasi AST fingerprint perlu diperkuat terhadap variasi trailing commas dan whitespace Prettier, serta dukungan ekstraksi kontrak `defineProps`, `defineEmits`, dan event bindings pada file `.vue`. Diperlukan pula automated test suite komprehensif untuk memverifikasi kekebalan deterministik Verity secara berkelanjutan.
- **Tujuan Utama**: 
  1. Membersihkan import Vue SFC ke ESM browser build (`@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js`).
  2. Memperluas kapabilitas `VueSfcParser` untuk mendeteksi `defineProps`, `defineEmits`, dan event bindings.
  3. Menjamin kekebalan `FingerprintNormalizer` terhadap trailing commas, whitespace ganda, dan inline/block comments.
  4. Menyediakan unit & integration test suite (`tests/ast-normalizer.test.ts`, `tests/vue-parser.test.ts`, `tests/cli-commands.test.ts`).

---

## Scope & Boundaries
### In-Scope
- [x] Refactor import `@vue/compiler-sfc` di `src/core/parser/mixed/vue.ts` ke browser ESM build.
- [x] Ekstraksi simbol `defineProps`, `defineEmits`, dan events dari template Vue SFC di `src/core/parser/mixed/vue.ts`.
- [x] Penguatan strip trailing comma dan comment handling di `src/core/fingerprint/normalizer.ts`.
- [x] Pembuatan test suite `tests/ast-normalizer.test.ts`, `tests/vue-parser.test.ts`, dan `tests/cli-commands.test.ts`.
- [x] Verifikasi eksekusi test melalui `bun test` dan verifikasi integritas via `verity check`.

### Out-of-Scope
- Implementasi MCP server layer (dialokasikan untuk Milestone 2).
- Parser PHP AST (dialokasikan untuk Milestone 5).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/mixed/vue.ts:L1-L80`
  - `src/core/fingerprint/normalizer.ts:L1-L51`
  - `tests/ast-normalizer.test.ts` (new)
  - `tests/vue-parser.test.ts` (new)
  - `tests/cli-commands.test.ts` (new)
- **Data Model & API Impact**: None (internal parsing engine & tests).

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Vue SFC Clean Import & Parsing**:
  - **Given**: File Vue SFC dengan `<script setup>` dan template bindings.
  - **When**: `VueSfcParser.parse()` dipanggil menggunakan build `compiler-sfc.esm-browser.js`.
  - **Then**: Script dan template terurai tanpa error dan mengekstrak simbol `defineProps` / `defineEmits` jika ditargetkan.
- [ ] **Scenario 2: AST Normalizer Immunity**:
  - **Given**: Dua kode sumber dengan logika sama persis tetapi berbeda dalam whitespace, tabs vs spaces, trailing commas, dan penempatan komentar.
  - **When**: `FingerprintNormalizer.hashNormalizedText()` dijalankan pada kedua teks.
  - **Then**: Menghasilkan SHA-256 fingerprint yang identik (status OK, no false positive).
- [ ] **Scenario 3: CLI Commands Integration Test**:
  - **Given**: Dokumen markdown spec dan target file kode di repositori.
  - **When**: `verity check` dijalankan melalui command runner.
  - **Then**: Seluruh anchor tervalidasi dan menghasilkan exit code 0.

---

## Definition of Done (DoD) Checklist
- [ ] Import `@vue/compiler-sfc` ter-refactor ke browser ESM build.
- [ ] `VueSfcParser` mendukung `defineProps`, `defineEmits`, dan event bindings.
- [ ] `FingerprintNormalizer` kebal terhadap trailing comma dan whitespace formatting.
- [ ] Seluruh test di `bun test` lulus 100%.
- [ ] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `af1af9c49c877674d236f57288616999f93312fc`
- **Anchors**:
  - `src/core/parser/mixed/vue.ts`
  - `src/core/fingerprint/normalizer.ts`