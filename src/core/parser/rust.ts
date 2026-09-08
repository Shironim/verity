import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class RustParser implements CodeParser {
  readonly supportedExtensions = ['.rs'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // 1. Jika tidak ada target symbol, normalisasi seluruh isi file
    if (!targetSymbol) {
      const cleaned = content.trim();
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    // 2. Format Scoping Type::method atau Type.method
    if (targetSymbol.includes('::') || targetSymbol.includes('.')) {
      const parts = targetSymbol.includes('::')
        ? targetSymbol.split('::')
        : targetSymbol.split('.');
      const [typeName, methodName] = parts;
      const methodBlock = this.findImplMethodBlock(content, typeName, methodName);
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

      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    // 3. Cari sebagai method di dalam impl manapun
    const implMethod = this.findMethodInAnyImpl(content, targetSymbol);
    if (implMethod) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(implMethod);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: implMethod,
      };
    }

    // 4. Cari sebagai standalone function
    const fnBlock = this.findFunctionBlock(content, targetSymbol);
    if (fnBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(fnBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: fnBlock,
      };
    }

    // 5. Cari sebagai struct, enum, atau trait
    const itemBlock = this.findStructEnumOrTraitBlock(content, targetSymbol);
    if (itemBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(itemBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: itemBlock,
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

    // 1. Scan standalone & impl functions: fn name(...)
    const fnRegex = /(?:^|\n)([ \t]*(?:#\[[^\]]*\][ \t]*\n[ \t]*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?(?:extern\s*(?:"[^"]*")?\s*)?fn\s+([A-Za-z0-9_]+))/g;
    let match: RegExpExecArray | null;

    while ((match = fnRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const name = match[2];
      const matchIndex = match.index + (match[0].length - fullHeader.length);
      const block = this.extractBracedBlockSafe(content, matchIndex) || fullHeader;
      const startLine = this.getLineNumber(content, matchIndex);

      symbols.push({
        name,
        kind: 'function',
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    // 2. Scan struct, enum, trait
    const typeRegex = /(?:^|\n)([ \t]*(?:#\[[^\]]*\][ \t]*\n[ \t]*)*(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait)\s+([A-Za-z0-9_]+))/g;
    while ((match = typeRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const kindStr = match[2];
      const name = match[3];
      const matchIndex = match.index + (match[0].length - fullHeader.length);

      let kind: SymbolKind = 'class';
      if (kindStr === 'struct') kind = 'class';
      else if (kindStr === 'enum') kind = 'type';
      else if (kindStr === 'trait') kind = 'interface';

      const block = this.extractTypeBlockSafe(content, matchIndex) || fullHeader;
      const startLine = this.getLineNumber(content, matchIndex);

      symbols.push({
        name,
        kind,
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    return symbols;
  }

  private findFunctionBlock(code: string, name: string): string | null {
    const escaped = this.escapeRegex(name);
    const regex = new RegExp(
      `(?:^|\\n)([ \\t]*(?:#\\[[^\\]]*\\][ \\t]*\\n[ \\t]*)*(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?(?:const\\s+)?(?:unsafe\\s+)?(?:extern\\s*(?:"[^"]*")?\\s*)?fn\\s+${escaped}(?:<[^>]*>)?\\s*\\()`,
      'g'
    );
    const match = regex.exec(code);
    if (!match) return null;

    const fullHeader = match[1];
    const startIndex = match.index + (match[0].length - fullHeader.length);
    return this.extractBracedBlockSafe(code, startIndex);
  }

  private findStructEnumOrTraitBlock(code: string, name: string): string | null {
    const escaped = this.escapeRegex(name);
    const regex = new RegExp(
      `(?:^|\\n)([ \\t]*(?:#\\[[^\\]]*\\][ \\t]*\\n[ \\t]*)*(?:pub(?:\\([^)]*\\))?\\s+)?(?:struct|enum|trait)\\s+${escaped}(?:<[^>]*>)?\\s*)`,
      'g'
    );
    const match = regex.exec(code);
    if (!match) return null;

    const fullHeader = match[1];
    const startIndex = match.index + (match[0].length - fullHeader.length);
    return this.extractTypeBlockSafe(code, startIndex);
  }

  private findImplMethodBlock(code: string, typeName: string, methodName: string): string | null {
    const escapedType = this.escapeRegex(typeName);
    const escapedMethod = this.escapeRegex(methodName);

    // Cari impl [Trait for] TypeName
    const implRegex = new RegExp(
      `impl(?:<[^>]*>)?\\s*(?:[A-Za-z0-9_:]+(?:<[^>]*>)?\\s+for\\s+)?${escapedType}(?:<[^>]*>)?(?:\\s+where\\s+[^{]*)?\\s*\\{`,
      'g'
    );

    let implMatch: RegExpExecArray | null;
    while ((implMatch = implRegex.exec(code)) !== null) {
      const implBlock = this.extractBracedBlockSafe(code, implMatch.index);
      if (!implBlock) continue;

      // Cari method di dalam blok impl ini
      const methodRegex = new RegExp(
        `(?:^|\\n)([ \\t]*(?:#\\[[^\\]]*\\][ \\t]*\\n[ \\t]*)*(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?(?:const\\s+)?(?:unsafe\\s+)?fn\\s+${escapedMethod}(?:<[^>]*>)?\\s*\\()`,
        'g'
      );
      const methodMatch = methodRegex.exec(implBlock);
      if (methodMatch) {
        const fullHeader = methodMatch[1];
        const methodStart = methodMatch.index + (methodMatch[0].length - fullHeader.length);
        return this.extractBracedBlockSafe(implBlock, methodStart);
      }
    }

    return null;
  }

  private findMethodInAnyImpl(code: string, methodName: string): string | null {
    const escapedMethod = this.escapeRegex(methodName);
    const implRegex = /impl(?:<[^>]*>)?\s*(?:[A-Za-z0-9_:]+(?:<[^>]*>)?\s+for\s+)?[A-Za-z0-9_:]+(?:<[^>]*>)?(?:\s+where\s+[^{]*)?\s*\{/g;

    let implMatch: RegExpExecArray | null;
    while ((implMatch = implRegex.exec(code)) !== null) {
      const implBlock = this.extractBracedBlockSafe(code, implMatch.index);
      if (!implBlock) continue;

      const methodRegex = new RegExp(
        `(?:^|\\n)([ \\t]*(?:#\\[[^\\]]*\\][ \\t]*\\n[ \\t]*)*(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?(?:const\\s+)?(?:unsafe\\s+)?fn\\s+${escapedMethod}(?:<[^>]*>)?\\s*\\()`,
        'g'
      );
      const methodMatch = methodRegex.exec(implBlock);
      if (methodMatch) {
        const fullHeader = methodMatch[1];
        const methodStart = methodMatch.index + (methodMatch[0].length - fullHeader.length);
        return this.extractBracedBlockSafe(implBlock, methodStart);
      }
    }

    return null;
  }

  private extractTypeBlockSafe(code: string, startIndex: number): string | null {
    const openBrace = code.indexOf('{', startIndex);
    const semicolon = code.indexOf(';', startIndex);

    // Tuple struct atau type alias tanpa kurung kurawal: struct Foo(u32, u32);
    if (semicolon !== -1 && (openBrace === -1 || semicolon < openBrace)) {
      return code.slice(startIndex, semicolon + 1).trim();
    }

    if (openBrace === -1) {
      return null;
    }

    return this.extractBracedBlockSafe(code, startIndex);
  }

  private extractBracedBlockSafe(code: string, startIndex: number): string | null {
    const openBrace = code.indexOf('{', startIndex);
    if (openBrace === -1) {
      return null;
    }

    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inRawString = false;
    let rawStringHashes = 0;
    let inLineComment = false;
    let blockCommentDepth = 0;

    for (let i = openBrace; i < code.length; i++) {
      const char = code[i];
      const prev = code[i - 1];

      // Komentar satu baris
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }

      // Komentar blok (Rust mendukung nested /* /* ... */ */)
      if (blockCommentDepth > 0) {
        if (char === '/' && code[i + 1] === '*') {
          blockCommentDepth++;
          i++;
        } else if (char === '*' && code[i + 1] === '/') {
          blockCommentDepth--;
          i++;
        }
        continue;
      }

      // Raw string literal r#"..."# atau r"..."
      if (inRawString) {
        if (char === '"') {
          let hashes = 0;
          while (code[i + 1 + hashes] === '#') {
            hashes++;
          }
          if (hashes >= rawStringHashes) {
            inRawString = false;
            i += hashes;
          }
        }
        continue;
      }

      // String literal biasa
      if (inDoubleQuote) {
        if (char === '"' && prev !== '\\') inDoubleQuote = false;
        continue;
      }

      // Char literal 'c'
      if (inSingleQuote) {
        if (char === "'" && prev !== '\\') inSingleQuote = false;
        continue;
      }

      // Deteksi awal komentar atau string
      if (char === '/' && code[i + 1] === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && code[i + 1] === '*') {
        blockCommentDepth = 1;
        i++;
        continue;
      }

      // Deteksi raw string: r"..." atau r#"..."#
      if ((char === 'r' || (char === 'b' && code[i + 1] === 'r')) && (code[i + 1] === '"' || code[i + 1] === '#' || code[i + 2] === '"' || code[i + 2] === '#')) {
        let scanIdx = char === 'b' ? i + 2 : i + 1;
        let hashes = 0;
        while (code[scanIdx] === '#') {
          hashes++;
          scanIdx++;
        }
        if (code[scanIdx] === '"') {
          inRawString = true;
          rawStringHashes = hashes;
          i = scanIdx;
          continue;
        }
      }

      // Deteksi byte string b"..." atau normal string "..."
      if (char === '"' || (char === 'b' && code[i + 1] === '"')) {
        inDoubleQuote = true;
        if (char === 'b') i++;
        continue;
      }

      // Deteksi char literal: 'a', '\n' (pastikan bukan lifetime 'a atau 'static)
      if (char === "'" && (code[i + 2] === "'" || (code[i + 1] === '\\' && code[i + 3] === "'"))) {
        inSingleQuote = true;
        continue;
      }

      // Hitung kedalaman kurung kurawal
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

  private getLineNumber(content: string, index: number): number {
    const lines = content.slice(0, index).split('\n');
    return lines.length;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
