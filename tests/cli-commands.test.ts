import { describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { ParserDispatcher } from '../src/core/parser/dispatcher';
import { FrontmatterAnchorHandler } from '../src/core/anchor/frontmatter';
import { InlineAnchorHandler } from '../src/core/anchor/inline';
import type { Anchor } from '../src/core/types';

describe('CLI Components & Dispatcher Integration', () => {
  const dispatcher = new ParserDispatcher();

  it('should dispatch to TypeScriptParser for .ts files', async () => {
    const tsCode = `export function add(a: number, b: number) { return a + b; }`;
    const result = await dispatcher.parse('sample.ts', tsCode, 'add');

    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('add');
    expect(result.fingerprint).toBeDefined();
  });

  it('should dispatch to VueSfcParser for .vue files', async () => {
    const vueCode = `
      <template><button @click="run">Click</button></template>
      <script setup>
      function run() { console.log("running"); }
      </script>
    `;
    const result = await dispatcher.parse('Button.vue', vueCode, 'run');

    expect(result.found).toBe(true);
    expect(result.rawMatchedContent).toContain('running');
  });

  it('should dispatch to FallbackParser for unknown extensions', async () => {
    const customConfig = `server_port = 8080\nenv = production`;
    const result = await dispatcher.parse('config.ini', customConfig);

    expect(result.found).toBe(true);
    expect(result.fingerprint.length).toBe(64);
  });

  it('should correctly serialize and parse frontmatter anchors', () => {
    const initialDoc = `# Sample Document\n\nSome explanation text.`;

    const updated = FrontmatterAnchorHandler.upsertAnchor(initialDoc, {
      targetPath: 'src/index.ts',
      symbol: 'start',
      provenance: {
        commitSha: 'abc1234',
        fingerprint: 'hash999',
      },
    });

    const anchors = FrontmatterAnchorHandler.extractAnchors('sample.md', updated);
    expect(anchors.length).toBe(1);
    expect(anchors[0].targetPath).toBe('src/index.ts');
    expect(anchors[0].symbol).toBe('start');
    expect(anchors[0].provenance.commitSha).toBe('abc1234');
  });

  it('should correctly parse inline @verity comment anchors', () => {
    const inlineTag = InlineAnchorHandler.formatInlineTag({
      targetPath: 'src/core/engine.ts',
      symbol: 'Engine',
      provenance: {
        commitSha: '1234567',
        fingerprint: 'f9a8b7c',
      },
    });

    const markdownWithInline = `
# Architecture Document

Here is our core engine:
${inlineTag}
Detailed notes on engine logic.
`;

    const anchors = InlineAnchorHandler.extractAnchors('sample.md', markdownWithInline);
    expect(anchors.length).toBe(1);
    expect(anchors[0].targetPath).toBe('src/core/engine.ts');
    expect(anchors[0].symbol).toBe('Engine');
    expect(anchors[0].provenance.commitSha).toBe('1234567');
  });

  it('should execute verity check via CLI binary with zero exit code', () => {
    const output = execSync('bun run src/cli/index.ts check --json', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
    expect(parsed.total).toBeGreaterThan(0);
    expect(typeof parsed.staleCount).toBe('number');
    expect(Array.isArray(parsed.reports)).toBe(true);
  });

  it('should support check --quick --sync-index and sync manifest', () => {
    const output = execSync('bun run src/cli/index.ts check --quick --sync-index', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(output).toBeDefined();
    expect(output).toContain('Manifest docs/brief/INDEX.md disinkronkan.');
  });
});

