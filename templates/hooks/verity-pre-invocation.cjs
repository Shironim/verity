const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getVerityCommand(workspaceRoot) {
  if (fs.existsSync(path.join(workspaceRoot, 'src/cli/index.ts'))) {
    return 'bun run src/cli/index.ts';
  }
  return 'verity';
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch (_) {
    return '';
  }
}

const VERITY_DOMAIN_REGEX = /\b(verity|brief|spec-drift|provenance|anchor)\b/i;

function readTailLines(filePath, maxBytes = 32768) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    if (fileSize === 0) return [];
    const bytesToRead = Math.min(fileSize, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, bytesToRead, fileSize - bytesToRead);
    } finally {
      fs.closeSync(fd);
    }
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    // Jika buffer membaca dari tengah file, baris pertama kemungkinan terpotong parsial
    if (bytesToRead < fileSize && lines.length > 1) {
      lines.shift();
    }
    return lines;
  } catch (_) {
    return [];
  }
}

function isVerityActive(data) {
  // 1. Cek jika user prompt langsung mengandung kata kunci domain Verity
  const userInput = data.userInput || data.user_input || data.prompt || data.rawPrompt || '';
  if (VERITY_DOMAIN_REGEX.test(userInput)) {
    return true;
  }

  // 2. Cek transcript dengan O(1) Tail-Read (Turn-Bounded)
  const transcriptPath = data.transcriptPath || data.transcript_path || data.transcriptFile || data.transcript_file || '';
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    const lines = readTailLines(transcriptPath);
    let userTurnsEncountered = 0;

    // Pindai mundur dari langkah paling akhir
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      let step;
      try {
        step = JSON.parse(line);
      } catch (_) {
        continue;
      }

      // Deteksi panggilan tool Verity dalam turn aktif/terkini
      if (step.type === 'PLANNER_RESPONSE' && Array.isArray(step.tool_calls)) {
        for (const tc of step.tool_calls) {
          const name = tc.name || '';
          const args = tc.args || {};
          if (name.startsWith('verity_')) return true;
          if (name === 'call_mcp_tool' && (args.ServerName === 'verity' || (args.ToolName && args.ToolName.startsWith('verity_')))) return true;
          if (name === 'run_command' && args.CommandLine && VERITY_DOMAIN_REGEX.test(args.CommandLine)) return true;
        }
      }

      // Jika menemukan batas USER_INPUT
      if (step.type === 'USER_INPUT') {
        userTurnsEncountered++;
        const content = typeof step.content === 'string' ? step.content : JSON.stringify(step.content || '');
        if (VERITY_DOMAIN_REGEX.test(content)) {
          return true;
        }
        // Berhenti setelah memeriksa batas turn aktif (maksimal 1 turn ke belakang)
        if (userTurnsEncountered >= 1) {
          break;
        }
      }
    }
  }

  return false;
}

function main() {
  const rawInput = readStdin();
  let workspaceRoot = process.cwd();
  let data = {};

  if (rawInput.trim()) {
    try {
      data = JSON.parse(rawInput);
      if (data.workspacePaths && data.workspacePaths.length > 0) {
        workspaceRoot = data.workspacePaths[0];
      }
    } catch (_) {}
  }

  // JIKA VERITY TIDAK DIPANGGIL: Jangan inject mandat apa pun ke system prompt di awal
  if (!isVerityActive(data)) {
    process.stdout.write('{}');
    process.exit(0);
  }

  const mandateLines = [
    '[VERITY SPEC-DRIVEN MANDATE]',
    '• Spec as SSOT: Always consult and align with docs/brief/[slug].md before modifying code.',
    '• Zero Kludge: Strictly prohibit hacky workarounds ("tambal sulam") and tech-debt shortcuts.',
    '• Industry Standard: Fix root causes via robust, production-grade architecture (12-Factor, SSOT).',
    '• Provenance Integrity: Always seal completed briefs and anchors using `verity link`.'
  ];

  const messages = [mandateLines.join('\n')];

  try {
    // Jalankan pemeriksaan kilat Verity (cache-aware SHA, <= 5ms)
    const verityCmd = getVerityCommand(workspaceRoot);
    const cmdOutput = execSync(`${verityCmd} check --quick --json`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const parsed = JSON.parse(cmdOutput.trim());
    const staleCount = parsed.staleCount || 0;
    const errorCount = (parsed.reports || []).filter(r => r.status === 'ERROR' || r.status === 'NOT_FOUND').length;

    if (staleCount > 0 || errorCount > 0) {
      const staleItems = (parsed.reports || [])
        .filter(r => r.status === 'STALE' || r.status === 'ERROR' || r.status === 'NOT_FOUND')
        .map(r => (r.specPath || r.targetFile || r.brief || r.file || '').split('/').pop())
        .filter(Boolean);
      const staleListStr = staleItems.length > 0 ? ` on: ${[...new Set(staleItems)].slice(0, 3).join(', ')}${staleItems.length > 3 ? '...' : ''}` : '';

      const warningMessage = 
        `[VERITY DRIFT AWARENESS] Found ${staleCount} STALE and ${errorCount} ERROR/NOT_FOUND anchor(s) in docs/brief/${staleListStr}.\n` +
        `CONTINUITY NOTE: This warning ONLY applies if your current task touches the files/briefs listed above.\n` +
        `If you are working on an independent new feature or brief, ignore this warning and proceed with your work.`;

      messages.push(warningMessage);
    }
  } catch (_) {
    // Fail-safe fallback if check fails; mandate is still injected
  }

  process.stdout.write(JSON.stringify({
    injectSteps: [
      {
        ephemeralMessage: messages.join('\n\n')
      }
    ]
  }));
  process.exit(0);
}

main();
