---
verity:
  anchors:
    - path: src/core/parser/rust.ts
      provenance:
        commitSha: 4b30074d06f8ac2d94707f051295da40c0f67396
        fingerprint: e8bf5febc2bd8364c2d87c411ef2f018a57a4913571c70b87b911629bac543ab
---

# Brief: Native Rust (.rs) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Bahasa Rust (`.rs`) adalah fondasi utama dalam pengembangan sistem modern performa tinggi, runtime engine, WebAssembly, CLI tools (seperti Turbopack, SWC, Polars, Tauri), dan infrastruktur cloud. Saat ini Verity belum memiliki parser semantik untuk Rust, sehingga file `.rs` ditangani oleh FallbackParser (hashing seluruh file tanpa pemahaman batas fungsi, trait, struct, atau implementasi metode).
- **Tujuan Utama**: 
  1. Mengimplementasikan `RustParser` native berbasis tokenizer deterministik dan *balanced braces scanner* di `src/core/parser/rust.ts`.
  2. Mendukung ekstraksi simbol fungsi mandiri (`fn func_name`, `pub fn`, `pub async fn`, `pub const fn`), `struct`, `enum`, `trait`, serta blok implementasi (`impl StructName { fn method() }` atau `impl Trait for Struct { ... }`) dengan notasi `StructName::method_name`.
  3. Menangani atribut Rust (`#[derive(...)]`, `#[inline]`, `#[tokio::main]`) dan raw string literals (`r#"..."#`).
  4. Mendaftarkan `RustParser` ke `ParserDispatcher` untuk ekstensi `.rs`.
  5. Menjamin kekebalan penuh terhadap variasi format `rustfmt`, trailing commas, dan komentar.
  6. Menyediakan automated test suite komprehensif di `tests/rust-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [x] Implementasi `RustParser` di `src/core/parser/rust.ts` yang mengimplementasikan interface `CodeParser`.
- [x] Dukungan ekstraksi:
  - Fungsi standalone: `[pub] [async] [const] [unsafe] fn function_name(...) -> ReturnType { ... }`
  - Method dalam impl block: `impl [Trait for] TypeName { [pub] fn method_name(...) { ... } }` via notasi `TypeName::method_name` atau `method_name`.
  - Struct declaration: `[pub] struct StructName { ... }` atau tuple struct `[pub] struct StructName(...);`.
  - Enum declaration: `[pub] enum EnumName { ... }`.
  - Trait declaration: `[pub] trait TraitName { ... }`.
  - Type alias: `[pub] type AliasName = ...;`.
- [x] Pendaftaran ekstensi `.rs` di `src/core/parser/dispatcher.ts`.
- [x] Ekspor parser di `src/core/parser/index.ts`.
- [x] Pembuatan test suite `tests/rust-parser.test.ts`.
- [x] Verifikasi automated tests (`bun test`) dan audit drift (`verity check`).
- [x] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Macro expansion (`macro_rules!` / procedural macros) evaluasi dinamis.
- Type inference dan borrow-checker static analysis.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/rust.ts` (new dedicated Rust parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `RustParser`)
  - `src/core/parser/index.ts` (re-export `RustParser`)
  - `tests/rust-parser.test.ts` (new automated test suite)
- **Data Model & API Impact**: None (internal parsing engine).

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: File-Level Rust Parsing**:
  - **Given**: Berkas Rust tanpa target symbol spesifik.
  - **When**: `RustParser.parse(filePath, content)` dieksekusi.
  - **Then**: Mengembalikan `found: true` dengan fingerprint SHA-256 yang dinormalisasi.
- [x] **Scenario 2: Function Extraction (Sync, Async, Pub, Unsafe)**:
  - **Given**: Kode Rust berisi fungsi publik, async, maupun private (`pub async fn fetch_data()`, `fn calculate()`).
  - **When**: Dicari dengan symbol `fetch_data` atau `calculate`.
  - **Then**: Mengembalikan blok kode fungsi terkait secara tepat dengan `found: true`.
- [x] **Scenario 3: Struct, Enum, & Trait Extraction**:
  - **Given**: Kode Rust berisi deklarasi `struct Config { ... }`, `enum State { ... }`, dan `trait Repository { ... }` beserta attribute `#[derive(Debug, Clone)]`.
  - **When**: Dicari dengan symbol `Config`, `State`, atau `Repository`.
  - **Then**: Mengembalikan definisi blok lengkap termasuk attribute pengiringnya.
- [x] **Scenario 4: Impl Method Extraction**:
  - **Given**: Kode Rust dengan `impl ConfigService { pub fn new() -> Self { ... } }`.
  - **When**: Dicari dengan symbol `ConfigService::new` atau `new`.
  - **Then**: Mengembalikan blok metode di dalam `impl` tersebut dengan tepat.
- [x] **Scenario 5: Formatting & Comment Immunity (`rustfmt`)**:
  - **Given**: Dua implementasi kode Rust yang identik secara logika namun berbeda spasi, komentar `// ...`, atau newline.
  - **When**: Keduanya di-fingerprint melalui `RustParser`.
  - **Then**: Keduanya menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [x] `RustParser` terimplementasi di `src/core/parser/rust.ts`.
- [x] Terdaftar di `ParserDispatcher` dan diekspor di `index.ts`.
- [x] Test suite `tests/rust-parser.test.ts` dibuat dan 100% lulus.
- [x] `verity check` berjalan bersih tanpa regresi.
- [x] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `4b30074d06f8ac2d94707f051295da40c0f67396`
- **Anchors**:
  - `src/core/parser/rust.ts`