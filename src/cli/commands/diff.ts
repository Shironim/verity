import { resolve } from 'node:path';
import { GitClient } from '../../core/git/client';
import { AnchorScanner } from '../../core/anchor/scanner';

export interface DiffCommandOptions {
  cwd?: string;
  baselineSha?: string;
}

export async function runDiffCommand(
  targetArg?: string,
  options: DiffCommandOptions = {}
): Promise<number> {
  const rootDir = resolve(options.cwd || process.cwd());
  const gitClient = new GitClient(rootDir);

  if (!gitClient.isGitRepository()) {
    console.error('Error: Direktori kerja saat ini bukan repositori Git.');
    return 1;
  }

  if (!targetArg) {
    console.log('Usage: verity diff <target-code-file | spec-file> [--baseline <sha>]');
    return 1;
  }

  const scanner = new AnchorScanner(rootDir);
  const anchors = scanner.scan();

  // Cari matching anchor berdasarkan targetPath atau specFile
  const normArg = targetArg.replace(/\\/g, '/');
  const matchedAnchor = anchors.find(
    (a) =>
      a.targetPath.toLowerCase() === normArg.toLowerCase() ||
      a.specFile.toLowerCase() === normArg.toLowerCase() ||
      a.specFile.toLowerCase().endsWith(normArg.toLowerCase())
  );

  let baselineSha = options.baselineSha;
  let targetPath = normArg;

  if (matchedAnchor) {
    baselineSha = baselineSha || matchedAnchor.provenance.commitSha;
    targetPath = matchedAnchor.targetPath;
  }

  if (!baselineSha) {
    console.error(
      `Error: Tidak dapat menemukan baseline commit SHA untuk '${targetArg}'. Gunakan opsi --baseline <sha>.`
    );
    return 1;
  }

  const diffOutput = gitClient.getDiff(baselineSha, 'HEAD', targetPath);

  if (!diffOutput) {
    console.log(
      `\n\x1b[32m[OK]\x1b[0m Tidak ada perubahan kode pada '${targetPath}' sejak baseline commit ${baselineSha.slice(0, 8)}.\n`
    );
    return 0;
  }

  console.log(`\n📄 [Verity Diff] Perubahan pada '${targetPath}' (${baselineSha.slice(0, 8)}..HEAD):\n`);
  console.log(diffOutput);
  console.log('');
  return 0;
}
