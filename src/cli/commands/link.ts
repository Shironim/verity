import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GitClient } from '../../core/git/client';
import { ParserDispatcher } from '../../core/parser/dispatcher';
import { FrontmatterAnchorHandler } from '../../core/anchor/frontmatter';
import { InlineAnchorHandler } from '../../core/anchor/inline';

export interface LinkOptions {
  inline?: boolean;
}

export async function runLinkCommand(
  specFilePath: string,
  codeAnchorArgs: string | string[],
  options: LinkOptions = {}
): Promise<void> {
  const rootDir = process.cwd();
  const gitClient = new GitClient(rootDir);

  if (!gitClient.isGitRepository()) {
    console.error('Error: Direktori saat ini bukan git repository.');
    process.exit(1);
  }

  const resolvedSpec = resolve(rootDir, specFilePath);
  if (!existsSync(resolvedSpec)) {
    console.error(`Error: Spec file tidak ditemukan: ${specFilePath}`);
    process.exit(1);
  }

  const anchors = Array.isArray(codeAnchorArgs) ? codeAnchorArgs : [codeAnchorArgs];
  if (anchors.length === 0) {
    console.error('Error: Harap berikan minimal satu code anchor.');
    process.exit(1);
  }

  let headSha: string;
  try {
    headSha = gitClient.getHeadSha();
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const dispatcher = new ParserDispatcher();
  let specContent = readFileSync(resolvedSpec, 'utf8');
  const linkedAnchors: { target: string; fingerprint: string }[] = [];

  for (const anchorArg of anchors) {
    const [targetPath, targetSymbol] = anchorArg.split('#');
    const resolvedTarget = resolve(rootDir, targetPath);

    if (!existsSync(resolvedTarget)) {
      console.error(`Error: File kode target tidak ditemukan: ${targetPath}`);
      process.exit(1);
    }

    const fileContent = readFileSync(resolvedTarget, 'utf8');
    const parseResult = await dispatcher.parse(targetPath, fileContent, targetSymbol);

    if (targetSymbol && !parseResult.found) {
      console.error(`Error: Simbol '${targetSymbol}' tidak ditemukan di dalam ${targetPath}.`);
      process.exit(1);
    }

    const relativeTargetPath = targetPath.replace(/\\/g, '/');
    const displayTarget = `${relativeTargetPath}${targetSymbol ? '#' + targetSymbol : ''}`;

    if (options.inline) {
      const inlineTag = InlineAnchorHandler.formatInlineTag({
        targetPath: relativeTargetPath,
        symbol: targetSymbol,
        provenance: {
          commitSha: headSha,
          fingerprint: parseResult.fingerprint,
          timestamp: new Date().toISOString(),
        },
      });
      specContent = specContent.trimEnd() + '\n\n' + inlineTag + '\n';
    } else {
      specContent = FrontmatterAnchorHandler.upsertAnchor(specContent, {
        targetPath: relativeTargetPath,
        symbol: targetSymbol,
        provenance: {
          commitSha: headSha,
          fingerprint: parseResult.fingerprint,
          timestamp: new Date().toISOString(),
        },
      });
    }

    linkedAnchors.push({ target: displayTarget, fingerprint: parseResult.fingerprint });
  }

  // Perbarui atau suntikkan section naratif ## Provenance ke badan dokumen markdown
  specContent = updateMarkdownProvenanceSection(specContent, headSha, linkedAnchors.map((a) => a.target));

  writeFileSync(resolvedSpec, specContent, 'utf8');

  console.log(`[OK] ${linkedAnchors.length} anchor berhasil ditautkan ke ${specFilePath}`);
  console.log(`  -> Git SHA: ${headSha.slice(0, 8)}`);
  for (const a of linkedAnchors) {
    console.log(`  -> Target : ${a.target} (${a.fingerprint.slice(0, 10)}...)`);
  }
}

/**
 * Menyuntikkan atau memperbarui section ## Provenance pada markdown brief.
 */
export function updateMarkdownProvenanceSection(
  content: string,
  commitSha: string,
  anchorTargets: string[]
): string {
  const provenanceHeader = '## Provenance';
  const anchorList = anchorTargets.map((t) => `  - \`${t}\``).join('\n');
  const newProvenanceBlock = `${provenanceHeader}
- **Completion Commit**: \`${commitSha}\`
- **Anchors**:
${anchorList}`;

  // Jika section ## Provenance sudah ada, ganti seluruh isi section tersebut
  const regex = /^##\s+Provenance(?:(?![\r\n]+##\s)[\s\S])*/m;
  if (regex.test(content)) {
    return content.replace(regex, newProvenanceBlock);
  }

  // Jika belum ada, tambahkan di akhir file
  return content.trimEnd() + '\n\n---\n\n' + newProvenanceBlock + '\n';
}
