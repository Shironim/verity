import { runServer } from '../../mcp/server';

export async function runMcpCommand(): Promise<void> {
  // Stdout is reserved exclusively for JSON-RPC framing in stdio mode.
  // Diagnostics must go to stderr.
  process.stderr.write('Verity MCP Server starting in stdio mode...\n');
  await runServer();
}
