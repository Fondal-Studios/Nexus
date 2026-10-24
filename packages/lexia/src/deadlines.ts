import { addDays, isIsoDate, isWeekend, type IsoDate } from "./dates";

/**
 * Procedural deadlines. LEXIA never ships built-in procedural rules or
 * holiday tables: the rule (with its legal source) and the judicial calendar
 * (with its official source) must be supplied and marked verified. Without
 * them the result is `insufficient_data`, never a guessed date.
 */
export interface ProceduralRule {
  id: string;
  description: string;
  days: number;
  mode: "business" | "calendar";
  /** Citation id of the norm that sets this term, resolvable in the corpus. */
  sourceCitationId: string;
  /** Counting starts the day after notification when true. */
  startsNextDay: boolean;
}

export interface JudicialCalendar {
  jurisdiction: string;
  /** Non-working dates (feriados, ferias, asuetos) in the covered range. */
  nonWorkingDates: IsoDate[];
  coverageFrom: IsoDate;
  coverageTo: IsoDate;
  source: string;
  /** True only when someone checked the table against the official publication. */
  verified: boolean;
}

export interface DeadlineInput {
  jurisdiction?: string;
  notificationDate?: IsoDate;
  rule?: ProceduralRule;
  calendar?: JudicialCalendar;
}

export type DeadlineResult =
  | { status: "insufficient_data"; missing: string[] }
  | {
      status: "calculated";
      dueDate: IsoDate;
      /** A computed term is a proposal until a professional confirms it. */
      reviewStatus: "pending_professional_review";
      basis: { ruleId: string; sourceCitationId: string; calendarSource: string; notificationDate: IsoDate };
    };

export function computeDeadline(input: DeadlineInput): DeadlineResult {
  const missing: string[] = [];
  if (!input.jurisdiction) missing.push("jurisdicción");
  if (!input.notificationDate) missing.push("fecha de notificación");
  else if (!isIsoDate(input.notificationDate)) missing.push("fecha de notificación válida (AAAA-MM-DD)");
  if (!input.rule) missing.push("regla procesal aplicable con su fuente");
  else if (!Number.isInteger(input.rule.days) || input.rule.days <= 0) missing.push("cantidad de días de la regla");
  if (!input.calendar) missing.push("calendario judicial");
  else {
    if (!input.calendar.verified) missing.push("calendario judicial verificado contra fuente oficial");
    if (input.jurisdiction && input.calendar.jurisdiction !== input.jurisdiction)
      missing.push("calendario de la misma jurisdicción");
  }
  if (missing.length) return { status: "insufficient_data", missing };

  const { rule, calendar, notificationDate } = input as Required<DeadlineInput> & { jurisdiction: string };
  const nonWorking = new Set(calendar.nonWorkingDates);
  let cursor = notificationDate;
  if (!rule.startsNextDay) cursor = addDays(cursor, -1);
  let counted = 0;
  while (counted < rule.days) {
    cursor = addDays(cursor, 1);
    if (cursor > calendar.coverageTo || notificationDate < calendar.coverageFrom)
      return { status: "insufficient_data", missing: [`calendario judicial que cubra hasta ${cursor}`] };
    if (rule.mode === "calendar" || (!isWeekend(cursor) && !nonWorking.has(cursor))) counted++;
  }
  // A calendar-day term that ends on a non-working day still moves to the next working day.
  while (rule.mode === "calendar" && (isWeekend(cursor) || nonWorking.has(cursor))) {
    cursor = addDays(cursor, 1);
    if (cursor > calendar.coverageTo)
      return { status: "insufficient_data", missing: [`calendario judicial que cubra hasta ${cursor}`] };
  }
  return {
    status: "calculated",
    dueDate: cursor,
    reviewStatus: "pending_professional_review",
    basis: {
      ruleId: rule.id,
      sourceCitationId: rule.sourceCitationId,
      calendarSource: calendar.source,
      notificationDate,
    },
  };
}

export type DeadlineStatus = "estimated" | "calculated" | "confirmed";

export interface TrackedDeadline {
  id: string;
  title: string;
  dueDate: IsoDate | null;
  status: DeadlineStatus | "insufficient_data";
  confirmedBy?: string;
  confirmedAt?: string;
  done?: boolean;
}

/** Only a human can promote a deadline to `confirmed`; an estimate never can be. */
export function confirmDeadline(
  deadline: TrackedDeadline,
  confirmer: { userId: string; role: string },
  at: Date,
): TrackedDeadline {
  if (deadline.status !== "calculated")
    throw new Error("Solo un plazo calculado con datos suficientes puede confirmarse; una estimación no.");
  if (!["owner", "admin", "lawyer"].includes(confirmer.role))
    throw new Error("Solo un abogado/a puede confirmar un plazo.");
  return { ...deadline, status: "confirmed", confirmedBy: confirmer.userId, confirmedAt: at.toISOString() };
}
