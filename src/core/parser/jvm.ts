import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

/**
 * Dedicated AST Parser untuk Ekosistem JVM (Java & Kotlin).
 * Mendukung ekstraksi class, record, interface, enum, companion object,
 * method, function (Kotlin fun / suspend fun), serta anotasi Spring Boot / Android / Kotlin.
 */
export class JvmParser implements CodeParser {
  readonly supportedExtensions = ['.java', '.kt'];

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

      // Handle package/namespace in typeName, e.g. com.example.OrderService -> OrderService
      const typeName = rawTypeName.includes('.')
        ? rawTypeName.slice(rawTypeName.lastIndexOf('.') + 1)
        : rawTypeName;

      const typeBlock = this.findTypeBlock(content, typeName);
      if (typeBlock) {
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

      // Check jika targetSymbol sebenarnya merujuk langsung ke nama Type (e.g. com.example.OrderService)
      const directTypeBlock =
        this.findTypeBlock(content, memberName) || this.findTypeBlock(content, targetSymbol);
      if (directTypeBlock) {
        const fingerprint = FingerprintNormalizer.hashNormalizedText(directTypeBlock);
        return {
          filePath,
          targetSymbol,
          fingerprint,
          found: true,
          rawMatchedContent: directTypeBlock,
        };
      }

      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    // 3. Pencarian Simbol Tunggal (Tipe atau Method/Function)
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

    return {
      filePath,
      targetSymbol,
      fingerprint: '',
      found: false,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const symbols: SymbolNode[] = [];

    // 1. Scan Types: class, record, interface, enum, object, companion object
    const typeRegex =
      /(?:^|\n)[ \t]*((?:(?:public|private|protected|internal|static|abstract|final|sealed|non-sealed|open|data|value|inner|annotation)\s+)*(class|record|interface|enum(?:\s+class)?|object|companion\s+object|@interface)(?:\s+([A-Za-z0-9_]+))?)/g;

    let match: RegExpExecArray | null;
    while ((match = typeRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const kindStr = match[2];
      const explicitName = match[3];
      const declIndex = match.index + (match[0].length - fullHeader.length);

      const name = explicitName || (kindStr.includes('companion') ? 'companion object' : '');
      if (!name) continue;

      let kind: SymbolKind = 'class';
      if (kindStr === 'interface' || kindStr === '@interface') {
        kind = 'interface';
      } else if (kindStr.startsWith('enum')) {
        kind = 'type';
      }

      const startIndex = this.findDeclarationStartIndex(content, declIndex);
      const block = this.extractMemberBlockSafe(content, startIndex, declIndex) || fullHeader;
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

    // 2. Scan Kotlin fun & Java Methods
    // 2a. Kotlin fun
    const kotlinFunRegex =
      /(?:^|\n)[ \t]*((?:(?:public|private|protected|internal|override|open|abstract|final|suspend|inline|tailrec|operator|infix|external)\s+)*fun(?:<[^>]+>)?\s+(?:[A-Za-z0-9_<>.,[\]?]+\.)?([A-Za-z0-9_]+)\s*\([^)]*\))/g;

    while ((match = kotlinFunRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const name = match[2];

      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(content, declIndex);
      const block = this.extractMemberBlockSafe(content, startIndex, declIndex) || fullHeader;
      const startLine = this.getLineNumber(content, startIndex);

      symbols.push({
        name,
        kind: 'function',
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    // 2b. Java methods and constructors
    const javaMethodRegex =
      /(?:^|\n)[ \t]*((?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)+(?:<[^>]+>\s+)?(?:[A-Za-z0-9_<>.,[\]?]+\s+)?([A-Za-z0-9_]+)\s*\([^)]*\))/g;

    while ((match = javaMethodRegex.exec(content)) !== null) {
      const fullHeader = match[1];
      const name = match[2];

      // Abaikan kata kunci kontrol alur Java
      if (['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'super', 'this', 'return'].includes(name)) {
        continue;
      }

      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(content, declIndex);
      const block = this.extractMemberBlockSafe(content, startIndex, declIndex) || fullHeader;
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
   * Mencari blok definisi tipe (class, record, interface, enum, object, companion object).
   */
  private findTypeBlock(code: string, typeName: string): string | null {
    const escaped = this.escapeRegex(typeName);

    // Pencarian khusus 'companion object' tanpa nama
    if (typeName === 'companion object' || typeName === 'companion') {
      const compRegex = /(?:^|\n)[ \t]*(companion\s+object(?:\s+[A-Za-z0-9_]+)?)/g;
      let m: RegExpExecArray | null;
      while ((m = compRegex.exec(code)) !== null) {
        const declIndex = m.index + (m[0].length - m[1].length);
        const startIndex = this.findDeclarationStartIndex(code, declIndex);
        const block = this.extractMemberBlockSafe(code, startIndex, declIndex);
        if (block) return block;
      }
    }

    // Tipe umum (Java class/interface/record/enum, Kotlin class/data class/interface/object)
    const typeRegex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|internal|static|abstract|final|sealed|non-sealed|open|data|value|inner|annotation)\\s+)*(?:class|record|interface|enum(?:\\s+class)?|object|@interface)\\s+${escaped}(?:<[^>]*>)?(?:\\s*\\([\\s\\S]*?\\))?(?:\\s*:[^{;\\n]+|\\s+extends\\s+[^{;\\n]+|\\s+implements\\s+[^{;\\n]+|\\s+permits\\s+[^{;\\n]+)*)`,
      'g'
    );

    let match: RegExpExecArray | null;
    while ((match = typeRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex, declIndex);
      if (block) return block;
    }

    // Pencarian companion object dengan nama eksplisit
    const compNamedRegex = new RegExp(
      `(?:^|\\n)[ \\t]*(companion\\s+object\\s+${escaped})`,
      'g'
    );
    while ((match = compNamedRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex, declIndex);
      if (block) return block;
    }

    return null;
  }

  /**
   * Mencari blok method atau function di dalam potongan kode Java atau Kotlin.
   */
  private findMemberInCode(code: string, memberName: string): string | null {
    const escaped = this.escapeRegex(memberName);

    // 1. Kotlin fun: [modifiers] fun [Receiver.]memberName(...)
    const kotlinFunRegex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|internal|override|open|abstract|final|suspend|inline|tailrec|operator|infix|external)\\s+)*fun(?:<[^>]+>)?\\s+(?:[A-Za-z0-9_<>.,\\[\\]?]+\\.)?${escaped}\\s*\\([\\s\\S]*?\\)(?:\\s*:[^{=;\\n]+)?)`,
      'g'
    );

    let match: RegExpExecArray | null;
    while ((match = kotlinFunRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex, declIndex);
      if (block) return block;
    }

    // 2. Java method or constructor: [modifiers] [<T>] ReturnType memberName(...) [throws ...]
    const javaMethodRegex = new RegExp(
      `(?:^|\\n)[ \\t]*((?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\\s+)*(?:<[^>]+>\\s+)?(?:[A-Za-z0-9_<>.,\\[\\]?]+\\s+)?${escaped}\\s*\\([\\s\\S]*?\\)(?:\\s*throws\\s+[^{;]+)?)`,
      'g'
    );

    while ((match = javaMethodRegex.exec(code)) !== null) {
      const fullHeader = match[1];
      const declIndex = match.index + (match[0].length - fullHeader.length);
      const startIndex = this.findDeclarationStartIndex(code, declIndex);
      const block = this.extractMemberBlockSafe(code, startIndex, declIndex);
      if (block) return block;
    }

    return null;
  }

  /**
   * Menelusuri ke belakang untuk menemukan awal deklarasi termasuk anotasi Java/Kotlin (@Annotation).
   */
  private findDeclarationStartIndex(code: string, declIndex: number): number {
    let idx = declIndex - 1;
    let lastValidStart = declIndex;

    while (idx >= 0) {
      const ch = code[idx];

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        idx--;
        continue;
      }

      // Lewati block comment: */
      if (ch === '/' && idx > 0 && code[idx - 1] === '*') {
        let commentIdx = idx - 2;
        while (commentIdx >= 1 && !(code[commentIdx - 1] === '/' && code[commentIdx] === '*')) {
          commentIdx--;
        }
        idx = commentIdx - 2;
        continue;
      }

      // Lewati line comment: //
      const lineStart = code.lastIndexOf('\n', idx) + 1;
      const lineText = code.slice(lineStart, idx + 1).trim();
      if (lineText.startsWith('//')) {
        idx = lineStart - 1;
        continue;
      }

      // Deteksi penutup argumen anotasi: )
      if (ch === ')') {
        const openParenIdx = this.findMatchingParenBackward(code, idx);
        if (openParenIdx !== -1) {
          let aIdx = openParenIdx - 1;
          while (aIdx >= 0 && (code[aIdx] === ' ' || code[aIdx] === '\t')) aIdx--;
          while (aIdx >= 0 && /[A-Za-z0-9_.:]/.test(code[aIdx])) aIdx--;
          if (aIdx >= 0 && code[aIdx] === '@') {
            lastValidStart = aIdx;
            idx = aIdx - 1;
            continue;
          }
        }
      }

      // Deteksi anotasi tanpa tanda kurung: @Annotation
      if (/[A-Za-z0-9_]/.test(ch)) {
        let aIdx = idx;
        while (aIdx >= 0 && /[A-Za-z0-9_.:]/.test(code[aIdx])) aIdx--;
        if (aIdx >= 0 && code[aIdx] === '@') {
          lastValidStart = aIdx;
          idx = aIdx - 1;
          continue;
        }
      }

      break;
    }

    return lastValidStart;
  }

  /**
   * Mencari pasangan '(' dari ')' dengan mengabaikan string dan char literals.
   */
  private findMatchingParenBackward(code: string, closeIndex: number): number {
    let depth = 0;
    let inString = false;
    let inChar = false;

    for (let i = closeIndex; i >= 0; i--) {
      const ch = code[i];
      const prev = i > 0 ? code[i - 1] : '';

      if (ch === '"' && prev !== '\\') inString = !inString;
      if (ch === "'" && prev !== '\\') inChar = !inChar;
      if (inString || inChar) continue;

      if (ch === ')') depth++;
      else if (ch === '(') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Mengekstrak blok anggota secara seimbang (braces, quotes, single-expression bodies).
   */
  private extractMemberBlockSafe(code: string, startIndex: number, declIndex: number): string | null {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inRawString = false;
    let rawStringQuotes = 0;
    let inLineComment = false;
    let inBlockComment = false;

    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let hasEncounteredOpenBrace = false;
    let hasEncounteredDeclParen = false;
    let hasEncounteredEquals = false;

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

      // 3. Keluar dari Raw String Literal: """
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

      // 4. Keluar dari Double Quote
      if (inDoubleQuote) {
        if (char === '"' && prev !== '\\') inDoubleQuote = false;
        continue;
      }

      // 5. Keluar dari Single Quote
      if (inSingleQuote) {
        if (char === "'" && prev !== '\\') inSingleQuote = false;
        continue;
      }

      // 6. Deteksi Komentar
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

      // 7. Deteksi Raw String """
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

      // 8. Deteksi Regular String Literal
      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }

      // 9. Deteksi Char Literal
      if (char === "'" && (code[i + 2] === "'" || (next === '\\' && code[i + 3] === "'"))) {
        inSingleQuote = true;
        continue;
      }

      // 10. Lacak Kurung Bulat & Siku
      if (char === '(') {
        if (i >= declIndex) hasEncounteredDeclParen = true;
        parenDepth++;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      } else if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      }

      // 11. Deteksi Equals '=' untuk Kotlin single-expression fun
      if (i >= declIndex && !hasEncounteredOpenBrace && parenDepth === 0 && char === '=' && next !== '=') {
        hasEncounteredEquals = true;
      }

      // 12. Lacak Kurung Kurawal { }
      if (char === '{') {
        hasEncounteredOpenBrace = true;
        braceDepth++;
        continue;
      } else if (char === '}') {
        braceDepth--;
        if (braceDepth === 0 && hasEncounteredOpenBrace) {
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

      // 13. Semicolon termination (Java abstract/interface methods atau record 1-liner)
      if (char === ';' && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        return code.slice(startIndex, i + 1).trim();
      }

      // 14. Braceless Kotlin declaration atau single-expression fun ending pada batas newline
      if (i >= declIndex && !hasEncounteredOpenBrace && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        if (char === '\n') {
          const rest = code.slice(i + 1);
          const nextTrimmed = rest.trimStart();
          const isNextDecl =
            /^(?:@|(?:public|private|protected|internal|data|sealed|abstract|open|final|override|fun|class|interface|object|val|var|enum)\b|\})/.test(
              nextTrimmed
            );
          if (hasEncounteredEquals || (hasEncounteredDeclParen && isNextDecl) || nextTrimmed === '') {
            if (isNextDecl || nextTrimmed === '') {
              return code.slice(startIndex, i).trim();
            }
          }
        }
      }
    }

    if (!hasEncounteredOpenBrace && (hasEncounteredDeclParen || hasEncounteredEquals)) {
      return code.slice(startIndex).trim();
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
