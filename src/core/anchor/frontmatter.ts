import { parse, stringify } from 'yaml';
import type { Anchor } from '../types';

export class FrontmatterAnchorHandler {
  /**
   * Ekstraksi seluruh anchor yang tercatat dalam frontmatter YAML berkas markdown.
   */
  static extractAnchors(specFile: string, content: string): Anchor[] {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return [];

    try {
      const data = parse(match[1]);
      if (!data || typeof data !== 'object') return [];

      const verityBlock = data.verity;
      if (!verityBlock || !Array.isArray(verityBlock.anchors)) return [];

      return verityBlock.anchors.map((item: any) => ({
        specFile,
        targetPath: item.path,
        symbol: item.symbol || undefined,
        provenance: {
          commitSha: item.provenance?.commitSha || item.sha || '',
          fingerprint: item.provenance?.fingerprint || item.fp || '',
          timestamp: item.provenance?.timestamp,
        },
        kind: 'frontmatter',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Menambahkan atau memperbarui anchor ke dalam frontmatter YAML dokumen.
   */
  static upsertAnchor(content: string, newAnchor: Omit<Anchor, 'kind' | 'specFile'>): string {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let frontmatterData: Record<string, any> = {};
    let body = content;

    if (match) {
      try {
        frontmatterData = parse(match[1]) || {};
      } catch {
        frontmatterData = {};
      }
      body = content.slice(match[0].length).trimStart();
    }

    if (!frontmatterData.verity) {
      frontmatterData.verity = {};
    }
    if (!Array.isArray(frontmatterData.verity.anchors)) {
      frontmatterData.verity.anchors = [];
    }

    const anchors: any[] = frontmatterData.verity.anchors;
    const existingIndex = anchors.findIndex(
      (a) => a.path === newAnchor.targetPath && a.symbol === newAnchor.symbol
    );

    const anchorEntry = {
      path: newAnchor.targetPath,
      ...(newAnchor.symbol ? { symbol: newAnchor.symbol } : {}),
      provenance: {
        commitSha: newAnchor.provenance.commitSha,
        fingerprint: newAnchor.provenance.fingerprint,
        timestamp: newAnchor.provenance.timestamp || new Date().toISOString(),
      },
    };

    if (existingIndex >= 0) {
      anchors[existingIndex] = anchorEntry;
    } else {
      anchors.push(anchorEntry);
    }

    const yamlStr = stringify(frontmatterData).trim();
    return `---\n${yamlStr}\n---\n\n${body}`;
  }
}
