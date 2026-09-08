---
verity:
  anchors:
    - path: src/core/parser/python.ts
      provenance:
        commitSha: 518748e1f54bca3e11e555e0e96f52756a55144e
        fingerprint: 03c9fc1b302d2a22aa926a0ecc3411543ff5b5bebb53a7fb3af2928e7648e9e9
        timestamp: 2026-09-08T11:54:32.166Z
    - path: src/core/parser/dispatcher.ts
      provenance:
        commitSha: 518748e1f54bca3e11e555e0e96f52756a55144e
        fingerprint: d45eb986df94d5b03c8d5684c7f0e3d1c7564b165649446ffe6bc18a18af02a6
        timestamp: 2026-09-08T11:54:32.171Z
---

# Brief: Native Python (.py) Dedicated AST Parser

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Python adalah bahasa pemrograman standar industri untuk pengembangan sistem AI/LLM Agent, data engineering, serta framework web modern seperti FastAPI, Django, dan Flask. Saat ini Verity belum memiliki parser semantik untuk Python, sehingga file `.py` masih ditangani oleh FallbackParser (hashing file mentah tanpa kemampuan mengisolasi simbol fungsi atau class).
- **Tujuan Utama**: 
  1. Mengimplementasikan `PythonParser` native berbasis *Indentation-Aware Block Scanner* di `src/core/parser/python.ts`.
  2. Mendukung ekstraksi fungsi sinkron (`def name`), fungsi asinkron (`async def name`), class (`class Name`), serta method di dalam class (`ClassName::method_name`).
  3. Menangani *decorators* (`@decorator`, `@app.get(...)`) dan docstrings multiline (`""" ... """` atau `''' ... '''`) secara presisi.
  4. Mendaftarkan ekstensi `.py` ke `ParserDispatcher`.
  5. Menjamin kekebalan deterministik terhadap variasi format linter (Black, Ruff, autopep8), whitespace, dan komentar `# ...`.
  6. Menyediakan automated test suite komprehensif di `tests/python-parser.test.ts`.

---

## Scope & Boundaries
### In-Scope
- [x] Implementasi `PythonParser` di `src/core/parser/python.ts` yang mengimplementasikan interface `CodeParser`.
- [x] Logika *Indentation-Aware Scanner* untuk menangani sintaksis Python berbasis *significant whitespace* tanpa dependensi eksternal:
  - Fungsi standalone: `def function_name(...) -> ReturnType:`
  - Fungsi asinkron: `async def function_name(...):`
  - Class definition: `class ClassName(BaseClass):`
  - Method dalam class: `class ClassName` -> `def method_name(self, ...)` (queryable via `ClassName::method_name` atau `method_name`)
  - Capture decorator yang menempel tepat sebelum deklarasi (`@staticmethod`, `@property`, `@app.route(...)`)
- [x] Pendaftaran ekstensi `.py` di `src/core/parser/dispatcher.ts:L10-L20`.
- [x] Pembuatan test suite `tests/python-parser.test.ts` (unit tests untuk functions, async functions, classes, methods, docstrings, dan PEP 8 immunity).
- [x] Verifikasi automated tests (`bun test`) dan validasi drift (`verity check`).
- [x] Penyegelan provenance via `verity link`.

### Out-of-Scope
- Ekstraksi AST berbasis Python C-extensions atau bytecode `.pyc`.
- Parsing sintaksis Python 2 usang (`print "hello"`).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/parser/python.ts` (new dedicated Python parser)
  - `src/core/parser/dispatcher.ts:L1-L25` (registrasi `PythonParser`)
  - `tests/python-parser.test.ts` (new automated test suite)
- **Data Model & API Impact**: None (internal parsing engine & dispatcher).

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: File-Level Python Parsing**:
  - **Given**: Berkas Python tanpa target symbol spesifik.
  - **When**: `PythonParser.parse(filePath, content)` dieksekusi.
  - **Then**: Mengembalikan `found: true` dengan fingerprint SHA-256 yang dinormalisasi.
- [x] **Scenario 2: Sync & Async Function Extraction**:
  - **Given**: Berkas Python berisi `def calculate_score(val: int) -> float:` dan `async def fetch_data():`.
  - **When**: Dicari dengan symbol `calculate_score` atau `fetch_data`.
  - **Then**: Mengembalikan blok kode fungsi lengkap termasuk body yang terindentasi dengan `found: true`.
- [x] **Scenario 3: Class & Method Extraction**:
  - **Given**: Kode Python berisi class `AgentExecutor` dengan method `run(self, task: str)`.
  - **When**: Dicari dengan symbol `AgentExecutor` atau `AgentExecutor::run`.
  - **Then**: Mengembalikan blok class atau method terkait secara tepat.
- [x] **Scenario 4: Decorators & Multiline Docstrings**:
  - **Given**: Fungsi Python yang diawali `@router.post("/chat")` dan memiliki docstring `"""Handle chat."""`.
  - **When**: Dicari dengan nama fungsinya.
  - **Then**: Blok kode berhasil diisolasi tanpa terputus oleh docstring multiline.
- [x] **Scenario 5: Formatting & Comment Immunity (Black / Ruff / PEP 8)**:
  - **Given**: Dua implementasi kode Python yang identik secara logika namun memiliki perbedaan komentar `# ...`, spasi di sekitar operator, atau trailing comma.
  - **When**: Keduanya di-fingerprint melalui `PythonParser`.
  - **Then**: Keduanya menghasilkan fingerprint SHA-256 yang 100% identik.

---

## Definition of Done (DoD) Checklist
- [x] `PythonParser` terimplementasi di `src/core/parser/python.ts`.
- [x] `PythonParser` terdaftar di `ParserDispatcher`.
- [x] `tests/python-parser.test.ts` mencakup minimal 6 test cases dan seluruhnya PASS.
- [x] `bun test` berhasil dengan 0 failure di seluruh test suite repositori.
- [x] Provenance disegel via `verity link` dan manifest disinkronkan via `verity index`.

---

## Provenance
- **Completion Commit**: `518748e1f54bca3e11e555e0e96f52756a55144e`
- **Anchors**:
  - `src/core/parser/python.ts`
  - `src/core/parser/dispatcher.ts`