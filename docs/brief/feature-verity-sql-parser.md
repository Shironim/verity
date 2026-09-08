# Brief: Native SQL DDL (.sql) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Draft  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: File SQL (`.sql`) sering digunakan untuk skema database, migration script, dan definisi function/view/trigger. Dalam banyak dokumen arsitektur dan Task Brief, perubahan skema tabel (`CREATE TABLE users (...)`) merupakan kontrak fundamental sistem. Saat ini Verity memperlakukan `.sql` via FallbackParser sehingga perubahan pada satu tabel atau index dalam file migrasi multi-tabel memicu invalidasi seluruh dokumen brief tanpa presisi nama entitas.
- **Tujuan Utama**: 
  1. Mengimplementasikan `SqlParser` di `src/core/parser/sql.ts` berbasis statement scanner deterministik.
  2. Mendukung ekstraksi DDL statements: `CREATE TABLE`, `CREATE VIEW`, `CREATE PROCEDURE`, `CREATE FUNCTION`, `CREATE TRIGGER`, `CREATE [UNIQUE] INDEX`.
  3. Mendukung pencarian simbol berbasis nama entitas (misal `users`, `table:users`, `view:active_users`, `func:calculate_tax`).
  4. Mendaftarkan ekstensi `.sql` ke `ParserDispatcher`.
  5. Menjamin kekebalan penuh terhadap variasi komentar SQL (`-- ...`, `/* ... */`), case-insensitivity keyword (`create table` vs `CREATE TABLE`), dan whitespace.
  6. Menyediakan automated test suite komprehensif di `tests/sql-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [ ] Implementasi `SqlParser` di `src/core/parser/sql.ts` yang mengimplementasikan `CodeParser`.
- [ ] Dukungan ekstraksi statement DDL:
  - Table: `CREATE [TEMP|TEMPORARY] TABLE [IF NOT EXISTS] table_name (...)`
  - View: `CREATE [OR REPLACE] VIEW view_name AS ...`
  - Function/Procedure: `CREATE [OR REPLACE] FUNCTION|PROCEDURE func_name(...) ...`
  - Index: `CREATE [UNIQUE] INDEX index_name ON table_name (...)`
- [ ] Pendaftaran ekstensi `.sql` di `src/core/parser/dispatcher.ts`.
- [ ] Ekspor parser di `src/core/parser/index.ts`.
- [ ] Pembuatan test suite `tests/sql-parser.test.ts`.
- [ ] Verifikasi automated tests (`bun test`) dan audit drift (`verity check`).
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Parsing DML runtime queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- Validasi dialek SQL spesifik vendor (Postgres vs MySQL vs Oracle) untuk eksekusi runtime.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/sql.ts` (new dedicated SQL parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `.sql`)
  - `src/core/parser/index.ts` (re-export parser)
  - `tests/sql-parser.test.ts` (automated test suite)
- **Data Model & API Impact**: None (internal parsing engine).

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: SQL Table Definition Extraction**:
  - **Given**: Berkas skema SQL dengan beberapa tabel (`CREATE TABLE users (...)`, `CREATE TABLE orders (...)`).
  - **When**: Dicari dengan symbol `users` atau `table:users`.
  - **Then**: Mengembalikan blok pernyataan `CREATE TABLE users (...)` secara tepat dengan `found: true`.
- [ ] **Scenario 2: View and Function Extraction**:
  - **Given**: Berkas SQL berisi `CREATE VIEW active_orders AS ...` dan `CREATE FUNCTION calculate_vat(...) ...`.
  - **When**: Dicari dengan symbol `active_orders` atau `calculate_vat`.
  - **Then**: Mengembalikan blok DDL terkait.
- [ ] **Scenario 3: Formatting, Case & Comment Immunity**:
  - **Given**: Dua implementasi statement `CREATE TABLE` yang identik namun berbeda huruf besar/kecil (`create table` vs `CREATE TABLE`), spasi, atau komentar `-- comment`.
  - **When**: Keduanya di-fingerprint melalui `SqlParser`.
  - **Then**: Menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [ ] `SqlParser` terimplementasi di `src/core/parser/sql.ts`.
- [ ] Terdaftar di `ParserDispatcher` (`.sql`) dan diekspor di `index.ts`.
- [ ] Test suite `tests/sql-parser.test.ts` dibuat dan 100% lulus.
- [ ] `verity check` berjalan bersih tanpa regresi.
- [ ] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: (pending implementasi)
- **Anchors**: (pending implementasi)
