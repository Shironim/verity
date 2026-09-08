import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Anchor } from '../types';
import { FrontmatterAnchorHandler } from './frontmatter';
import { InlineAnchorHandler } from './inline';

export class AnchorScanner {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
  }

  /**
   * Mengumpulkan semua anchor dari target path (bisa file spesifik atau direktori).
   */
  scan(targetPath?: string): Anchor[] {
    const fullPath = targetPath ? resolve(this.rootDir, targetPath) : this.rootDir;
    if (!existsSync(fullPath)) return [];

    const stats = statSync(fullPath);
    if (stats.isFile()) {
      return this.scanFile(fullPath);
    }

    const files = this.collectMarkdownFiles(fullPath);
    const anchors: Anchor[] = [];
    for (const file of files) {
      anchors.push(...this.scanFile(file));
    }
    return anchors;
  }

  private scanFile(filePath: string): Anchor[] {
    if (!filePath.endsWith('.md')) return [];

    try {
      const content = readFileSync(filePath, 'utf8');
      const relativePath = filePath.startsWith(this.rootDir)
        ? filePath.slice(this.rootDir.length + 1).replace(/\\/g, '/')
        : filePath;

      const fmAnchors = FrontmatterAnchorHandler.extractAnchors(relativePath, content);
      const inlineAnchors = InlineAnchorHandler.extractAnchors(relativePath, content);

      return [...fmAnchors, ...inlineAnchors];
    } catch {
      return [];
    }
  }

  private collectMarkdownFiles(dir: string): string[] {
    const results: string[] = [];
    const ignored = new Set(['node_modules', '.git', '.agents', 'dist', 'build', '.idea', '.vscode']);

    const traverse = (currentDir: string) => {
      try {
        const entries = readdirSync(currentDir);
        for (const entry of entries) {
          if (ignored.has(entry)) continue;

          const full = join(currentDir, entry);
          const s = statSync(full);
          if (s.isDirectory()) {
            traverse(full);
          } else if (entry.endsWith('.md')) {
            results.push(full);
          }
        }
      } catch {
        // Abaikan direktori yang tidak dapat diakses
      }
    };

    traverse(dir);
    return results;
  }
}
