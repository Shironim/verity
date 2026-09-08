import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { parse } from 'yaml';
import { ParserDispatcher } from '../parser/dispatcher';
import { FrontmatterAnchorHandler } from './frontmatter';
import { InlineAnchorHandler } from './inline';
import type { Anchor } from '../types';

export interface BriefManifestEntry {
  fileName: string;
  title: string;
  category: string;
  status: string;
  lastChecked: string;
  summary: string;
  anchorCount: number;
}

export class BriefManifestGenerator {
  private readonly rootDir: string;
  private readonly briefDir: string;
  private readonly dispatcher = new ParserDispatcher();

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    this.briefDir = resolve(this.rootDir, 'docs/brief');
  }

  async generateAndSync(): Promise<{ total: number; entries: BriefManifestEntry[] }> {
    if (!existsSync(this.briefDir)) {
      return { total: 0, entries: [] };
    }

    const files = readdirSync(this.briefDir)
      .filter((f) => f.endsWith('.md') && f.toUpperCase() !== 'INDEX.MD')
      .sort();

    const entries: BriefManifestEntry[] = [];

    for (const file of files) {
      const fullPath = join(this.briefDir, file);
      const content = readFileSync(fullPath, 'utf8');
      const entry = await this.processBrief(file, content);
      entries.push(entry);
    }

    this.writeIndexMarkdown(entries);
    return { total: entries.length, entries };
  }

  private async processBrief(fileName: string, content: string): Promise<BriefManifestEntry> {
    const title = this.extractTitle(content, fileName);
    const category = this.extractCategory(content, fileName);
    const summary = this.extractSummary(content);
    const frontmatterStatus = this.extractStatus(content);

    // Ambil semua anchor yang ada di brief ini
    const relativePath = `docs/brief/${fileName}`;
    const fmAnchors = FrontmatterAnchorHandler.extractAnchors(relativePath, content);
    const inlineAnchors = InlineAnchorHandler.extractAnchors(relativePath, content);
    const anchors: Anchor[] = [...fmAnchors, ...inlineAnchors];

    let hasStale = false;
    for (const anchor of anchors) {
      const fullTarget = resolve(this.rootDir, anchor.targetPath);
      if (!existsSync(fullTarget)) {
        hasStale = true;
        break;
      }
      try {
        const codeContent = readFileSync(fullTarget, 'utf8');
        const parseResult = await this.dispatcher.parse(
          anchor.targetPath,
          codeContent,
          anchor.symbol
        );
        if (parseResult.fingerprint !== anchor.provenance.fingerprint) {
          hasStale = true;
          break;
        }
      } catch {
        hasStale = true;
        break;
      }
    }

    let finalStatus = frontmatterStatus;
    if (hasStale) {
      finalStatus = 'Needs Reconciliation';
    } else if (anchors.length > 0 && frontmatterStatus === 'Completed') {
      finalStatus = 'Completed';
    }

    return {
      fileName,
      title,
      category,
      status: finalStatus,
      lastChecked: new Date().toISOString().split('T')[0],
      summary,
      anchorCount: anchors.length,
    };
  }

  private extractTitle(content: string, fallback: string): string {
    const match = content.match(/^#\s+(?:Brief:\s*)?([^\r\n]+)/m);
    return match ? match[1].trim() : fallback.replace(/\.md$/, '');
  }

  private extractCategory(content: string, fileName: string): string {
    const match = content.match(/>\s*\*\*Kategori\*\*:\s*\[?([a-zA-Z0-9_\-]+)/);
    if (match) return match[1].trim();

    const filePrefix = fileName.split('-')[0];
    if (['feature', 'bugfix', 'refactor', 'testing'].includes(filePrefix)) {
      return filePrefix;
    }
    return 'general';
  }

  private extractStatus(content: string): string {
    const match = content.match(/>\s*\*\*Status\*\*:\s*\[?([a-zA-Z0-9_\-\s]+)\]?/);
    if (match) {
      const raw = match[1].split('|')[0].trim();
      return raw || 'Draft';
    }
    return 'Draft';
  }

  private extractSummary(content: string): string {
    // Cari '- **Tujuan Utama**:'
    const goalMatch = content.match(/-\s*\*\*Tujuan Utama\*\*:\s*([^\r\n]+)/);
    if (goalMatch) return goalMatch[1].trim();

    // Atau ambil baris pertama setelah Overview & Problem Statement
    const overviewMatch = content.match(/##\s+Overview & Problem Statement\r?\n+([\s\S]*?)(?:\r?\n##|$)/);
    if (overviewMatch) {
      const lines = overviewMatch[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter((l) => l.length > 0 && !l.startsWith('**Konteks'));
      if (lines.length > 0) return lines[0];
    }

    return 'Tidak ada ringkasan.';
  }

  private writeIndexMarkdown(entries: BriefManifestEntry[]): void {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const header = `# Brief Manifest Index

> **Single Source of Truth (SSOT) Manifest**  
> Terakhir Disinkronkan: ${now}  
> Dikelola otomatis oleh: \`verity index\` (Derived-Only Artifact — Dilarang Diedit Manual)

| Brief | Kategori | Status | Anchors | Ringkasan |
|---|---|---|:---:|---|
`;

    const rows = entries.map((e) => {
      const link = `[\`${e.fileName}\`](file:///docs/brief/${e.fileName})`;
      const statusBadge =
        e.status === 'Completed'
          ? '`Completed`'
          : e.status === 'Needs Reconciliation'
          ? '**`Needs Reconciliation`**'
          : `\`${e.status}\``;

      return `| ${link} | \`${e.category}\` | ${statusBadge} | ${e.anchorCount} | ${e.summary} |`;
    });

    const fullContent = header + rows.join('\n') + '\n';
    writeFileSync(join(this.briefDir, 'INDEX.md'), fullContent, 'utf8');
  }
}
