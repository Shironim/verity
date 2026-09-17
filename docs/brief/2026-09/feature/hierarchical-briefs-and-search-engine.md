---
verity:
  anchors:
    - path: src/core/anchor/search.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 3487206df360e62b181b3bb43709e84f6f7f77368369e01f562b496eea5acf41
        timestamp: 2026-09-17T17:27:35.317Z
    - path: src/core/anchor/reader.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: a071beaad591b9637a1499fdf9a1e58542d0951c69bfe01f6f88a3496d8691f8
        timestamp: 2026-09-17T17:27:35.336Z
    - path: src/core/anchor/manifest.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: f24aa1a03be70ae7325159269197de3622a6209ef5559add9b176c16ee27b594
        timestamp: 2026-09-17T17:27:35.358Z
    - path: src/cli/commands/find.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 24ccfa10a25e3805be76c8c705741377da3ea5e9c3743588a38780df5873fdda
        timestamp: 2026-09-17T17:27:35.370Z
    - path: src/cli/index.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 4837002446e3c2dcddab54c31ee3c1ca674b3268fd50dd6386b02335a1a04d34
        timestamp: 2026-09-17T17:27:35.382Z
    - path: src/mcp/tools.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 385f413283547a6bfb8d83f0147817b18f442737aa0e97fa4b03ddc36f18b080
        timestamp: 2026-09-17T17:27:35.399Z
---

# Brief: Feature Hierarchical Brief Structure & Verity Search Engine (`verity find`)

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-18  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  1. **File Clutter pada Skala Besar**: Seiring berjalannya waktu dan bertambahnya jumlah pekerjaan, meletakkan seluruh file brief secara datar di `docs/brief/` menyebabkan penumpukan file (*file clutter*) yang menyulitkan developer dan agen untuk menavigasi berkas secara visual.
  2. **Kebutuhan Pengorganisasian Hibrida**: Dibutuhkan struktur folder hibrida berbasis waktu dan kategori: `docs/brief/YYYY-MM/[category]/[slug].md` (contoh: `docs/brief/2026-09/feature/auth.md`).
  3. **Kebutuhan Mesin Pencarian Spesifikasi (*Spec Discovery Engine*)**: Dengan bertambahnya folder bulanan, manusia dan AI Agent memerlukan cara cepat untuk menemukan brief lama tanpa menelusuri folder secara manual. Verity membutuhkan CLI command `verity find` dan native MCP tool `verity_find` yang mendukung pencarian kata kunci (*full-text*), *reverse-lookup* berdasarkan file kode target (`--target <file>`), serta filter berdasarkan kategori, status, dan bulan.

- **Tujuan Utama**:
  1. Memperbarui `BriefManifestGenerator` (`src/core/anchor/manifest.ts`) agar memindai seluruh subdirektori `docs/brief/**/*.md` secara rekursif dan menjaga integritas tautan di `INDEX.md`.
  2. Membangun core engine pencarian `BriefSearchEngine` (`src/core/anchor/search.ts`) dengan dukungan multi-kriteria (query, target anchor, kategori, status, bulan).
  3. Menghadirkan perintah CLI `verity find` (`src/cli/commands/find.ts` & `src/cli/index.ts`).
  4. Mendaftarkan native MCP tool `verity_find` pada `src/mcp/tools.ts`.
  5. Memperbarui skill `to-brief` di `.agents/skills/to-brief/SKILL.md` dan `templates/skills/to-brief/SKILL.md`.
  6. Menambahkan automated tests untuk memastikan performa dan keandalan pencarian.

---

## Scope & Boundaries
### In-Scope
- [x] Core search service `BriefSearchEngine` di `src/core/anchor/search.ts`.
- [x] Rekursif scanning pada `src/core/anchor/manifest.ts`.
- [x] CLI command `verity find` di `src/cli/commands/find.ts` dan integrasi di `src/cli/index.ts`.
- [x] MCP tool `verity_find` di `src/mcp/tools.ts`.
- [x] Pembaruan skill `to-brief` di `.agents/skills/to-brief/SKILL.md` dan `templates/skills/to-brief/SKILL.md`.
- [x] Penyesuaian `src/cli/commands/init.ts` agar mendukung struktur folder bulanan saat inisialisasi.
- [x] Unit tests di `tests/brief-search.test.ts` dan pembaruan `tests/ecosystem.test.ts`.

### Out-of-Scope
- Pemindahan paksa file-file brief legacy (brief legacy tetap dipertahankan secara *backward-compatible*).
- Fuzzy search eksternal berbasis dependency berat (menggunakan scoring deterministik berbasis substring, token matching, dan path matching).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/core/anchor/search.ts` (Core Search Engine)
  - `src/core/anchor/manifest.ts` (Recursive Brief Scanner for Manifest Index)
  - `src/cli/commands/find.ts` (CLI find implementation)
  - `src/cli/index.ts` (CLI entrypoint command registration)
  - `src/mcp/tools.ts` (MCP tool `verity_find`)
  - `.agents/skills/to-brief/SKILL.md` (Updated skill documentation)
  - `templates/skills/to-brief/SKILL.md` (Updated template skill)
  - `src/cli/commands/init.ts` (Init starter brief path)
  - `tests/brief-search.test.ts` (Comprehensive unit tests)
- **Data Model & API Impact**:
  - Non-breaking, memperluas kemampuan sistem dengan 1 CLI command baru dan 1 MCP tool baru.

---

## Acceptance Criteria (Given-When-Then)
- [x] **Scenario 1: Recursive Manifest Indexing**:
  - **Given**: File brief berada di berbagai level folder (`docs/brief/2026-09/feature/auth.md` dan flat `docs/brief/feature-legacy.md`).
  - **When**: `BriefManifestGenerator.generateAndSync()` dijalankan.
  - **Then**: Seluruh brief terindeks di `docs/brief/INDEX.md` dengan path relatif yang akurat.
- [x] **Scenario 2: Full-Text Query Search**:
  - **Given**: Kumpulan brief tersimpan di subdirektori bulanan.
  - **When**: `verity find <kata-kunci>` dijalankan.
  - **Then**: Mengembalikan brief yang judul, ringkasan, atau isinya cocok dengan kata kunci.
- [x] **Scenario 3: Target Anchor Reverse-Lookup**:
  - **Given**: Sebuah brief menaungi target file `src/cli/commands/init.ts`.
  - **When**: `verity find --target src/cli/commands/init.ts` dijalankan.
  - **Then**: Brief yang menaungi file tersebut berhasil ditemukan dan ditampilkan.
- [x] **Scenario 4: Filter Kategori, Status, dan Bulan**:
  - **Given**: Parameter filter `--category`, `--status`, atau `--month` diberikan.
  - **When**: Pencarian dieksekusi via CLI atau MCP.
  - **Then**: Hasil difilter secara akurat sesuai kriteria.

---

## Definition of Done (DoD) Checklist
- [x] `BriefSearchEngine` terimplementasi di `src/core/anchor/search.ts`.
- [x] `manifest.ts` mendukung pemindaian rekursif.
- [x] CLI command `verity find` aktif dan teruji.
- [x] MCP tool `verity_find` terdaftar.
- [x] Skill `to-brief` diperbarui di `.agents/` dan `templates/`.
- [x] Unit tests dibuat di `tests/brief-search.test.ts`.
- [x] Status brief diubah menjadi `Completed` dan siap disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/core/anchor/search.ts`
  - `src/core/anchor/reader.ts`
  - `src/core/anchor/manifest.ts`
  - `src/cli/commands/find.ts`
  - `src/cli/index.ts`
  - `src/mcp/tools.ts`