---
verity:
  anchors:
    - path: src/cli/commands/link.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 7a8717a92c0e9c693cb11c2f877f97d2721c169fe9c87df5629a922af33d96f7
        timestamp: 2026-09-17T17:27:36.271Z
    - path: src/cli/commands/check.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 1666bd29e6f3c74052de02705b509b4a71b16da91f8a77441e3060ed0ed6bc15
        timestamp: 2026-09-17T17:27:36.296Z
    - path: src/core/anchor/manifest.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: f24aa1a03be70ae7325159269197de3622a6209ef5559add9b176c16ee27b594
        timestamp: 2026-09-17T17:27:36.314Z
    - path: src/cli/index.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 4837002446e3c2dcddab54c31ee3c1ca674b3268fd50dd6386b02335a1a04d34
        timestamp: 2026-09-17T17:27:36.331Z
---

# Brief: Verity Ecosystem Integration (Multi-Anchor, Derived Manifest, Quick Check)

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement

- **Konteks & Alasan**:
  Verity saat ini telah memiliki engine inti (AST normalizer, Git client, parser Vue SFC/Astro/TS, serta CLI dasar `link` dan `check`). Namun, untuk mengintegrasikan Verity ke dalam ekosistem autonomous coding bersama skill `to-brief`, `session-handover`, dan Antigravity Lifecycle Hooks, diperlukan penyesuaian arsitektural:
  1. *Paperwork Tax:* `verity link` saat ini hanya menerima 1 anchor per panggilan, memaksa agent memanggil perintah berulang-ulang untuk task dengan banyak target file.
  2. *Hook Latency:* Hook `PreInvocation` Antigravity membutuhkan pengecekan ultra-cepat ($\le 5\text{ms}$), bukan parsing AST mendalam di setiap pesan model.
  3. *Derived Manifest SSOT:* Dibutuhkan generator manifest `docs/brief/INDEX.md` yang 100% dibuat oleh mesin secara deterministik dari hasil `verity check`, tanpa campur tangan editing manual.
  4. *Provenance Narrative Sync:* Blok `## Provenance
- **Completion Commit**: `8e4aaf366cffa33111dd93421c56ac1eac1a7794`
- **Anchors**:
  - `src/cli/commands/link.ts`
  - `src/cli/commands/check.ts`
  - `src/core/anchor/manifest.ts`
  - `src/cli/index.ts`
## Scope & Boundaries

### In-Scope
- [x] Upgrade `src/cli/commands/link.ts` untuk menerima multiple code anchors: `verity link <spec-file> <anchor1> [anchor2...] [--inline]`.
- [x] Otomasi penyuntikan/pembaruan section `## Provenance` di dalam badan markdown brief saat `verity link` dieksekusi.
- [x] Pembuatan modul `src/core/anchor/manifest.ts` untuk menghasilkan dan memperbarui `docs/brief/INDEX.md` secara deterministik.
- [x] Penambahan opsi `--quick` pada `verity check` yang memanfaatkan Git HEAD cache untuk eksekusi kilat pada hook Antigravity.
- [x] Penambahan subcommand `verity index` dan flag `verity check --sync-index`.
- [x] Pengujian unit test untuk multi-anchor, manifest generator, dan quick-check cache.

### Out-of-Scope
- Belum memodifikasi file skill `.agents/skills/to-brief/SKILL.md` dan `session-handover/SKILL.md` (dilakukan pada Fase 2 setelah CLI teruji).
- Belum mengonfigurasi `.agents/hooks.json` (dilakukan pada Fase 3 setelah Fase 2 selesai).

---

## Spesifikasi Detail Pekerjaan

### 1. Daftar File yang Akan Diubah / Dibuat
- [`src/core/anchor/manifest.ts`](file:///F:/Veritas/verity/src/core/anchor/manifest.ts) *(Baru)*: Generator dan sinkronizer berkas `docs/brief/INDEX.md` (membaca seluruh brief, mengecek status anchor via Verity, dan menulis tabel manifest).
- [`src/cli/commands/link.ts`](file:///F:/Veritas/verity/src/cli/commands/link.ts) *(Diubah)*: Menangani parameter array `codeAnchors`, meng-upsert seluruh anchor ke frontmatter secara atomik, dan memperbarui section naratif `## Provenance` di badan file markdown.
- [`src/cli/commands/check.ts`](file:///F:/Veritas/verity/src/cli/commands/check.ts) *(Diubah)*: Menambahkan flag `--quick` (cek cepat via file cache `.verity/cache.json` & git HEAD SHA) dan flag `--sync-index` (otomatis memicu manifest generator).
- [`src/cli/index.ts`](file:///F:/Veritas/verity/src/cli/index.ts) *(Diubah)*: Mendaftarkan subcommand `verity index` dan argumen baru di pesan bantuan `--help`.
- [`test/ecosystem.test.ts`](file:///F:/Veritas/verity/test/ecosystem.test.ts) *(Baru)*: Suite pengujian untuk multi-anchor, provenance injection, quick check cache, dan manifest index generator.

### 2. Line Range Mapping (Presisi Target Edit)
- [`src/cli/commands/link.ts:L14-L95`](file:///F:/Veritas/verity/src/cli/commands/link.ts#L14-L95): Mengubah signature `runLinkCommand(specFilePath: string, codeAnchors: string[], options)` dan menambahkan fungsi `updateMarkdownProvenanceSection(content, anchors, headSha)`.
- [`src/cli/commands/check.ts:L10-L135`](file:///F:/Veritas/verity/src/cli/commands/check.ts#L10-L135): Menambahkan opsi `quick?: boolean` dan `syncIndex?: boolean`, serta logika evaluasi cache SHA.
- [`src/cli/index.ts:L35-L75`](file:///F:/Veritas/verity/src/cli/index.ts#L35-L75): Routing subcommand `verity index` dan multiple argument parsing pada `link`.

### 3. Urutan Pengerjaan yang Logis
1. Implementasi `src/core/anchor/manifest.ts` (Manifest Index Generator).
2. Perluasan `src/cli/commands/link.ts` (Multi-anchor support + section `## Provenance` updater).
3. Penambahan opsi `--quick` dan `--sync-index` pada `src/cli/commands/check.ts`.
4. Pendaftaran subcommand dan flags pada `src/cli/index.ts`.
5. Penulisan dan eksekusi pengujian di `test/ecosystem.test.ts`.
6. Eksekusi `verity index` untuk membuat `docs/brief/INDEX.md` pertama kali.

### 4. Dampak Terhadap Bagian Lain
- Backwards compatible: Pemanggilan `verity link` dengan 1 target anchor tetap berfungsi normal seperti sebelumnya.
- `verity check` tanpa flag `--quick` tetap menjalankan deep AST check secara menyeluruh.

### 5. Potensi Breaking Change atau Resiko
- *Resiko Format Markdown*: Penulisan section `## Provenance` harus menjaga integritas konten brief yang sudah ada tanpa menimpa bagian naratif lainnya. Mitigasi: Gunakan regex boundary yang aman; jika section `## Provenance` sudah ada, perbarui isinya; jika belum, tambahkan di akhir dokumen.

### 6. Alternatif Pendekatan
- *Penyimpanan Cache Quick-Check*: Bisa di memori atau file lokal `.verity/cache.json`.
  - *Terpilih:* File lokal `.verity/cache.json` (diabaikan oleh git via `.gitignore`) agar status cache bertahan antar pemanggilan proses CLI Bun yang independen.

---

## Acceptance Criteria (Given-When-Then)

- [x] **Scenario 1: Multi-Anchor Linking dalam Satu Perintah**
  - **Given**: File brief `docs/brief/test.md` dan dua file kode `src/a.ts#foo` serta `src/b.ts#bar`.
  - **When**: Pengguna/agent menjalankan `bun run verity link docs/brief/test.md src/a.ts#foo src/b.ts#bar`.
  - **Then**: Kedua anchor tersimpan di frontmatter `verity.anchors`, dan badan markdown memiliki section `## Provenance` berisi commit SHA dan daftar kedua anchor tersebut.

- [x] **Scenario 2: Quick Check dengan Cache Hit**
  - **Given**: Seluruh anchor berstatus `OK` dan cache tersimpan pada commit HEAD saat ini.
  - **When**: `bun run verity check --quick` dijalankan tanpa ada perubahan commit atau working tree git.
  - **Then**: Perintah selesai dalam waktu $< 15\text{ms}$ dan melaporkan `[CACHE HIT] All anchors valid`.

- [x] **Scenario 3: Otomasi Sinkronisasi Manifest `docs/brief/INDEX.md`**
  - **Given**: Terdapat file brief di `docs/brief/*.md` dengan berbagai status anchor.
  - **When**: Pengguna/agent menjalankan `bun run verity index` atau `bun run verity check --sync-index`.
  - **Then**: Berkas `docs/brief/INDEX.md` tercipta/terperbarui berisi tabel manifest lengkap dengan kolom Status yang akurat (`OK` / `Needs Reconciliation`).

---

## Definition of Done (DoD) Checklist

- [x] `verity link` mendukung multi-anchor dan auto-update section `## Provenance`.
- [x] `verity check --quick` berhasil mengecek cache dalam hitungan milidetik untuk hook Antigravity.
- [x] `verity index` menghasilkan tabel manifest terstruktur di `docs/brief/INDEX.md`.
- [x] Unit tests di `test/ecosystem.test.ts` lulus 100%.
- [x] Seluruh perubahan terverifikasi tanpa regresi pada parser eksisting.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/cli/commands/link.ts`
  - `src/cli/commands/check.ts`
  - `src/core/anchor/manifest.ts`
  - `src/cli/index.ts`