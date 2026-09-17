---
verity:
  anchors:
    - path: package.json
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: 3b919a4033a256e9a3522f4c4797d23a57bc2ca0c06aeccc36017a740a4bf8cd
    - path: README.md
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: 9211c891dad264cbbb57e931a8d0271e86ad2d0eb2974a8df647def612b2c652
        timestamp: 2026-09-08T10:38:29.920Z
    - path: scripts/install.sh
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: ecd4b6f228f0950598917f1a96515ae54aea22005a3e5bdfa1755dc460b12f61
        timestamp: 2026-09-08T10:38:29.937Z
    - path: scripts/install.ps1
      provenance:
        commitSha: af1af9c49c877674d236f57288616999f93312fc
        fingerprint: b7d1309ab3d990b9b451928dca4a488e6e9d4728f86df532f4d0fff88e8340a8
        timestamp: 2026-09-08T10:38:29.942Z
---

# Brief: Multi-Platform Standalone Compilation & Open-Source Distribution

> **Kategori**: feature  
> **Status**: Superseded (Digantikan oleh `docs/brief/refactor-registry-distribution.md`)  
> **Tanggal**: 2026-09-08 (Superseded: 2026-09-17)  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  Untuk dapat didistribusikan secara global ke komunitas open-source dan tim engineering tanpa mewajibkan runtime Bun/Node terpasang di mesin pengguna atau CI server, Verity memerlukan arsitektur kompilasi biner mandiri zero-dependency (`bun build --compile`) untuk Linux, macOS (Intel & Apple Silicon), dan Windows, serta installer script 1-baris dan pipeline GitHub Actions release.
- **Tujuan Utama**:
  1. Mengonfigurasi target kompilasi multi-platform di `package.json` (`linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`, `windows-x64`).
  2. Menyediakan skrip instalasi otomatis: `scripts/install.sh` (Linux/macOS) dan `scripts/install.ps1` (Windows).
  3. Menyusun workflow GitHub Actions `.github/workflows/release.yml` untuk rilis biner otomatis saat tag rilis dibuat.
  4. Menyusun dokumentasi publik `README.md` dan metadata NPM (`package.json`) yang siap dipublikasikan ke npmjs.org.

---

## Scope & Boundaries
### In-Scope
- [x] Penambahan scripts kompilasi mandiri pada `package.json`.
- [x] Pembuatan skrip installer cross-platform `scripts/install.sh` dan `scripts/install.ps1`.
- [x] Konfigurasi pipeline rilis otomatis `.github/workflows/release.yml`.
- [x] Penyusunan `README.md` publik komprehensif (arsitektur, CLI usage, MCP integration, filosofi).
- [x] Uji coba build kompilasi lokal (`bun run build:local`) dan verifikasi eksekusi biner yang dihasilkan.

### Out-of-Scope
- Registrasi akun/token NPM secara langsung (token auth dikonfigurasi oleh pemilik repositori di GitHub Secrets).
- Parser PHP AST (Milestone 5).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `package.json:L8-L25`
  - `scripts/install.sh` (new)
  - `scripts/install.ps1` (new)
  - `.github/workflows/release.yml` (new)
  - `README.md`
- **Data Model & API Impact**: None (distribution packaging).

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: Local Binary Compilation**:
  - **Given**: Repositori Verity dengan Bun runtime.
  - **When**: Pengembang menjalankan perintah `bun run build:local` (atau target platform saat ini).
  - **Then**: Terbentuk berkas biner mandiri (executable) di `bin/verity` yang dapat langsung dieksekusi `./bin/verity --version`.
- [ ] **Scenario 2: Shell Installer Architecture Detection**:
  - **Given**: Sistem Linux atau macOS.
  - **When**: `scripts/install.sh` dieksekusi dengan mendeteksi `uname -s` dan `uname -m`.
  - **Then**: Skrip memetakan target arsitektur yang benar (`linux-x64`, `darwin-arm64`, dll.).
- [ ] **Scenario 3: GitHub Actions Release Workflow**:
  - **Given**: Tag git baru `v*.*.*` di-push.
  - **When**: Workflow `.github/workflows/release.yml` terpicu.
  - **Then**: Seluruh 5 varian biner terkompilasi dan diunggah ke GitHub Releases beserta hash SHA-256.

---

## Definition of Done (DoD) Checklist
- [ ] Multi-target scripts terdaftar di `package.json`.
- [ ] `scripts/install.sh` dan `scripts/install.ps1` dibuat dan executable.
- [ ] `.github/workflows/release.yml` terkonfigurasi.
- [ ] `README.md` terdokumentasi lengkap.
- [ ] Biner lokal teruji berjalan normal via `./bin/verity --version`.
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `af1af9c49c877674d236f57288616999f93312fc`
- **Anchors**:
  - `package.json`
  - `scripts/install.sh`
  - `scripts/install.ps1`
  - `README.md`