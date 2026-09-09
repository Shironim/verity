import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export interface RubySymbolInfo {
  type: 'module' | 'class' | 'def';
  name: string;
  startLine: number;
  endLine: number;
  rawText: string;
  scopeStack: string[];
}

interface StackFrame {
  type: 'module' | 'class' | 'def' | 'block';
  name: string;
  startLine: number;
  lineIndex: number;
}

export class RubyParser implements CodeParser {
  readonly supportedExtensions = ['.rb'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // 1. Jika tidak ada target symbol, normalisasi seluruh isi file
    if (!targetSymbol) {
      const cleaned = this.cleanRubyTrivia(content);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    const symbols = this.scanSymbols(content);
    const matched = this.matchSymbol(symbols, targetSymbol.trim());

    if (matched) {
      const cleaned = this.cleanRubyTrivia(matched.rawText);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: matched.rawText,
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
    return symbols.map((s) => {
      let fullName = s.name;
      if (s.scopeStack.length > 0) {
        const parentScope = s.scopeStack.join('::');
        if (s.type === 'def') {
          const isClassMethod = s.name.startsWith('self.') || s.name.includes('.');
          const cleanMethodName = s.name.replace(/^self\./, '').replace(/^[A-Za-z0-9_:]+\./, '');
          fullName = isClassMethod
            ? `${parentScope}::${cleanMethodName}`
            : `${parentScope}#${cleanMethodName}`;
        } else {
          fullName = `${parentScope}::${s.name}`;
        }
      }

      const kind: SymbolKind =
        s.type === 'class' ? 'class' : s.type === 'module' ? 'class' : 'method';

      return {
        name: fullName,
        kind,
        rawText: s.rawText,
        normalizedTokens: [s.rawText],
        startLine: s.startLine,
        endLine: s.endLine,
      };
    });
  }

  /**
   * Keyword-Block Scanner khusus Ruby (.rb).
   * Memindai def/class/module ... end serta struktur kontrol bersarang.
   */
  scanSymbols(content: string): RubySymbolInfo[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const symbols: RubySymbolInfo[] = [];
    const stack: StackFrame[] = [];

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inMultilineComment = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex];
      const lineNum = lineIndex + 1;

      // Check multiline comment (=begin ... =end)
      if (!inMultilineComment && rawLine.startsWith('=begin')) {
        inMultilineComment = true;
        continue;
      }
      if (inMultilineComment) {
        if (rawLine.startsWith('=end')) {
          inMultilineComment = false;
        }
        continue;
      }

      // Mask string literals and comments to avoid false keyword detection
      let masked = '';
      for (let j = 0; j < rawLine.length; j++) {
        const ch = rawLine[j];
        const prev = j > 0 ? rawLine[j - 1] : '';

        if (inSingleQuote) {
          masked += ' ';
          if (ch === "'" && prev !== '\\') inSingleQuote = false;
          continue;
        }
        if (inDoubleQuote) {
          masked += ' ';
          if (ch === '"' && prev !== '\\') inDoubleQuote = false;
          continue;
        }

        if (ch === '#') {
          break; // Komentar baris hingga akhir baris
        }

        if (ch === "'") {
          inSingleQuote = true;
          masked += ' ';
          continue;
        }
        if (ch === '"') {
          inDoubleQuote = true;
          masked += ' ';
          continue;
        }

        // Simbol Ruby (:symbol)
        if (
          ch === ':' &&
          /[a-zA-Z_]/.test(rawLine[j + 1] || '') &&
          (j === 0 || /[\s,([{\]}=]/.test(prev))
        ) {
          masked += '  ';
          j++;
          while (j < rawLine.length && /[a-zA-Z0-9_?!]/.test(rawLine[j])) {
            masked += ' ';
            j++;
          }
          j--;
          continue;
        }

        masked += ch;
      }

      // Scan kata kunci blok Ruby
      const kwRegex = /\b(module|class|def|if|unless|case|while|until|for|begin|do|end)\b/g;
      let match: RegExpExecArray | null;
      const isLineWhileUntilFor = /^\s*(while|until|for)\b/.test(masked);

      while ((match = kwRegex.exec(masked)) !== null) {
        const kw = match[1];
        const matchIdx = match.index;
        const textBefore = masked.slice(0, matchIdx).trim();

        if (kw === 'module') {
          const after = rawLine.slice(matchIdx + kw.length).trim();
          const modNameMatch = after.match(/^([A-Za-z0-9_:]+)/);
          const name = modNameMatch ? modNameMatch[1] : 'AnonymousModule';
          stack.push({ type: 'module', name, startLine: lineNum, lineIndex });
        } else if (kw === 'class') {
          const after = rawLine.slice(matchIdx + kw.length).trim();
          if (after.startsWith('<<')) {
            stack.push({ type: 'block', name: 'singleton_class', startLine: lineNum, lineIndex });
          } else {
            const clsNameMatch = after.match(/^([A-Za-z0-9_:]+)/);
            const name = clsNameMatch ? clsNameMatch[1] : 'AnonymousClass';
            stack.push({ type: 'class', name, startLine: lineNum, lineIndex });
          }
        } else if (kw === 'def') {
          const after = rawLine.slice(matchIdx + kw.length).trim();
          // Perlindungan endless method Ruby 3+: def foo(x) = x * 2 (tidak butuh end)
          const isEndless = /^[A-Za-z0-9_?!.]+(\s*\([^)]*\))?\s*=/.test(after);
          if (!isEndless) {
            const methodNameMatch = after.match(/^([A-Za-z0-9_?!.]+)/);
            const name = methodNameMatch ? methodNameMatch[1] : 'anonymous_method';
            stack.push({ type: 'def', name, startLine: lineNum, lineIndex });
          }
        } else if (kw === 'if' || kw === 'unless' || kw === 'while' || kw === 'until') {
          // Deteksi statement opener vs modifier (e.g. `return if cond` atau `x = y rescue nil`)
          const isOpBefore =
            textBefore === '' ||
            /[=([{\;,]|&&|\|\||\band\b|\bor\b|\bnot\b|\bthen\b|\belse\b|\belsif\b|\brescue\b|\bensure\b$/.test(
              textBefore
            );
          if (isOpBefore) {
            stack.push({ type: 'block', name: kw, startLine: lineNum, lineIndex });
          }
        } else if (kw === 'case' || kw === 'begin' || kw === 'for') {
          stack.push({ type: 'block', name: kw, startLine: lineNum, lineIndex });
        } else if (kw === 'do') {
          // Jika while/until/for sudah membuka blok di baris yang sama, `do` tidak membuka blok ganda
          if (!isLineWhileUntilFor) {
            stack.push({ type: 'block', name: 'do', startLine: lineNum, lineIndex });
          }
        } else if (kw === 'end') {
          if (stack.length > 0) {
            const top = stack.pop()!;
            if (top.type === 'module' || top.type === 'class' || top.type === 'def') {
              const rawText = lines.slice(top.lineIndex, lineIndex + 1).join('\n');
              const scopeStack = stack
                .filter((s) => s.type === 'class' || s.type === 'module')
                .map((s) => s.name);

              symbols.push({
                type: top.type,
                name: top.name,
                startLine: top.startLine,
                endLine: lineNum,
                rawText,
                scopeStack,
              });
            }
          }
        }
      }
    }

    return symbols;
  }

  /**
   * Mencocokkan target symbol dengan simbol hasil pemindaian AST.
   */
  private matchSymbol(symbols: RubySymbolInfo[], targetSymbol: string): RubySymbolInfo | undefined {
    // 1. Notasi Instance Method: ClassName#method_name
    if (targetSymbol.includes('#')) {
      const [className, methodName] = targetSymbol.split('#');
      return symbols.find((s) => {
        if (s.type !== 'def') return false;
        const cleanName = s.name.replace(/^self\./, '').replace(/^[A-Za-z0-9_:]+\./, '');
        const matchesMethod = cleanName === methodName;
        const fullScope = s.scopeStack.join('::');
        const matchesClass =
          s.scopeStack.includes(className) ||
          fullScope === className ||
          fullScope.endsWith(`::${className}`);
        return matchesMethod && (matchesClass || s.scopeStack.length === 0);
      });
    }

    // 2. Notasi Class/Scoped Method atau Namespace: ClassName::method atau Mod::Class
    if (targetSymbol.includes('::') || targetSymbol.includes('.')) {
      const separator = targetSymbol.includes('::') ? '::' : '.';
      const lastSepIndex = targetSymbol.lastIndexOf(separator);
      const scopePart = targetSymbol.slice(0, lastSepIndex);
      const memberPart = targetSymbol.slice(lastSepIndex + separator.length);

      // Cek apakah cocok dengan method di dalam class/module
      const methodMatch = symbols.find((s) => {
        if (s.type !== 'def') return false;
        const cleanName = s.name.replace(/^self\./, '').replace(/^[A-Za-z0-9_:]+\./, '');
        const matchesMethod = cleanName === memberPart || s.name === memberPart;
        const fullScope = s.scopeStack.join('::');
        const matchesScope =
          s.scopeStack.includes(scopePart) ||
          fullScope === scopePart ||
          fullScope.endsWith(`::${scopePart}`);
        return matchesMethod && matchesScope;
      });

      if (methodMatch) return methodMatch;

      // Cek apakah targetSymbol merepresentasikan class/module bersarang (e.g. Mod::SubMod)
      const containerMatch = symbols.find((s) => {
        if (s.type !== 'class' && s.type !== 'module') return false;
        const fullScope = s.scopeStack.length > 0 ? `${s.scopeStack.join('::')}::${s.name}` : s.name;
        return fullScope === targetSymbol || s.name === memberPart;
      });

      if (containerMatch) return containerMatch;
    }

    // 3. Pencarian langsung nama Class atau Module
    const containerMatch = symbols.find((s) => {
      if (s.type !== 'class' && s.type !== 'module') return false;
      const fullScope = s.scopeStack.length > 0 ? `${s.scopeStack.join('::')}::${s.name}` : s.name;
      return s.name === targetSymbol || fullScope === targetSymbol;
    });
    if (containerMatch) return containerMatch;

    // 4. Pencarian standalone method atau singleton method
    return symbols.find((s) => {
      if (s.type !== 'def') return false;
      const cleanName = s.name.replace(/^self\./, '').replace(/^[A-Za-z0-9_:]+\./, '');
      return s.name === targetSymbol || cleanName === targetSymbol;
    });
  }

  /**
   * Membersihkan komentar (# dan =begin...=end) dan whitespace ekstra
   * untuk menghasilkan konsistensi SHA-256 fingerprinting (RuboCop immunity).
   */
  cleanRubyTrivia(content: string): string {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inMultilineComment = false;

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const cleanedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inMultilineComment && line.startsWith('=begin')) {
        inMultilineComment = true;
        continue;
      }
      if (inMultilineComment) {
        if (line.startsWith('=end')) {
          inMultilineComment = false;
        }
        continue;
      }

      let cleanedLine = '';
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        const prev = j > 0 ? line[j - 1] : '';

        if (inSingleQuote) {
          cleanedLine += ch;
          if (ch === "'" && prev !== '\\') inSingleQuote = false;
          continue;
        }
        if (inDoubleQuote) {
          cleanedLine += ch;
          if (ch === '"' && prev !== '\\') inDoubleQuote = false;
          continue;
        }

        // Komentar baris
        if (ch === '#') {
          break;
        }

        if (ch === "'") {
          inSingleQuote = true;
          cleanedLine += ch;
          continue;
        }
        if (ch === '"') {
          inDoubleQuote = true;
          cleanedLine += ch;
          continue;
        }

        cleanedLine += ch;
      }

      if (cleanedLine.trim().length > 0) {
        cleanedLines.push(cleanedLine);
      }
    }

    return cleanedLines.join('\n');
  }
}
