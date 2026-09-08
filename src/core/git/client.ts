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
