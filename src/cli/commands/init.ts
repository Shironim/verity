import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { GitClient } from '../../core/git/client';
import { BriefManifestGenerator } from '../../core/anchor/manifest';

export interface InitOptions {
  cwd?: string;
  yes?: boolean;
  hook?: boolean;
  template?: string;
  agentHooks?: boolean;
  skills?: boolean;
}

const STARTER_BRIEF = `# Brief: Example Feature Specification

> **Kategori**: feature  
> **Status**: Draft  
> **Tanggal**: ${new Date().toISOString().slice(0, 10)}  

---

## Overview & Problem Statement
- **Konteks & Alasan**: Contoh task brief SSOT untuk mendokumentasikan spesifikasi fitur.
- **Tujuan Utama**: Memastikan keselarasan implementasi kode dengan keputusan arsitektural.

---

## Scope & Boundaries
### In-Scope
- [ ] Implementasi fungsi inti di modul target.

### Out-of-Scope
- Optimasi performa lanjutan di luar cakupan saat ini.

---

## Spesifikasi Detail Pekerjaan
- **Target Files / Modules**: \`src/index.ts\`

---

## Acceptance Criteria (Given-When-Then)
- [ ] **Scenario 1**:
  - **Given**: Konfigurasi awal siap.
  - **When**: Fitur dijalankan.
  - **Then**: Menghasilkan keluaran yang diharapkan.

---

## Definition of Done (DoD) Checklist
- [ ] Kode terimplementasi sesuai spesifikasi.
- [ ] Provenance disegel via \`verity link\`.

---

## Provenance
- **Completion Commit**: (menunggu penyegelan via verity link)
- **Anchors**:
`;

export async function runInitCommand(options: InitOptions = {}): Promise<{
  docsCreated: boolean;
  hookInstalled: boolean;
  instructionsInstalled: boolean;
  agentHooksInstalled: boolean;
  skillsInstalled: boolean;
}> {
  const rootDir = resolve(options.cwd || process.cwd());
  const gitClient = new GitClient(rootDir);

  console.log(`🚀 [Verity] Inisialisasi Verity di: ${rootDir}`);

  let docsCreated = false;
  let hookInstalled = false;
  let instructionsInstalled = false;
  let agentHooksInstalled = false;
  let skillsInstalled = false;

  // 1. Buat direktori docs/brief jika belum ada
  const briefDir = join(rootDir, 'docs/brief');
  if (!existsSync(briefDir)) {
    mkdirSync(briefDir, { recursive: true });
    docsCreated = true;
    console.log('  \x1b[32m[+]\x1b[0m Direktori docs/brief/ berhasil dibuat.');
  } else {
    console.log('  \x1b[34m[=]\x1b[0m Direktori docs/brief/ sudah ada.');
  }

  // 2. Buat starter brief jika belum ada file markdown di docs/brief
  const starterFile = join(briefDir, 'feature-example.md');
  if (!existsSync(starterFile)) {
    writeFileSync(starterFile, STARTER_BRIEF, 'utf8');
    console.log('  \x1b[32m[+]\x1b[0m Starter brief dibuat di docs/brief/feature-example.md');
  }

  // 3. Sinkronkan manifest INDEX.md awal
  const manifestGen = new BriefManifestGenerator(rootDir);
  await manifestGen.generateAndSync();
  console.log('  \x1b[32m[+]\x1b[0m Manifest docs/brief/INDEX.md disinkronkan.');

  // 4. Salin panduan instructions.md ke AGENTS.md / instructions.md
  const instructionsTarget = join(rootDir, 'AGENTS.md');
  const templateInstructionsPath = resolve(__dirname, '../../../templates/instructions.md');

  if (existsSync(templateInstructionsPath)) {
    const templateContent = readFileSync(templateInstructionsPath, 'utf8');
    if (!existsSync(instructionsTarget)) {
      writeFileSync(instructionsTarget, templateContent, 'utf8');
      instructionsInstalled = true;
      console.log('  \x1b[32m[+]\x1b[0m Panduan AI Agent dibuat di AGENTS.md');
    } else {
      const existing = readFileSync(instructionsTarget, 'utf8');
      if (!existing.includes('Verity')) {
        writeFileSync(instructionsTarget, `${existing}\n\n---\n\n${templateContent}`, 'utf8');
        instructionsInstalled = true;
        console.log('  \x1b[32m[+]\x1b[0m Aturan Verity ditambahkan ke file AGENTS.md yang sudah ada.');
      } else {
        console.log('  \x1b[34m[=]\x1b[0m AGENTS.md sudah memuat aturan Verity.');
      }
    }
  }

  // 5. Pasang Git pre-commit hook jika diminta atau jika di git repo dengan flag --hook/--yes
  const installHook = options.hook || (options.yes && gitClient.isGitRepository());
  const gitHooksDir = join(rootDir, '.git/hooks');

  if (installHook && existsSync(gitHooksDir)) {
    const preCommitPath = join(gitHooksDir, 'pre-commit');
    const templateHookPath = resolve(__dirname, '../../../templates/pre-commit-hook.sh');

    if (existsSync(templateHookPath)) {
      const hookContent = readFileSync(templateHookPath, 'utf8');
      if (!existsSync(preCommitPath)) {
        writeFileSync(preCommitPath, hookContent, 'utf8');
        chmodSync(preCommitPath, 0o755);
        hookInstalled = true;
        console.log('  \x1b[32m[+]\x1b[0m Git pre-commit hook terpasang di .git/hooks/pre-commit');
      } else {
        const existingHook = readFileSync(preCommitPath, 'utf8');
        if (!existingHook.includes('verity check')) {
          writeFileSync(preCommitPath, `${existingHook}\n\n${hookContent}`, 'utf8');
          chmodSync(preCommitPath, 0o755);
          hookInstalled = true;
          console.log('  \x1b[32m[+]\x1b[0m Guardrail Verity ditambahkan ke hook pre-commit yang ada.');
        } else {
          console.log('  \x1b[34m[=]\x1b[0m Hook pre-commit sudah memuat pemeriksaan Verity.');
        }
      }
    }
  }

  // 6. Pasang Agent Lifecycle Hooks (.agents/hooks/) jika diminta atau flag --yes/--agent-hooks
  const installAgentHooks = options.agentHooks || options.yes;
  const agentHooksDir = join(rootDir, '.agents/hooks');
  const templateHooksDir = resolve(__dirname, '../../../templates/hooks');

  if (installAgentHooks && existsSync(templateHooksDir)) {
    mkdirSync(join(agentHooksDir, 'lib'), { recursive: true });
    const hookFiles = ['verity-pre-invocation.cjs', 'verity-mutation-guard.cjs'];
    for (const file of hookFiles) {
      const src = join(templateHooksDir, file);
      const dest = join(agentHooksDir, file);
      if (existsSync(src) && !existsSync(dest)) {
        writeFileSync(dest, readFileSync(src, 'utf8'), 'utf8');
      }
    }
    const sessionStateSrc = join(templateHooksDir, 'lib/session-state.cjs');
    const sessionStateDest = join(agentHooksDir, 'lib/session-state.cjs');
    if (existsSync(sessionStateSrc) && !existsSync(sessionStateDest)) {
      writeFileSync(sessionStateDest, readFileSync(sessionStateSrc, 'utf8'), 'utf8');
    }
    agentHooksInstalled = true;
    console.log('  \x1b[32m[+]\x1b[0m Agent Lifecycle Hooks terpasang di .agents/hooks/');
  }

  // 7. Pasang Agent Skills (.agents/skills/) untuk to-brief dan session-handover
  const installSkills = options.skills || options.yes;
  const agentSkillsDir = join(rootDir, '.agents/skills');
  const templateSkillsDir = resolve(__dirname, '../../../templates/skills');

  if (installSkills && existsSync(templateSkillsDir)) {
    const skillsToCopy = ['to-brief', 'session-handover'];
    for (const skillName of skillsToCopy) {
      const skillSrcDir = join(templateSkillsDir, skillName);
      const skillDestDir = join(agentSkillsDir, skillName);
      if (existsSync(skillSrcDir)) {
        mkdirSync(skillDestDir, { recursive: true });
        const skillFileSrc = join(skillSrcDir, 'SKILL.md');
        const skillFileDest = join(skillDestDir, 'SKILL.md');
        if (existsSync(skillFileSrc) && !existsSync(skillFileDest)) {
          writeFileSync(skillFileDest, readFileSync(skillFileSrc, 'utf8'), 'utf8');
        }
      }
    }
    skillsInstalled = true;
    console.log('  \x1b[32m[+]\x1b[0m Agent Skills (to-brief, session-handover) terpasang di .agents/skills/');
  }

  // 8. Inisialisasi direktori handover/ jika belum ada
  const handoverDir = join(rootDir, 'handover');
  if (!existsSync(handoverDir)) {
    mkdirSync(handoverDir, { recursive: true });
    const handoverIndex = join(handoverDir, 'INDEX.md');
    if (!existsSync(handoverIndex)) {
      writeFileSync(
        handoverIndex,
        '# Handover Manifest Index\n\n> **Handover Records**\n\n| Tanggal | Sesi | Status | Ringkasan |\n|---|---|:---:|---|\n',
        'utf8'
      );
    }
    console.log('  \x1b[32m[+]\x1b[0m Direktori handover/ dan INDEX.md berhasil dibuat.');
  }

  console.log('\n✨ [Verity] Inisialisasi selesai! Anda dapat menjalankan:');
  console.log('   - verity check        : untuk audit spec drift');
  console.log('   - verity link <spec>  : untuk menyegel brief ke kode');
  console.log('   - verity mcp          : untuk menjalankan mode AI Agent MCP Server\n');

  return { docsCreated, hookInstalled, instructionsInstalled, agentHooksInstalled, skillsInstalled };
}
