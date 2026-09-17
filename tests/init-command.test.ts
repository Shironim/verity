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

  it('should auto-append .agents/ and .verity/ to .gitignore and remain idempotent', async () => {
    const gitignoreFile = join(tempDir, '.gitignore');
    await Bun.write(gitignoreFile, 'node_modules/\ndist/\n');

    const firstResult = await runInitCommand({ cwd: tempDir, yes: true });
    expect(firstResult.gitignoreUpdated).toBe(true);

    const content = readFileSync(gitignoreFile, 'utf8');
    expect(content).toContain('.agents/');
    expect(content).toContain('.verity/');

    // Jalankan ulang - harus idempotent
    const secondResult = await runInitCommand({ cwd: tempDir, yes: true });
    expect(secondResult.gitignoreUpdated).toBe(false);
  });

  it('should auto-create and smart merge .agents/hooks.json', async () => {
    // 1. Fresh creation
    const result = await runInitCommand({ cwd: tempDir, agentHooks: true });
    expect(result.agentHooksInstalled).toBe(true);

    const hooksJsonPath = join(tempDir, '.agents/hooks.json');
    expect(existsSync(hooksJsonPath)).toBe(true);

    const initialConfig = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
    expect(initialConfig['verity-pre-invocation']).toBeDefined();
    expect(initialConfig['verity-mutation-guard']).toBeDefined();
    expect(initialConfig['verity-pre-invocation'].PreInvocation[0].command).toContain('hooks/verity-pre-invocation.cjs');
    expect(initialConfig['verity-mutation-guard'].PreToolUse[0].hooks[0].command).toContain('hooks/verity-mutation-guard.cjs');

    // 2. Existing custom hook merge
    initialConfig['custom-linter'] = { enabled: true };
    await Bun.write(hooksJsonPath, JSON.stringify(initialConfig, null, 2));

    await runInitCommand({ cwd: tempDir, agentHooks: true });
    const mergedConfig = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
    expect(mergedConfig['custom-linter']).toBeDefined();
    expect(mergedConfig['verity-pre-invocation']).toBeDefined();
    expect(mergedConfig['verity-mutation-guard']).toBeDefined();
  });

  it('should not be hijacked by consumer repo having a local templates/ folder', async () => {
    // Simulasi consumer repo yang memiliki folder templates/ sendiri (misal template HTML/email)
    const consumerTemplates = join(tempDir, 'templates');
    mkdirSync(consumerTemplates, { recursive: true });
    await Bun.write(join(consumerTemplates, 'user-email.html'), '<h1>Hello</h1>');

    const result = await runInitCommand({ cwd: tempDir, yes: true, agentHooks: true });
    expect(result.instructionsInstalled).toBe(true);
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true);
    const agentsContent = readFileSync(join(tempDir, 'AGENTS.md'), 'utf8');
    expect(agentsContent).toContain('Verity AI Agent Guidelines');
  });
});
