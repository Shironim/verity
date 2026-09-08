---
verity:
  anchors:
    - path: src/core/parser/php.ts
      provenance:
        commitSha: 4b30074d06f8ac2d94707f051295da40c0f67396
        fingerprint: e2ec1631b59fc333f725c8c0eaf0655dcb44c3b0786c778d455301f56a0481c8
        timestamp: 2026-09-08T12:13:23.585Z
    - path: src/core/parser/dispatcher.ts
      provenance:
        commitSha: 4b30074d06f8ac2d94707f051295da40c0f67396
        fingerprint: b3c1c768e6ab7267a6614a8ede8e5c67b894b54d65b61057092223c9383ce565
        timestamp: 2026-09-08T12:13:23.597Z
---

# Brief: Tier-2 PHP AST Symbol Parser (`php.ts`)

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  Ekosistem web modern (terutama fullstack Laravel + Inertia.js + Vue) sering kali mengaitkan spesifikasi task brief ke backend PHP (Controller actions, FormRequest validation rules, Eloquent Model hooks). Selama ini, file `.php` masuk ke Tier-3 Fallback (file-level hashing), sehingga modifikasi kecil pada satu method controller akan menganggap seluruh anchor file tersebut stale. Dibutuhkan parser Tier-2 mandiri untuk mengekstrak simbol kelas, method, dan `Class::method` pada file `.php`.
- **Tujuan Utama**:
  1. Mengimplementasikan `PhpParser` di `src/core/parser/php.ts` yang mengimplementasikan `CodeParser`.
  2. Mendukung ekstraksi simbol level kelas (`class`, `interface`, `trait`, `enum`) dan method/fungsi (`public/protected/private function`).
  3. Mendukung notasi simbol gabungan `Class::method` (e.g. `UserController::store`).
  4. Mendaftarkan `PhpParser` ke `ParserDispatcher` untuk ekstensi `.php`.
  5. Menjamin kekebalan fingerprint terhadap perbedaan formatting Pint/PSR-12 melalui `FingerprintNormalizer`.
  6. Menyediakan unit test suite di `tests/php-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [x] Implementasi `PhpParser` di `src/core/parser/php.ts`.
- [x] Dukungan ekstraksi simbol function, method, class, interface, trait, enum.
- [x] Dukungan resolusi sintaks `Class::method`.
- [x] Integrasi ke `src/core/parser/dispatcher.ts`.
- [x] Pembuatan unit test `tests/php-parser.test.ts`.
- [x] Verifikasi eksekusi via `bun test` dan verifikasi integritas via `verity check`.

### Out-of-Scope
- Eksekusi runtime PHP binary / interpreter (analisis murni statis mandiri di Bun tanpa dependensi CLI php).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/php.ts` (new)
  - `src/core/parser/dispatcher.ts:L1-L28`
  - `tests/php-parser.test.ts` (new)
- **Data Model & API Impact**:
  - Dukungan ekstensi `.php` di `ParserDispatcher`.

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Class and Method Extraction**:
  - **Given**: File PHP dengan Controller yang memuat beberapa methods (`index`, `store`, `destroy`).
  - **When**: `PhpParser.parse()` dipanggil dengan target symbol `store`.
  - **Then**: Method `store` terisolasi dan menghasilkan fingerprint yang valid.
- [ ] **Scenario 2: Compound Class::method Symbol**:
  - **Given**: File PHP dengan deklarasi `class OrderController` dan method `checkout`.
  - **When**: Target symbol `OrderController::checkout` dicari.
  - **Then**: Method `checkout` di dalam kelas `OrderController` berhasil ditemukan (`found: true`).
- [ ] **Scenario 3: Formatting Immunity on PHP Code**:
  - **Given**: Dua kode PHP yang identik secara logika tetapi diformat berbeda (Pint vs PSR-12, tabs vs spaces, trailing commas).
  - **When**: Fingerprint dihitung untuk keduanya.
  - **Then**: Menghasilkan hash fingerprint yang sama persis.

---

## Definition of Done (DoD) Checklist
- [ ] `PhpParser` terimplementasi di `src/core/parser/php.ts`.
- [ ] `ParserDispatcher` mengenali ekstensi `.php`.
- [ ] Test suite `tests/php-parser.test.ts` lulus 100%.
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `4b30074d06f8ac2d94707f051295da40c0f67396`
- **Anchors**:
  - `src/core/parser/php.ts`
  - `src/core/parser/dispatcher.ts`