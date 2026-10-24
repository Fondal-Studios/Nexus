import { z } from "zod";
import { verifyCitations, type CitationRef, type Corpus } from "./citations";
import type { IsoDate } from "./dates";

/** Every relevant statement by the assistant is typed so facts are never mixed with guesses. */
export const CLAIM_KINDS = ["established_fact", "allegation", "inference", "pending_confirmation"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const evidenceRefSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().positive().optional(),
  /** Literal text from the document; verified against the extracted text when available. */
  quote: z.string().min(1).optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const claimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(CLAIM_KINDS),
  evidence: z.array(evidenceRefSchema).default([]),
  /** For inferences: ids of the claims they are derived from. */
  derivedFrom: z.array(z.string()).default([]),
  legalBasis: z.array(z.object({ normId: z.string(), article: z.string().optional() })).default([]),
  uncertainty: z.enum(["low", "medium", "high"]),
});
export type Claim = z.infer<typeof claimSchema>;

export interface ClaimContext {
  /** Extracted text of the documents of THIS matter, by document id. */
  documents: Map<string, string>;
  corpus: Corpus;
  normativeDate: IsoDate;
  otherClaims?: Map<string, Claim>;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLowerCase();

/** Returns a list of problems; the assistant output is only releasable when it is empty. */
export function validateClaim(claim: Claim, ctx: ClaimContext): string[] {
  const problems: string[] = [];
  if (claim.kind === "established_fact" && claim.evidence.length === 0)
    problems.push(`"${claim.id}": un hecho acreditado necesita al menos una referencia documental.`);
  if (claim.kind === "allegation" && claim.evidence.length === 0)
    problems.push(`"${claim.id}": una alegación debe indicar el escrito donde se formula.`);
  if (claim.kind === "inference") {
    const parents = claim.derivedFrom.map((id) => ctx.otherClaims?.get(id));
    if (claim.derivedFrom.length === 0) problems.push(`"${claim.id}": una inferencia debe indicar de qué afirmaciones deriva.`);
    else if (parents.some((p) => !p)) problems.push(`"${claim.id}": deriva de una afirmación inexistente.`);
    if (claim.uncertainty === "low") problems.push(`"${claim.id}": una inferencia no puede declararse con incertidumbre baja.`);
  }
  for (const ev of claim.evidence) {
    const text = ctx.documents.get(ev.documentId);
    if (text === undefined) {
      problems.push(`"${claim.id}": el documento ${ev.documentId} no pertenece a este expediente.`);
      continue;
    }
    if (ev.quote && !fold(text).includes(fold(ev.quote)))
      problems.push(`"${claim.id}": la cita textual no figura en el documento ${ev.documentId}.`);
  }
  const refs: CitationRef[] = claim.legalBasis;
  for (const issue of verifyCitations(ctx.corpus, refs, ctx.normativeDate))
    problems.push(`"${claim.id}": ${issue.ref.normId}${issue.ref.article ? ` art. ${issue.ref.article}` : ""} — ${issue.message}`);
  return problems;
}
