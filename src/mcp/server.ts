import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { VERITY_TOOLS, findTool } from './tools';

export const VERITY_INSTRUCTIONS = `Verity MCP Server — Deterministic Spec-Drift Integrity Gate
- Use 'verity_check' to verify if markdown specifications or brief anchors have drifted from code implementations.
- Use 'verity_link' to seal a brief to target code files/symbols and record the Git commit SHA.
- Use 'verity_status' for repository-wide specification health metrics.
- Use 'verity_reconcile_diff' to inspect code diffs for stale specs.
- Use 'verity_sync_manifest' to regenerate docs/brief/INDEX.md deterministically.
Never manually edit docs/brief/INDEX.md; always let Verity synchronize it.`;

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'verity-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: VERITY_INSTRUCTIONS,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: VERITY_TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args = {} } = request.params;
    const tool = findTool(name);

    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool name: '${name}'. Available tools: ${VERITY_TOOLS.map((t) => t.name).join(', ')}.`,
          },
        ],
      };
    }

    try {
      return await tool.handler(args);
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  });

  return server;
}

export async function runServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  runServer().catch((err) => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
