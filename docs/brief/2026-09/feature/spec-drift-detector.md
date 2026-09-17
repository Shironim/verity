---
verity:
  anchors:
    - path: src/cli/index.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 4837002446e3c2dcddab54c31ee3c1ca674b3268fd50dd6386b02335a1a04d34
        timestamp: 2026-09-17T17:27:36.010Z
---

# Brief: Verity — Multi-Language Spec-Drift Detector

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement

- **Konteks & Alasan**:
  Dalam software engineering modern yang menerapkan *Spec-Driven Development*, spesifikasi (brief, architectural decision records, technical specs) berfungsi sebagai Single Source of Truth (SSOT). Namun, dokumen naratif ini rentan mengalami *spec drift* atau *context rot* saat kode berubah tanpa sinkronisasi dokumen. Solusi saat ini (doc-tests, LLM-on-commit, Fiberplane `drift`, `strata-mcp`, `codegraph`) memiliki keterbatasan: tidak mendukung dokumen campuran seperti Vue SFC (`.vue`) dan Astro (`.astro`), cakupan bahasa terbatas, atau boros biaya komputasi LLM.
- **Tujuan Utama**:
  Membangun CLI tool mandiri berbasis Bun & TypeScript yang mampu mendeteksi *spec-drift* secara deterministik berbasis *git provenance* (commit SHA baseline) dan *normalized AST fingerprint* yang kebal terhadap reformatting kosmetik, dengan dukungan symbol-level pada file single-language maupun multi-language (Vue SFC/Astro via adaptasi dari `strata-mcp`), serta graceful file-level fallback.

---

## Scope & Boundaries

### In-Scope
- [x] Inisialisasi arsitektur project Bun + TypeScript (`package.json`, `tsconfig.json`).
- [x] Anchor Engine: Penyimpanan dan parsing metadata anchor ganda (YAML frontmatter & inline comments `<!-- @verity ... -->`).
- [x] Multi-Tier Code Parser Engine:
  - Adapter Vue SFC (`.vue`) & Astro (`.astro`) porting dari `strata-mcp` (menggunakan `@vue/compiler-sfc`).
  - TypeScript/JavaScript Symbol Extractor menggunakan AST TypeScript compiler API.
  - File-level hash fallback (SHA-256 terstandarisasi).
- [x] Normalized AST Fingerprinting: Normalisasi token AST (menghilangkan whitespace, trivia, formatting) untuk mencegah false-positive saat ada linting/formatting (Prettier/Pint).
- [x] Git Provenance Client: Ekstraksi HEAD commit SHA, deteksi diff riwayat git, dan pengambilan metadata rekonsiliasi (author, commit SHA, pesan commit, timestamp).
- [x] CLI Commands:
  - `verity link <spec-file> <code-anchor>`: Mengikat spec ke file/simbol kode dan menyimpan baseline provenance.
  - `verity check`: Memindai anchor, memverifikasi staleness, melaporkan status (`OK` vs `STALE`) dengan detail rekonsiliasi, dan exit code 1 jika ada yang stale (CI gate-ready).

### Out-of-Scope
- Tidak melakukan evaluasi validitas semantik isi prosa spec menggunakan LLM.
- Tidak bertindak sebagai live query / interactive graph engine (bukan pengganti `strata-mcp` atau `codegraph`).
- Tidak membuat shared package eksternal dengan `strata-mcp`; parser diadaptasi/diduplikasi secara sengaja (*deliberate duplication*) dengan penanda sumber porting.

---

## Spesifikasi Detail Pekerjaan

### 1. Daftar File yang Akan Dibuat / Diubah
- [`package.json`](file:///F:/Veritas/verity/package.json): Konfigurasi Bun project, dependencies (`@vue/compiler-sfc`, `typescript`, `yaml`).
- [`tsconfig.json`](file:///F:/Veritas/verity/tsconfig.json): Konfigurasi kompilasi TypeScript untuk Bun runtime.
- [`src/core/types.ts`](file:///F:/Veritas/verity/src/core/types.ts): Kontrak inti (Anchor, Provenance, SymbolNode, StalenessResult).
- [`src/core/git/client.ts`](file:///F:/Veritas/verity/src/core/git/client.ts): Pembungkus perintah Git (getHeadSha, getCommitHistoryForFile, getSymbolBlame).
- [`src/core/fingerprint/normalizer.ts`](file:///F:/Veritas/verity/src/core/fingerprint/normalizer.ts): Penghasil fingerprint deterministik dari token AST yang dinormalisasi.
- [`src/core/parser/types.ts`](file:///F:/Veritas/verity/src/core/parser/types.ts): Interface parser dan abstraksi symbol extractor.
- [`src/core/parser/typescript.ts`](file:///F:/Veritas/verity/src/core/parser/typescript.ts): AST parser untuk TypeScript/JavaScript menggunakan TS Compiler API.
- [`src/core/parser/mixed/vue.ts`](file:///F:/Veritas/verity/src/core/parser/mixed/vue.ts): Adaptasi SFC splitter & script extractor dari `strata-mcp`.
- [`src/core/parser/mixed/astro.ts`](file:///F:/Veritas/verity/src/core/parser/mixed/astro.ts): Frontmatter script extractor untuk file `.astro`.
- [`src/core/parser/fallback.ts`](file:///F:/Veritas/verity/src/core/parser/fallback.ts): Fallback hasher untuk bahasa yang belum didukung simbolnya.
- [`src/core/parser/dispatcher.ts`](file:///F:/Veritas/verity/src/core/parser/dispatcher.ts): Router pemilihan parser berdasarkan ekstensi file target.
- [`src/core/anchor/frontmatter.ts`](file:///F:/Veritas/verity/src/core/anchor/frontmatter.ts): Parser & serializer anchor YAML frontmatter pada file markdown.
- [`src/core/anchor/inline.ts`](file:///F:/Veritas/verity/src/core/anchor/inline.ts): Parser & serializer anchor inline comment (`<!-- @verity ... -->`).
- [`src/core/anchor/scanner.ts`](file:///F:/Veritas/verity/src/core/anchor/scanner.ts): Pemindai repositori untuk mengumpulkan seluruh anchor aktif.
- [`src/cli/commands/link.ts`](file:///F:/Veritas/verity/src/cli/commands/link.ts): Handler perintah `verity link`.
- [`src/cli/commands/check.ts`](file:///F:/Veritas/verity/src/cli/commands/check.ts): Handler perintah `verity check`.
- [`src/cli/index.ts`](file:///F:/Veritas/verity/src/cli/index.ts): CLI runner executable (entry point binary).

### 2. Line Range Mapping (Rancangan Awal Struktur File Baru)
Karena codebase adalah greenfield, seluruh file di atas adalah berkas baru (`:L1-L80` rata-rata per modul modular).

### 3. Urutan Pengerjaan yang Logis
1. Setup konfigurasi project (`package.json`, `tsconfig.json`) dengan runtime Bun.
2. Definisi kontrak tipe data inti (`src/core/types.ts`).
3. Implementasi Git Client (`src/core/git/client.ts`).
4. Implementasi AST Normalizer & Fingerprinter (`src/core/fingerprint/normalizer.ts`).
5. Implementasi Parsers (TypeScript symbol extractor, adaptasi Vue/Astro dari `strata-mcp`, fallback hasher).
6. Implementasi Anchor Store (Frontmatter & Inline comment parser/updater).
7. Implementasi CLI Commands (`link` & `check`) beserta format output tabular dan JSON.
8. Verifikasi fungsionalitas dengan sample spec & test case kode.

### 4. Dampak Terhadap Bagian Lain
- Tidak ada dampak negatif ke modul lain karena ini repositori baru.
- Dokumen spec pengguna yang ditautkan via `verity link` hanya akan disisipkan blok frontmatter atau tag komentar HTML tanpa merusak isi prosa naratif.

### 5. Potensi Breaking Change atau Resiko
- *Resiko Git Execution*: Repository pengguna belum tentu merupakan git repo atau belum memiliki commit (`unborn branch`). Mitigasi: Validasi kondisi git repo sebelum menjalankan operasi dan berikan pesan error ramah jika belum ada commit git.
- *Resiko Parsing Vue SFC*: Blok `<script>` pada SFC mungkin menggunakan TypeScript atau JavaScript murni. Mitigasi: `@vue/compiler-sfc` mendeteksi atribut `lang="ts"` dan meneruskannya ke AST parser yang tepat.

### 6. Alternatif Pendekatan
- **Parser Engine (Tree-Sitter WASM vs TS Compiler API):**
  - *Opsi A:* Menggunakan `web-tree-sitter` (WASM). Kelebihan: multi-language grammar. Kekurangan: load binary WASM dan manajemen file grammar `.wasm` terpisah yang rentan path resolution error di Windows/Bun.
  - *Opsi B (Terpilih untuk TS/JS + Vue):* TypeScript Compiler API untuk TS/JS + `@vue/compiler-sfc` dari `strata-mcp`, dipadukan dengan graceful file-level fallback. Pendekatan ini 100% native JavaScript/TypeScript, sangat cepat di Bun, tanpa dependensi binary WASM eksternal.

---

## Acceptance Criteria (Given-When-Then)

- [x] **Scenario 1: Menautkan Spec ke Simbol Kode (`verity link`)**
  - **Given**: File spec markdown `docs/brief/auth.md` dan file kode `src/auth.ts` yang memiliki fungsi `login()`.
  - **When**: Pengguna menjalankan `bun run verity link docs/brief/auth.md src/auth.ts#login`.
  - **Then**: Metadata anchor tersimpan di `docs/brief/auth.md` berisi target path, symbol `login`, commit SHA saat ini, dan normalized fingerprint.

- [x] **Scenario 2: Pengecekan Reformat Kode Tidak Menimbulkan False-Positive (`verity check`)**
  - **Given**: File `src/auth.ts#login` diformat ulang (perubahan spasi, baris baru, titik koma) tanpa mengubah struktur token AST.
  - **When**: Pengguna menjalankan `bun run verity check`.
  - **Then**: Status dilaporkan `OK` (exit code 0) dan tidak dianggap stale.

- [x] **Scenario 3: Deteksi Perubahan Kode yang Sebenarnya (`verity check` STALE)**
  - **Given**: Logika di dalam `src/auth.ts#login` diubah dan di-commit ke git.
  - **When**: Pengguna menjalankan `bun run verity check`.
  - **Then**: Status dilaporkan `STALE` (exit code 1), menyertakan nama author yang mengubah, commit SHA, dan pesan commit rekonsiliasi.

- [x] **Scenario 4: Ekstraksi Simbol pada Vue SFC (`.vue`)**
  - **Given**: Komponen Vue `Login.vue` dengan method/fungsi di dalam `<script setup>` atau `<script>`.
  - **When**: Anchor mengarah ke `Login.vue#submitForm`.
  - **Then**: Verity berhasil mengekstrak blok script melalui parser `strata-mcp` dan menghitung fingerprint simbol tanpa terganggu elemen template HTML.

---

## Definition of Done (DoD) Checklist

- [x] `package.json` dan `tsconfig.json` terkonfigurasi untuk Bun & TypeScript.
- [x] Modul parser mendukung TypeScript, JavaScript, Vue SFC (`.vue`), Astro (`.astro`), dan fallback file-level.
- [x] Fingerprinter menghasilkan hash identik untuk kode sebelum dan sesudah formatting Prettier/Pint.
- [x] Perintah `verity link` dan `verity check` berfungsi penuh dengan penanganan error yang jelas.
- [x] Seluruh skenario Acceptance Criteria teruji dan berhasil lulus.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/index.ts`