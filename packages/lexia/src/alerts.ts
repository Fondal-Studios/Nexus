import { createHash } from "node:crypto";
import { daysBetween, type IsoDate } from "./dates";
import type { EvidenceRef } from "./claims";
import type { TrackedDeadline } from "./deadlines";

export type Priority = "critical" | "high" | "medium" | "low";

export interface LegalAlert {
  /** Deterministic: the same finding keeps the same id across audit runs. */
  id: string;
  rule: string;
  description: string;
  evidence: EvidenceRef[];
  /** Citation text when a legal source applies; absent otherwise. */
  legalSource?: string;
  priority: Priority;
  impact: string;
  suggestedAction: string;
  uncertainty: "low" | "medium" | "high";
  reviewStatus: "unreviewed" | "confirmed" | "dismissed";
}

export interface MatterSnapshot {
  id: string;
  kind: "judicial" | "administrative" | "extrajudicial" | "advisory";
  courtNumber?: string | null;
  filedAt?: IsoDate | null;
  responsibleLawyerIds: string[];
  chronology: { id: string; date: IsoDate; title: string; type: "actuacion" | "hearing" | "other"; documentId?: string }[];
  deadlines: TrackedDeadline[];
  tasks: { id: string; title: string; assigneeId?: string | null; done: boolean }[];
  documentTypesPresent: string[];
}

export interface AuditOptions {
  today: IsoDate;
  /** Firm/matter-type checklist: document types expected for this stage. */
  requiredDocumentTypes?: string[];
  /** Horizon in days inside which an unconfirmed deadline is escalated. */
  unconfirmedHorizonDays?: number;
}

const idOf = (rule: string, subject: string) =>
  `${rule}:${createHash("sha256").update(`${rule}|${subject}`).digest("hex").slice(0, 12)}`;

/**
 * Deterministic rule-based auditor. It reports only what the data shows and
 * labels uncertainty; it never derives a deadline by itself.
 */
export function auditMatter(m: MatterSnapshot, opts: AuditOptions): LegalAlert[] {
  const out: LegalAlert[] = [];
  const horizon = opts.unconfirmedHorizonDays ?? 10;
  const push = (a: Omit<LegalAlert, "id" | "reviewStatus">, subject: string) =>
    out.push({ ...a, id: idOf(a.rule, `${m.id}|${subject}`), reviewStatus: "unreviewed" });

  if (m.responsibleLawyerIds.length === 0)
    push(
      {
        rule: "matter.no_responsible",
        description: "El expediente no tiene abogado/a responsable.",
        evidence: [],
        priority: "high",
        impact: "Nadie responde por vencimientos y actuaciones.",
        suggestedAction: "Asignar al menos un abogado/a responsable.",
        uncertainty: "low",
      },
      "-",
    );

  if (m.kind === "judicial" && !m.courtNumber)
    push(
      {
        rule: "matter.no_court_number",
        description: "Expediente judicial sin número de causa registrado.",
        evidence: [],
        priority: "medium",
        impact: "Dificulta vincular notificaciones y consultar el sistema del tribunal.",
        suggestedAction: "Cargar el número judicial cuando exista o marcar la causa como no iniciada.",
        uncertainty: "medium",
      },
      "-",
    );

  for (const t of m.tasks)
    if (!t.done && !t.assigneeId)
      push(
        {
          rule: "task.no_owner",
          description: `La tarea "${t.title}" no tiene responsable.`,
          evidence: [],
          priority: "medium",
          impact: "Puede quedar sin ejecutarse.",
          suggestedAction: "Asignar un responsable.",
          uncertainty: "low",
        },
        t.id,
      );

  if (m.filedAt)
    for (const e of m.chronology)
      if (e.type === "actuacion" && e.date < m.filedAt)
        push(
          {
            rule: "chronology.before_filing",
            description: `La actuación "${e.title}" (${e.date}) es anterior a la fecha de promoción (${m.filedAt}).`,
            evidence: e.documentId ? [{ documentId: e.documentId }] : [],
            priority: "medium",
            impact: "Una fecha mal cargada puede distorsionar la cronología y los cómputos.",
            suggestedAction: "Verificar la fecha en el documento original y corregir la que corresponda.",
            uncertainty: "medium",
          },
          e.id,
        );

  for (const d of m.deadlines) {
    if (d.done) continue;
    if (d.status === "insufficient_data" || !d.dueDate) {
      push(
        {
          rule: "deadline.insufficient_data",
          description: `El vencimiento "${d.title}" no puede calcularse: faltan datos.`,
          evidence: [],
          priority: "high",
          impact: "Sin fecha confiable existe riesgo de perder un plazo.",
          suggestedAction: "Completar jurisdicción, fecha de notificación y regla aplicable, o fijar la fecha manualmente tras revisar el expediente.",
          uncertainty: "high",
        },
        d.id,
      );
      continue;
    }
    const left = daysBetween(opts.today, d.dueDate);
    if (left < 0)
      push(
        {
          rule: "deadline.overdue",
          description: `El vencimiento "${d.title}" (${d.dueDate}) figura como vencido y sin cumplir.`,
          evidence: [],
          priority: "critical",
          impact: "Posible pérdida de una facultad procesal.",
          suggestedAction: "Revisar de inmediato si el acto se cumplió o si corresponde una medida de recuperación.",
          uncertainty: d.status === "confirmed" ? "low" : "high",
        },
        d.id,
      );
    else if (d.status !== "confirmed" && left <= horizon)
      push(
        {
          rule: "deadline.unconfirmed_close",
          description: `El vencimiento "${d.title}" (${d.dueDate}, en ${left} días) todavía no fue confirmado por un profesional.`,
          evidence: [],
          priority: d.status === "estimated" ? "high" : "medium",
          impact: d.status === "estimated" ? "La fecha es una estimación, no un plazo judicial." : "Cálculo pendiente de revisión profesional.",
          suggestedAction: "Verificar notificación, regla y calendario, y confirmar o corregir la fecha.",
          uncertainty: d.status === "estimated" ? "high" : "medium",
        },
        d.id,
      );
  }

  for (const type of opts.requiredDocumentTypes ?? [])
    if (!m.documentTypesPresent.includes(type))
      push(
        {
          rule: "documents.missing_required",
          description: `Falta documentación esperada en el expediente: ${type}.`,
          evidence: [],
          priority: "medium",
          impact: "Puede impedir una presentación o debilitar la prueba.",
          suggestedAction: "Solicitar o cargar el documento, o descartar la alerta si no corresponde.",
          uncertainty: "medium",
        },
        type,
      );

  const order: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}
