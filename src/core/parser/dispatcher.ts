import { extname } from 'node:path';
import type { CodeParser } from './types';
import type { ParseResult } from '../types';
import { TypeScriptParser } from './typescript';
import { VueSfcParser } from './mixed/vue';
import { AstroParser } from './mixed/astro';
import { PhpParser } from './php';
import { GoParser } from './go';
import { PythonParser } from './python';
import { RustParser } from './rust';
import { CSharpParser } from './csharp';
import { JvmParser } from './jvm';
import { RubyParser } from './ruby';
import { FallbackParser } from './fallback';

export class ParserDispatcher {
  private static readonly defaultParsers: CodeParser[] = [
    new VueSfcParser(),
    new AstroParser(),
    new TypeScriptParser(),
    new PhpParser(),
    new GoParser(),
    new PythonParser(),
    new RustParser(),
    new CSharpParser(),
    new JvmParser(),
    new RubyParser(),
  ];

  private readonly parsers: CodeParser[];
  private readonly fallbackParser = new FallbackParser();

  constructor(initialParsers?: CodeParser[]) {
    this.parsers = initialParsers ? [...initialParsers] : [...ParserDispatcher.defaultParsers];
  }

  /**
   * Registers a new custom or external parser dynamically into the dispatcher instance.
   * Prepends the parser so custom registrations can take precedence.
   */
  registerParser(parser: CodeParser): this {
    this.parsers.unshift(parser);
    return this;
  }

  /**
   * Registers a parser globally across all new ParserDispatcher instances.
   */
  static registerGlobalParser(parser: CodeParser): void {
    ParserDispatcher.defaultParsers.unshift(parser);
  }

  /**
   * Returns a read-only list of currently registered parsers.
   */
  getRegisteredParsers(): readonly CodeParser[] {
    return this.parsers;
  }

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

