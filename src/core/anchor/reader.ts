import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { FrontmatterAnchorHandler } from './frontmatter';
import { InlineAnchorHandler } from './inline';
import type { Anchor } from '../types';

export interface BriefDocument {
  filePath: string;
  relativePath: string;
  fileName: string;
  title: string;
  category: string;
  status: string;
  date?: string;
  summary: string;
  anchors: Anchor[];
  content: string;
}

/**
 * Single Source of Truth (SSOT) untuk pemindaian dan ekstraksi metadata berkas brief spesifikasi.
 * Mencegah duplikasi parsing antara BriefManifestGenerator dan BriefSearchEngine.
 */
export class BriefDocumentReader {
  /**
   * Mengumpulkan semua file markdown brief secara rekursif dari docs/brief/.
   * Mengabaikan file INDEX.MD, folder _archive, dan berkas/folder tersembunyi.
   */
  static collectBriefFiles(dir: string, baseDir: string = dir): string[] {
    if (!existsSync(dir)) return [];
    const dirEntries = readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const item of dirEntries) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name.startsWith('.') || item.name === '_archive') continue;
        results.push(...BriefDocumentReader.collectBriefFiles(fullPath, baseDir));
      } else if (
        item.isFile() &&
        item.name.endsWith('.md') &&
        item.name.toUpperCase() !== 'INDEX.MD'
      ) {
        const relative = fullPath.slice(baseDir.length + 1).replace(/\\/g, '/');
        results.push(relative);
      }
    }
    return results.sort();
  }

  /**
   * Membaca dan mengekstrak dokumen brief secara lengkap.
   */
  static readBrief(fullPath: string, relativePath: string): BriefDocument | null {
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      return null;
    }

    const docRelativePath = `docs/brief/${relativePath}`;
    const fmAnchors = FrontmatterAnchorHandler.extractAnchors(docRelativePath, content);
    const inlineAnchors = InlineAnchorHandler.extractAnchors(docRelativePath, content);
    const anchors: Anchor[] = [...fmAnchors, ...inlineAnchors];

    const fileName = basename(relativePath);
    const title = BriefDocumentReader.extractTitle(content, fileName);
    const category = BriefDocumentReader.extractCategory(content, relativePath);
    const status = BriefDocumentReader.extractStatus(content);
    const date = BriefDocumentReader.extractDate(content);
    const summary = BriefDocumentReader.extractSummary(content);

    return {
      filePath: docRelativePath,
      relativePath,
      fileName,
      title,
      category,
      status,
      date,
      summary,
      anchors,
      content,
    };
  }

  static extractTitle(content: string, fallback: string): string {
    const match = content.match(/^#\s+(?:Brief:\s*)?([^\r\n]+)/m);
    return match ? match[1].trim() : fallback.replace(/\.md$/, '');
  }

  static extractCategory(content: string, relativePath: string): string {
    const match = content.match(/>\s*\*\*Kategori\*\*:\s*\[?([a-zA-Z0-9_\-]+)/);
    if (match) return match[1].trim();

    const parts = relativePath.split('/');
    for (const part of parts) {
      if (['feature', 'bugfix', 'refactor', 'testing'].includes(part)) {
        return part;
      }
    }

    const fileName = basename(relativePath);
    const filePrefix = fileName.split('-')[0];
    if (['feature', 'bugfix', 'refactor', 'testing'].includes(filePrefix)) {
      return filePrefix;
    }
    return 'general';
  }

  static extractStatus(content: string): string {
    const match = content.match(/>\s*\*\*Status\*\*:\s*\[?([a-zA-Z0-9_\-\s]+)\]?/);
    if (match) {
      const raw = match[1].split('|')[0].trim();
      return raw || 'Draft';
    }
    return 'Draft';
  }

  static extractDate(content: string): string | undefined {
    const match = content.match(/>\s*\*\*Tanggal\*\*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    return match ? match[1].trim() : undefined;
  }

  static extractSummary(content: string): string {
    const goalMatch = content.match(/-\s*\*\*Tujuan Utama\*\*:\s*([^\r\n]+)/);
    if (goalMatch) return goalMatch[1].trim();

    const overviewMatch = content.match(
      /##\s+Overview & Problem Statement\r?\n+([\s\S]*?)(?:\r?\n##|$)/
    );
    if (overviewMatch) {
      const lines = overviewMatch[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter((l) => l.length > 0 && !l.startsWith('**Konteks'));
      if (lines.length > 0) return lines[0];
    }

    return 'Tidak ada ringkasan.';
  }
}
