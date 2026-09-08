import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { GitClient } from '../../core/git/client';
import { ParserDispatcher } from '../../core/parser/dispatcher';
import { AnchorScanner } from '../../core/anchor/scanner';
import { BriefManifestGenerator } from '../../core/anchor/manifest';
import type { StalenessReport } from '../../core/types';

export interface CheckOptions {
  json?: boolean;
  ci?: boolean;
  quick?: boolean;
  syncIndex?: boolean;
}

interface QuickCacheData {
  headSha: string;
  allValid: boolean;
  timestamp: string;
  totalAnchors: number;
}

export async function runCheckCommand(
  targetScanPath?: string,
  options: CheckOptions = {}
): Promise<void> {
  const rootDir = process.cwd();
  const gitClient = new GitClient(rootDir);
  const cacheDir = resolve(rootDir, '.verity');
  const cacheFile = join(cacheDir, 'cache.json');

  // Evaluasi mode --quick (Cache-Aware untuk Antigravity Hook, <= 5ms)
  if (options.quick && gitClient.isGitRepository()) {
    try {
      const headSha = gitClient.getHeadSha();
      const statusOutput = execSync('git status --porcelain', {
        cwd: rootDir,
        encoding: 'utf8',
      }).trim();

      if (existsSync(cacheFile) && !statusOutput) {
        const cacheContent = JSON.parse(readFileSync(cacheFile, 'utf8')) as QuickCacheData;
        if (cacheContent.headSha === headSha && cacheContent.allValid) {
          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  cached: true,
                  total: cacheContent.totalAnchors,
                  staleCount: 0,
                  message: 'Cache hit: Working tree clean and HEAD SHA matches last verification.',
                },
                null,
                2
              )
            );
          } else {
            console.log(`\x1b[32m[CACHE HIT]\x1b[0m Working tree bersih & commit ${headSha.slice(0, 8)} terverifikasi valid.`);
          }
          return;
        }
      }
    } catch {
      // Jika cache gagal dibaca, fallback ke deep check di bawah
    }
  }

  const scanner = new AnchorScanner(rootDir);
  const dispatcher = new ParserDispatcher();
  const anchors = scanner.scan(targetScanPath);

  if (anchors.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ total: 0, reports: [] }, null, 2));
    } else {
      console.log('Tidak ditemukan anchor spesifikasi yang terdaftar.');
    }
    return;
  }

  const reports: StalenessReport[] = [];
  let hasStale = false;

  for (const anchor of anchors) {
    const fullTargetPath = resolve(rootDir, anchor.targetPath);

    if (!existsSync(fullTargetPath)) {
      reports.push({
        anchor,
        status: 'NOT_FOUND',
        message: `File target '${anchor.targetPath}' tidak ditemukan.`,
      });
      hasStale = true;
      continue;
    }

    try {
      const fileContent = readFileSync(fullTargetPath, 'utf8');
      const parseResult = await dispatcher.parse(
        anchor.targetPath,
        fileContent,
        anchor.symbol
      );

      if (anchor.symbol && !parseResult.found) {
        reports.push({
          anchor,
          status: 'NOT_FOUND',
          message: `Simbol '${anchor.symbol}' tidak ditemukan di dalam '${anchor.targetPath}'.`,
        });
        hasStale = true;
        continue;
      }

      if (parseResult.fingerprint === anchor.provenance.fingerprint) {
        reports.push({
          anchor,
          status: 'OK',
          currentFingerprint: parseResult.fingerprint,
        });
      } else {
        hasStale = true;
        const reconciliation = gitClient.getCommitMetadataSince(
          anchor.targetPath,
          anchor.provenance.commitSha
        );

        reports.push({
          anchor,
          status: 'STALE',
          currentFingerprint: parseResult.fingerprint,
          reconciliation: reconciliation || undefined,
          message: 'Fingerprint AST berubah sejak baseline commit.',
        });
      }
    } catch (err: any) {
      reports.push({
        anchor,
        status: 'ERROR',
        message: err.message,
      });
      hasStale = true;
    }
  }

  // Simpan cache jika berhasil dan git repo valid
  if (gitClient.isGitRepository()) {
    try {
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      const headSha = gitClient.getHeadSha();
      const cacheData: QuickCacheData = {
        headSha,
        allValid: !hasStale,
        timestamp: new Date().toISOString(),
        totalAnchors: anchors.length,
      };
      writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
    } catch {
      // Abaikan kegagalan penulisan cache
    }
  }

  // Sinkronisasi manifest index jika diminta via flag --sync-index
  if (options.syncIndex) {
    try {
      const manifestGen = new BriefManifestGenerator(rootDir);
      await manifestGen.generateAndSync();
    } catch (err: any) {
      console.error(`Warning: Gagal memperbarui manifest index: ${err.message}`);
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          total: reports.length,
          staleCount: reports.filter((r) => r.status !== 'OK').length,
          reports,
        },
        null,
        2
      )
    );
  } else {
    printFormattedReport(reports);
    if (options.syncIndex) {
      console.log('[OK] Manifest docs/brief/INDEX.md disinkronkan.');
    }
  }

  if (hasStale) {
    process.exit(1);
  }
}

function printFormattedReport(reports: StalenessReport[]) {
  console.log('\n=== Verity Spec-Drift Report ===\n');

  for (const report of reports) {
    const { anchor, status, reconciliation, message } = report;
    const target = `${anchor.targetPath}${anchor.symbol ? '#' + anchor.symbol : ''}`;
    const statusBadge =
      status === 'OK'
        ? '\x1b[32m[ OK ]\x1b[0m'
        : status === 'STALE'
        ? '\x1b[31m[ STALE ]\x1b[0m'
        : '\x1b[33m[ ' + status + ' ]\x1b[0m';

    console.log(`${statusBadge} ${anchor.specFile} -> ${target}`);
    console.log(`       Baseline SHA: ${anchor.provenance.commitSha.slice(0, 8)} (${anchor.kind})`);

    if (status === 'STALE') {
      if (reconciliation) {
        console.log(`       Changed by  : ${reconciliation.author} (${reconciliation.commitSha.slice(0, 8)})`);
        console.log(`       Commit Msg  : ${reconciliation.commitMessage}`);
        console.log(`       Date        : ${reconciliation.date}`);
      } else {
        console.log(`       Diff Info   : ${message || 'Modifikasi terdeteksi di luar git range'}`);
      }
    } else if (status !== 'OK' && message) {
      console.log(`       Reason      : ${message}`);
    }
    console.log('');
  }

  const okCount = reports.filter((r) => r.status === 'OK').length;
  const staleCount = reports.filter((r) => r.status === 'STALE').length;
  const otherCount = reports.length - okCount - staleCount;

  console.log('----------------------------------------------------');
  console.log(`Summary: ${okCount} OK, ${staleCount} STALE, ${otherCount} Error/NotFound (Total: ${reports.length})\n`);
}
