# Brief: Native C# (.cs) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Draft  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Bahasa C# (`.cs`) adalah tulang punggung ekosistem enterprise Microsoft, backend .NET Core / ASP.NET, game development (Unity), serta cloud Azure. Arsitektur C# sarat dengan Controller, Middleware, Entity Framework DbContext, dan Services. Tanpa parser khusus, modifikasi pada satu method di controller memicu drift pada seluruh file dokumen brief terkait.
- **Tujuan Utama**: 
  1. Mengimplementasikan `CSharpParser` di `src/core/parser/csharp.ts`.
  2. Mendukung ekstraksi simbol `class`, `record`, `struct`, `interface`, `enum`, method (`Class::Method` atau `Class.Method`), dan atribut C# (`[HttpPost]`, `[Authorize]`).
  3. Mendukung fitur C# modern: file-scoped namespaces (`namespace Foo;`), auto-properties, async/await method signatures.
  4. Mendaftarkan ekstensi `.cs` ke `ParserDispatcher`.
  5. Menjamin kekebalan penuh terhadap variasi format `dotnet format`, XML documentation comments (`/// ...`), dan komentar single/multiline.
  6. Menyediakan automated test suite komprehensif di `tests/csharp-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [ ] Implementasi `CSharpParser` di `src/core/parser/csharp.ts` yang mengimplementasikan `CodeParser`.
- [ ] Dukungan ekstraksi:
  - Class, Record, Struct, Interface, Enum: `[public|internal|private] [abstract|sealed|static] class/record/struct/interface/enum Name { ... }`
  - Method dengan attribute: `[Attribute] [public|private] [async] [virtual|override] ReturnType MethodName(...) { ... }` via notasi `ClassName::MethodName` atau `MethodName`.
  - Properties & Constructors.
- [ ] Pendaftaran ekstensi `.cs` di `src/core/parser/dispatcher.ts`.
- [ ] Ekspor parser di `src/core/parser/index.ts`.
- [ ] Pembuatan test suite `tests/csharp-parser.test.ts`.
- [ ] Verifikasi automated tests (`bun test`) dan audit drift (`verity check`).
- [ ] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Evaluasi Roslyn compiler workspace dan Source Generators dinamis.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/csharp.ts` (new dedicated C# parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `.cs`)
  - `src/core/parser/index.ts` (re-export parser)
  - `tests/csharp-parser.test.ts` (automated test suite)
- **Data Model & API Impact**: None (internal parsing engine).

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: C# Class & Method Extraction with Attributes**:
  - **Given**: Berkas C# `UsersController.cs` dengan class dan method `[HttpGet("{id}")] public async Task<IActionResult> GetUser(string id) { ... }`.
  - **When**: Dicari dengan symbol `UsersController::GetUser` atau `GetUser`.
  - **Then**: Mengembalikan blok kode method lengkap beserta atributnya dan `found: true`.
- [ ] **Scenario 2: Record & Interface Extraction**:
  - **Given**: Berkas C# berisi `public record UserDto(...)` dan `public interface IUserRepository { ... }`.
  - **When**: Dicari dengan symbol `UserDto` atau `IUserRepository`.
  - **Then**: Mengembalikan blok definisi dengan benar.
- [ ] **Scenario 3: Formatting & XML Doc Comments Immunity**:
  - **Given**: Dua implementasi kode C# identik namun berbeda komentar `/// <summary>` atau spasi indentasi.
  - **When**: Keduanya di-fingerprint melalui `CSharpParser`.
  - **Then**: Menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [ ] `CSharpParser` terimplementasi di `src/core/parser/csharp.ts`.
- [ ] Terdaftar di `ParserDispatcher` (`.cs`) dan diekspor di `index.ts`.
- [ ] Test suite `tests/csharp-parser.test.ts` dibuat dan 100% lulus.
- [ ] `verity check` berjalan bersih tanpa regresi.
- [ ] Provenance disegel via `verity link`.

---

## Provenance
- **Completion Commit**: (pending implementasi)
- **Anchors**: (pending implementasi)
