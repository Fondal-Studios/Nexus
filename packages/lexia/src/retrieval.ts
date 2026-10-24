import { HIERARCHY, type Corpus, type NormLevel, type NormVersion } from "./citations";
import type { IsoDate } from "./dates";

export interface RetrievalFilters {
  /** Jurisdictions to include, e.g. `["AR", "AR-B"]`. Empty/undefined = all. */
  jurisdictions?: string[];
  onDate: IsoDate;
  subject?: string;
  minLevel?: NormLevel;
  officialOnly?: boolean;
}

export interface Hit {
  version: NormVersion;
  article: string;
  score: number;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const tokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2);

/**
 * Filter-first lexical retrieval. Hard filters (jurisdiction, validity on the
 * case's normative date, subject, hierarchy, source) run before any scoring so
 * a repealed or out-of-jurisdiction norm can never rank. A vector index plugs
 * in later by replacing `score` only; the filters stay.
 */
export function searchCorpus(corpus: Corpus, query: string, f: RetrievalFilters, limit = 10): Hit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const hits: Hit[] = [];
  for (const v of corpus.versions) {
    if (f.jurisdictions?.length && !f.jurisdictions.includes(v.jurisdiction)) continue;
    if (v.validFrom > f.onDate || (v.validTo && f.onDate > v.validTo)) continue;
    if (f.subject && v.subject !== f.subject) continue;
    if (f.minLevel && HIERARCHY[v.level] < HIERARCHY[f.minLevel]) continue;
    if (v.source.kind === "unverified") continue;
    if (f.officialOnly && v.source.kind !== "official") continue;
    for (const [article, text] of Object.entries(v.articles)) {
      const bag = new Set(tokens(`${v.title} ${text}`));
      const matched = q.filter((t) => bag.has(t)).length;
      if (!matched) continue;
      hits.push({ version: v, article, score: matched / q.length + HIERARCHY[v.level] / 100 });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
