import { describe, expect, it } from 'bun:test';
import { createMcpServer } from '../src/mcp/server';
import { VERITY_TOOLS, findTool } from '../src/mcp/tools';

describe('Verity MCP Server & Tools', () => {
  it('should register all 5 core MCP tools', () => {
    expect(VERITY_TOOLS.length).toBe(5);

    const toolNames = VERITY_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('verity_check');
    expect(toolNames).toContain('verity_link');
    expect(toolNames).toContain('verity_status');
    expect(toolNames).toContain('verity_reconcile_diff');
    expect(toolNames).toContain('verity_sync_manifest');
  });

  it('should instantiate MCP Server without errors', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });

  it('should find individual tool definitions via findTool', () => {
    const checkTool = findTool('verity_check');
    expect(checkTool).toBeDefined();
    expect(checkTool?.inputSchema.type).toBe('object');

    const statusTool = findTool('verity_status');
    expect(statusTool).toBeDefined();

    const nonExistent = findTool('unknown_tool');
    expect(nonExistent).toBeUndefined();
  });

  it('should execute verity_status and return repository health statistics', async () => {
    const statusTool = findTool('verity_status')!;
    const response = await statusTool.handler({});

    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);

    const data = JSON.parse(response.content[0].text);
    expect(data.isGitRepository).toBe(true);
    expect(typeof data.totalAnchors).toBe('number');
    expect(data.totalAnchors).toBeGreaterThan(0);
    expect(data.headSha).toBeDefined();
  });

  it('should execute verity_check and return structured reports', async () => {
    const checkTool = findTool('verity_check')!;
    const response = await checkTool.handler({});

    expect(response.content).toBeDefined();
    const data = JSON.parse(response.content[0].text);

    expect(typeof data.total).toBe('number');
    expect(typeof data.staleCount).toBe('number');
    expect(Array.isArray(data.reports)).toBe(true);
  });

  it('should execute verity_sync_manifest and report success', async () => {
    const syncTool = findTool('verity_sync_manifest')!;
    const response = await syncTool.handler({});

    expect(response.content).toBeDefined();
    const data = JSON.parse(response.content[0].text);

    expect(data.success).toBe(true);
    expect(data.outputFile).toBe('docs/brief/INDEX.md');
    expect(typeof data.totalBriefs).toBe('number');
  });

  it('should execute verity_reconcile_diff for existing target file', async () => {
    const diffTool = findTool('verity_reconcile_diff')!;
    const response = await diffTool.handler({
      targetPath: 'src/cli/index.ts',
    });

    expect(response.content).toBeDefined();
    const data = JSON.parse(response.content[0].text);

    expect(data.targetPath).toBe('src/cli/index.ts');
    expect(data.headSha).toBeDefined();
    expect(typeof data.diff).toBe('string');
  });

  it('should handle errors gracefully when required arguments are missing', async () => {
    const linkTool = findTool('verity_link')!;
    const response = await linkTool.handler({
      specFilePath: 'non-existent.md',
      codeAnchors: ['src/unknown.ts'],
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Spec file not found');
  });
});
