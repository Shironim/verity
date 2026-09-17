import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GitClient } from '../core/git/client';
import { ParserDispatcher } from '../core/parser/dispatcher';
import { AnchorScanner } from '../core/anchor/scanner';
import { FrontmatterAnchorHandler } from '../core/anchor/frontmatter';
import { InlineAnchorHandler } from '../core/anchor/inline';
import { BriefManifestGenerator } from '../core/anchor/manifest';
import { BriefSearchEngine } from '../core/anchor/search';
import { runInitCommand } from '../cli/commands/init';
import type { StalenessReport } from '../core/types';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

export const VERITY_TOOLS: McpToolDefinition[] = [
  {
    name: 'verity_check',
    description:
      'Audit spec-drift across registered anchors or specific document/path. Returns structured status (OK/STALE/NOT_FOUND), baseline commit SHA, current fingerprint, and git reconciliation metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        targetScanPath: {
          type: 'string',
          description: 'Optional path to specific markdown spec file or folder to audit.',
        },
        quick: {
          type: 'boolean',
          description: 'Optional fast evaluation using clean git working tree cache (<= 5ms).',
        },
      },
    },
    handler: async (args) => {
      const rootDir = process.cwd();
      const gitClient = new GitClient(rootDir);
      const scanner = new AnchorScanner(rootDir);
      const dispatcher = new ParserDispatcher();

      const anchors = scanner.scan(args?.targetScanPath);
      if (anchors.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { total: 0, staleCount: 0, reports: [], message: 'No registered spec anchors found.' },
                null,
                2
              ),
            },
          ],
        };
      }

      const reports: StalenessReport[] = [];
      let staleCount = 0;

      for (const anchor of anchors) {
        const fullTargetPath = resolve(rootDir, anchor.targetPath);

        if (!existsSync(fullTargetPath)) {
          reports.push({
            anchor,
            status: 'NOT_FOUND',
            message: `Target file '${anchor.targetPath}' does not exist.`,
          });
          staleCount++;
          continue;
        }

        try {
          const fileContent = readFileSync(fullTargetPath, 'utf8');
          const parseResult = await dispatcher.parse(
            anchor.targetPath,
            fileContent,
            anchor.symbol
          );

          if (anchor.symbol && !parseResult.found) {
            reports.push({
              anchor,
              status: 'NOT_FOUND',
              message: `Symbol '${anchor.symbol}' was not found in '${anchor.targetPath}'.`,
            });
            staleCount++;
            continue;
          }

          if (parseResult.fingerprint === anchor.provenance.fingerprint) {
            reports.push({
              anchor,
              status: 'OK',
              currentFingerprint: parseResult.fingerprint,
            });
          } else {
            staleCount++;
            const reconciliation = gitClient.getCommitMetadataSince(
              anchor.targetPath,
              anchor.provenance.commitSha
            );

            reports.push({
              anchor,
              status: 'STALE',
              currentFingerprint: parseResult.fingerprint,
              reconciliation: reconciliation || undefined,
              message: 'Normalized AST fingerprint shifted since baseline provenance commit.',
            });
          }
        } catch (err: any) {
          reports.push({
            anchor,
            status: 'ERROR',
            message: `Parser error: ${err.message}`,
          });
          staleCount++;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total: anchors.length,
                staleCount,
                okCount: anchors.length - staleCount,
                reports,
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: 'verity_link',
    description:
      'Link a markdown spec to one or more code anchors (file or file#symbol). Automatically extracts normalized AST fingerprints and seals the current Git HEAD commit SHA.',
    inputSchema: {
      type: 'object',
      properties: {
        specFilePath: {
          type: 'string',
          description: 'Relative path to the markdown specification file (e.g. docs/brief/feature-auth.md).',
        },
        codeAnchors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of target code anchors (e.g. ["src/auth.ts", "src/user.ts#getUser"]).',
        },
        inline: {
          type: 'boolean',
          description: 'If true, append inline comment tags instead of updating frontmatter YAML.',
        },
      },
      required: ['specFilePath', 'codeAnchors'],
    },
    handler: async (args) => {
      const rootDir = process.cwd();
      const gitClient = new GitClient(rootDir);

      if (!gitClient.isGitRepository()) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: Current directory is not a Git repository.' }],
        };
      }

      const resolvedSpec = resolve(rootDir, args.specFilePath);
      if (!existsSync(resolvedSpec)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error: Spec file not found at ${args.specFilePath}` }],
        };
      }

      const anchorsList: string[] = Array.isArray(args.codeAnchors)
        ? args.codeAnchors
        : [args.codeAnchors];

      if (anchorsList.length === 0) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: At least one code anchor must be provided.' }],
        };
      }

      let headSha: string;
      try {
        headSha = gitClient.getHeadSha();
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error retrieving HEAD SHA: ${err.message}` }],
        };
      }

      const dispatcher = new ParserDispatcher();
      let specContent = readFileSync(resolvedSpec, 'utf8');
      const linkedAnchors: Array<{ target: string; symbol?: string; fingerprint: string }> = [];

      for (const anchorArg of anchorsList) {
        const [targetPath, targetSymbol] = anchorArg.split('#');
        const resolvedTarget = resolve(rootDir, targetPath);

        if (!existsSync(resolvedTarget)) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Error: Target code file not found: ${targetPath}` }],
          };
        }

        const fileContent = readFileSync(resolvedTarget, 'utf8');
        const parseResult = await dispatcher.parse(targetPath, fileContent, targetSymbol);

        if (targetSymbol && !parseResult.found) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error: Symbol '${targetSymbol}' not found in target file '${targetPath}'`,
              },
            ],
          };
        }

        linkedAnchors.push({
          target: targetPath,
          symbol: targetSymbol,
          fingerprint: parseResult.fingerprint,
        });

        const provenanceData = {
          commitSha: headSha,
          fingerprint: parseResult.fingerprint,
          timestamp: new Date().toISOString(),
        };

        if (args.inline) {
          specContent = InlineAnchorHandler.appendInlineTag(specContent, {
            targetPath,
            symbol: targetSymbol,
            provenance: provenanceData,
          });
        } else {
          specContent = FrontmatterAnchorHandler.upsertAnchor(specContent, {
            targetPath,
            symbol: targetSymbol,
            provenance: provenanceData,
          });
        }
      }

      writeFileSync(resolvedSpec, specContent, 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                specFilePath: args.specFilePath,
                headSha: headSha.slice(0, 8),
                fullSha: headSha,
                linkedCount: linkedAnchors.length,
                anchors: linkedAnchors,
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: 'verity_status',
    description:
      'Provides a high-level health report of all tracked specifications, anchors, and Git repository state.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const rootDir = process.cwd();
      const gitClient = new GitClient(rootDir);
      const scanner = new AnchorScanner(rootDir);
      const isGit = gitClient.isGitRepository();
      const headSha = isGit ? gitClient.getHeadSha() : null;

      const anchors = scanner.scan();
      const specFiles = new Set(anchors.map((a) => a.specFile));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                isGitRepository: isGit,
                headSha: headSha ? headSha.slice(0, 8) : null,
                totalBriefs: specFiles.size,
                totalAnchors: anchors.length,
                specFiles: Array.from(specFiles),
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: 'verity_reconcile_diff',
    description:
      'Extract the exact git diff for a stale code anchor between its baseline provenance commit SHA and current HEAD.',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: {
          type: 'string',
          description: 'Relative path to the target code file.',
        },
        baselineSha: {
          type: 'string',
          description: 'Baseline Git commit SHA. If omitted, it will be looked up from registered anchors.',
        },
        specFilePath: {
          type: 'string',
          description: 'Optional spec file to locate the baseline SHA.',
        },
      },
      required: ['targetPath'],
    },
    handler: async (args) => {
      const rootDir = process.cwd();
      const gitClient = new GitClient(rootDir);

      if (!gitClient.isGitRepository()) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: Current directory is not a Git repository.' }],
        };
      }

      let baselineSha = args.baselineSha;
      if (!baselineSha) {
        const scanner = new AnchorScanner(rootDir);
        const anchors = scanner.scan(args.specFilePath);
        const matched = anchors.find((a) => a.targetPath === args.targetPath);
        if (matched) {
          baselineSha = matched.provenance.commitSha;
        }
      }

      if (!baselineSha) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: Could not determine baseline commit SHA for ${args.targetPath}. Please provide 'baselineSha'.`,
            },
          ],
        };
      }

      const diff = gitClient.getDiff(baselineSha, 'HEAD', args.targetPath);
      const commitMeta = gitClient.getCommitMetadataSince(args.targetPath, baselineSha);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                targetPath: args.targetPath,
                baselineSha: baselineSha.slice(0, 8),
                headSha: gitClient.getHeadSha().slice(0, 8),
                commitMetadata: commitMeta,
                diffLength: diff.length,
                diff: diff || '(No file content differences between baseline and HEAD)',
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    name: 'verity_sync_manifest',
    description:
      'Deterministically synchronize the brief manifest index at docs/brief/INDEX.md based on active brief documents.',
    inputSchema: {
      type: 'object',
      properties: {
        docsDir: {
          type: 'string',
          description: 'Optional directory containing markdown briefs (defaults to docs/brief).',
        },
        outputFile: {
          type: 'string',
          description: 'Optional destination manifest file (defaults to docs/brief/INDEX.md).',
        },
      },
    },
    handler: async (args) => {
      const rootDir = process.cwd();
      const generator = new BriefManifestGenerator(rootDir);

      try {
        const manifestResult = await generator.generateAndSync();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  outputFile: 'docs/brief/INDEX.md',
                  totalBriefs: manifestResult.total,
                  entries: manifestResult.entries.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to generate index manifest: ${err.message}` }],
        };
      }
    },
  },
  {
    name: 'verity_find',
    description:
      'Search across task briefs and specifications by query text, target code anchor, category, status, or month.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional keyword to search across brief titles, summaries, and contents.',
        },
        target: {
          type: 'string',
          description: 'Optional file path or symbol to find briefs that anchor this code location (reverse-lookup).',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (feature, bugfix, refactor, testing).',
        },
        status: {
          type: 'string',
          description: 'Optional status filter (Draft, In Progress, Completed, Needs Reconciliation).',
        },
        month: {
          type: 'string',
          description: 'Optional period filter in YYYY-MM format (e.g. 2026-09).',
        },
        limit: {
          type: 'number',
          description: 'Optional maximum number of results to return (defaults to 20).',
        },
      },
    },
    handler: async (args) => {
      const rootDir = process.cwd();
      const engine = new BriefSearchEngine(rootDir);

      try {
        const results = await engine.search({
          query: args?.query,
          target: args?.target,
          category: args?.category,
          status: args?.status,
          month: args?.month,
          limit: args?.limit || 20,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: results.length,
                  results: results.map((r) => ({
                    filePath: r.filePath,
                    title: r.title,
                    category: r.category,
                    status: r.status,
                    date: r.date,
                    summary: r.summary,
                    anchors: r.anchors.map((a) => `${a.targetPath}${a.symbol ? '#' + a.symbol : ''}`),
                    matchReasons: r.matchReasons,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to search briefs: ${err.message}` }],
        };
      }
    },
  },
  {
    name: 'verity_init',
    description:
      'Initialize an autonomous project environment with docs/brief/, AGENTS.md guidelines, INDEX.md manifest, pre-commit hook, agent lifecycle hooks, and skills.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Optional target workspace root directory (defaults to current working directory).',
        },
        yes: {
          type: 'boolean',
          description: 'Accept all defaults and install all components (hooks, skills, etc.).',
        },
        hook: {
          type: 'boolean',
          description: 'Install Git pre-commit hook.',
        },
        agentHooks: {
          type: 'boolean',
          description: 'Install Agent Lifecycle Hooks in .agents/hooks/.',
        },
        skills: {
          type: 'boolean',
          description: 'Install agent skills in .agents/skills/.',
        },
      },
    },
    handler: async (args) => {
      const rootDir = resolve(args?.cwd || process.cwd());
      try {
        const result = await runInitCommand({
          cwd: rootDir,
          yes: args?.yes ?? true,
          hook: args?.hook,
          agentHooks: args?.agentHooks,
          skills: args?.skills,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  rootDir,
                  result,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to initialize Verity: ${err.message}` }],
        };
      }
    },
  },
];

export function findTool(name: string): McpToolDefinition | undefined {
  return VERITY_TOOLS.find((t) => t.name === name);
}
