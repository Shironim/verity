import type { CodeParser } from './types';
import type { ParseResult } from '../types';
import { FingerprintNormalizer } from '../fingerprint/normalizer';

export class FallbackParser implements CodeParser {
  readonly supportedExtensions = ['*'];

  parse(filePath: string, content: string, targetSymbol?: string): ParseResult {
    // Jika target symbol diminta pada bahasa yang hanya didukung di level file,
    // kita catat dan lakukan fallback perbandingan isi file
    const fingerprint = FingerprintNormalizer.hashNormalizedText(content);

    return {
      filePath,
      targetSymbol,
      fingerprint,
      found: true,
      rawMatchedContent: content,
    };
  }
}
