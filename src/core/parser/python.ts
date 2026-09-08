import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export interface PythonSymbolInfo {
  name: string;
  kind: SymbolKind;
  className?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

interface RawDeclaration {
  name: string;
  isClass: boolean;
  indent: number;
  declStartLine: number;
  declEndLine: number;
  rawText: string;
}

interface LineMeta {
  raw: string;
  indent: number;
  trimmed: string;
  isBlank: boolean;
  isCommentOnly: boolean;
  startBracketDepth: number;
  startInTripleDouble: boolean;
  startInTripleSingle: boolean;
  endBracketDepth: number;
  endInTripleDouble: boolean;
  endInTripleSingle: boolean;
}

export class PythonParser implements CodeParser {
  readonly supportedExtensions = ['.py'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // 1. Jika tidak ada target symbol, normalisasi seluruh isi file
    if (!targetSymbol) {
      const cleaned = this.cleanPythonTrivia(content);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    const symbols = this.scanSymbols(content);

    // 2. Format ClassName::method_name atau ClassName.method_name
    if (targetSymbol.includes('::') || targetSymbol.includes('.')) {
      const [className, methodName] = targetSymbol.includes('::')
        ? targetSymbol.split('::')
        : targetSymbol.split('.');

      const matchedMethod = symbols.find(
        (s) => s.className === className && s.name === methodName
      );

      if (matchedMethod) {
        const cleaned = this.cleanPythonTrivia(matchedMethod.rawText);
        const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
        return {
          filePath,
          targetSymbol,
          fingerprint,
          found: true,
          rawMatchedContent: matchedMethod.rawText,
        };
      }

      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    // 3. Cari sebagai method atau function berdasarkan nama langsung
    const matchedFunc = symbols.find(
      (s) => (s.kind === 'function' || s.kind === 'method') && s.name === targetSymbol
    );
    if (matchedFunc) {
      const cleaned = this.cleanPythonTrivia(matchedFunc.rawText);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: matchedFunc.rawText,
      };
    }

    // 4. Cari sebagai class
    const matchedClass = symbols.find((s) => s.kind === 'class' && s.name === targetSymbol);
    if (matchedClass) {
      const cleaned = this.cleanPythonTrivia(matchedClass.rawText);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: matchedClass.rawText,
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
    const symbols = this.scanSymbols(content);
    return symbols.map((s) => ({
      name: s.name,
      kind: s.kind,
      rawText: s.rawText,
      normalizedTokens: [s.rawText],
      startLine: s.startLine,
      endLine: s.endLine,
    }));
  }

  /**
   * Pemindaian AST Python berbasis Indentation-Aware Block Scanner.
   * Mengisolasi class, function, async function, dan methods beserta decorator
   * dan multiline docstring tanpa dependensi eksternal.
   */
  scanSymbols(content: string): PythonSymbolInfo[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const lineMetas = this.analyzeLines(lines);
    const rawDecls: RawDeclaration[] = [];

    let pendingDecorators: { startLine: number; indent: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const meta = lineMetas[i];

      // Abaikan baris yang berada di dalam multiline string atau bracket yang belum tertutup
      if (meta.startBracketDepth !== 0 || meta.startInTripleDouble || meta.startInTripleSingle) {
        continue;
      }

      if (meta.isBlank) {
        continue;
      }

      if (meta.isCommentOnly) {
        continue;
      }

      // Deteksi Decorator (@...)
      if (meta.trimmed.startsWith('@')) {
        if (!pendingDecorators || pendingDecorators.indent !== meta.indent) {
          pendingDecorators = { startLine: i, indent: meta.indent };
        }
        continue;
      }

      // Deteksi Class atau Function (sync / async)
      const classMatch = meta.trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
      const funcMatch = meta.trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)/);

      if (!classMatch && !funcMatch) {
        pendingDecorators = null;
        continue;
      }

      const name = classMatch ? classMatch[1] : funcMatch![1];
      const isClass = Boolean(classMatch);
      const baseIndent = meta.indent;
      const declStartLine =
        pendingDecorators && pendingDecorators.indent === baseIndent
          ? pendingDecorators.startLine
          : i;
      pendingDecorators = null;

      // Cari akhir header (karakter colon ':' di bracket depth 0)
      const headerInfo = this.findHeaderEnd(lines, i, meta);
      const headerEndLine = headerInfo.headerEndLine;
      const colonIndex = headerInfo.colonIndex;

      let declEndLine = headerEndLine;

      // Cek apakah one-liner body (misal: def ping(): return "pong")
      const restOfHeaderLine = lines[headerEndLine].slice(colonIndex + 1).trim();
      const isSingleLineBody = restOfHeaderLine.length > 0 && !restOfHeaderLine.startsWith('#');

      if (!isSingleLineBody) {
        // Cari akhir body berdasarkan indentasi
        let bodyEndLineBefore = lines.length;

        for (let m = headerEndLine + 1; m < lines.length; m++) {
          const mMeta = lineMetas[m];

          if (mMeta.startBracketDepth > 0 || mMeta.startInTripleDouble || mMeta.startInTripleSingle) {
            continue;
          }

          if (mMeta.isBlank) {
            continue;
          }

          if (mMeta.isCommentOnly) {
            continue;
          }

          if (mMeta.indent > baseIndent) {
            continue;
          }

          // Indentasi <= baseIndent pada baris kode non-kosong menandakan akhir blok
          bodyEndLineBefore = m;
          break;
        }

        // Pangkas trailing blank lines dan komentar di batas luar
        let lastLineIdx = bodyEndLineBefore - 1;
        while (lastLineIdx > headerEndLine) {
          const metaLast = lineMetas[lastLineIdx];
          if (metaLast.isBlank) {
            lastLineIdx--;
            continue;
          }
          if (metaLast.isCommentOnly && metaLast.indent <= baseIndent) {
            lastLineIdx--;
            continue;
          }
          break;
        }

        declEndLine = lastLineIdx;
      }

      const rawText = lines.slice(declStartLine, declEndLine + 1).join('\n');
      rawDecls.push({
        name,
        isClass,
        indent: baseIndent,
        declStartLine,
        declEndLine,
        rawText,
      });
    }

    // Resolusi hirarki simbol (class vs method vs standalone function)
    const symbols: PythonSymbolInfo[] = [];

    for (const decl of rawDecls) {
      if (decl.isClass) {
        symbols.push({
          name: decl.name,
          kind: 'class',
          rawText: decl.rawText,
          startLine: decl.declStartLine + 1,
          endLine: decl.declEndLine + 1,
        });
      } else {
        // Cari enclosing class (jika fungsi dideklarasikan di dalam batas class)
        const enclosingClasses = rawDecls.filter(
          (c) =>
            c.isClass &&
            decl.declStartLine >= c.declStartLine &&
            decl.declEndLine <= c.declEndLine &&
            decl.indent > c.indent
        );

        enclosingClasses.sort((a, b) => b.declStartLine - a.declStartLine);
        const enclosingClass = enclosingClasses[0];

        symbols.push({
          name: decl.name,
          kind: enclosingClass ? 'method' : 'function',
          className: enclosingClass ? enclosingClass.name : undefined,
          rawText: decl.rawText,
          startLine: decl.declStartLine + 1,
          endLine: decl.declEndLine + 1,
        });
      }
    }

    return symbols;
  }

  /**
   * Menemukan posisi akhir header deklarasi (titik dua ':' di bracket depth 0).
   */
  private findHeaderEnd(
    lines: string[],
    startLineIdx: number,
    startMeta: LineMeta
  ): { headerEndLine: number; colonIndex: number } {
    let hDepth = startMeta.startBracketDepth;
    let hTripleDouble = startMeta.startInTripleDouble;
    let hTripleSingle = startMeta.startInTripleSingle;

    for (let k = startLineIdx; k < lines.length; k++) {
      const line = lines[k];
      let inS = false;
      let inD = false;

      let j = 0;
      while (j < line.length) {
        const c = line[j];
        let backslashes = 0;
        for (let b = j - 1; b >= 0 && line[b] === '\\'; b--) {
          backslashes++;
        }
        const isEscaped = backslashes % 2 === 1;

        if (hTripleDouble) {
          if (c === '"' && line[j + 1] === '"' && line[j + 2] === '"' && !isEscaped) {
            hTripleDouble = false;
            j += 3;
            continue;
          }
          j++;
          continue;
        }

        if (hTripleSingle) {
          if (c === "'" && line[j + 1] === "'" && line[j + 2] === "'" && !isEscaped) {
            hTripleSingle = false;
            j += 3;
            continue;
          }
          j++;
          continue;
        }

        if (inD) {
          if (c === '"' && !isEscaped) inD = false;
          j++;
          continue;
        }

        if (inS) {
          if (c === "'" && !isEscaped) inS = false;
          j++;
          continue;
        }

        if (c === '#') {
          break; // Komentar sisa baris
        }

        if (c === '"' && line[j + 1] === '"' && line[j + 2] === '"') {
          hTripleDouble = true;
          j += 3;
          continue;
        }

        if (c === "'" && line[j + 1] === "'" && line[j + 2] === "'") {
          hTripleSingle = true;
          j += 3;
          continue;
        }

        if (c === '"') {
          inD = true;
          j++;
          continue;
        }

        if (c === "'") {
          inS = true;
          j++;
          continue;
        }

        if (c === '(' || c === '[' || c === '{') {
          hDepth++;
        } else if (c === ')' || c === ']' || c === '}') {
          hDepth = Math.max(0, hDepth - 1);
        } else if (c === ':' && hDepth === 0) {
          return { headerEndLine: k, colonIndex: j };
        }

        j++;
      }
    }

    return { headerEndLine: startLineIdx, colonIndex: lines[startLineIdx].length - 1 };
  }

  /**
   * Pre-scan setiap baris untuk melacak bracket depth, multiline docstring state,
   * dan indentasi.
   */
  private analyzeLines(lines: string[]): LineMeta[] {
    const lineMetas: LineMeta[] = [];
    let curBracketDepth = 0;
    let curInTripleDouble = false;
    let curInTripleSingle = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const startBracketDepth = curBracketDepth;
      const startInTripleDouble = curInTripleDouble;
      const startInTripleSingle = curInTripleSingle;

      let inSingle = false;
      let inDouble = false;

      const lineWithoutTabs = line.replace(/\t/g, '    ');
      const indentMatch = lineWithoutTabs.match(/^[ ]*/);
      const indent = indentMatch ? indentMatch[0].length : 0;
      const trimmed = line.trim();
      const isBlank = trimmed.length === 0;

      let isCommentOnly = false;
      let j = 0;
      while (j < line.length) {
        const c = line[j];
        let backslashes = 0;
        for (let b = j - 1; b >= 0 && line[b] === '\\'; b--) {
          backslashes++;
        }
        const isEscaped = backslashes % 2 === 1;

        if (curInTripleDouble) {
          if (c === '"' && line[j + 1] === '"' && line[j + 2] === '"' && !isEscaped) {
            curInTripleDouble = false;
            j += 3;
            continue;
          }
          j++;
          continue;
        }

        if (curInTripleSingle) {
          if (c === "'" && line[j + 1] === "'" && line[j + 2] === "'" && !isEscaped) {
            curInTripleSingle = false;
            j += 3;
            continue;
          }
          j++;
          continue;
        }

        if (inDouble) {
          if (c === '"' && !isEscaped) inDouble = false;
          j++;
          continue;
        }

        if (inSingle) {
          if (c === "'" && !isEscaped) inSingle = false;
          j++;
          continue;
        }

        if (c === '#') {
          if (j === indent) {
            isCommentOnly = true;
          }
          break;
        }

        if (c === '"' && line[j + 1] === '"' && line[j + 2] === '"') {
          curInTripleDouble = true;
          j += 3;
          continue;
        }

        if (c === "'" && line[j + 1] === "'" && line[j + 2] === "'") {
          curInTripleSingle = true;
          j += 3;
          continue;
        }

        if (c === '"') {
          inDouble = true;
          j++;
          continue;
        }

        if (c === "'") {
          inSingle = true;
          j++;
          continue;
        }

        if (c === '(' || c === '[' || c === '{') {
          curBracketDepth++;
        } else if (c === ')' || c === ']' || c === '}') {
          curBracketDepth = Math.max(0, curBracketDepth - 1);
        }

        j++;
      }

      lineMetas.push({
        raw: line,
        indent,
        trimmed,
        isBlank,
        isCommentOnly: isCommentOnly || trimmed.startsWith('#'),
        startBracketDepth,
        startInTripleDouble,
        startInTripleSingle,
        endBracketDepth: curBracketDepth,
        endInTripleDouble: curInTripleDouble,
        endInTripleSingle: curInTripleSingle,
      });
    }

    return lineMetas;
  }

  /**
   * Menghilangkan komentar `# ...` secara string-aware dan menormalisasi triple-single quotes
   * ke triple-double quotes agar kebal terhadap variasi Black / Ruff / PEP 8.
   */
  cleanPythonTrivia(content: string): string {
    let result = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTripleSingle = false;
    let inTripleDouble = false;
    let inComment = false;

    const len = content.length;
    for (let i = 0; i < len; i++) {
      const char = content[i];

      if (inComment) {
        if (char === '\n') {
          inComment = false;
          result += '\n';
        }
        continue;
      }

      let backslashes = 0;
      for (let j = i - 1; j >= 0 && content[j] === '\\'; j--) {
        backslashes++;
      }
      const isEscaped = backslashes % 2 === 1;

      if (inTripleDouble) {
        if (char === '"' && content[i + 1] === '"' && content[i + 2] === '"' && !isEscaped) {
          inTripleDouble = false;
          result += '"""';
          i += 2;
          continue;
        }
        result += char;
        continue;
      }

      if (inTripleSingle) {
        if (char === "'" && content[i + 1] === "'" && content[i + 2] === "'" && !isEscaped) {
          inTripleSingle = false;
          result += '"""';
          i += 2;
          continue;
        }
        result += char;
        continue;
      }

      if (inDoubleQuote) {
        if (char === '"' && !isEscaped) {
          inDoubleQuote = false;
        } else if (char === '\n') {
          inDoubleQuote = false;
        }
        result += char;
        continue;
      }

      if (inSingleQuote) {
        if (char === "'" && !isEscaped) {
          inSingleQuote = false;
        } else if (char === '\n') {
          inSingleQuote = false;
        }
        result += char;
        continue;
      }

      // Deteksi awal triple quotes
      if (char === '"' && content[i + 1] === '"' && content[i + 2] === '"') {
        inTripleDouble = true;
        result += '"""';
        i += 2;
        continue;
      }

      if (char === "'" && content[i + 1] === "'" && content[i + 2] === "'") {
        inTripleSingle = true;
        result += '"""';
        i += 2;
        continue;
      }

      // Deteksi awal quote tunggal / ganda
      if (char === '"') {
        inDoubleQuote = true;
        result += char;
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        result += char;
        continue;
      }

      // Deteksi komentar
      if (char === '#') {
        inComment = true;
        continue;
      }

      result += char;
    }

    return result;
  }
}
