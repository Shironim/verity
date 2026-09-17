---
verity:
  anchors:
    - path: src/mcp/server.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 0098e903599dc155bacdebe30cb3e3f4c0f4a5e14bf8c23b39c825ea87205828
        timestamp: 2026-09-17T17:27:35.684Z
    - path: src/mcp/tools.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: 385f413283547a6bfb8d83f0147817b18f442737aa0e97fa4b03ddc36f18b080
        timestamp: 2026-09-17T17:27:35.704Z
    - path: src/cli/commands/mcp.ts
      provenance:
        commitSha: ac5b2c5c98fc8e1415df60e50fe4db95492b39e8
        fingerprint: a3e38d9582504cc7649b51fb24582a8ec644a3f6a4b903ebd012fcd0ac8ea35e
        timestamp: 2026-09-17T17:27:35.728Z
---

# Brief: Native Model Context Protocol (MCP) Server Layer

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-08  

---

## Overview & Problem Statement
- **Konteks & Alasan**:
  Saat ini Verity beroperasi secara eksklusif sebagai CLI tool. Untuk dapat diakses secara native oleh AI coding agents (Claude Code, Cursor, Antigravity, OpenCode, Codex) tanpa harus selalu membungkus perintah ke subshell terminal, Verity membutuhkan antarmuka Model Context Protocol (MCP) Server berbasis JSON-RPC melalui stdio.
- **Tujuan Utama**:
  Menyediakan native MCP server layer di `src/mcp/server.ts` dan command `verity mcp` di CLI, yang mengekspos 5 core tools:
  1. `verity_check`: Menjalankan audit spec drift dan mengembalikan JSON terstruktur.
  2. `verity_link`: Mengaitkan spesifikasi dengan kode sumber dan menyegel git SHA & normalized fingerprint.
  3. `verity_status`: Mengembalikan ringkasan metrik kesehatan repository (jumlah anchor, rasio stale vs OK).
  4. `verity_reconcile_diff`: Menyajikan git diff presisi dari commit pengubah untuk spesifikasi berstatus STALE.
  5. `verity_sync_manifest`: Memicu regenerasi deterministik `docs/brief/INDEX.md`.

---

## Scope & Boundaries
### In-Scope
- [x] Penambahan implementasi MCP Server stdio di `src/mcp/server.ts` menggunakan `@modelcontextprotocol/sdk`.
- [x] Implementasi 5 tool handlers di `src/mcp/tools.ts`: `verity_check`, `verity_link`, `verity_status`, `verity_reconcile_diff`, `verity_sync_manifest`.
- [x] Implementasi CLI sub-command `verity mcp` di `src/cli/commands/mcp.ts` dan registrasi di `src/cli/index.ts`.
- [x] Unit & integration test untuk MCP tools di `tests/mcp-server.test.ts`.
- [x] Uji coba eksekusi stdio runner dan verifikasi via `verity check`.

### Out-of-Scope
- Transpor SSE/HTTP (fokus murni pada local stdio transport sesuai standar agent tooling).
- Live query AST graph (tetap berada di domain `strata-mcp` / `codegraph`).

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**:
  - `src/mcp/server.ts` (new)
  - `src/mcp/tools.ts` (new)
  - `src/cli/commands/mcp.ts` (new)
  - `src/cli/index.ts:L30-L80`
  - `tests/mcp-server.test.ts` (new)
- **Data Model & API Impact**:
  - Expose MCP tools over stdio protocol:
    - `verity_check(targetScanPath?: string, quick?: boolean)`
    - `verity_link(specFilePath: string, codeAnchors: string[], inline?: boolean)`
    - `verity_status()`
    - `verity_reconcile_diff(specFilePath: string, targetPath: string)`
    - `verity_sync_manifest()`

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1: MCP Tool Listing**:
  - **Given**: Server MCP Verity aktif via stdio transport.
  - **When**: Client mengirimkan permintaan `tools/list`.
  - **Then**: Server mengembalikan daftar 5 tools (`verity_check`, `verity_link`, `verity_status`, `verity_reconcile_diff`, `verity_sync_manifest`) dengan skema input JSON yang valid.
- [ ] **Scenario 2: Tool Execution (verity_check & verity_status)**:
  - **Given**: Repositori memiliki file spec dan anchor aktif.
  - **When**: Client memanggil tool `verity_check` atau `verity_status`.
  - **Then**: Server mengembalikan payload JSON status/laporan tanpa error.
- [ ] **Scenario 3: CLI Runner Command**:
  - **Given**: CLI Verity dieksekusi dengan argumen `bun run verity mcp`.
  - **When**: Sub-command `mcp` dipanggil.
  - **Then**: Proses menjalankan stdio server runner secara non-blocking.

---

## Definition of Done (DoD) Checklist
- [ ] Server MCP stdio terimplementasi menggunakan `@modelcontextprotocol/sdk`.
- [ ] Kelima tools MCP teruji dan mengembalikan respon terstruktur.
- [ ] Perintah `verity mcp` dapat dijalankan via CLI.
- [ ] Test suite `tests/mcp-server.test.ts` lulus di `bun test`.
- [ ] Provenance brief disegel via `verity link`.

---

## Provenance
- **Completion Commit**: `ac5b2c5c98fc8e1415df60e50fe4db95492b39e8`
- **Anchors**:
  - `src/mcp/server.ts`
  - `src/mcp/tools.ts`
  - `src/cli/commands/mcp.ts`