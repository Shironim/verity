import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Anchor } from '../types';
import { FrontmatterAnchorHandler } from './frontmatter';
import { InlineAnchorHandler } from './inline';

import { execSync } from 'node:child_process';

export interface ScannerOptions {
  forceFresh?: boolean;
}

export class AnchorScanner {
  private readonly rootDir: string;
  private readonly manifestPath: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    this.manifestPath = resolve(this.rootDir, '.verity', 'manifest.json');
  }

  getManifestPath(): string {
    return this.manifestPath;
  }

  loadManifest(): Anchor[] | null {
    try {
      if (!existsSync(this.manifestPath)) return null;
      const data = JSON.parse(readFileSync(this.manifestPath, 'utf8'));
      if (data && Array.isArray(data.anchors)) {
        return data.anchors;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveManifest(anchors: Anchor[]): void {
    try {
      const dir = resolve(this.rootDir, '.verity');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        totalAnchors: anchors.length,
        anchors,
      };
      writeFileSync(this.manifestPath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // Abaikan kegagalan penulisan manifest cache
    }
  }

  /**
   * Mengumpulkan semua anchor dari target path (bisa file spesifik atau direktori).
   * Memanfaatkan .verity/manifest.json cache jika pemindaian bersifat global dan
   * secara otomatis refresh jika ada perubahan file markdown pada working tree.
   */
  scan(targetPath?: string, options: ScannerOptions = {}): Anchor[] {
    const fullPath = targetPath ? resolve(this.rootDir, targetPath) : this.rootDir;
    if (!existsSync(fullPath)) return [];

    const stats = statSync(fullPath);
    if (stats.isFile()) {
      return this.scanFile(fullPath);
    }

    const isGlobalScan = !targetPath || fullPath === this.rootDir;
    let shouldForceFresh = options.forceFresh || false;

    // Otomatis refresh jika terdapat perubahan pada folder docs/ di working tree
    if (isGlobalScan && !shouldForceFresh) {
      try {
        const gitStatus = execSync('git status --porcelain docs/', {
          cwd: this.rootDir,
          encoding: 'utf8',
        }).trim();
        if (gitStatus) {
          shouldForceFresh = true;
        }
      } catch {
        // Abaikan jika bukan git repository
      }
    }

    // Gunakan centralized registry manifest jika pemindaian global/root dan tidak ada mutasi docs/
    if (isGlobalScan && !shouldForceFresh) {
      const cached = this.loadManifest();
      if (cached) {
        return cached;
      }
    }

    const files = this.collectMarkdownFiles(fullPath);
    const anchors: Anchor[] = [];
    for (const file of files) {
      anchors.push(...this.scanFile(file));
    }

    if (isGlobalScan) {
      this.saveManifest(anchors);
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
