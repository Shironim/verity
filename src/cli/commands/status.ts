import { resolve } from 'node:path';
import { GitClient } from '../../core/git/client';
import { AnchorScanner } from '../../core/anchor/scanner';

export interface StatusCommandOptions {
  cwd?: string;
  json?: boolean;
}

export async function runStatusCommand(options: StatusCommandOptions = {}): Promise<number> {
  const rootDir = resolve(options.cwd || process.cwd());
  const gitClient = new GitClient(rootDir);
  const scanner = new AnchorScanner(rootDir);

  const isGit = gitClient.isGitRepository();
  let headSha: string | null = null;
  if (isGit) {
    try {
      headSha = gitClient.getHeadSha();
    } catch {
      headSha = null;
    }
  }

  const anchors = scanner.scan();
  const specFiles = new Set(anchors.map((a) => a.specFile));

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          isGitRepository: isGit,
          headSha: headSha ? headSha.slice(0, 8) : null,
          fullHeadSha: headSha,
          totalBriefs: specFiles.size,
          totalAnchors: anchors.length,
          specFiles: Array.from(specFiles),
        },
        null,
        2
      )
    );
    return 0;
  }

  console.log(`\n📊 [Verity Status] Ringkasan Kesehatan Repositori:\n`);
  console.log(`  Git Repository : ${isGit ? '\x1b[32mYes\x1b[0m' : '\x1b[31mNo\x1b[0m'}`);
  if (isGit) {
    console.log(`  HEAD Commit    : \x1b[33m${headSha ? headSha.slice(0, 8) : 'N/A'}\x1b[0m`);
  }
  console.log(`  Total Briefs   : \x1b[1m${specFiles.size}\x1b[0m dokumen spesifikasi`);
  console.log(`  Total Anchors  : \x1b[1m${anchors.length}\x1b[0m tautan kode aktif\n`);

  return 0;
}
