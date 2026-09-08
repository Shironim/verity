# Brief Manifest Index

> **Single Source of Truth (SSOT) Manifest**  
> Terakhir Disinkronkan: 2026-09-08 11:56 UTC  
> Dikelola otomatis oleh: `verity index` (Derived-Only Artifact — Dilarang Diedit Manual)

| Brief | Kategori | Status | Anchors | Ringkasan |
|---|---|---|:---:|---|
| [`feature-verity-agent-onboarding-kit.md`](file:///docs/brief/feature-verity-agent-onboarding-kit.md) | `feature` | `Completed` | 2 | 1. Mengimplementasikan perintah `verity init` (`src/cli/commands/init.ts`) dengan flag `--yes`, `--hook`, dan `--template`. |
| [`feature-verity-ecosystem-integration.md`](file:///docs/brief/feature-verity-ecosystem-integration.md) | `feature` | `Draft` | 4 | Verity saat ini telah memiliki engine inti (AST normalizer, Git client, parser Vue SFC/Astro/TS, serta CLI dasar `link` dan `check`). Namun, untuk mengintegrasikan Verity ke dalam ekosistem autonomous coding bersama skill `to-brief`, `session-handover`, dan Antigravity Lifecycle Hooks, diperlukan penyesuaian arsitektural: |
| [`feature-verity-go-parser.md`](file:///docs/brief/feature-verity-go-parser.md) | `feature` | `Completed` | 2 | 1. Mengimplementasikan `GoParser` native berbasis tokenizer deterministik dan *balanced braces scanner* di `src/core/parser/go.ts`. |
| [`feature-verity-multi-platform-distribution.md`](file:///docs/brief/feature-verity-multi-platform-distribution.md) | `feature` | `Completed` | 4 | 1. Mengonfigurasi target kompilasi multi-platform di `package.json` (`linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`, `windows-x64`). |
| [`feature-verity-native-mcp-server.md`](file:///docs/brief/feature-verity-native-mcp-server.md) | `feature` | `Completed` | 3 | Menyediakan native MCP server layer di `src/mcp/server.ts` dan command `verity mcp` di CLI, yang mengekspos 5 core tools: |
| [`feature-verity-php-parser.md`](file:///docs/brief/feature-verity-php-parser.md) | `feature` | `Completed` | 2 | 1. Mengimplementasikan `PhpParser` di `src/core/parser/php.ts` yang mengimplementasikan `CodeParser`. |
| [`feature-verity-python-parser.md`](file:///docs/brief/feature-verity-python-parser.md) | `feature` | `Completed` | 2 | 1. Mengimplementasikan `PythonParser` native berbasis *Indentation-Aware Block Scanner* di `src/core/parser/python.ts`. |
| [`feature-verity-spec-drift-detector.md`](file:///docs/brief/feature-verity-spec-drift-detector.md) | `feature` | `Draft` | 1 | Membangun CLI tool mandiri berbasis Bun & TypeScript yang mampu mendeteksi *spec-drift* secara deterministik berbasis *git provenance* (commit SHA baseline) dan *normalized AST fingerprint* yang kebal terhadap reformatting kosmetik, dengan dukungan symbol-level pada file single-language maupun multi-language (Vue SFC/Astro via adaptasi dari `strata-mcp`), serta graceful file-level fallback. |
| [`refactor-cache-hit-sync-and-hook-activation.md`](file:///docs/brief/refactor-cache-hit-sync-and-hook-activation.md) | `refactor` | `Completed` | 1 | 1. Memperbarui `runCheckCommand` di `src/cli/commands/check.ts` agar tetap menjalankan `manifestGen.generateAndSync()` saat `options.syncIndex` bernilai true, meskipun dalam kondisi cache-hit `--quick`. |
| [`refactor-parser-hardening-and-test-suite.md`](file:///docs/brief/refactor-parser-hardening-and-test-suite.md) | `refactor` | `Completed` | 2 | 1. Membersihkan import Vue SFC ke ESM browser build (`@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js`). |
