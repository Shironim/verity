#!/usr/bin/env bun
import { runLinkCommand } from './commands/link';
import { runCheckCommand } from './commands/check';
import { runMcpCommand } from './commands/mcp';
import { runInitCommand } from './commands/init';
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
