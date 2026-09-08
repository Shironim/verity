# Brief Manifest Index

> **Single Source of Truth (SSOT) Manifest**  
> Terakhir Disinkronkan: 2026-09-08 05:31 UTC  
> Dikelola otomatis oleh: `verity index` (Derived-Only Artifact — Dilarang Diedit Manual)

| Brief | Kategori | Status | Anchors | Ringkasan |
|---|---|---|:---:|---|
| [`feature-verity-ecosystem-integration.md`](file:///docs/brief/feature-verity-ecosystem-integration.md) | `feature` | `Draft` | 4 | Verity saat ini telah memiliki engine inti (AST normalizer, Git client, parser Vue SFC/Astro/TS, serta CLI dasar `link` dan `check`). Namun, untuk mengintegrasikan Verity ke dalam ekosistem autonomous coding bersama skill `to-brief`, `session-handover`, dan Antigravity Lifecycle Hooks, diperlukan penyesuaian arsitektural: |
| [`feature-verity-spec-drift-detector.md`](file:///docs/brief/feature-verity-spec-drift-detector.md) | `feature` | `Draft` | 1 | Membangun CLI tool mandiri berbasis Bun & TypeScript yang mampu mendeteksi *spec-drift* secara deterministik berbasis *git provenance* (commit SHA baseline) dan *normalized AST fingerprint* yang kebal terhadap reformatting kosmetik, dengan dukungan symbol-level pada file single-language maupun multi-language (Vue SFC/Astro via adaptasi dari `strata-mcp`), serta graceful file-level fallback. |
