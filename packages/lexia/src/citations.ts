import type { IsoDate } from "./dates";

/** Higher number = higher in the normative hierarchy. */
export const HIERARCHY = {
  constitution: 6,
  treaty: 5,
  law: 4,
  decree: 3,
  resolution: 2,
  other: 1,
} as const;
export type NormLevel = keyof typeof HIERARCHY;

export type SourceKind = "official" | "secondary" | "unverified";

export interface NormVersion {
  /** Stable norm id, e.g. `ar-nacional:ley-xxxxx`. */
  normId: string;
  versionId: string;
  title: string;
  /** `AR` for national law, `AR-<province code>` for provincial/municipal. */
  jurisdiction: string;
  level: NormLevel;
  subject: string;
  source: { kind: SourceKind; url?: string; retrievedAt: IsoDate };
  validFrom: IsoDate;
  /** Absent while the version is still in force. */
  validTo?: IsoDate;
  articles: Record<string, string>;
}

export interface Corpus {
  versions: NormVersion[];
}

export interface CitationRef {
  normId: string;
  article?: string;
}

export type Resolution =
  | { status: "ok"; version: NormVersion; text?: string }
  | { status: "not_in_corpus" }
  | { status: "not_in_force_on_date"; nearest?: NormVersion }
  | { status: "article_not_found"; version: NormVersion }
  | { status: "source_unverified"; version: NormVersion };

/**
 * Resolves a citation for a given date. A norm not in the corpus, not in force
 * that day, with a missing article or without an official/secondary source is
 * reported as such — the assistant must say so instead of citing it.
 */
export function resolveCitation(
  corpus: Corpus,
  ref: CitationRef,
  onDate: IsoDate,
  opts: { requireOfficial?: boolean } = {},
): Resolution {
  const all = corpus.versions.filter((v) => v.normId === ref.normId);
  if (!all.length) return { status: "not_in_corpus" };
  const inForce = all.find((v) => v.validFrom <= onDate && (!v.validTo || onDate <= v.validTo));
  if (!inForce) {
    const nearest = [...all].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    return { status: "not_in_force_on_date", nearest };
  }
  const sourceOk = opts.requireOfficial
    ? inForce.source.kind === "official"
    : inForce.source.kind !== "unverified";
  if (!sourceOk) return { status: "source_unverified", version: inForce };
  if (ref.article === undefined) return { status: "ok", version: inForce };
  const text = inForce.articles[ref.article];
  if (text === undefined) return { status: "article_not_found", version: inForce };
  return { status: "ok", version: inForce, text };
}

export interface CitationIssue {
  ref: CitationRef;
  problem: Resolution["status"];
  message: string;
}

const MESSAGES: Record<Exclude<Resolution["status"], "ok">, string> = {
  not_in_corpus: "La norma no está en la biblioteca de LEXIA: no puede citarse como verificada.",
  not_in_force_on_date: "La norma no estaba vigente en la fecha normativa del caso.",
  article_not_found: "El artículo no figura en la versión consolidada cargada.",
  source_unverified: "La versión cargada no tiene una fuente verificable.",
};

/** Returns one issue per citation that cannot be verified; an empty list means all verified. */
export function verifyCitations(
  corpus: Corpus,
  refs: CitationRef[],
  onDate: IsoDate,
  opts: { requireOfficial?: boolean } = {},
): CitationIssue[] {
  const issues: CitationIssue[] = [];
  for (const ref of refs) {
    const r = resolveCitation(corpus, ref, onDate, opts);
    if (r.status !== "ok") issues.push({ ref, problem: r.status, message: MESSAGES[r.status] });
  }
  return issues;
}
