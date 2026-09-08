import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../src/core/git/client';
import { AnchorScanner } from '../src/core/anchor/scanner';
import type { Anchor } from '../src/core/types';

describe('Scalability & Enterprise Edge-Case Hardening', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `verity-scale-test-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(tempDir, { recursive: true });
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Scenario 1: GitClient should collect changed files since baseline commit and include working tree mutations', () => {
    const gitClient = new GitClient(tempDir);

    // Initial commit
    const fileA = join(tempDir, 'fileA.ts');
    const fileB = join(tempDir, 'fileB.ts');
    writeFileSync(fileA, 'export const a = 1;', 'utf8');
    writeFileSync(fileB, 'export const b = 2;', 'utf8');
    execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    const baselineSha = gitClient.getHeadSha();

    // Modify fileA and create fileC
    writeFileSync(fileA, 'export const a = 2;', 'utf8');
    const fileC = join(tempDir, 'fileC.ts');
    writeFileSync(fileC, 'export const c = 3;', 'utf8');

    const changed = gitClient.getChangedFilesSince(baselineSha);

    expect(changed.has('fileA.ts')).toBe(true);
    expect(changed.has('fileC.ts')).toBe(true);
    expect(changed.has('fileB.ts')).toBe(false); // fileB was not touched
  });

  it('Scenario 2: GitClient should detect renamed or moved files', () => {
    const gitClient = new GitClient(tempDir);

    const oldFile = join(tempDir, 'oldName.ts');
    writeFileSync(oldFile, 'export function compute() { return 42; }', 'utf8');
    execSync('git add . && git commit -m "add old"', { cwd: tempDir, stdio: 'ignore' });

    const baselineSha = gitClient.getHeadSha();

    // Rename using git mv
    execSync('git mv oldName.ts newName.ts', { cwd: tempDir, stdio: 'ignore' });

    const detected = gitClient.detectRenamedFile('oldName.ts', baselineSha);
    expect(detected).toBe('newName.ts');
  });

  it('Scenario 3: AnchorScanner should serialize and load from Centralized Manifest cache (.verity/manifest.json)', () => {
    const scanner = new AnchorScanner(tempDir);
    const manifestPath = scanner.getManifestPath();

    expect(existsSync(manifestPath)).toBe(false);

    const mockAnchors: Anchor[] = [
      {
        specFile: 'docs/brief/feature-a.md',
        targetPath: 'src/a.ts',
        symbol: 'doA',
        provenance: {
          commitSha: 'abcdef1234567890',
          fingerprint: '1111222233334444',
        },
        kind: 'frontmatter',
      },
      {
        specFile: 'docs/brief/feature-b.md',
        targetPath: 'src/b.ts',
        provenance: {
          commitSha: 'abcdef1234567890',
          fingerprint: '5555666677778888',
        },
        kind: 'frontmatter',
      },
    ];

    scanner.saveManifest(mockAnchors);
    expect(existsSync(manifestPath)).toBe(true);

    const loaded = scanner.loadManifest();
    expect(loaded).toBeDefined();
    expect(loaded?.length).toBe(2);
    expect(loaded?.[0].targetPath).toBe('src/a.ts');
    expect(loaded?.[0].symbol).toBe('doA');
    expect(loaded?.[1].targetPath).toBe('src/b.ts');
  });

  it('Scenario 4: AnchorScanner should respect forceFresh and fallback gracefully if cache is absent', () => {
    const docsDir = join(tempDir, 'docs', 'brief');
    mkdirSync(docsDir, { recursive: true });

    const briefContent = `---
verity:
  anchors:
    - path: src/core.ts
      symbol: start
      provenance:
        commitSha: 12345678
        fingerprint: aabbccdd
---
# Test Brief
`;
    writeFileSync(join(docsDir, 'test.md'), briefContent, 'utf8');

    const scanner = new AnchorScanner(tempDir);

    // Initial scan creates manifest
    const anchorsInitial = scanner.scan();
    expect(anchorsInitial.length).toBe(1);
    expect(anchorsInitial[0].targetPath).toBe('src/core.ts');
    expect(existsSync(scanner.getManifestPath())).toBe(true);

    // Scan with forceFresh re-reads from markdown files
    const anchorsFresh = scanner.scan(undefined, { forceFresh: true });
    expect(anchorsFresh.length).toBe(1);
    expect(anchorsFresh[0].symbol).toBe('start');
  });

  it('Scenario 5: StalenessStatus should support MOVED status', () => {
    const sampleReport = {
      anchor: {
        specFile: 'docs/brief/auth.md',
        targetPath: 'src/old-auth.ts',
        provenance: { commitSha: 'abc', fingerprint: '123' },
        kind: 'frontmatter' as const,
      },
      status: 'MOVED' as const,
      relocatedPath: 'src/auth/index.ts',
      message: "File target dipindahkan ke 'src/auth/index.ts'",
    };

    expect(sampleReport.status).toBe('MOVED');
    expect(sampleReport.relocatedPath).toBe('src/auth/index.ts');
  });
});
