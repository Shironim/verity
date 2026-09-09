import type { Anchor } from '../types';

export class InlineAnchorHandler {
  // Regex untuk mencocokkan <!-- @verity path="..." symbol="..." sha="..." fp="..." -->
  private static readonly INLINE_REGEX =
    /<!--\s*@verity\s+path=["']([^"']+)["'](?:\s+symbol=["']([^"']+)["'])?\s+sha=["']([^"']+)["']\s+fp=["']([^"']+)["'](?:\s+ts=["']([^"']+)["'])?\s*-->/g;

  /**
   * Ekstraksi seluruh inline comment anchor dari dokumen teks/markdown.
   */
  static extractAnchors(specFile: string, content: string): Anchor[] {
    const anchors: Anchor[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      const regex = new RegExp(this.INLINE_REGEX.source, 'g');

      while ((match = regex.exec(line)) !== null) {
        anchors.push({
          specFile,
          targetPath: match[1],
          symbol: match[2] || undefined,
          provenance: {
            commitSha: match[3],
            fingerprint: match[4],
            timestamp: match[5],
          },
          kind: 'inline',
          line: i + 1,
        });
      }
    }

    return anchors;
  }

  /**
   * Membuat string tag komentar HTML inline anchor.
   */
  static formatInlineTag(anchor: Omit<Anchor, 'kind' | 'specFile' | 'line'>): string {
    const symbolAttr = anchor.symbol ? ` symbol="${anchor.symbol}"` : '';
    const tsAttr = anchor.provenance.timestamp
      ? ` ts="${anchor.provenance.timestamp}"`
      : '';

    return `<!-- @verity path="${anchor.targetPath}"${symbolAttr} sha="${anchor.provenance.commitSha}" fp="${anchor.provenance.fingerprint}"${tsAttr} -->`;
  }

  /**
   * Menambahkan komentar inline anchor ke akhir konten teks.
   */
  static appendInlineTag(
    content: string,
    anchor: Omit<Anchor, 'kind' | 'specFile' | 'line'>
  ): string {
    const tag = this.formatInlineTag(anchor);
    return content.trimEnd() + '\n\n' + tag + '\n';
  }
}
