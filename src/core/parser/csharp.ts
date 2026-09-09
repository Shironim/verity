import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class CSharpParser implements CodeParser {
  readonly supportedExtensions = ['.cs'];

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

    // 2. Format Scoping Type::member atau Type.member
    if (targetSymbol.includes('::') || targetSymbol.includes('.')) {
      const isDoubleColon = targetSymbol.includes('::');
      const separator = isDoubleColon ? '::' : '.';
      const lastSepIndex = targetSymbol.lastIndexOf(separator);
      const rawTypeName = targetSymbol.slice(0, lastSepIndex);
      const memberName = targetSymbol.slice(lastSepIndex + separator.length);

      // Handle namespace in typeName, e.g. App.Controllers.UsersController -> UsersController
      const typeName = rawTypeName.includes('.')
        ? rawTypeName.slice(rawTypeName.lastIndexOf('.') + 1)
        : rawTypeName;

      const typeBlock = this.findTypeBlock(content, typeName);
      if (typeBlock) {
        // Cari method/constructor di dalam typeBlock
        const memberBlock = this.findMemberInCode(typeBlock, memberName);
        if (memberBlock) {
          const fingerprint = FingerprintNormalizer.hashNormalizedText(memberBlock);
          return {
            filePath,
            targetSymbol,
            fingerprint,
            found: true,
            rawMatchedContent: memberBlock,
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

    // 3. Cari sebagai Type (class, record, struct, interface, enum)
    const typeBlock = this.findTypeBlock(content, targetSymbol);
    if (typeBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(typeBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: typeBlock,
      };
    }

    // 4. Cari sebagai method/constructor di tipe manapun
    const memberBlock = this.findMemberInCode(content, targetSymbol);
    if (memberBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(memberBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: memberBlock,
      };
    }

    // 5. Simbol tidak ditemukan
    return {
      filePath,
      targetSymbol,
      fingerprint: '',
      found: false,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const symbols: SymbolNode[] = [];

    // 1. Scan Types: class, record, struct, interface, enum
    const typeRegex =
      /(?:^|\n)[ \t]*((?:(?:public|private|protected|internal|static|abstract|sealed|partial|readonly|ref)\s+)*(class|record(?:\s+(?:class|struct))?|struct|interface|enum)\s+([A-Za-z0-9_]+))/g;

    let match: RegExpExecArray | null;
    while ((match = typeRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const kindStr = match[2];
      const name = match[3];
      const declIndex = match.index + (match[0].length - fullHeader.length);

      let kind: SymbolKind = 'class';
      if (kindStr.startsWith('record')) kind = 'class';
      else if (kindStr === 'struct') kind = 'class';
      else if (kindStr === 'interface') kind = 'interface';
      else if (kindStr === 'enum') kind = 'type';

      const startIndex = this.findDeclarationStartIndex(content, declIndex);
      const block = this.extractMemberBlockSafe(content, startIndex) || fullHeader;
      const startLine = this.getLineNumber(content, startIndex);

      symbols.push({
        name,
        kind,
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    // 2. Scan Methods, Constructors, and Properties
    const methodRegex =
      /(?:^|\n)[ \t]*((?:(?:public|private|protected|internal|static|async|virtual|override|sealed|abstract|extern|new|partial|readonly)\s+)+(?:[A-Za-z0-9_.,<>[\]?]+\s+)?([A-Za-z0-9_]+)(?:<[^>]*>)?\s*\([^)]*\))/g;

    while ((match = methodRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const name = match[2];

      // Abaikan keyword control flow jika tidak sengaja tertangkap
      if (['if', 'for', 'foreach', 'while', 'switch', 'catch', 'lock', 'using'].includes(name)) {
        continue;
      }

      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(content, declIndex);
      const block = this.extractMemberBlockSafe(content, startIndex) || fullHeader;
      const startLine = this.getLineNumber(content, startIndex);

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

  /**
   * Mencari blok definisi tipe (class, record, struct, interface, enum).
   */
  private findTypeBlock(code: string, typeName: string): string | null {
    const escaped = this.escapeRegex(typeName);
    const regex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|internal|static|abstract|sealed|partial|readonly|ref)\\s+)*(?:class|record(?:\\s+(?:class|struct))?|struct|interface|enum)\\s+${escaped}(?:<[^>]*>)?(?:\\s*\\([^)]*\\))?[^{;]*)`,
      'g'
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex);
      if (block) return block;
    }

    return null;
  }

  /**
   * Mencari blok method, constructor, atau property di dalam potongan kode C#.
   */
  private findMemberInCode(code: string, memberName: string): string | null {
    const escaped = this.escapeRegex(memberName);

    // 1. Cek Method atau Constructor: modifiers + optional return type + memberName(...)
    const methodRegex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|internal|static|async|virtual|override|sealed|abstract|extern|new|partial|readonly)\\s+)*(?:[A-Za-z0-9_.,<>\\[\\]?]+\\s+)?${escaped}(?:<[^>]*>)?\\s*\\([\\s\\S]*?\\)\\s*(?::\\s*(?:base|this)\\s*\\([\\s\\S]*?\\)\\s*)?(?:where\\s+[^{;=>]+)?)`,
      'g'
    );

    let match: RegExpExecArray | null;
    while ((match = methodRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex);
      if (block) return block;
    }

    // 2. Cek Property: modifiers + Type + memberName { get; set; } atau => ...;
    const propRegex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|internal|static|virtual|override|sealed|abstract|extern|new|partial|readonly|required)\\s+)+[A-Za-z0-9_.,<>\\[\\]?]+\\s+${escaped}\\s*(?:\\{|=>))`,
      'g'
    );

    while ((match = propRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex);
      if (block) return block;
    }

    return null;
  }

  /**
   * Menelusuri ke belakang untuk menemukan awal deklarasi termasuk atribut C# ([Attribute]).
   */
  private findDeclarationStartIndex(code: string, declIndex: number): number {
    let idx = declIndex - 1;
    let lastValidStart = declIndex;

    while (idx >= 0) {
      const ch = code[idx];

      // Lewati whitespace & newline
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        idx--;
        continue;
      }

      // Deteksi akhir block comment: */
      if (ch === '/' && idx > 0 && code[idx - 1] === '*') {
        let commentIdx = idx - 2;
        while (commentIdx >= 1 && !(code[commentIdx - 1] === '/' && code[commentIdx] === '*')) {
          commentIdx--;
        }
        idx = commentIdx - 2;
        continue;
      }

      // Deteksi penutup atribut C#: ]
      if (ch === ']') {
        const openBracketIdx = this.findMatchingBracketBackward(code, idx);
        if (openBracketIdx !== -1) {
          lastValidStart = openBracketIdx;
          idx = openBracketIdx - 1;
          continue;
        }
      }

      // Deteksi komentar baris: // atau ///
      const lineStart = code.lastIndexOf('\n', idx) + 1;
      const lineText = code.slice(lineStart, idx + 1).trim();
      if (lineText.startsWith('//')) {
        idx = lineStart - 1;
        continue;
      }

      // Jika karakter lain (e.g. semicolon atau kurung kurawal), berhenti
      break;
    }

    return lastValidStart;
  }

  /**
   * Mencari pasangan '[' dari ']' dengan mengabaikan string dan char literals.
   */
  private findMatchingBracketBackward(code: string, closeIndex: number): number {
    let depth = 0;
    let inString = false;
    let inChar = false;

    for (let i = closeIndex; i >= 0; i--) {
      const ch = code[i];
      const prev = i > 0 ? code[i - 1] : '';

      // Abaikan escaped quotes di dalam string
      if (ch === '"' && prev !== '\\') {
        inString = !inString;
        continue;
      }

      if (ch === "'" && prev !== '\\') {
        inChar = !inChar;
        continue;
      }

      if (inString || inChar) {
        continue;
      }

      if (ch === ']') {
        depth++;
      } else if (ch === '[') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Mengekstrak blok member C# secara aman:
   * - Mendukung braced blocks { ... }
   * - Mendukung expression-bodied members => ...;
   * - Mendukung positional records / abstract members ...;
   */
  private extractMemberBlockSafe(code: string, startIndex: number): string | null {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inVerbatimString = false;
    let inRawString = false;
    let rawStringQuotes = 0;
    let inLineComment = false;
    let inBlockComment = false;

    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let hasEncounteredOpenBrace = false;
    let isExpressionBodied = false;

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i];
      const next = i + 1 < code.length ? code[i + 1] : '';
      const prev = i > 0 ? code[i - 1] : '';

      // 1. Keluar dari Line Comment
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }

      // 2. Keluar dari Block Comment
      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      // 3. Keluar dari Raw String Literal (C# 11: """...""")
      if (inRawString) {
        if (char === '"') {
          let count = 0;
          let tempIdx = i;
          while (tempIdx < code.length && code[tempIdx] === '"') {
            count++;
            tempIdx++;
          }
          if (count >= rawStringQuotes) {
            inRawString = false;
            i = tempIdx - 1;
          }
        }
        continue;
      }

      // 4. Keluar dari Verbatim String (@"..." di mana "" adalah escape quote)
      if (inVerbatimString) {
        if (char === '"') {
          if (next === '"') {
            i++; // skip escaped double quote ""
          } else {
            inVerbatimString = false;
          }
        }
        continue;
      }

      // 5. Keluar dari Regular Double Quote
      if (inDoubleQuote) {
        if (char === '"' && prev !== '\\') {
          inDoubleQuote = false;
        }
        continue;
      }

      // 6. Keluar dari Single Quote Char
      if (inSingleQuote) {
        if (char === "'" && prev !== '\\') {
          inSingleQuote = false;
        }
        continue;
      }

      // 7. Deteksi Awal Komentar
      if (char === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      // 8. Deteksi Awal Raw String Literal: """
      if (char === '"' && next === '"' && i + 2 < code.length && code[i + 2] === '"') {
        let count = 0;
        let tempIdx = i;
        while (tempIdx < code.length && code[tempIdx] === '"') {
          count++;
          tempIdx++;
        }
        inRawString = true;
        rawStringQuotes = count;
        i = tempIdx - 1;
        continue;
      }

      // 9. Deteksi Awal Verbatim String: @"..." atau $@"...
      if ((char === '@' && next === '"') || (char === '$' && next === '@' && i + 2 < code.length && code[i + 2] === '"')) {
        inVerbatimString = true;
        i = char === '$' ? i + 2 : i + 1;
        continue;
      }

      // 10. Deteksi Regular String atau Interpolated String
      if (char === '"' || (char === '$' && next === '"')) {
        inDoubleQuote = true;
        if (char === '$') i++;
        continue;
      }

      // 11. Deteksi Char Literal
      if (char === "'" && (code[i + 2] === "'" || (next === '\\' && code[i + 3] === "'"))) {
        inSingleQuote = true;
        continue;
      }

      // 12. Lacak Tanda Kurung Luar (Parentheses & Brackets)
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
      else if (char === '[') bracketDepth++;
      else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

      // 13. Deteksi Expression Bodied: =>
      if (!hasEncounteredOpenBrace && char === '=' && next === '>') {
        isExpressionBodied = true;
        i++;
        continue;
      }

      // 14. Lacak Kurung Kurawal { }
      if (char === '{') {
        hasEncounteredOpenBrace = true;
        braceDepth++;
        continue;
      } else if (char === '}') {
        braceDepth--;
        if (braceDepth === 0 && hasEncounteredOpenBrace) {
          // Selesai blok kurung kurawal
          // Cek jika ada trailing semicolon: e.g. struct / record struct / field initializer
          let endIdx = i;
          let nextCharIdx = i + 1;
          while (nextCharIdx < code.length && (code[nextCharIdx] === ' ' || code[nextCharIdx] === '\t')) {
            nextCharIdx++;
          }
          if (nextCharIdx < code.length && code[nextCharIdx] === ';') {
            endIdx = nextCharIdx;
          }
          return code.slice(startIndex, endIdx + 1).trim();
        }
        continue;
      }

      // 15. Penanganan Semicolon di luar Kurung Kurawal
      if (char === ';' && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        // Positional record, abstract method, interface method, atau expression-bodied member
        return code.slice(startIndex, i + 1).trim();
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
