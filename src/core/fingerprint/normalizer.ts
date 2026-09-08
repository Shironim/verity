import { createHash } from 'node:crypto';

/**
 * Normalizer & Hasher deterministik untuk menjaga kekebalan fingerprint
 * terhadap perubahan kosmetik (whitespace, indentasi, semicolons, dan newlines).
 */
export class FingerprintNormalizer {
  /**
   * Menghasilkan hash SHA-256 dari daftar token AST terstruktur.
   */
  static hashTokens(tokens: string[]): string {
    const cleaned = tokens
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .join('|');

    return createHash('sha256').update(cleaned).digest('hex');
  }

  /**
   * Menghasilkan hash SHA-256 dari string mentah dengan normalisasi whitespace
   * dan line-endings (CRLF -> LF, collapse multi-spaces, strip comment kosmetik dasar).
   */
  static hashNormalizedText(rawText: string): string {
    const normalized = this.normalizeText(rawText);
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Membersihkan teks dari variasi format Prettier/Pint.
   */
  static normalizeText(text: string): string {
    return text
      // Normalisasi line endings
      .replace(/\r\n/g, '\n')
      // Hapus inline comments kosmetik (// ...)
      .replace(/\/\/[^\n]*/g, '')
      // Hapus block comments (/* ... */)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Hapus HTML/Vue template comments (<!-- ... -->)
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalisasi quotes tunggal ke ganda untuk keseragaman string literal
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      // Hilangkan semicolons di akhir baris / sebelum kurung tutup
      .replace(/;\s*([}\n]|$)/gm, '$1')
      // Rapatkan tanda kurung dan delimiter umum
      .replace(/\s*([{}()[\].,:=+\-*/><&|!?:;])\s*/g, '$1')
      // Hapus trailing comma sebelum closing bracket/parenthesis/brace
      .replace(/,\s*([}\]\)])/g, '$1')
      // Hapus semicolon sisa sebelum closing brace
      .replace(/;\s*([}\]])/g, '$1')
      // Collapse seluruh whitespace berlebih menjadi single space
      .replace(/\s+/g, ' ')
      .trim();
  }
}
