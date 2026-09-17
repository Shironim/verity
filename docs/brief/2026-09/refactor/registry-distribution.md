# Brief: Refactor Distribusi Verity ke Registry-Only (Bun & NPM Global)

> **Kategori**: refactor  
> **Status**: Completed  
> **Tanggal**: 2026-09-17  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Sebelumnya Verity mencoba mendukung instalasi biner standalone satu-baris via `curl` dan `scripts/install.sh` (serta `install.ps1`). Pendekatan ini gagal karena:
  1. Pipeline GitHub Actions untuk rilis biner multi-platform (`.github/workflows/release.yml`) tidak eksis, menyebabkan download biner via curl menghasilkan error 404.
  2. Fallback kompilasi `bun build --compile ./src/cli/index.ts` mengasumsikan direktori kerja (`$PWD`) adalah root repository Verity, sehingga gagal fatal saat dijalankan dari direktori sembarang pengguna.
  3. Verity sudah terpublikasi secara resmi di npm registry dengan nama `@dimassetoid/verity` dan dapat dipasang secara andal menggunakan `bun add -g @dimassetoid/verity` atau `npm install -g @dimassetoid/verity`.
- **Tujuan Utama**: Menghapus metode instalasi biner standalone berbasis curl/ps1, memusatkan jalur distribusi resmi ke registry npm/bun global, menyederhanakan dokumentasi, serta memastikan biner bundle `dist/verity.js` berjalan kompatibel dengan shebang Node runtime.

---

## Scope & Boundaries
### In-Scope
- [x] Menghapus skrip installer biner standalone `scripts/install.sh` dan `scripts/install.ps1`.
- [x] Memperbarui `README.md` untuk merefleksikan instalasi global melalui Bun dan NPM.
- [x] Memastikan build output `dist/verity.js` dan source `src/cli/index.ts` memiliki shebang `#!/usr/bin/env node` yang valid dan kompatibel lintas runtime (`node` / `bun`).
- [x] Menandai brief lama `docs/brief/feature-verity-multi-platform-distribution.md` sebagai `Superseded`.

### Out-of-Scope
- Pembuatan CI/CD workflow untuk kompilasi biner cross-platform di GitHub Releases (sengaja ditiadakan demi fokus ekosistem package manager).
- Distribusi biner melalui Homebrew tap atau platform native package manager lainnya.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `README.md:L66-L85` (Perbaruan panduan instalasi)
  - `package.json:L1-L45` (Target build node dan field bin)
  - `src/cli/index.ts:L1-L5` (Shebang universal node)
  - `dist/verity.js:L1-L5` (Shebang bundle node)
  - `docs/brief/feature-verity-multi-platform-distribution.md` (Update status ke Superseded)
- **Data Model & API Impact**: Tidak ada perubahan pada internal parser AST, Git cache, atau MCP server Verity. Perubahan murni pada layer distribusi dan deployment CLI.

---

## Acceptance Criteria (Given-When-Then)

- [x] **Scenario 1: Panduan Instalasi README.md Bebas dari Curl Biner**
  - **Given**: Pengguna membuka halaman dokumentasi atau `README.md`.
  - **When**: Pengguna memeriksa bagian Quick Installation.
  - **Then**: Dokumentasi hanya menampilkan instruksi instalasi via `bun add -g @dimassetoid/verity` dan `npm install -g @dimassetoid/verity` tanpa instruksi `curl` / `irm`.

- [x] **Scenario 2: Eksekusi CLI Global via Node / Bun Runtime**
  - **Given**: Pengguna memasang Verity secara global melalui `npm i -g @dimassetoid/verity` atau `bun add -g @dimassetoid/verity`.
  - **When**: Pengguna menjalankan perintah `verity --version` atau `verity --help` di terminal sembarang direktori.
  - **Then**: CLI biner `verity` terpanggil dengan sukses menggunakan shebang `#!/usr/bin/env node` yang kompatibel universal tanpa error runtime.

- [x] **Scenario 3: Resolusi Brief Lama (Superseded Status)**
  - **Given**: Brief `docs/brief/feature-verity-multi-platform-distribution.md` memiliki anchor ke `scripts/install.sh` yang telah dihapus.
  - **When**: Brief baru ini aktif dan brief lama ditandai sebagai `Superseded`.
  - **Then**: Dokumentasi spesifikasi memiliki audit trail yang jelas mengenai mengapa pendekatan standalone biner ditinggalkan.

---

## Definition of Done (DoD) Checklist
- [x] Kode/skrip installer curl dihapus.
- [x] README.md diperbarui.
- [x] Target build dikonfigurasi ke node dan shebang diatur ke `#!/usr/bin/env node`.
- [x] Status brief lama diset ke `Superseded`.
- [x] Seluruh kriteria penerimaan (Acceptance Criteria) terverifikasi.

---

## Provenance
- **Completion Commit**: (pending)
- **Anchors**:
  - `README.md`
  - `package.json`
