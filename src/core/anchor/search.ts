import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { BriefDocumentReader, type BriefDocument } from './reader';
import type { Anchor } from '../types';

export interface BriefSearchOptions {
  query?: string;
  target?: string;
  category?: string;
  status?: string;
  month?: string;
  limit?: number;
}

export interface BriefSearchResult {
  filePath: string;
  relativePath: string;
  title: string;
  category: string;
  status: string;
  date?: string;
  summary: string;
  anchors: Anchor[];
  score: number;
  matchReasons: string[];
}

export class BriefSearchEngine {
  private readonly rootDir: string;
  private readonly briefDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    this.briefDir = resolve(this.rootDir, 'docs/brief');
  }

  /**
   * Cari brief spesifikasi berdasarkan kriteria query teks, target code anchor,
   * kategori, status pengerjaan, atau periode bulan.
   */
  async search(options: BriefSearchOptions = {}): Promise<BriefSearchResult[]> {
    if (!existsSync(this.briefDir)) {
      return [];
    }

    const files = BriefDocumentReader.collectBriefFiles(this.briefDir);
    const results: BriefSearchResult[] = [];

    const normQuery = options.query?.trim().toLowerCase();
    const normTarget = options.target?.trim().toLowerCase();
    const normCategory = options.category?.trim().toLowerCase();
    const normStatus = options.status?.trim().toLowerCase();
    const normMonth = options.month?.trim().toLowerCase();

    for (const relativePath of files) {
      const fullPath = join(this.briefDir, relativePath);
      const doc = BriefDocumentReader.readBrief(fullPath, relativePath);
      if (!doc) continue;

      const { filePath, title, category, status, date, summary, anchors, content } = doc;

      let score = 0;
      const matchReasons: string[] = [];

      // 1. Filter Kategori
      if (normCategory) {
        if (category.toLowerCase() !== normCategory) {
          continue;
        }
        matchReasons.push(`Category match: ${category}`);
      }

      // 2. Filter Status
      if (normStatus) {
        if (status.toLowerCase() !== normStatus) {
          continue;
        }
        matchReasons.push(`Status match: ${status}`);
      }

      // 3. Filter Bulan (YYYY-MM)
      if (normMonth) {
        const pathMatchesMonth = relativePath.toLowerCase().includes(normMonth);
        const dateMatchesMonth = date?.toLowerCase().includes(normMonth);
        if (!pathMatchesMonth && !dateMatchesMonth) {
          continue;
        }
        matchReasons.push(`Month match: ${normMonth}`);
      }

      // 4. Reverse Lookup: Target Code Anchor
      if (normTarget) {
        const matchingAnchor = anchors.find((a) => {
          const targetNorm = a.targetPath.toLowerCase();
          const symbolNorm = a.symbol?.toLowerCase() || '';
          return (
            targetNorm.includes(normTarget) ||
            normTarget.includes(targetNorm) ||
            (symbolNorm && symbolNorm.includes(normTarget))
          );
        });

        if (!matchingAnchor) {
          continue;
        }

        score += 50;
        matchReasons.push(`Target anchor match: ${matchingAnchor.targetPath}${matchingAnchor.symbol ? '#' + matchingAnchor.symbol : ''}`);
      }

      // 5. Query Full-Text / Keyword
      if (normQuery) {
        const queryTerms = normQuery.split(/\s+/).filter(Boolean);
        let queryMatches = 0;

        for (const term of queryTerms) {
          if (title.toLowerCase().includes(term)) {
            score += 30;
            queryMatches++;
            matchReasons.push(`Title contains "${term}"`);
          }
          if (summary.toLowerCase().includes(term)) {
            score += 15;
            queryMatches++;
            matchReasons.push(`Summary contains "${term}"`);
          }
          if (relativePath.toLowerCase().includes(term)) {
            score += 20;
            queryMatches++;
            matchReasons.push(`Path contains "${term}"`);
          }
          if (content.toLowerCase().includes(term)) {
            score += 5;
            queryMatches++;
          }
        }

        if (queryMatches === 0) {
          continue;
        }
      }

      // Default score jika filter tanpa query spesifik
      if (!normQuery && !normTarget) {
        score = 10;
      }

      results.push({
        filePath: doc.filePath,
        relativePath: doc.relativePath,
        title: doc.title,
        category: doc.category,
        status: doc.status,
        date: doc.date,
        summary: doc.summary,
        anchors: doc.anchors,
        score,
        matchReasons,
      });
    }

    // Urutkan berdasarkan score tertinggi, lalu abjad relativePath
    results.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));

    const limit = options.limit || 50;
    return results.slice(0, limit);
  }
}
