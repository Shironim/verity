import type { CodeParser } from './types';
import type { ParseResult, SymbolNode, SymbolKind } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class GoParser implements CodeParser {
  readonly supportedExtensions = ['.go'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // 1. Jika tidak ada target symbol, normalisasi seluruh isi file
    if (!targetSymbol) {
      const cleaned = this.cleanPackageTrivia(content);
      const fingerprint = FingerprintNormalizer.hashNormalizedText(cleaned);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    // 2. Format Receiver::Method atau Receiver.Method
    if (targetSymbol.includes('::') || targetSymbol.includes('.')) {
      const parts = targetSymbol.includes('::')
        ? targetSymbol.split('::')
        : targetSymbol.split('.');
      const [receiverName, methodName] = parts;
      const methodBlock = this.findMethodReceiverBlock(content, receiverName, methodName);
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

    // 3. Cari sebagai method receiver (berdasarkan nama method saja) atau fungsi biasa
    const funcOrMethodBlock = this.findFunctionOrMethodBlock(content, targetSymbol);
    if (funcOrMethodBlock) {
      const fingerprint = FingerprintNormalizer.hashNormalizedText(funcOrMethodBlock);
      return {
        filePath,
        targetSymbol,
        fingerprint,
        found: true,
        rawMatchedContent: funcOrMethodBlock,
      };
    }

    // 4. Cari sebagai type declaration (struct, interface, atau alias)
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

    return {
      filePath,
      targetSymbol,
      fingerprint: '',
      found: false,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const symbols: SymbolNode[] = [];

    // 1. Scan untuk func (baik standalone function maupun method receiver)
    // func (r *Receiver) Method(...) atau func FuncName(...)
    const funcRegex = /func\s*(?:\([^)]*?\)\s*)?([A-Za-z0-9_]+)\s*(?:\[[^\]]*?\])?\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      const block = this.extractBracedBlockSafe(content, match.index) || match[0];
      const startLine = this.getLineNumber(content, match.index);
      const isMethod = /func\s*\([^)]*?\)/.test(match[0]);

      symbols.push({
        name,
        kind: isMethod ? 'method' : 'function',
        rawText: block,
        normalizedTokens: [block],
        startLine,
        endLine: startLine + (block.match(/\n/g)?.length || 0),
      });
    }

    // 2. Scan untuk type (struct, interface, type alias)
    const typeRegex = /type\s+([A-Za-z0-9_]+)(?:\s*\[[^\]]*?\])?\s+(struct|interface|[A-Za-z0-9_\[\]*]+)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      const name = match[1];
      const kindStr = match[2];
      let kind: SymbolKind = 'type';
      if (kindStr === 'struct') kind = 'class';
      else if (kindStr === 'interface') kind = 'interface';

      const block = this.extractTypeBlockSafe(content, match.index) || match[0];
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

    return symbols;
  }

  private findFunctionOrMethodBlock(code: string, name: string): string | null {
    const escaped = this.escapeRegex(name);
    // Cocokkan func standalone: func Name(...)
    // Atau func method: func (r *Receiver) Name(...)
    const regex = new RegExp(
      `func\\s*(?:\\([^)]*?\\)\\s*)?${escaped}\\s*(?:\\[[^\\]]*?\\])?\\s*\\(`,
      'g'
    );
    const match = regex.exec(code);
    if (!match) return null;

    return this.extractBracedBlockSafe(code, match.index);
  }

  private findMethodReceiverBlock(code: string, receiver: string, method: string): string | null {
    const escapedRecv = this.escapeRegex(receiver);
    const escapedMethod = this.escapeRegex(method);
    // Receiver bisa berupa value (r Receiver), pointer (r *Receiver), atau unnamed (*Receiver)
    const regex = new RegExp(
      `func\\s*\\([^)]*?\\*?\\b${escapedRecv}\\b[^)]*?\\)\\s*${escapedMethod}\\s*(?:\\[[^\\]]*?\\])?\\s*\\(`,
      'g'
    );
    const match = regex.exec(code);
    if (!match) return null;

    return this.extractBracedBlockSafe(code, match.index);
  }

  private findTypeBlock(code: string, typeName: string): string | null {
    const escaped = this.escapeRegex(typeName);
    const regex = new RegExp(
      `type\\s+${escaped}(?:\\s*\\[[^\\]]*?\\])?\\s+`,
      'g'
    );
    const match = regex.exec(code);
    if (!match) return null;

    return this.extractTypeBlockSafe(code, match.index);
  }

  private extractTypeBlockSafe(code: string, startIndex: number): string | null {
    // Cari apakah ada kurung kurawal pembuka (struct / interface) sebelum baris baru ganda
    const openBrace = code.indexOf('{', startIndex);
    const nextNewline = code.indexOf('\n', startIndex);

    // Jika tidak ada '{' atau '{' ada setelah baris lain (misal type alias: type ID string)
    if (openBrace === -1 || (nextNewline !== -1 && openBrace > nextNewline && !/struct\s*\{|interface\s*\{/.test(code.slice(startIndex, openBrace + 1)))) {
      const endLineIndex = nextNewline !== -1 ? nextNewline : code.length;
      return code.slice(startIndex, endLineIndex).trim();
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
    let inBacktick = false;
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
      if (inBacktick) {
        // Go raw string literal tidak mengenal escape sequence
        if (char === '`') inBacktick = false;
        continue;
      }
      if (inSingleQuote) {
        if (char === "'" && prev !== '\\') inSingleQuote = false;
        continue;
      }
      if (inDoubleQuote) {
        if (char === '"' && prev !== '\\') inDoubleQuote = false;
        continue;
      }

      // Mulai komentar atau string
      if (char === '/' && code[i + 1] === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && code[i + 1] === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (char === '`') {
        inBacktick = true;
        continue;
      }
      if (char === "'") {
        inSingleQuote = true;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = true;
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

  private cleanPackageTrivia(text: string): string {
    // Normalisasi komentar package header
    return text.trim();
  }

  private getLineNumber(content: string, index: number): number {
    const lines = content.slice(0, index).split('\n');
    return lines.length;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
