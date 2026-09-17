import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ParserDispatcher } from '../parser/dispatcher';
import { BriefDocumentReader, type BriefDocument } from './reader';

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

    const files = BriefDocumentReader.collectBriefFiles(this.briefDir);
    const entries: BriefManifestEntry[] = [];

    for (const relativePath of files) {
      const fullPath = join(this.briefDir, relativePath);
      const doc = BriefDocumentReader.readBrief(fullPath, relativePath);
      if (!doc) continue;

      const entry = await this.processBrief(doc);
      entries.push(entry);
    }

    this.writeIndexMarkdown(entries);
    return { total: entries.length, entries };
  }

  private async processBrief(doc: BriefDocument): Promise<BriefManifestEntry> {
    const anchors = doc.anchors;

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

    let finalStatus = doc.status;
    if (hasStale) {
      finalStatus = 'Needs Reconciliation';
    } else if (anchors.length > 0 && doc.status === 'Completed') {
      finalStatus = 'Completed';
    }

    return {
      fileName: doc.relativePath,
      title: doc.title,
      category: doc.category,
      status: finalStatus,
      lastChecked: new Date().toISOString().split('T')[0],
      summary: doc.summary,
      anchorCount: anchors.length,
    };
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
