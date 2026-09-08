---
verity:
  anchors:
    - path: src/core/parser/go.ts
      provenance:
        commitSha: 4b30074d06f8ac2d94707f051295da40c0f67396
        fingerprint: 869ca1b04b107681b9dc60051134c0cb19a2b70af1cb06e62745bef795390bc5
        timestamp: 2026-09-08T12:13:23.896Z
    - path: src/core/parser/dispatcher.ts
      provenance:
        commitSha: 4b30074d06f8ac2d94707f051295da40c0f67396
        fingerprint: b3c1c768e6ab7267a6614a8ede8e5c67b894b54d65b61057092223c9383ce565
        timestamp: 2026-09-08T12:13:23.907Z
---

# Brief: Native Go (.go) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Bahasa Go (Golang) merupakan standar utama dalam pengembangan arsitektur cloud-native, microservices, backend performa tinggi, dan CLI tools. Saat ini Verity hanya memiliki parser semantik untuk TypeScript, Vue SFC, Astro, dan PHP, sedangkan file `.go` masih ditangani oleh FallbackParser (hashing file mentah tanpa pemahaman struktur simbol).
- **Tujuan Utama**: 
  1. Mengimplementasikan `GoParser` native berbasis tokenizer deterministik dan *balanced braces scanner* di `src/core/parser/go.ts`.
  2. Mendukung pelacakan simbol fungsi independen (`func FuncName`), method receiver (`func (r *Receiver) MethodName` via `Receiver::MethodName`), serta definisi `struct` dan `interface`.
  3. Menangani raw string literal backtick (`` `...` ``) yang sering digunakan pada Go struct tags (`json:"..."`).
  4. Mendaftarkan `GoParser` ke `ParserDispatcher` (`.go`).
  5. Menjamin kekebalan penuh terhadap variasi format `gofmt`, trailing commas, dan komentar.
  6. Menyediakan automated test suite komprehensif di `tests/go-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [x] Implementasi `GoParser` di `src/core/parser/go.ts` yang mengimplementasikan interface `CodeParser`.
- [x] Dukungan ekstraksi:
  - Fungsi umum: `func FunctionName(...) { ... }`
  - Method dengan pointer/value receiver: `func (r *Receiver) MethodName(...) { ... }` (dipanggil via `Receiver::MethodName` atau `MethodName`)
  - Struct declaration: `type StructName struct { ... }`
  - Interface declaration: `type InterfaceName interface { ... }`
- [x] Pendaftaran ekstensi `.go` di `src/core/parser/dispatcher.ts:L10-L20`.
- [x] Pembuatan test suite `tests/go-parser.test.ts` (unit tests untuk functions, method receivers, structs, interfaces, dan immunity gofmt).
- [x] Verifikasi automated tests (`bun test`) dan validasi drift (`verity check`).
- [x] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Parser Python (`.py`) — dialokasikan untuk task brief terpisah berikutnya.
- Parsing internal Control Flow Graph (CFG) Go — Verity hanya memerlukan isolasi batas blok semantik & AST fingerprint.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/go.ts` (new dedicated Go parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `GoParser`)
  - `tests/go-parser.test.ts` (new automated test suite)
- **Data Model & API Impact**: None (internal parsing engine & dispatcher).

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: File-Level Go Parsing**:
  - **Given**: Berkas Go tanpa target symbol spesifik.
  - **When**: `GoParser.parse(filePath, content)` dieksekusi.
  - **Then**: Mengembalikan `found: true` dengan fingerprint SHA-256 yang dinormalisasi.
- [x] **Scenario 2: Function & Method Receiver Extraction**:
  - **Given**: Kode Go berisi fungsi biasa `func CalculateTotal()` dan method receiver `func (s *OrderService) ProcessOrder()`.
  - **When**: Dicari dengan symbol `CalculateTotal` atau `OrderService::ProcessOrder`.
  - **Then**: Mengembalikan blok kode fungsi/method terkait secara tepat dengan `found: true`.
- [x] **Scenario 3: Struct & Interface Extraction**:
  - **Given**: Kode Go berisi deklarasi `type User struct { ... }` dengan backtick tags dan `type Repository interface { ... }`.
  - **When**: Dicari dengan symbol `User` atau `Repository`.
  - **Then**: Mengembalikan blok definisi struct/interface lengkap dengan kurung kurawal pembuka dan penutup.
- [x] **Scenario 4: Formatting & Comment Immunity (`gofmt`)**:
  - **Given**: Dua implementasi kode Go yang identik secara logika namun memiliki perbedaan komentar `// ...`, baris kosong, atau indentasi tab/spasi.
  - **When**: Keduanya di-fingerprint melalui `GoParser`.
  - **Then**: Keduanya menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [x] `GoParser` terimplementasi di `src/core/parser/go.ts`.
- [x] `GoParser` terdaftar di `ParserDispatcher`.
- [x] `tests/go-parser.test.ts` mencakup minimal 6 test cases dan seluruhnya PASS.
- [x] `bun test` berhasil dengan 0 failure di seluruh test suite repositori.
- [x] Provenance disegel via `verity link` dan manifest disinkronkan via `verity index`.

---

## Provenance
- **Completion Commit**: `4b30074d06f8ac2d94707f051295da40c0f67396`
- **Anchors**:
  - `src/core/parser/go.ts`
  - `src/core/parser/dispatcher.ts`