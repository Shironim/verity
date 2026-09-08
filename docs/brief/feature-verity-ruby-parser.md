# Brief: Native Ruby (.rb) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Draft  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Ruby (`.rb`), terutama dalam kerangka Ruby on Rails, adalah platform utama bagi ribuan aplikasi SaaS dan startup global (GitHub, Shopify, GitLab). Sintaks Ruby tidak menggunakan kurung kurawal `{}` untuk mendefinisikan blok class/method, melainkan pasangan kata kunci `def ... end`, `class ... end`, dan `module ... end`. Saat ini Verity belum memiliki parser blok untuk Ruby sehingga perubahan kecil pada satu action controller memicu drift dokumen brief seluruh file.
- **Tujuan Utama**: 
  1. Mengimplementasikan `RubyParser` di `src/core/parser/ruby.ts` menggunakan *Keyword-Block Scanner* (`def/class/module ... end`).
  2. Mendukung ekstraksi method biasa (`def method_name`), class method (`def self.method_name`), `class`, dan `module` dengan notasi `ClassName#instance_method` atau `ClassName::class_method`.
  3. Mendaftarkan ekstensi `.rb` ke `ParserDispatcher`.
  4. Menjamin kekebalan penuh terhadap variasi format `rubocop`, trailing whitespace, dan komentar `# ...`.
  5. Menyediakan automated test suite komprehensif di `tests/ruby-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [ ] Implementasi `RubyParser` di `src/core/parser/ruby.ts` yang mengimplementasikan `CodeParser`.
- [ ] Dukungan ekstraksi:
  - Instance Method: `def method_name(...) ... end` via notasi `ClassName#method_name`, `ClassName::method_name`, atau `method_name`.
  - Class/Singleton Method: `def self.method_name(...) ... end`.
  - Class: `class ClassName [< SuperClass] ... end`.
  - Module: `module ModuleName ... end`.
- [ ] Pendaftaran ekstensi `.rb` di `src/core/parser/dispatcher.ts`.
- [ ] Ekspor parser di `src/core/parser/index.ts`.
- [ ] Pembuatan test suite `tests/ruby-parser.test.ts`.
- [ ] Verifikasi automated tests (`bun test`) dan audit drift (`verity check`).
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Metaprogramming dinamis (`define_method`, `method_missing`).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/ruby.ts` (new dedicated Ruby parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `.rb`)
  - `src/core/parser/index.ts` (re-export parser)
  - `tests/ruby-parser.test.ts` (automated test suite)
- **Data Model & API Impact**: None (internal parsing engine).

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Ruby Method Extraction (Instance & Class)**:
  - **Given**: Berkas Ruby `orders_controller.rb` berisi `class OrdersController` dengan `def index ... end` dan `def self.notify ... end`.
  - **When**: Dicari dengan symbol `OrdersController#index` atau `OrdersController::notify`.
  - **Then**: Mengembalikan blok kode method tersebut secara utuh dari `def` hingga pasangan `end` penutupnya.
- [ ] **Scenario 2: Module & Class Extraction**:
  - **Given**: Berkas Ruby berisi `module Billing` dan `class Invoice < ApplicationRecord`.
  - **When**: Dicari dengan symbol `Billing` atau `Invoice`.
  - **Then**: Mengembalikan blok definisi class/module lengkap.
- [ ] **Scenario 3: Formatting & Rubocop Immunity**:
  - **Given**: Dua implementasi kode Ruby yang identik secara logika namun memiliki perbedaan spasi atau komentar `#`.
  - **When**: Keduanya di-fingerprint melalui `RubyParser`.
  - **Then**: Menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [ ] `RubyParser` terimplementasi di `src/core/parser/ruby.ts`.
- [ ] Terdaftar di `ParserDispatcher` (`.rb`) dan diekspor di `index.ts`.
- [ ] Test suite `tests/ruby-parser.test.ts` dibuat dan 100% lulus.
- [ ] `verity check` berjalan bersih tanpa regresi.
- [ ] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: (pending implementasi)
- **Anchors**: (pending implementasi)
