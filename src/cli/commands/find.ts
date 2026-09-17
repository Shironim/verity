import { resolve } from 'node:path';
import { BriefSearchEngine, type BriefSearchOptions, type BriefSearchResult } from '../../core/anchor/search';

export interface FindCommandOptions extends BriefSearchOptions {
  cwd?: string;
  json?: boolean;
}

export async function runFindCommand(
  query?: string,
  options: FindCommandOptions = {}
): Promise<{ total: number; results: BriefSearchResult[] }> {
  const rootDir = resolve(options.cwd || process.cwd());
  const engine = new BriefSearchEngine(rootDir);

  const searchOpts: BriefSearchOptions = {
    ...options,
    query: query || options.query,
  };

  const results = await engine.search(searchOpts);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return { total: results.length, results };
  }

  if (results.length === 0) {
    console.log('\n\x1b[33m[!]\x1b[0m Tidak ditemukan spesifikasi brief yang cocok dengan kriteria pencarian.\n');
    return { total: 0, results: [] };
  }

  console.log(`\n🔍 [Verity Find] Ditemukan ${results.length} brief spesifikasi:\n`);

  for (const r of results) {
    const statusColor =
      r.status === 'Completed'
        ? '\x1b[32m'
        : r.status === 'Needs Reconciliation'
        ? '\x1b[31m'
        : '\x1b[34m';

    console.log(`📄 \x1b[1m${r.title}\x1b[0m (${statusColor}${r.status}\x1b[0m, \x1b[36m${r.category}\x1b[0m)`);
    console.log(`   Path   : \x1b[35m${r.filePath}\x1b[0m`);
    if (r.date) {
      console.log(`   Tanggal: ${r.date}`);
    }
    console.log(`   Tujuan : ${r.summary}`);
    if (r.anchors.length > 0) {
      const anchorList = r.anchors.map((a) => `${a.targetPath}${a.symbol ? '#' + a.symbol : ''}`).join(', ');
      console.log(`   Anchors: \x1b[33m${anchorList}\x1b[0m`);
    }
    if (r.matchReasons.length > 0) {
      console.log(`   Cocok  : \x1b[90m${r.matchReasons.join(' | ')}\x1b[0m`);
    }
    console.log('');
  }

  return { total: results.length, results };
}
