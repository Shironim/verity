/**
 * Ported & adapted from: Veritas/strata-mcp/src/adapters/astro.ts & engine/astro-sfc.ts
 * Dual-licensed under project conventions.
 * Purpose: Extract frontmatter script block from Astro files to enable symbol-level AST parsing.
 */

import type { CodeParser } from '../types';
import type { ParseResult, SymbolNode } from '../../types';
import { TypeScriptParser } from '../typescript';
import { FingerprintNormalizer } from '../../fingerprint/normalizer';

export class AstroParser implements CodeParser {
  readonly supportedExtensions = ['.astro'];
  private readonly tsParser = new TypeScriptParser();

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    const scriptContent = this.extractFrontmatterScript(content);

    if (!targetSymbol) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(content);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    if (!scriptContent) {
      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    return this.tsParser.parse(filePath, scriptContent, targetSymbol);
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const scriptContent = this.extractFrontmatterScript(content);
    if (!scriptContent) return [];
    return this.tsParser.findSymbols(filePath, scriptContent);
  }

  private extractFrontmatterScript(content: string): string | null {
    // Astro script is enclosed in leading '---' fences
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? match[1] : null;
  }
}
