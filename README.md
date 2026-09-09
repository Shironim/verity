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

## 3. Supported Languages & Architecture Tiers

Verity features dedicated AST scanners and token normalizers designed for **100% cosmetic reformatting immunity** (immune to whitespace, line breaks, comments, and code formatters).

To establish transparent reliability expectations, language support is categorized into two operational tiers:

### Tier 1 — Battle-Tested
The primary focus of the core engine, verified through daily dogfooding and used directly to build and maintain Verity itself. Features full AST slicing and production-grade edge-case coverage.

| Language / Framework | Extensions | Extraction Capabilities | Immunity Guarantee |
|---|---|---|---|
| **TypeScript / JavaScript** | `.ts`, `.tsx`, `.js`, `.jsx` | Functions, classes, methods, types, interfaces | Prettier, ESLint, Biome |
| **Vue SFC** | `.vue` | `<script>`, `<template>` events, `defineProps`, `defineEmits` | Prettier, vue-format |
| **Astro** | `.astro` | Component frontmatter scripts, template bindings | Prettier Astro plugin |

### Tier 2 — Extended & Community Support (Feedback Welcome)
Implemented via modular tokenizing scanners and verified by unit test suites. Built on Verity's pluggable `ParserDispatcher` architecture—real-world edge-case reports and community contributions are actively welcomed.

| Language | Extensions | Extraction Capabilities | Immunity Guarantee |
|---|---|---|---|
| **Rust** | `.rs` | Functions (`pub`, `async`, `const`), structs, enums, traits, `impl Type::method` | `rustfmt` |
| **Python** | `.py` | Indentation-aware functions, classes, decorated methods (`Class::method`) | `black`, `ruff` |
| **Go** | `.go` | Top-level functions, structs, interfaces, methods with receiver (`Type::Method`) | `gofmt`, `goimports` |
| **PHP** | `.php` | Classes, interfaces, traits, methods (`Class::method`), attributes | `PHP-CS-Fixer`, `Pint` |
| **C#** | `.cs` | Classes, records (positional/nominal), structs, interfaces, expression-bodied methods | `dotnet-format` |
| **Java** | `.java` | Classes, records, interfaces, enums, annotated methods (`Class::method`) | `google-java-format` |
| **Kotlin** | `.kt` | Data classes, sealed classes, companion objects, `suspend fun` | `ktlint` |
| **Ruby** | `.rb` | Keyword-block scanner (`def/class/module ... end`), `Class#method`, `Class::method` | `rubocop` |
| **Generic Fallback** | `*` | Graceful normalized text hashing with whitespace compaction | General whitespace |

## 4. Quick Installation

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

## 5. CLI Usage & Core Commands

### 1. Initialize an Autonomous Project Environment
```bash
# Full automated setup (Specs, Manifest, Handover, Git Hook, Agent Hooks, and Skills)
verity init --yes

# Or selective initialization
verity init --hook --agent-hooks --skills
```
Sets up the complete Autonomous Spec-Driven Engineering Lifecycle:
- `docs/brief/` and `INDEX.md`: SSOT specification repository with starter brief.
- `handover/` and `INDEX.md`: Session handover documentation for AI agent context continuity.
- `AGENTS.md`: AI Agent rules, anti-patterns, and boundary ownership standards.
- `.git/hooks/pre-commit`: Local VCS gatekeeper preventing commits when specs are STALE.
- `.agents/hooks/`: Agent Lifecycle Hooks (`verity-pre-invocation.cjs` and `verity-mutation-guard.cjs`).
- `.agents/skills/`: `to-brief` (boundary-safe specification creation) and `session-handover` (spec-verified context preservation).

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

## 6. Native MCP Server (AI Coding Agents)

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

## 7. Pluggable Parser Architecture (Extensibility)

Verity's `ParserDispatcher` implements an open pluggable registry pattern (*Open for Extension, Closed for Modification*):

```typescript
import { ParserDispatcher, type CodeParser, type ParseResult } from '@dimassetoid/verity';

class CustomSqlParser implements CodeParser {
  readonly supportedExtensions = ['.sql'];

  async parse(filePath: string, content: string, targetSymbol?: string): Promise<ParseResult> {
    return {
      filePath,
      targetSymbol,
      found: true,
      content,
      normalizedContent: content.trim(),
    };
  }
}

// Register dynamically at runtime — zero modifications to core dispatcher code!
const dispatcher = new ParserDispatcher();
dispatcher.registerParser(new CustomSqlParser());
```

---

## 8. Architecture Overview

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
│   │   ├── dispatcher.ts      # Pluggable & extensible parser registry
│   │   ├── typescript.ts      # TypeScript / JavaScript parser
│   │   ├── mixed/
│   │   │   ├── vue.ts         # Vue SFC parser (script, template, props, emits)
│   │   │   └── astro.ts       # Astro frontmatter script extractor
│   │   ├── php.ts             # PHP balanced-braces AST parser
│   │   ├── go.ts              # Go declaration & receiver parser
│   │   ├── python.ts          # Python indentation-aware parser
│   │   ├── rust.ts            # Rust balanced-braces & impl parser
│   │   ├── csharp.ts          # C# balanced-braces & attribute parser
│   │   ├── jvm.ts             # JVM parser (Java & Kotlin)
│   │   ├── ruby.ts            # Ruby keyword-block scanner (def/class/module ... end)
│   │   └── fallback.ts        # Normalized whitespace-compacting fallback
│   ├── fingerprint/
│   │   └── normalizer.ts      # Reformat-proof AST token normalizer
│   └── git/
│       └── client.ts          # Git command wrapper (SHA, logs, diffs, renames)
└── index.ts                   # Programmatic API
templates/
├── instructions.md            # Default AGENTS.md rules
├── pre-commit-hook.sh         # Git pre-commit hook script
├── hooks/                     # Verity agent lifecycle hooks
└── skills/                    # Verity agent skills (to-brief, session-handover)
```

---

## 9. Testing & Quality Gate

```bash
bun test
```
Runs the automated test suite (109 tests across 16 files) covering:
- AST Token Normalizer formatting and comment immunity
- Vue SFC, Astro, PHP, Go, Python, Rust, C#, JVM, and Ruby parser extraction
- Pluggable `ParserDispatcher` dynamic registration and extension overriding
- CLI command execution and idempotent workspace initialization
- Scalability edge-cases, Git move tracking, and MCP server tools

---

## 10. License

MIT License © 2026 Dimas Seto
