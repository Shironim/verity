/**
 * Ported & adapted from: Veritas/strata-mcp/src/adapters/vue.ts & engine/splitter.ts
 * Dual-licensed under project conventions.
 * Purpose: Extract <script> and <script setup> blocks from Vue SFC to enable
 * symbol-level AST parsing without interference from HTML/template syntax.
 */

import { parse } from '@vue/compiler-sfc';
import type { CodeParser } from '../types';
import type { ParseResult, SymbolNode } from '../../types';
import { TypeScriptParser } from '../typescript';
import { FingerprintNormalizer } from '../../fingerprint/normalizer';

export class VueSfcParser implements CodeParser {
  readonly supportedExtensions = ['.vue'];
  private readonly tsParser = new TypeScriptParser();

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    const { descriptor } = parse(content, {
      filename: filePath,
      sourceMap: false,
      pad: false,
    });

    const scriptBlocks = [
      descriptor.script?.content,
      descriptor.scriptSetup?.content,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    // Jika tidak ada symbol spesifik, buat fingerprint dari seluruh script + template
    if (!targetSymbol) {
      const templateContent = descriptor.template?.content || '';
      const combined = scriptBlocks.join('\n') + '\n' + templateContent;
      const fingerprint = FingerprintNormalizer.hashNormalizedText(combined || content);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: combined,
      };
    }

    // Jika ada symbol yang dicari, telusuri script blocks
    for (const scriptContent of scriptBlocks) {
      const result = this.tsParser.parse(filePath, scriptContent, targetSymbol);
      if (result.found) {
        return result;
      }
    }

    return {
      filePath,
      targetSymbol,
      fingerprint: '',
      found: false,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const { descriptor } = parse(content, {
      filename: filePath,
      sourceMap: false,
      pad: false,
    });

    const scriptBlocks = [
      descriptor.script?.content,
      descriptor.scriptSetup?.content,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    const allSymbols: SymbolNode[] = [];
    for (const scriptContent of scriptBlocks) {
      const symbols = this.tsParser.findSymbols(filePath, scriptContent);
      allSymbols.push(...symbols);
    }

    return allSymbols;
  }
}
