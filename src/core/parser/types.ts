import type { ParseResult, SymbolNode } from '../types';

export interface CodeParser {
  readonly supportedExtensions: string[];
  parse(filePath: string, content: string, targetSymbol?: string): Promise<ParseResult> | ParseResult;
  findSymbols?(filePath: string, content: string): Promise<SymbolNode[]> | SymbolNode[];
}
