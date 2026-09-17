#!/usr/bin/env node
import { runLinkCommand } from './commands/link';
import { runCheckCommand } from './commands/check';
import { runMcpCommand } from './commands/mcp';
import { runInitCommand } from './commands/init';
import { runFindCommand } from './commands/find';
import { runStatusCommand } from './commands/status';
import { runDiffCommand } from './commands/diff';
import { BriefManifestGenerator } from '../core/anchor/manifest';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Verity — Multi-Language Spec-Drift Detector

Usage:
  verity init [--yes, -y] [--hook] [--agent-hooks] [--skills]
    Inisialisasi direktori docs/brief/, manifest INDEX.md, panduan agent, pre-commit hook, agent lifecycle hooks, dan agent skills (to-brief, session-handover).

  verity link <spec-file> <anchor1> [anchor2 ...] [--inline]
    Menautkan spec markdown ke satu atau beberapa target file/symbol kode dan menyimpan baseline provenance.
    Contoh:
      verity link docs/brief/auth.md src/auth.ts#login src/components/Login.vue#submitForm
      verity link docs/brief/setup.md src/setup.ts --inline

  verity check [target-path] [--quick] [--sync-index] [--json] [--ci]
    Memindai seluruh anchor spesifikasi dan memeriksa staleness terhadap kode aktual.
    Contoh:
      verity check
      verity check --quick         # Cache-aware check (<= 5ms untuk Antigravity Hook)
      verity check --sync-index    # Periksa dan sinkronkan docs/brief/INDEX.md
      verity check --json

  verity status [--json]
    Tampilkan ringkasan kesehatan repositori, total brief, dan anchor aktif.

  verity diff <target-code-file | spec-file> [--baseline <sha>]
    Tampilkan git diff untuk file kode target sejak baseline provenance commit.

  verity find [query] [--target <file>] [--category <cat>] [--status <status>] [--month <YYYY-MM>] [--json]
    Cari brief spesifikasi berdasarkan kata kunci, file kode anchor target, kategori, status, atau bulan.
    Contoh:
      verity find auth
      verity find --target src/auth.ts
      verity find --category bugfix --month 2026-09

  verity index
    Menghasilkan atau menyinkronkan manifest docs/brief/INDEX.md secara otomatis.

  verity mcp
    Menjalankan Verity sebagai Model Context Protocol (MCP) Server via stdio JSON-RPC.

Options:
  --quick          Gunakan Git HEAD cache untuk verifikasi kilat
  --sync-index     Perbarui manifest docs/brief/INDEX.md setelah check
  --json           Format output sebagai JSON terstruktur
  --ci             Non-zero exit code jika ada anchor yang stale
  --help, -h       Tampilkan pesan bantuan ini
  --version, -v    Tampilkan versi Verity
`);
}

async function main() {
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log('verity v0.1.0');
    return;
  }

  if (command === 'init') {
    const isYes = args.includes('--yes') || args.includes('-y');
    const isHook = args.includes('--hook');
    const isAgentHooks = args.includes('--agent-hooks');
    const isSkills = args.includes('--skills');
    await runInitCommand({ yes: isYes, hook: isHook, agentHooks: isAgentHooks, skills: isSkills });
    return;
  }

  if (command === 'mcp') {
    await runMcpCommand();
    return;
  }

  if (command === 'link') {
    const specFile = args[1];
    const codeAnchors = args.slice(2).filter((a) => !a.startsWith('--'));
    const isInline = args.includes('--inline');

    if (!specFile || codeAnchors.length === 0) {
      console.error('Error: Argumen kurang. Format: verity link <spec-file> <anchor1> [anchor2 ...] [--inline]');
      process.exit(1);
    }

    await runLinkCommand(specFile, codeAnchors, { inline: isInline });
    return;
  }

  if (command === 'check') {
    const isJson = args.includes('--json');
    const isCi = args.includes('--ci');
    const isQuick = args.includes('--quick');
    const isSyncIndex = args.includes('--sync-index');
    // Ambil path opsional jika ada argumen selain flags
    const pathArg = args.slice(1).find((a) => !a.startsWith('--'));

    await runCheckCommand(pathArg, {
      json: isJson,
      ci: isCi,
      quick: isQuick,
      syncIndex: isSyncIndex,
    });
    return;
  }

  if (command === 'find') {
    const isJson = args.includes('--json');
    const getOptionValue = (flag: string) => {
      const idx = args.indexOf(flag);
      return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
    };

    const target = getOptionValue('--target');
    const category = getOptionValue('--category');
    const status = getOptionValue('--status');
    const month = getOptionValue('--month');

    // Query adalah argumen non-flag pertama setelah command 'find'
    const nonFlags = args.slice(1).filter((a, i, arr) => {
      if (a.startsWith('--')) return false;
      const prev = arr[i - 1];
      if (prev && ['--target', '--category', '--status', '--month'].includes(prev)) return false;
      return true;
    });
    const query = nonFlags[0];

    await runFindCommand(query, {
      target,
      category,
      status,
      month,
      json: isJson,
    });
    return;
  }

  if (command === 'status') {
    const isJson = args.includes('--json');
    await runStatusCommand({ json: isJson });
    return;
  }

  if (command === 'diff') {
    const targetArg = args.slice(1).find((a) => !a.startsWith('--'));
    const baselineIdx = args.indexOf('--baseline');
    const baselineSha = baselineIdx !== -1 && baselineIdx + 1 < args.length ? args[baselineIdx + 1] : undefined;
    await runDiffCommand(targetArg, { baselineSha });
    return;
  }

  if (command === 'index') {
    const manifestGen = new BriefManifestGenerator(process.cwd());
    const { total } = await manifestGen.generateAndSync();
    console.log(`[OK] Manifest docs/brief/INDEX.md berhasil disinkronkan (${total} brief).`);
    return;
  }

  console.error(`Error: Perintah '${command}' tidak dikenali.`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
