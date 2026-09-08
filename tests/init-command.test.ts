import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInitCommand } from '../src/cli/commands/init';

describe('runInitCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'verity-init-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize docs/brief, example brief, INDEX.md, and AGENTS.md in a fresh workspace', async () => {
    const result = await runInitCommand({ cwd: tempDir, yes: true });

    expect(result.docsCreated).toBe(true);
    expect(existsSync(join(tempDir, 'docs/brief'))).toBe(true);
    expect(existsSync(join(tempDir, 'docs/brief/feature-example.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'docs/brief/INDEX.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true);

    const indexContent = readFileSync(join(tempDir, 'docs/brief/INDEX.md'), 'utf8');
    expect(indexContent).toContain('feature-example.md');
  });

  it('should install git pre-commit hook if .git/hooks directory exists', async () => {
    const gitHooks = join(tempDir, '.git/hooks');
    mkdirSync(gitHooks, { recursive: true });

    const result = await runInitCommand({ cwd: tempDir, hook: true });

    expect(result.hookInstalled).toBe(true);
    const hookPath = join(gitHooks, 'pre-commit');
    expect(existsSync(hookPath)).toBe(true);

    const hookContent = readFileSync(hookPath, 'utf8');
    expect(hookContent).toContain('verity check');
  });

  it('should be idempotent and not destroy existing briefs on re-initialization', async () => {
    await runInitCommand({ cwd: tempDir, yes: true });

    // Modifikasi feature-example.md
    const exampleFile = join(tempDir, 'docs/brief/feature-example.md');
    const customContent = '# Brief: Custom User Specification\n\nModified content';
    await Bun.write(exampleFile, customContent);

    // Jalankan init kedua kali
    const secondResult = await runInitCommand({ cwd: tempDir, yes: true });
    expect(secondResult.docsCreated).toBe(false);

    const retainedContent = readFileSync(exampleFile, 'utf8');
    expect(retainedContent).toBe(customContent);
  });
});
