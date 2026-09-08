import { extname } from 'node:path';
import type { CodeParser } from './types';
import type { ParseResult } from '../types';
import { TypeScriptParser } from './typescript';
import { VueSfcParser } from './mixed/vue';
import { AstroParser } from './mixed/astro';
import { FallbackParser } from './fallback';

export class ParserDispatcher {
  private readonly parsers: CodeParser[] = [
    new VueSfcParser(),
    new AstroParser(),
    new TypeScriptParser(),
  ];

  private readonly fallbackParser = new FallbackParser();

  getParserForFile(filePath: string): CodeParser {
    const ext = extname(filePath).toLowerCase();
    const matched = this.parsers.find((p) => p.supportedExtensions.includes(ext));
    return matched || this.fallbackParser;
  }

  async parse(filePath: string, content: string, targetSymbol?: string): Promise<ParseResult> {
    const parser = this.getParserForFile(filePath);
    return await parser.parse(filePath, content, targetSymbol);
  }
}
