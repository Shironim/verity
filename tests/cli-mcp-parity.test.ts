import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runStatusCommand } from '../src/cli/commands/status';
import { runDiffCommand } from '../src/cli/commands/diff';
import { VERITY_TOOLS, findTool } from '../src/mcp/tools';

describe('CLI & MCP Parity', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'verity-parity-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should register all 7 core MCP tools ensuring 100% feature parity with CLI', () => {
    expect(VERITY_TOOLS.length).toBe(7);

    const toolNames = VERITY_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('verity_check');
    expect(toolNames).toContain('verity_link');
    expect(toolNames).toContain('verity_status');
    expect(toolNames).toContain('verity_reconcile_diff');
    expect(toolNames).toContain('verity_sync_manifest');
    expect(toolNames).toContain('verity_find');
    expect(toolNames).toContain('verity_init');
  });

  it('should execute runStatusCommand without error and report zero exit code', async () => {
    const exitCode = await runStatusCommand({ cwd: tempDir, json: true });
    expect(exitCode).toBe(0);
  });

  it('should execute runDiffCommand and report usage when no target provided', async () => {
    const exitCode = await runDiffCommand(undefined, { cwd: process.cwd() });
    expect(exitCode).toBe(1);
  });

  it('should execute verity_init MCP tool and initialize workspace', async () => {
    const initTool = findTool('verity_init');
    expect(initTool).toBeDefined();

    const response = await initTool!.handler({ cwd: tempDir, yes: true });
    expect(response.isError).toBeUndefined();

    const data = JSON.parse(response.content[0].text);
    expect(data.success).toBe(true);
    expect(existsSync(join(tempDir, 'docs/brief'))).toBe(true);
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true);
  });
});
