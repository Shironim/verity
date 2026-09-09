const fs = require('fs');
const { execSync } = require('child_process');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch (_) {
    return '';
  }
}

function sendDecision(decision, reason) {
  const payload = { decision };
  if (reason) payload.reason = reason;
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function handlePostTool(data) {
  const toolCall = data.toolCall || {};
  const args = toolCall.args || {};
  const targetFile = args.TargetFile || args.targetFile || '';
  const normalizedPath = targetFile.replace(/\\/g, '/');

  // Abaikan jika target file adalah INDEX.md itu sendiri (mencegah infinite loop)
  if (/(docs\/brief\/INDEX\.md|docs\/handover\/INDEX\.md|handover\/INDEX\.md)$/i.test(normalizedPath)) {
    process.stdout.write('{}');
    process.exit(0);
  }

  // Hanya picu sync jika file yang dimodifikasi berada di src/ atau docs/brief/
  const isWatchedTarget = /\/(src|docs\/brief)\//i.test(normalizedPath);

  if (isWatchedTarget) {
    let workspaceRoot = process.cwd();
    if (data.workspacePaths && data.workspacePaths.length > 0) {
      workspaceRoot = data.workspacePaths[0];
    }

    try {
      execSync('bun run src/cli/index.ts check --quick --sync-index', {
        cwd: workspaceRoot,
        stdio: 'ignore',
        timeout: 4000
      });
    } catch (_) {
      // Fail-safe: abaikan error agar tidak memblokir workflow agent
    }
  }

  process.stdout.write('{}');
  process.exit(0);
}

function handlePreTool(data) {
  const toolCall = data.toolCall || {};
  const args = toolCall.args || {};

  // 1. Pelindung File Turunan (Derived Shield)
  const targetFile = args.TargetFile || args.targetFile || '';
  const normalizedPath = targetFile.replace(/\\/g, '/');
  const isDerivedManifest = /(docs\/brief\/INDEX\.md|docs\/handover\/INDEX\.md)$/i.test(normalizedPath);

  if (isDerivedManifest) {
    sendDecision(
      'deny',
      `[VERITY SHIELD] File '${normalizedPath.split('/').pop()}' adalah Derived-Only Artifact.\n` +
      `DILARANG mengedit atau menulis file manifest ini secara manual!\n` +
      `Tabel manifest digenerate 100% secara deterministik oleh Verity CLI. Jalankan 'bun run verity check --sync-index' untuk memperbarui manifest.`
    );
  }

  // 2. Pengawal Anchor Keterlacakan (Anchor Guard)
  const targetContent = args.TargetContent || '';
  const replacementContent = args.ReplacementContent || '';

  const anchorPattern = /(@verity|## Provenance|<!--\s*@verity)/i;
  const hadAnchor = anchorPattern.test(targetContent);
  const keepsAnchor = anchorPattern.test(replacementContent);

  if (hadAnchor && !keepsAnchor) {
    sendDecision(
      'force_ask',
      `[VERITY ANCHOR GUARD] Potensi penghapusan tag/blok keterlacakan Verity (@verity / Provenance) terdeteksi pada operasi edit ini.\n` +
      `Pastikan penghapusan metadata keterlacakan ini memang disengaja sebelum melanjutkan.`
    );
  }

  sendDecision('allow');
}

function main() {
  const rawInput = readStdin();
  const isPost = process.argv.includes('--post');

  if (!rawInput.trim()) {
    if (isPost) {
      process.stdout.write('{}');
    } else {
      sendDecision('allow');
    }
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(rawInput);
  } catch (_) {
    if (isPost) {
      process.stdout.write('{}');
    } else {
      sendDecision('allow');
    }
    process.exit(0);
  }

  if (isPost) {
    handlePostTool(data);
  } else {
    handlePreTool(data);
  }
}

main();
