const fs = require('fs');

/**
 * Membaca N baris terakhir dari file transcript.
 */
function readLastLines(filePath, maxLines = 150) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-maxLines);
  } catch (err) {
    return [];
  }
}

/**
 * Mengambil turn interaksi terbaru dari user beserta step-step setelahnya.
 */
function getLatestUserTurn(transcriptPath) {
  if (!transcriptPath) return { stepIndex: 0, content: '', turnSteps: [] };

  const lines = readLastLines(transcriptPath, 150);
  const steps = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      steps.push(JSON.parse(line));
    } catch (_) {}
  }

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === 'USER_INPUT') {
      return {
        stepIndex: steps[i].step_index,
        content: steps[i].content || '',
        turnSteps: steps.slice(i + 1)
      };
    }
  }

  return { stepIndex: 0, content: '', turnSteps: steps };
}

/**
 * Menghitung berapa kali investigasi/search tool dipanggil dalam turn user saat ini.
 */
function countCurrentTurnInvestigations(transcriptPath) {
  const userTurn = getLatestUserTurn(transcriptPath);
  let count = 0;
  const searchTools = new Set(['grep_search', 'find_by_name']);
  const searchMcpTools = new Set(['find_code', 'search_code', 'search_notes', 'ctx_search']);

  for (const step of userTurn.turnSteps) {
    if (step.tool_calls && Array.isArray(step.tool_calls)) {
      for (const call of step.tool_calls) {
        if (searchTools.has(call.name)) {
          count++;
        } else if (call.name === 'call_mcp_tool') {
          const args = call.args || {};
          const tool = args.ToolName || '';
          if (searchMcpTools.has(tool)) {
            count++;
          }
        }
      }
    }
  }

  return {
    count,
    latestUserPrompt: userTurn.content
  };
}

module.exports = {
  getLatestUserTurn,
  countCurrentTurnInvestigations
};
