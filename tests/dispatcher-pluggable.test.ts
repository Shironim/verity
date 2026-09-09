import { describe, expect, it } from 'bun:test';
import { ParserDispatcher } from '../src/core/parser/dispatcher';
import { FallbackParser } from '../src/core/parser/fallback';
import { TypeScriptParser } from '../src/core/parser/typescript';
import type { CodeParser } from '../src/core/parser/types';
import type { ParseResult } from '../src/core/types';

describe('ParserDispatcher (Pluggable Architecture)', () => {
  it('should initialize with all built-in parsers by default', () => {
    const dispatcher = new ParserDispatcher();
    const extensions = [
      'index.ts',
      'App.vue',
      'Page.astro',
      'index.php',
      'main.go',
      'script.py',
      'lib.rs',
      'Program.cs',
      'Service.java',
      'App.kt',
      'server.rb',
    ];

    for (const file of extensions) {
      const parser = dispatcher.getParserForFile(file);
      expect(parser instanceof FallbackParser).toBe(false);
      expect(parser.supportedExtensions.length).toBeGreaterThan(0);
    }
  });

  it('should return FallbackParser for unknown extensions', () => {
    const dispatcher = new ParserDispatcher();
    const parser = dispatcher.getParserForFile('data.xyz123');
    expect(parser instanceof FallbackParser).toBe(true);
  });

  it('should allow dynamic registration of custom parsers without modifying dispatcher.ts', async () => {
    const dispatcher = new ParserDispatcher();

    class CustomSqlParser implements CodeParser {
      readonly name = 'sql-custom';
      readonly supportedExtensions = ['.sql'];

      async parse(filePath: string, content: string, targetSymbol?: string): Promise<ParseResult> {
        return {
          filePath,
          targetSymbol,
          found: true,
          content: content.trim(),
          normalizedContent: content.trim().toLowerCase(),
        };
      }
    }

    // Before registration
    expect(dispatcher.getParserForFile('schema.sql') instanceof FallbackParser).toBe(true);

    // Register dynamically
    dispatcher.registerParser(new CustomSqlParser());

    // After registration
    const matched = dispatcher.getParserForFile('schema.sql');
    expect(matched instanceof CustomSqlParser).toBe(true);

    const result = await dispatcher.parse('schema.sql', 'CREATE TABLE users (id INT);');
    expect(result.found).toBe(true);
    expect(result.normalizedContent).toBe('create table users (id int);');
  });

  it('should allow overriding existing extensions with higher precedence', () => {
    const dispatcher = new ParserDispatcher();

    class CustomTsParser implements CodeParser {
      readonly supportedExtensions = ['.ts'];

      async parse(filePath: string, content: string): Promise<ParseResult> {
        return { filePath, found: true, content, normalizedContent: 'custom' };
      }
    }

    // Standard TS parser initially
    expect(dispatcher.getParserForFile('test.ts') instanceof TypeScriptParser).toBe(true);

    // Register override
    dispatcher.registerParser(new CustomTsParser());

    // Overridden
    expect(dispatcher.getParserForFile('test.ts') instanceof CustomTsParser).toBe(true);
  });

  it('should support custom parser list via constructor injection', () => {
    class IsolatedParser implements CodeParser {
      readonly supportedExtensions = ['.iso'];
      async parse(filePath: string, content: string): Promise<ParseResult> {
        return { filePath, found: true, content, normalizedContent: content };
      }
    }

    const isolatedDispatcher = new ParserDispatcher([new IsolatedParser()]);
    expect(isolatedDispatcher.getRegisteredParsers().length).toBe(1);
    expect(isolatedDispatcher.getParserForFile('file.iso') instanceof IsolatedParser).toBe(true);
    // Built-ins should not be in this isolated instance
    expect(isolatedDispatcher.getParserForFile('file.ts') instanceof FallbackParser).toBe(true);
  });
});
