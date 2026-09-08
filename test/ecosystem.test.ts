import { describe, expect, it } from 'bun:test';
import { updateMarkdownProvenanceSection } from '../src/cli/commands/link';
import { BriefManifestGenerator } from '../src/core/anchor/manifest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Ecosystem Integration & Provenance Sync', () => {
  it('should inject ## Provenance section when it does not exist', () => {
    const markdown = `# Feature Brief\n\nSome overview content.`;
    const updated = updateMarkdownProvenanceSection(
      markdown,
      'abc1234567890',
      ['src/auth.ts#login', 'src/components/Login.vue#submit']
    );

    expect(updated).toContain('## Provenance');
    expect(updated).toContain('- **Completion Commit**: `abc1234567890`');
    expect(updated).toContain('- `src/auth.ts#login`');
    expect(updated).toContain('- `src/components/Login.vue#submit`');
  });

  it('should update existing ## Provenance section cleanly without duplicating', () => {
    const markdown = `# Feature Brief\n\nSome content.\n\n## Provenance\n- **Completion Commit**: \`old_sha\`\n- **Anchors**:\n  - \`src/old.ts\`\n\n## Next Steps\n- Step 1`;
    const updated = updateMarkdownProvenanceSection(
      markdown,
      'new_sha_123',
      ['src/new.ts#handler']
    );

    expect(updated).toContain('## Provenance');
    expect(updated).toContain('- **Completion Commit**: `new_sha_123`');
    expect(updated).toContain('- `src/new.ts#handler`');
    expect(updated).not.toContain('old_sha');
    expect(updated).toContain('## Next Steps');
  });

  it('should generate docs/brief/INDEX.md manifest successfully', async () => {
    const generator = new BriefManifestGenerator(process.cwd());
    const result = await generator.generateAndSync();

    expect(result.total).toBeGreaterThan(0);

    const indexPath = join(process.cwd(), 'docs/brief/INDEX.md');
    expect(existsSync(indexPath)).toBe(true);

    const indexContent = readFileSync(indexPath, 'utf8');
    expect(indexContent).toContain('# Brief Manifest Index');
    expect(indexContent).toContain('| Brief | Kategori | Status | Anchors | Ringkasan |');
  });
});
