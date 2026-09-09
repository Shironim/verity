const fs = require('fs');
const { execSync } = require('child_process');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch (_) {
    return '';
  }
}

function main() {
  const rawInput = readStdin();
  let workspaceRoot = process.cwd();

  if (rawInput.trim()) {
    try {
      const data = JSON.parse(rawInput);
      if (data.workspacePaths && data.workspacePaths.length > 0) {
        workspaceRoot = data.workspacePaths[0];
      }
    } catch (_) {}
  }

  try {
    // Jalankan pemeriksaan kilat Verity (cache-aware SHA, <= 5ms)
    const cmdOutput = execSync('bun run src/cli/index.ts check --quick --json', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const parsed = JSON.parse(cmdOutput.trim());
    const staleCount = parsed.staleCount || 0;
    const errorCount = (parsed.reports || []).filter(r => r.status === 'ERROR').length;

    if (staleCount > 0 || errorCount > 0) {
      const staleItems = (parsed.reports || [])
        .filter(r => r.status === 'STALE' || r.status === 'ERROR')
        .map(r => (r.specPath || r.targetFile || r.brief || r.file || '').split('/').pop())
        .filter(Boolean);
      const staleListStr = staleItems.length > 0 ? ` pada: ${[...new Set(staleItems)].slice(0, 3).join(', ')}${staleItems.length > 3 ? '...' : ''}` : '';

      const warningMessage = 
        `[VERITY DRIFT AWARENESS] Ditemukan ${staleCount} anchor STALE dan ${errorCount} ERROR di docs/brief/${staleListStr}.\n` +
        `CATATAN KONTUINUITAS: Peringatan ini HANYA berlaku jika tugas Anda menyentuh file/brief di atas.\n` +
        `Jika Anda sedang mengerjakan fitur atau brief baru yang independen, abaikan peringatan ini dan lanjutkan pekerjaan tanpa ragu.`;

      process.stdout.write(JSON.stringify({
        injectSteps: [
          {
            ephemeralMessage: warningMessage
          }
        ]
      }));
      process.exit(0);
    }
  } catch (_) {
    // Abaikan error eksekusi agar tidak mengganggu alur percakapan
  }

  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

main();
