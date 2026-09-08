import { execSync } from 'node:child_process';
import type { CommitMetadata } from '../types';

export class GitClient {
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.cwd,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  }

  getHeadSha(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.cwd,
        encoding: 'utf8',
      }).trim();
    } catch (err: any) {
      throw new Error(`Gagal mengambil HEAD commit SHA: ${err.message}`);
    }
  }

  getCommitMetadataSince(filePath: string, baselineSha?: string): CommitMetadata | null {
    try {
      const range = baselineSha ? `${baselineSha}..HEAD` : '-1';
      const cmd = `git log -1 --format="%an|%H|%s|%cI" ${range} -- "${filePath}"`;

      const output = execSync(cmd, {
        cwd: this.cwd,
        encoding: 'utf8',
      }).trim();

      if (!output) {
        // Fallback: ambil commit terakhir yang menyentuh file ini
        const fallbackCmd = `git log -1 --format="%an|%H|%s|%cI" -- "${filePath}"`;
        const fallbackOutput = execSync(fallbackCmd, {
          cwd: this.cwd,
          encoding: 'utf8',
        }).trim();

        if (!fallbackOutput) return null;
        return this.parseCommitLine(fallbackOutput);
      }

      return this.parseCommitLine(output);
    } catch {
      return null;
    }
  }

  getDiff(baselineSha: string, targetSha: string = 'HEAD', filePath?: string): string {
    try {
      const fileFilter = filePath ? ` -- "${filePath}"` : '';
      const cmd = `git diff ${baselineSha}..${targetSha}${fileFilter}`;
      return execSync(cmd, {
        cwd: this.cwd,
        encoding: 'utf8',
      }).trim();
    } catch {
      return '';
    }
  }

  /**
   * Mengumpulkan semua file yang mengalami mutasi sejak baselineSha (committed)
   * maupun perubahan lokal di working tree / staging index.
   */
  getChangedFilesSince(baselineSha?: string): Set<string> {
    const changed = new Set<string>();

    const addLines = (output: string) => {
      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) {
          changed.add(trimmed.replace(/\\/g, '/'));
        }
      }
    };

    try {
      // 1. Perubahan commit antara baselineSha dan HEAD (jika baselineSha diberikan)
      if (baselineSha) {
        const diffCmd = `git diff --name-only ${baselineSha}..HEAD`;
        const diffOutput = execSync(diffCmd, { cwd: this.cwd, encoding: 'utf8' }).trim();
        addLines(diffOutput);
      }

      // 2. Perubahan working tree (unstaged)
      const wtCmd = 'git diff --name-only';
      const wtOutput = execSync(wtCmd, { cwd: this.cwd, encoding: 'utf8' }).trim();
      addLines(wtOutput);

      // 3. Perubahan staging index
      const stagedCmd = 'git diff --cached --name-only';
      const stagedOutput = execSync(stagedCmd, { cwd: this.cwd, encoding: 'utf8' }).trim();
      addLines(stagedOutput);

      // 4. File baru / untracked / renamed di status
      const statusCmd = 'git status --porcelain -u';
      const statusOutput = execSync(statusCmd, { cwd: this.cwd, encoding: 'utf8' }).trim();
      for (const line of statusOutput.split('\n')) {
        if (!line.trim()) continue;
        const filePart = line.slice(3).trim();
        if (filePart.includes('->')) {
          const [oldF, newF] = filePart.split('->').map((s) => s.trim().replace(/^"|"$/g, ''));
          changed.add(oldF.replace(/\\/g, '/'));
          changed.add(newF.replace(/\\/g, '/'));
        } else {
          changed.add(filePart.replace(/^"|"$/g, '').replace(/\\/g, '/'));
        }
      }
    } catch {
      // Abaikan kegagalan perintah git
    }

    return changed;
  }

  /**
   * Mendeteksi apakah suatu file target pernah dipindahkan (renamed / moved)
   * baik di working tree maupun di riwayat git commit sejak baseline.
   */
  detectRenamedFile(oldPath: string, baselineSha?: string): string | null {
    const normOld = oldPath.replace(/\\/g, '/');

    try {
      // 1. Cek git status saat ini (working tree & staging) dengan similarity -M
      const statusOutput = execSync('git status --porcelain -M', {
        cwd: this.cwd,
        encoding: 'utf8',
      }).trim();

      for (const line of statusOutput.split('\n')) {
        if (line.includes('->')) {
          const filePart = line.slice(3).trim();
          const [oldF, newF] = filePart.split('->').map((s) => s.trim().replace(/^"|"$/g, ''));
          if (oldF.replace(/\\/g, '/') === normOld) {
            return newF.replace(/\\/g, '/');
          }
        }
      }

      // 2. Cek riwayat commit git diff sejak baselineSha
      const range = baselineSha ? `${baselineSha}..HEAD` : '-10';
      const diffCmd = `git diff -M --name-status ${range}`;
      const diffOutput = execSync(diffCmd, {
        cwd: this.cwd,
        encoding: 'utf8',
      }).trim();

      for (const line of diffOutput.split('\n')) {
        const parts = line.split('\t');
        if (parts[0] && parts[0].startsWith('R') && parts.length >= 3) {
          const src = parts[1].trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
          const dest = parts[2].trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
          if (src === normOld) {
            return dest;
          }
        }
      }
    } catch {
      // Abaikan kegagalan
    }

    return null;
  }

  private parseCommitLine(line: string): CommitMetadata | null {
    const parts = line.split('|');
    if (parts.length < 4) return null;

    return {
      author: parts[0] || 'Unknown',
      commitSha: parts[1] || '',
      commitMessage: parts[2] || '',
      date: parts[3] || '',
    };
  }
}
