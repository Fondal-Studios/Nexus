import { z } from "zod";

const text = (max = 2000) => z.string().trim().max(max).default("");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const lexFirmInputSchema = z.object({ name: z.string().trim().min(2).max(160) });

export const lexClientInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  document: z.string().trim().max(40).default(""),
  phone: text(80),
  email: z.string().trim().max(200).default(""),
  address: text(300),
  notes: text(10000),
});
export type LexClientInput = z.infer<typeof lexClientInputSchema>;

export const LEX_MATTER_KINDS = ["judicial", "administrative", "extrajudicial", "advisory"] as const;
export const lexMatterInputSchema = z.object({
  clientId: z.string().uuid(),
  kind: z.enum(LEX_MATTER_KINDS),
  caption: z.string().trim().min(2).max(300),
  /** Court case number, when one exists. */
  courtNumber: z.string().trim().max(60).default(""),
  fuero: text(120),
  jurisdiction: text(120),
  court: text(200),
  stage: text(200),
  filedAt: isoDate.optional(),
  normativeDate: isoDate.optional(),
  reserved: z.boolean().default(false),
  /** Reserved: never shown to the client or sent to external AI. */
  privateNotes: text(20000),
});
export type LexMatterInput = z.infer<typeof lexMatterInputSchema>;

export const lexDeadlineInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  /** An estimate the lawyer typed in; stored as `estimated`, never as a court term. */
  estimatedDate: isoDate.optional(),
  /** When present the server computes the term, or reports exactly what is missing. */
  calculation: z
    .object({
      jurisdiction: z.string().trim().min(1).optional(),
      notificationDate: isoDate.optional(),
      rule: z
        .object({
          id: z.string().min(1),
          description: z.string().min(1),
          days: z.number().int().positive().max(365),
          mode: z.enum(["business", "calendar"]),
          sourceCitationId: z.string().min(1),
          startsNextDay: z.boolean(),
        })
        .optional(),
      calendar: z
        .object({
          jurisdiction: z.string().min(1),
          nonWorkingDates: z.array(isoDate).max(1000),
          coverageFrom: isoDate,
          coverageTo: isoDate,
          source: z.string().min(1),
          verified: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});
export type LexDeadlineInput = z.infer<typeof lexDeadlineInputSchema>;

export const lexTaskInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  assigneeId: z.string().uuid().nullable().default(null),
  dueDate: isoDate.optional(),
});

export const lexAssignmentInputSchema = z.object({
  memberId: z.string().uuid(),
  capacity: z.enum(["responsible", "collaborator"]).default("collaborator"),
});
