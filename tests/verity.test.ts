import { describe, expect, it } from 'bun:test';
import { FingerprintNormalizer } from '../src/core/fingerprint/normalizer';
import { TypeScriptParser } from '../src/core/parser/typescript';
import { VueSfcParser } from '../src/core/parser/mixed/vue';
import { FrontmatterAnchorHandler } from '../src/core/anchor/frontmatter';
import { InlineAnchorHandler } from '../src/core/anchor/inline';

describe('FingerprintNormalizer', () => {
  it('should generate identical fingerprints for code with different whitespace & formatting', () => {
    const codeA = `
      export function login(user: string, pass: string): boolean {
        const isValid = user.length > 0 && pass.length > 0;
        return isValid;
      }
    `;

    const codeB = `
      // Some cosmetic comment
      export function login( user: string, pass: string ): boolean
      {
        const isValid = user.length > 0 && pass.length > 0 ;
        return isValid ;
      }
    `;

    const hashA = FingerprintNormalizer.hashNormalizedText(codeA);
    const hashB = FingerprintNormalizer.hashNormalizedText(codeB);

    expect(hashA).toBe(hashB);
  });

  it('should generate different fingerprints when logic changes', () => {
    const codeA = `function sum(a: number, b: number) { return a + b; }`;
    const codeB = `function sum(a: number, b: number) { return a - b; }`;

    const hashA = FingerprintNormalizer.hashNormalizedText(codeA);
    const hashB = FingerprintNormalizer.hashNormalizedText(codeB);

    expect(hashA).not.toBe(hashB);
  });
});

describe('TypeScriptParser', () => {
  const tsParser = new TypeScriptParser();

  it('should find specific symbol in TypeScript file', () => {
    const code = `
      export const API_URL = 'https://example.com';

      export function calculateTotal(items: number[]): number {
        return items.reduce((a, b) => a + b, 0);
      }

      export class UserService {
        findUser(id: string) { return { id }; }
      }
    `;

    const result = tsParser.parse('sample.ts', code, 'calculateTotal');
    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('calculateTotal');
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64);
  });

  it('should return found=false for non-existent symbol', () => {
    const code = `export function existing() {}`;
    const result = tsParser.parse('sample.ts', code, 'nonExistent');
    expect(result.found).toBe(false);
  });
});

describe('VueSfcParser', () => {
  const vueParser = new VueSfcParser();

  it('should extract script block and find symbol in Vue SFC', () => {
    const sfc = `
      <template>
        <button @click="handleClick">Click Me</button>
      </template>

      <script setup lang="ts">
      import { ref } from 'vue';

      export function handleClick() {
        console.log('clicked');
      }
      </script>

      <style scoped>
      button { color: red; }
      </style>
    `;

    const result = vueParser.parse('Button.vue', sfc, 'handleClick');
    expect(result.found).toBe(true);
    expect(result.targetSymbol).toBe('handleClick');
    expect(result.fingerprint.length).toBe(64);
  });
});

describe('Anchor Handlers', () => {
  it('should upsert and extract frontmatter anchors', () => {
    const initialDoc = '# Feature Auth\n\nThis document describes authentication.';
    const updated = FrontmatterAnchorHandler.upsertAnchor(initialDoc, {
      targetPath: 'src/auth.ts',
      symbol: 'login',
      provenance: {
        commitSha: 'a1b2c3d4e5f6',
        fingerprint: '1234567890abcdef',
      },
    });

    const anchors = FrontmatterAnchorHandler.extractAnchors('docs/auth.md', updated);
    expect(anchors.length).toBe(1);
    expect(anchors[0].targetPath).toBe('src/auth.ts');
    expect(anchors[0].symbol).toBe('login');
    expect(anchors[0].provenance.commitSha).toBe('a1b2c3d4e5f6');
  });

  it('should format and extract inline anchors', () => {
    const inlineTag = InlineAnchorHandler.formatInlineTag({
      targetPath: 'src/user.ts',
      symbol: 'getUser',
      provenance: {
        commitSha: 'commit123',
        fingerprint: 'fp123456',
      },
    });

    const doc = `# User Management\n\n${inlineTag}\nSome narrative text.`;
    const anchors = InlineAnchorHandler.extractAnchors('docs/user.md', doc);

    expect(anchors.length).toBe(1);
    expect(anchors[0].targetPath).toBe('src/user.ts');
    expect(anchors[0].symbol).toBe('getUser');
    expect(anchors[0].provenance.commitSha).toBe('commit123');
    expect(anchors[0].kind).toBe('inline');
  });
});
