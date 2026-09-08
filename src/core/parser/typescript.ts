import ts from 'typescript';
import type { CodeParser } from './types';
import type { ParseResult, SymbolKind, SymbolNode } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class TypeScriptParser implements CodeParser {
  readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    if (!targetSymbol) {
      // Jika tidak ada target symbol spesifik, buat fingerprint dari seluruh konten
      const fingerprint = FingerprintNormalizer.hashNormalizedText(content);
      return {
        filePath,
        fingerprint,
        found: true,
        rawMatchedContent: content,
      };
    }

    const matchedNode = this.findSymbolNode(sourceFile, targetSymbol);

    if (!matchedNode) {
      return {
        filePath,
        targetSymbol,
        fingerprint: '',
        found: false,
      };
    }

    const rawText = matchedNode.getText(sourceFile);
    const fingerprint = FingerprintNormalizer.hashNormalizedText(rawText);

    return {
      filePath,
      targetSymbol,
      fingerprint,
      found: true,
      rawMatchedContent: rawText,
    };
  }

  findSymbols(filePath: string, content: string): SymbolNode[] {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const symbols: SymbolNode[] = [];

    const visit = (node: ts.Node) => {
      const info = this.extractSymbolInfo(node, sourceFile);
      if (info) {
        symbols.push(info);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return symbols;
  }

  private findSymbolNode(sourceFile: ts.SourceFile, targetSymbol: string): ts.Node | null {
    let result: ts.Node | null = null;

    const visit = (node: ts.Node) => {
      if (result) return;

      const name = this.getNodeName(node, sourceFile);
      if (name === targetSymbol) {
        result = node;
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
  }

  private getNodeName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isClassDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isInterfaceDeclaration(node)) {
      return node.name.text;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return node.name.text;
    }
    if (ts.isMethodDeclaration(node) && node.name) {
      return node.name.getText(sourceFile);
    }
    if (ts.isVariableDeclaration(node) && node.name) {
      return node.name.getText(sourceFile);
    }
    return null;
  }

  private extractSymbolInfo(node: ts.Node, sourceFile: ts.SourceFile): SymbolNode | null {
    let kind: SymbolKind = 'unknown';
    let name: string | null = null;

    if (ts.isFunctionDeclaration(node) && node.name) {
      kind = 'function';
      name = node.name.text;
    } else if (ts.isClassDeclaration(node) && node.name) {
      kind = 'class';
      name = node.name.text;
    } else if (ts.isInterfaceDeclaration(node)) {
      kind = 'interface';
      name = node.name.text;
    } else if (ts.isTypeAliasDeclaration(node)) {
      kind = 'type';
      name = node.name.text;
    } else if (ts.isMethodDeclaration(node) && node.name) {
      kind = 'method';
      name = node.name.getText(sourceFile);
    }

    if (!name) return null;

    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const rawText = node.getText(sourceFile);

    return {
      name,
      kind,
      rawText,
      normalizedTokens: [rawText],
      startLine: startLine + 1,
      endLine: endLine + 1,
    };
  }
}
