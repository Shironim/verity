# Verity — Multi-Language Spec-Drift Detector & Integrity Gate

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-black.svg)](https://bun.sh)
[![Protocol: MCP](https://img.shields.io/badge/Protocol-MCP%20Server-green.svg)](https://modelcontextprotocol.io)

> **"Code as Truth, Docs as Intent"**  
> Verity is a deterministic, multi-language integrity gate that detects when documentation, task briefs, and architectural decision records (ADRs) drift from actual code implementations.

---

## 1. The Spec-Drift Dilemma

In modern Spec-Driven Development, briefs and architectural records serve as the Single Source of Truth (SSOT). However, specifications suffer from **staleness vs code velocity**: code changes quickly, while narrative documents quietly rot into misleading artifacts (*spec drift*).

- **Why not doc-tests?** Doc-tests verify snippet execution, but are blind to narrative rationale ("WHY").
- **Why not LLM-on-commit?** Calling LLMs on every commit to audit docs is non-deterministic and exorbitantly wastes token budgets for a problem that is fundamentally deterministic.
- **Why Verity?** Verity binds specifications to code anchors using **Git provenance (commit SHA)** and **normalized AST fingerprints** that are 100% immune to cosmetic reformatting (whitespace, trailing commas, Prettier/Pint).

---

## 2. The 4-Project Synergy Matrix

Verity synthesizes the strengths of three pioneering tools in the ecosystem:

| Dimension | `drift` (Fiberplane) | `strata-mcp` (Frontend) | `codegraph` (Semantic) | **Verity** |
|---|---|---|---|---|
| **Primary Focus** | Spec-to-Code Staleness | Live AST Search & Graph | Symbol Navigation | **Spec-Drift Integrity Gate** |
| **Vue SFC / Astro** | ❌ None (HTML raw) | ✅ Native AST Surgery | ⚠️ Partial | ✅ **Native AST Slicing (Ported)** |
| **Git Provenance** | ⚠️ Static file hashes | ❌ N/A | ❌ N/A | ✅ **Commit SHA, Author, Message** |
| **Anchor Storage** | Single `drift.lock` file | N/A | N/A | ✅ **Dual (Frontmatter + Inline)** |
| **Interface** | CLI binary | MCP Server | CLI + MCP | ✅ **CLI + Native MCP Server** |
| **Zero-LLM Cost** | ✅ Deterministic | ✅ Deterministic | ✅ Deterministic | ✅ **100% Deterministic** |

---

## 3. Quick Installation

### Standalone Binary (Zero Dependencies)

**Linux & macOS (1-Line Install):**
```bash
curl -fsSL https://raw.githubusercontent.com/shironim/verity/master/scripts/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/shironim/verity/master/scripts/install.ps1 | iex
```

### Via NPM / Bun Global
```bash
npm install -g @dimassetoid/verity
# or
bun add -g @dimassetoid/verity
```

---

## 4. CLI Usage & Core Commands

### 1. Initialize a Project
```bash
verity init --yes --hook
```
Creates `docs/brief/`, an example brief, initializes `docs/brief/INDEX.md`, adds `AGENTS.md` instructions, and installs a Git pre-commit hook.

### 2. Link a Specification to Code Anchors
```bash
verity link docs/brief/feature-auth.md src/auth.ts#login src/components/Login.vue#submitForm
```
Calculates AST fingerprints and seals the current Git HEAD commit SHA into the markdown frontmatter (or inline tag with `--inline`).

### 3. Audit Spec Drift
```bash
# Standard interactive report
verity check

# Ultra-fast check using clean working tree cache (<= 5ms, ideal for agent hooks)
verity check --quick

# Check and update docs/brief/INDEX.md manifest
verity check --sync-index

# CI gate mode (exits with code 1 if STALE anchors are detected)
verity check --ci
```

---

## 5. Native MCP Server (AI Coding Agents)

Verity includes a native Model Context Protocol (MCP) server running over stdio JSON-RPC.

### Adding to Agent Configuration (`mcpServers`)

Add to your `claude_desktop_config.json`, Cursor MCP settings, or Antigravity config:

```json
{
  "mcpServers": {
    "verity": {
      "command": "verity",
      "args": ["mcp"]
    }
  }
}
```
*(Or run directly with `bun run /path/to/verity/src/cli/index.ts mcp`)*.

### Exposed MCP Tools

1. **`verity_check`**: Runs deterministic drift audit; returns structured JSON with OK/STALE statuses.
2. **`verity_link`**: Links and seals brief documents to target files/symbols with Git HEAD SHA.
3. **`verity_status`**: High-level repository health summary (total briefs, anchors, git state).
4. **`verity_reconcile_diff`**: Retrieves the precise Git diff of code modifications since baseline commit SHA.
5. **`verity_sync_manifest`**: Deterministically synchronizes `docs/brief/INDEX.md`.

---

## 6. Architecture Overview

```
src/
├── cli/
│   ├── index.ts               # CLI Entrypoint (dual-mode)
│   └── commands/
│       ├── link.ts            # 'verity link' implementation
│       ├── check.ts           # 'verity check' implementation
│       ├── init.ts            # 'verity init' onboarding wizard
│       └── mcp.ts             # 'verity mcp' stdio runner
├── mcp/
│   ├── server.ts              # MCP Server instance (@modelcontextprotocol/sdk)
│   └── tools.ts               # 5 Core MCP Tool definitions & handlers
├── core/
│   ├── anchor/
│   │   ├── frontmatter.ts     # YAML frontmatter parser & serializer
│   │   ├── inline.ts          # Inline <!-- @verity ... --> comment parser
│   │   ├── scanner.ts         # Recursive markdown anchor scanner
│   │   └── manifest.ts        # Derived-only manifest generator (INDEX.md)
│   ├── parser/
│   │   ├── dispatcher.ts      # Multi-tier extension dispatcher
│   │   ├── mixed/             # SFC & mixed document extractors
│   │   │   ├── vue.ts         # Vue SFC script/template/props/emits extractor
│   │   │   └── astro.ts       # Astro frontmatter script extractor
│   │   ├── typescript.ts      # TypeScript/JavaScript AST symbol parser
│   │   └── fallback.ts        # Deterministic file-level hash fallback
│   ├── fingerprint/
│   │   └── normalizer.ts      # Reformat-proof AST token normalizer
│   └── git/
│       └── client.ts          # Git command wrapper (SHA, logs, diffs)
└── index.ts                   # Programmatic API
```

---

## 7. Testing & Quality Gate

```bash
bun test
```
Runs the automated test suite across normalizer formatting immunity, Vue SFC AST extraction, CLI command execution, init command isolation, and MCP server tools.

---

## 8. License

MIT License © 2026 Dimas Seto
