import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BriefSearchEngine } from '../src/core/anchor/search';
import { BriefManifestGenerator } from '../src/core/anchor/manifest';
import { runFindCommand } from '../src/cli/commands/find';

describe('BriefSearchEngine & Hierarchical Briefs', () => {
  let tempDir: string;
  let briefDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'verity-search-test-'));
    briefDir = join(tempDir, 'docs/brief');

    // Buat struktur direktori bertingkat YYYY-MM/[category]/
    const sep2026Feature = join(briefDir, '2026-09/feature');
    const sep2026Bugfix = join(briefDir, '2026-09/bugfix');
    const oct2026Refactor = join(briefDir, '2026-10/refactor');

    mkdirSync(sep2026Feature, { recursive: true });
    mkdirSync(sep2026Bugfix, { recursive: true });
    mkdirSync(oct2026Refactor, { recursive: true });

    // Brief 1: Monthly Feature Brief
    writeFileSync(
      join(sep2026Feature, 'auth-system.md'),
      `---
verity:
  anchors:
    - path: src/auth/login.ts
      symbol: authenticate
      provenance:
        commitSha: 12345678
        fingerprint: abcdef
        timestamp: 2026-09-18T00:00:00Z
---

# Brief: Authentication System & SSO Integration

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-09-18  

## Overview & Problem Statement
- **Tujuan Utama**: Mengintegrasikan SSO OAuth2 dan proteksi brute-force login.
`,
      'utf8'
    );

    // Brief 2: Monthly Bugfix Brief
    writeFileSync(
      join(sep2026Bugfix, 'token-leak.md'),
      `---
verity:
  anchors:
    - path: src/auth/token.ts
      provenance:
        commitSha: 87654321
        fingerprint: fedcba
        timestamp: 2026-09-18T00:00:00Z
---

# Brief: Fix JWT Token Memory Leak

> **Kategori**: bugfix  
> **Status**: In Progress  
> **Tanggal**: 2026-09-19  

## Overview & Problem Statement
- **Tujuan Utama**: Mencegah kebocoran token JWT pada event emitter socket.
`,
      'utf8'
    );

    // Brief 3: Oct 2026 Refactor Brief
    writeFileSync(
      join(oct2026Refactor, 'parser-cleanup.md'),
      `# Brief: Clean Parser Dispatcher Cache

> **Kategori**: refactor  
> **Status**: Draft  
> **Tanggal**: 2026-10-01  

## Overview & Problem Statement
- **Tujuan Utama**: Membersihkan alokasi memori berlebih pada LRU cache AST parser.
`,
      'utf8'
    );

    // Brief 4: Legacy Flat Brief (Root docs/brief/)
    writeFileSync(
      join(briefDir, 'feature-legacy-cli.md'),
      `# Brief: Legacy CLI Tooling

> **Kategori**: feature  
> **Status**: Completed  
> **Tanggal**: 2026-08-10  

## Overview & Problem Statement
- **Tujuan Utama**: Memberikan interface terminal dasar untuk developer.
`,
      'utf8'
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should recursively scan and index all briefs across nested and legacy flat folders in manifest', async () => {
    const generator = new BriefManifestGenerator(tempDir);
    const { total, entries } = await generator.generateAndSync();

    expect(total).toBe(4);
    expect(entries.length).toBe(4);

    const relativePaths = entries.map((e) => e.fileName);
    expect(relativePaths).toContain('2026-09/feature/auth-system.md');
    expect(relativePaths).toContain('2026-09/bugfix/token-leak.md');
    expect(relativePaths).toContain('2026-10/refactor/parser-cleanup.md');
    expect(relativePaths).toContain('feature-legacy-cli.md');

    // Pastikan INDEX.md ditulis dengan path yang valid
    const indexContent = await Bun.file(join(briefDir, 'INDEX.md')).text();
    expect(indexContent).toContain('2026-09/feature/auth-system.md');
    expect(indexContent).toContain('Mengintegrasikan SSO OAuth2');
    expect(indexContent).toContain('2026-09/bugfix/token-leak.md');
  });

  it('should find briefs by full-text keyword query', async () => {
    const engine = new BriefSearchEngine(tempDir);

    const results = await engine.search({ query: 'OAuth2' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Authentication System & SSO Integration');
    expect(results[0].category).toBe('feature');
  });

  it('should reverse-lookup briefs by target code anchor', async () => {
    const engine = new BriefSearchEngine(tempDir);

    const results = await engine.search({ target: 'src/auth/login.ts' });
    expect(results.length).toBe(1);
    expect(results[0].relativePath).toBe('2026-09/feature/auth-system.md');
    expect(results[0].anchors[0].targetPath).toBe('src/auth/login.ts');
    expect(results[0].anchors[0].symbol).toBe('authenticate');
  });

  it('should filter briefs by category and status', async () => {
    const engine = new BriefSearchEngine(tempDir);

    const bugfixes = await engine.search({ category: 'bugfix' });
    expect(bugfixes.length).toBe(1);
    expect(bugfixes[0].title).toBe('Fix JWT Token Memory Leak');

    const completed = await engine.search({ status: 'Completed' });
    expect(completed.length).toBe(2);
  });

  it('should filter briefs by monthly period', async () => {
    const engine = new BriefSearchEngine(tempDir);

    const sepResults = await engine.search({ month: '2026-09' });
    expect(sepResults.length).toBe(2);

    const octResults = await engine.search({ month: '2026-10' });
    expect(octResults.length).toBe(1);
    expect(octResults[0].title).toBe('Clean Parser Dispatcher Cache');
  });

  it('should execute runFindCommand and return structured JSON when requested', async () => {
    const { total, results } = await runFindCommand('JWT', { cwd: tempDir, json: true });
    expect(total).toBe(1);
    expect(results[0].title).toBe('Fix JWT Token Memory Leak');
  });
});
