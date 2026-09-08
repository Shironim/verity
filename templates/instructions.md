# Verity AI Agent Guidelines & Integrity Protocol

> **Core Axiom**: *"Code as Truth, Docs as Intent"*  
> Code expresses WHAT and HOW; documentation and briefs answer WHY (business rationale, architecture decisions, and non-obvious constraints).  
> **Verity** is the deterministic integrity gate ensuring specs never drift unnoticed from actual code.

---

## 1. Operating Rules for AI Coding Agents

1. **Pre-Flight Spec Verification**:
   - Before starting a task or implementing features described in a brief, check spec health:
     ```bash
     verity check --quick
     ```
     *(Or call MCP tool `verity_check`)*.
   - If a spec has drifted (`STALE`), inspect what changed using:
     ```bash
     verity_reconcile_diff(targetPath: "...")
     ```

2. **Derived-Only Manifest Shield (`docs/brief/INDEX.md`)**:
   - **DO NOT** edit `docs/brief/INDEX.md` manually under any circumstances.
   - It is a 100% derived artifact synchronized deterministically by:
     ```bash
     verity check --sync-index
     # or
     verity index
     ```

3. **Mandatory Post-Flight Provenance Sealing**:
   - When marking a task brief as `Completed`, you **MUST** seal the provenance:
     ```bash
     verity link docs/brief/[category]-[slug].md path/to/file1.ext [path/to/file2.ext#symbol]
     ```
     *(Or call MCP tool `verity_link`)*.
   - Never mark a brief as `Completed` without recording the Git HEAD commit SHA and AST fingerprint.

4. **Normalized Fingerprint Awareness**:
   - Verity normalizes tokens, stripping trivia (Prettier/Pint formatting, trailing commas, comments).
   - Only semantic code changes (renamed functions, modified expressions, altered logic) trigger `STALE` status.

---

## 2. MCP Tools Quick Reference

| MCP Tool | Purpose | When to Use |
|---|---|---|
| `verity_check` | Audits drift across all or target briefs. | At session start and before pull request creation. |
| `verity_link` | Seals target files/symbols to markdown spec. | Immediately upon completing a task or brief. |
| `verity_status` | Returns total briefs, total anchors, and git state. | For high-level project health checks. |
| `verity_reconcile_diff` | Extracts git diff since baseline provenance. | When investigating why a brief became `STALE`. |
| `verity_sync_manifest` | Synchronizes `docs/brief/INDEX.md`. | After creating or updating briefs. |
