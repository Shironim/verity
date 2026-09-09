---
verity:
  anchors:
    - path: src/core/parser/dispatcher.ts
      provenance:
        commitSha: 6dcc0150b4ab2cdebe9eae7495b46a4477631b0d
        fingerprint: da2b62a0ad5c7ccb74f11930935139dfc1a3ac9b1d3cc15c4ab4a62d813736b5
        timestamp: 2026-09-09T04:20:00.325Z
---

# Brief: Pluggable Parser Dispatcher & Shared-Hub Boundary Decoupling

> **Kategori**: refactor  
> **Status**: Completed  
> **Tanggal**: 2026-09-09  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. Penggunaan bypass `--no-verify` pada commit sebelumnya meninggalkan utang teknis (*technical debt*): 4 task brief bahasa terdahulu (`python`, `rust`, `php`, `go`) berada dalam status **`STALE`** karena menautkan file router bersama [src/core/parser/dispatcher.ts](file:///home/shironim/Project/verity/src/core/parser/dispatcher.ts).
  2. File `dispatcher.ts` saat ini melanggar *Open-Closed Principle* (OCP): setiap kali ada parser bahasa baru ditambahkan (C#, JVM, Ruby), berkas ini harus diedit secara manual untuk mengimpor dan mendaftarkan parser baru ke dalam array statis.
  3. Modifikasi berulang pada satu file bersama (*shared integration hub*) memicu fenomena **Cascading STALE** dan memecah kedaulatan batas kepemilikan (*Boundary Ownership*). Spesifikasi fitur bahasa seharusnya hanya bertanggung jawab atas modul parsing bahasanya sendiri, bukan modul routing global sistem.
- **Tujuan Utama**:
  1. **Rekonsiliasi Hutang Teknis**: Membersihkan anchor `src/core/parser/dispatcher.ts` dari 4 brief lama (`python`, `rust`, `php`, `go`), memulihkan status seluruh brief menjadi 100% valid (`OK`, 0 STALE) secara sah.
  2. **Refaktorisasi Pluggable Dispatcher**: Mengubah `ParserDispatcher` di `src/core/parser/dispatcher.ts` menjadi extensible/pluggable registry (`register(parser: CodeParser)` / modular registration) sehingga berkas ini tertutup dari modifikasi rutin (*Closed for Modification*).
  3. **Pengalihan Kepemilikan (Boundary Ownership)**: Menjadikan brief refactor ini sebagai pemilik tunggal yang sah (*Single Boundary Owner*) dari `src/core/parser/dispatcher.ts`.
  4. **Zero-Bypass Quality Gate**: Menjamin bahwa setelah refaktorisasi dan rekonsiliasi, seluruh suite `bun test` dan `verity check` lulus 100%, serta commit dapat dilakukan secara murni tanpa bypass `--no-verify`.

---

## Scope & Boundaries
### In-Scope
- [x] **Pembersihan Anchor Brief Bahasa Terdahulu**:
  - Hapus anchor `src/core/parser/dispatcher.ts` dari frontmatter YAML pada:
    - [docs/brief/feature-verity-python-parser.md](file:///home/shironim/Project/verity/docs/brief/feature-verity-python-parser.md)
    - [docs/brief/feature-verity-rust-parser.md](file:///home/shironim/Project/verity/docs/brief/feature-verity-rust-parser.md)
    - [docs/brief/feature-verity-php-parser.md](file:///home/shironim/Project/verity/docs/brief/feature-verity-php-parser.md)
    - [docs/brief/feature-verity-go-parser.md](file:///home/shironim/Project/verity/docs/brief/feature-verity-go-parser.md)
  - Pertahankan hanya anchor domain parser masing-masing (`python.ts`, `rust.ts`, `php.ts`, `go.ts`).
- [x] **Refaktorisasi `ParserDispatcher`**:
  - Refactor `src/core/parser/dispatcher.ts` agar mendukung pendaftaran modular melalui method `registerParser(parser: CodeParser): void` atau inisialisasi dinamis.
  - Memastikan method `getParserForFile` dan `parse` tetap kompatibel 100% (*zero breaking change*) untuk seluruh ekstensi yang sudah didukung.
- [x] **Pengujian & Validasi**:
  - Penambahan automated test untuk fungsionalitas modular/pluggable registration di `tests/dispatcher-pluggable.test.ts`.
  - Verifikasi kelulusan seluruh 16 file test suite (`bun test`).
  - Verifikasi integritas audit Verity (`verity check`) menghasilkan 0 STALE dan 0 ERROR.
- [x] **Sinkronisasi Manifest & Penyegelan Provenance**:
  - Sinkronisasi manifest SSOT [docs/brief/INDEX.md](file:///home/shironim/Project/verity/docs/brief/INDEX.md).
  - Menyegel provenance brief ini ke `src/core/parser/dispatcher.ts` via `verity link`.

### Out-of-Scope
- Mengubah algoritma parsing internal dari parser bahasa (`csharp.ts`, `jvm.ts`, `ruby.ts`, dll).
- Mengubah CLI public contract (`verity check`, `verity link`, `verity init`, `verity mcp`).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `docs/brief/feature-verity-python-parser.md:L1-L15` (eliminasi anchor `dispatcher.ts`)
  - `docs/brief/feature-verity-rust-parser.md:L1-L15` (eliminasi anchor `dispatcher.ts`)
  - `docs/brief/feature-verity-php-parser.md:L1-L15` (eliminasi anchor `dispatcher.ts`)
  - `docs/brief/feature-verity-go-parser.md:L1-L15` (eliminasi anchor `dispatcher.ts`)
  - `src/core/parser/dispatcher.ts:L1-L45` (transformasi ke Pluggable/Modular Registry)
  - `tests/scalability-and-edge-cases.test.ts` (penambahan test dynamic parser registration)
  - `docs/brief/INDEX.md` (sinkronisasi SSOT manifest)
- **Data Model & API Impact**:
  - `ParserDispatcher` mendapatkan public method `registerParser(parser: CodeParser): this` dan optional constructor argumen `parsers?: CodeParser[]`.
  - API publik eksternal tetap kompatibel ke belakang.

---

## Acceptance Criteria (Given-When-Then)

- [x] **Scenario 1: Clean Boundary & Zero Stale Debt**:
  - **Given**: 4 brief bahasa lama (`python`, `rust`, `php`, `go`) yang sebelumnya berstatus `STALE` akibat mutasi `dispatcher.ts`.
  - **When**: Anchor `dispatcher.ts` dihapus dari dokumen-dokumen tersebut dan `verity check` dijalankan.
  - **Then**: Seluruh 4 brief tersebut kembali berstatus valid `OK` dan rekapitulasi audit melaporkan `0 STALE, 0 Error`.

- [x] **Scenario 2: Pluggable Parser Registration**:
  - **Given**: Instance `ParserDispatcher` yang sudah diinisialisasi.
  - **When**: Developer mendaftarkan parser kustom baru (misal dummy `SqlParser` yang menangani `.sql`) via `dispatcher.registerParser(customParser)`.
  - **Then**: `dispatcher.getParserForFile('query.sql')` secara dinamis mengembalikan parser kustom tersebut tanpa perlu mengubah source code `dispatcher.ts`.

- [x] **Scenario 3: Zero-Bypass Pre-Commit Gate**:
  - **Given**: Working tree bersih setelah refaktorisasi dan rekonsiliasi.
  - **When**: Perintah `git commit` dijalankan secara normal tanpa flag `--no-verify`.
  - **Then**: Pre-commit hook menjalankan `verity check --ci` dan commit berhasil diproses dengan status exit code 0.

- [x] **Scenario 4: Complete Backward Compatibility**:
  - **Given**: Proyek memiliki 104+ pengujian unit & integrasi lintas 11 ekstensi file (`.ts`, `.vue`, `.astro`, `.php`, `.go`, `.py`, `.rs`, `.cs`, `.java`, `.kt`, `.rb`).
  - **When**: Perintah `bun test` dijalankan pasca-refaktorisasi `ParserDispatcher`.
  - **Then**: 100% tes lulus tanpa kegagalan (0 fail).

---

## Definition of Done (DoD) Checklist
- [x] Anchor `src/core/parser/dispatcher.ts` dihapus dari 4 brief bahasa lama (`python`, `rust`, `php`, `go`).
- [x] `ParserDispatcher` di `src/core/parser/dispatcher.ts` mendukung pendaftaran modular/pluggable.
- [x] Test suite baru untuk pluggable registration dibuat dan lulus.
- [x] Seluruh 16 file test suite (`bun test`) lulus 100%.
- [x] `verity check` berjalan bersih (0 STALE, 0 ERROR).
- [x] Manifest SSOT `docs/brief/INDEX.md` tersinkronisasi.
- [x] Provenance brief ini disegel ke `src/core/parser/dispatcher.ts` via `verity link`.
- [x] Commit dilakukan secara murni tanpa flag `--no-verify`.

---

## Provenance
- **Completion Commit**: `6dcc0150b4ab2cdebe9eae7495b46a4477631b0d`
- **Anchors**:
  - `src/core/parser/dispatcher.ts`