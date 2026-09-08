/**
 * Ported & adapted from: Veritas/strata-mcp/src/adapters/vue.ts & engine/splitter.ts
 * Dual-licensed under project conventions.
 * Purpose: Extract <script> and <script setup> blocks from Vue SFC to enable
 * symbol-level AST parsing without interference from HTML/template syntax.
 */

import { parse } from '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';
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

    const templateContent = descriptor.template?.content || '';

    // Jika tidak ada symbol spesifik, buat fingerprint dari seluruh script + template
    if (!targetSymbol) {
      const combined = scriptBlocks.join('\n') + '\n' + templateContent;
      const fingerprint = FingerprintNormalizer.hashNormalizedText(combined || content);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: combined,
      };
    }

    // Ekstraksi khusus defineProps / props
    if (targetSymbol === 'props' || targetSymbol === 'defineProps') {
      const propsMatch = this.extractPropsBlock(scriptBlocks);
      if (propsMatch) {
        return {
          filePath,
          targetSymbol,
          fingerprint: FingerprintNormalizer.hashNormalizedText(propsMatch),
          found: true,
          rawMatchedContent: propsMatch,
        };
      }
    }

    // Ekstraksi khusus defineEmits / emits
    if (targetSymbol === 'emits' || targetSymbol === 'defineEmits') {
      const emitsMatch = this.extractEmitsBlock(scriptBlocks);
      if (emitsMatch) {
        return {
          filePath,
          targetSymbol,
          fingerprint: FingerprintNormalizer.hashNormalizedText(emitsMatch),
          found: true,
          rawMatchedContent: emitsMatch,
        };
      }
    }

    // Ekstraksi event bindings template (@click, v-on:submit, atau seluruh 'events')
    if (targetSymbol === 'events' || targetSymbol.startsWith('@') || targetSymbol.startsWith('v-on:')) {
      const eventsMatch = this.extractTemplateEvents(templateContent, targetSymbol);
      if (eventsMatch) {
        return {
          filePath,
          targetSymbol,
          fingerprint: FingerprintNormalizer.hashNormalizedText(eventsMatch),
          found: true,
          rawMatchedContent: eventsMatch,
        };
      }
    }

    // Jika ada symbol yang dicari, telusuri script blocks dengan TypeScriptParser
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

    // Tambahkan defineProps / defineEmits jika terdeteksi
    const propsMatch = this.extractPropsBlock(scriptBlocks);
    if (propsMatch) {
      allSymbols.push({
        name: 'defineProps',
        kind: 'variable',
        rawText: propsMatch,
        normalizedTokens: [propsMatch],
        startLine: 1,
        endLine: 1,
      });
    }

    const emitsMatch = this.extractEmitsBlock(scriptBlocks);
    if (emitsMatch) {
      allSymbols.push({
        name: 'defineEmits',
        kind: 'variable',
        rawText: emitsMatch,
        normalizedTokens: [emitsMatch],
        startLine: 1,
        endLine: 1,
      });
    }

    // Tambahkan event bindings dari template
    if (descriptor.template?.content) {
      const eventNames = this.getUniqueTemplateEventNames(descriptor.template.content);
      for (const eventName of eventNames) {
        allSymbols.push({
          name: `@${eventName}`,
          kind: 'method',
          rawText: `@${eventName}`,
          normalizedTokens: [`@${eventName}`],
          startLine: 1,
          endLine: 1,
        });
      }
    }

    return allSymbols;
  }

  private extractPropsBlock(scriptBlocks: string[]): string | null {
    const propPattern = /(?:const\s+\w+\s*=\s*)?(?:withDefaults\s*\(\s*)?defineProps(?:<[\s\S]*?>)?\s*\([\s\S]*?\)(?:\s*,\s*\{[\s\S]*?\}\s*\))?|props:\s*(?:\{[\s\S]*?\}|\[[\s\S]*?\])/;
    for (const block of scriptBlocks) {
      const match = block.match(propPattern);
      if (match) {
        return match[0].trim();
      }
    }
    return null;
  }

  private extractEmitsBlock(scriptBlocks: string[]): string | null {
    const emitPattern = /(?:const\s+\w+\s*=\s*)?defineEmits(?:<[\s\S]*?>)?\s*\([\s\S]*?\)|emits:\s*(?:\{[\s\S]*?\}|\[[\s\S]*?\])/;
    for (const block of scriptBlocks) {
      const match = block.match(emitPattern);
      if (match) {
        return match[0].trim();
      }
    }
    return null;
  }

  private extractTemplateEvents(templateContent: string, targetSymbol: string): string | null {
    if (!templateContent.trim()) return null;

    const eventRegex = /(?:@|v-on:)([a-zA-Z0-9_-]+)(?:\.[a-zA-Z0-9_-]+)*="([^"]*)"/g;
    const matches: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = eventRegex.exec(templateContent)) !== null) {
      const eventName = match[1];
      const handlerExpr = match[2];
      const fullBinding = `@${eventName}="${handlerExpr}"`;

      if (targetSymbol === 'events') {
        matches.push(fullBinding);
      } else {
        const cleanTarget = targetSymbol.replace(/^(@|v-on:)/, '');
        if (eventName === cleanTarget) {
          matches.push(fullBinding);
        }
      }
    }

    if (matches.length === 0) return null;
    return matches.sort().join('\n');
  }

  private getUniqueTemplateEventNames(templateContent: string): string[] {
    const eventRegex = /(?:@|v-on:)([a-zA-Z0-9_-]+)/g;
    const names = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = eventRegex.exec(templateContent)) !== null) {
      names.add(match[1]);
    }
    return Array.from(names).sort();
  }
}
