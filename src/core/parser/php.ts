import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class PhpParser implements CodeParser {
  readonly supportedExtensions = ['.php'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // 1. Jika tidak ada target symbol, hash seluruh isi file (tanpa <?php / ?> wrapper trivia)
    if (!targetSymbol) {
      const cleaned = this.cleanPhpTags(content);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    // 2. Cek apakah targetSymbol berbentuk Class::method
    if (targetSymbol.includes('::')) {
      const [className, methodName] = targetSymbol.split('::');
      const classBlock = this.findClassBlock(content, className);
      if (classBlock) {
        const methodBlock = this.findMethodBlock(classBlock, methodName);
        if (methodBlock) {
          const fingerprint = FingerprintNormalizer.hashNormalizedText(methodBlock);
          return {
            filePath,
            targetSymbol,
            fingerprint,
            found: true,
            rawMatchedContent: methodBlock,
          };
        }
      }
      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    // 3. Cari sebagai method/function
    const methodBlock = this.findMethodBlock(content, targetSymbol);
    if (methodBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(methodBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: methodBlock,
      };
    }

    // 4. Cari sebagai class / interface / trait / enum
    const classBlock = this.findClassBlock(content, targetSymbol);
    if (classBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(classBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: classBlock,
      };
    }

    return {
      filePath,
      targetSymbol,
      fingerprint: '',
      found: false,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const symbols: SymbolNode[] = [];
    const lines = content.split('\n');

    // 1. Scan untuk Class / Interface / Trait / Enum
    const classRegex = /(?:abstract\s+|final\s+|readonly\s+)*(class|interface|trait|enum)\s+([A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(content)) !== null) {
      const kindStr = match[1];
      const name = match[2];
      const kind: SymbolKind = kindStr === 'interface' ? 'interface' : 'class';
      const block = this.extractBracedBlockSafe(content, match.index) || match[0];
      const startLine = this.getLineNumber(content, match.index);

      symbols.push({
        name,
        kind,
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    // 2. Scan untuk Methods & Functions
    const funcRegex = /(?:(?:public|protected|private|static|final|abstract)\s+)*function\s+(?:&)?([A-Za-z0-9_]+)\s*\(/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      const block = this.extractBracedBlockSafe(content, match.index) || match[0];
      const startLine = this.getLineNumber(content, match.index);

      symbols.push({
        name,
        kind: 'method',
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    return symbols;
  }

  private findMethodBlock(code: string, methodName: string): string | null {
    const escaped = this.escapeRegex(methodName);
    const regex = new RegExp(
      `(?:(?:public|protected|private|static|final|abstract)\\s+)*function\\s+(?:&)?${escaped}\\s*\\(`,
      'i'
    );
    const match = regex.exec(code);
    if (!match) return null;

    return this.extractBracedBlockSafe(code, match.index);
  }

  private findClassBlock(code: string, className: string): string | null {
    const escaped = this.escapeRegex(className);
    const regex = new RegExp(
      `(?:abstract\\s+|final\\s+|readonly\\s+)*(?:class|interface|trait|enum)\\s+${escaped}\\b`,
      'i'
    );
    const match = regex.exec(code);
    if (!match) return null;

    return this.extractBracedBlockSafe(code, match.index);
  }

  private extractBracedBlockSafe(code: string, startIndex: number): string | null {
    const openBrace = code.indexOf('{', startIndex);
    if (openBrace === -1) {
      // Mungkin interface/abstract method tanpa body: cari semicolon
      const semicolon = code.indexOf(';', startIndex);
      if (semicolon !== -1) {
        return code.slice(startIndex, semicolon + 1).trim();
      }
      return null;
    }

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = openBrace; i < code.length; i++) {
      const char = code[i];
      const prev = code[i - 1];

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (prev === '*' && char === '/') inBlockComment = false;
        continue;
      }
      if (inSingle) {
        if (char === "'" && prev !== '\\') inSingle = false;
        continue;
      }
      if (inDouble) {
        if (char === '"' && prev !== '\\') inDouble = false;
        continue;
      }

      if (char === '/' && code[i + 1] === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '#') {
        inLineComment = true;
        continue;
      }
      if (char === '/' && code[i + 1] === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (char === "'") {
        inSingle = true;
        continue;
      }
      if (char === '"') {
        inDouble = true;
        continue;
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return code.slice(startIndex, i + 1).trim();
        }
      }
    }

    return null;
  }

  private cleanPhpTags(text: string): string {
    return text
      .replace(/^<\?(?:php)?\s*/i, '')
      .replace(/\?>\s*$/i, '');
  }

  private getLineNumber(content: string, index: number): number {
    const lines = content.slice(0, index).split('\n');
    return lines.length;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
