export type AnchorStorageKind = 'frontmatter' | 'inline';

export interface AnchorProvenance {
  commitSha: string;
  fingerprint: string;
  timestamp?: string;
}

export interface Anchor {
  specFile: string;
  targetPath: string;
  symbol?: string;
  provenance: AnchorProvenance;
  kind: AnchorStorageKind;
  line?: number;
}

export type StalenessStatus = 'OK' | 'STALE' | 'NOT_FOUND' | 'ERROR';

export interface CommitMetadata {
  author: string;
  commitSha: string;
  commitMessage: string;
  date: string;
}

export interface StalenessReport {
  anchor: Anchor;
  status: StalenessStatus;
  currentFingerprint?: string;
  reconciliation?: CommitMetadata;
  message?: string;
}

export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'interface'
  | 'type'
  | 'unknown';

export interface SymbolNode {
  name: string;
  kind: SymbolKind;
  rawText: string;
  normalizedTokens: string[];
  startLine: number;
  endLine: number;
}

export interface ParseResult {
  filePath: string;
  targetSymbol?: string;
  fingerprint: string;
  found: boolean;
  rawMatchedContent?: string;
}
