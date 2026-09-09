---
verity:
  anchors:
    - path: src/core/parser/jvm.ts
      provenance:
        commitSha: b1dc7cacb0068ad225e7814f727fae354ea902f9
        fingerprint: 930d3e817cce86a5071bdc6cb671d849cc02f42e46029f4abfdb57588508bae1
        timestamp: 2026-09-08T13:03:38.255Z
---

# Brief: Native Java (.java) & Kotlin (.kt) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Java dan Kotlin adalah pilar utama di dunia Enterprise Backend (Spring Boot, Quarkus, Micronaut) dan Android Mobile development. Repositori enterprise sering kali memiliki ribuan file dengan arsitektur multi-layer (Controller, Service, Repository, DTO). Saat ini Verity belum memiliki parser semantik untuk Java/Kotlin, sehingga perubahan sekecil apa pun memicu deteksi drift file utuh tanpa presisi metode/anotasi.
- **Tujuan Utama**: 
  1. Mengimplementasikan `JvmParser` (atau parser pasangan `JavaParser` & `KotlinParser`) di `src/core/parser/jvm.ts`.
  2. Mendukung ekstraksi simbol `class`, `interface`, `record`, `enum`, method (`Class::method`), dan anotasi (`@Service`, `@GetMapping`, `@Transactional`).
  3. Mendukung sintaks khas Kotlin: `fun functionName(...)`, `data class`, `suspend fun`, `companion object`.
  4. Mendaftarkan ekstensi `.java` dan `.kt` ke `ParserDispatcher`.
  5. Menjamin kekebalan penuh terhadap variasi format `google-java-format` / `ktlint`, trailing commas, dan komentar Javadoc/KDoc.
  6. Menyediakan automated test suite komprehensif di `tests/jvm-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [x] Implementasi `JvmParser` di `src/core/parser/jvm.ts` yang menangani ekstensi `.java` dan `.kt`.
- [x] Dukungan ekstraksi Java:
  - Class, Interface, Record, Enum: `[public|protected|private] [abstract|final] class/interface/record/enum Name { ... }`
  - Method dengan anotasi: `@Annotation public ReturnType methodName(...) { ... }` via notasi `ClassName::methodName` atau `methodName`.
- [x] Dukungan ekstraksi Kotlin:
  - Top-level function & member function: `[suspend] fun functionName(...) { ... }`
  - Class, Data Class, Sealed Class, Interface, Object: `[data|sealed] class Name { ... }`
- [x] Pendaftaran ekstensi `.java` dan `.kt` di `src/core/parser/dispatcher.ts`.
- [x] Ekspor parser di `src/core/parser/index.ts`.
- [x] Pembuatan test suite `tests/jvm-parser.test.ts`.
- [x] Verifikasi automated tests (`bun test`) dan audit drift (`verity check`).
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Resolusi bytecode `.class` atau dynamic annotation processing / reflection.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/jvm.ts` (new dedicated Java/Kotlin parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `.java` dan `.kt`)
  - `src/core/parser/index.ts` (re-export parser)
  - `tests/jvm-parser.test.ts` (automated test suite)
- **Data Model & API Impact**: None (internal parsing engine).

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: Java Class & Method Extraction**:
  - **Given**: Berkas Java `OrderService.java` berisi class dan method `@Transactional public void processPayment()`.
  - **When**: Dicari dengan symbol `OrderService::processPayment` atau `processPayment`.
  - **Then**: Mengembalikan blok kode metode lengkap dengan anotasinya dan `found: true`.
- [x] **Scenario 2: Kotlin Top-Level & Class Method Extraction**:
  - **Given**: Berkas Kotlin `UserService.kt` berisi `data class User` dan `suspend fun findUser()`.
  - **When**: Dicari dengan symbol `User` atau `findUser`.
  - **Then**: Mengembalikan blok definisi dengan benar.
- [x] **Scenario 3: Formatting & Javadoc/KDoc Immunity**:
  - **Given**: Dua implementasi kode Java/Kotlin dengan komentar Javadoc `/** ... */` dan whitespace berbeda.
  - **When**: Keduanya di-fingerprint melalui `JvmParser`.
  - **Then**: Menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [x] `JvmParser` terimplementasi di `src/core/parser/jvm.ts`.
- [x] Terdaftar di `ParserDispatcher` (`.java`, `.kt`) dan diekspor di `index.ts`.
- [x] Test suite `tests/jvm-parser.test.ts` dibuat dan 100% lulus.
- [x] `verity check` berjalan bersih tanpa regresi.
- [x] Penyegelan provenance via `verity link`.

---

## Provenance
- **Completion Commit**: `b1dc7cacb0068ad225e7814f727fae354ea902f9`
- **Anchors**:
  - `src/core/parser/jvm.ts`