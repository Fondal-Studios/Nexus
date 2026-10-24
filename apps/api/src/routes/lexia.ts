import { Router, type Request } from "express";
import { Prisma, type LexClient, type LexMatter, type LexMember } from "@prisma/client";
import {
  lexAssignmentInputSchema,
  lexClientInputSchema,
  lexDeadlineInputSchema,
  lexFirmInputSchema,
  lexMatterInputSchema,
  lexTaskInputSchema,
  type LexClientInput,
  type LexMatterInput,
} from "@nexus/shared";
import {
  auditMatter,
  authorize,
  computeDeadline,
  confirmDeadline,
  type Action,
  type MatterSnapshot,
  type Principal,
  type Resource,
  type ResourceType,
  type Role,
  type TrackedDeadline,
} from "@nexus/lexia";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { decryptClinical, encryptClinical, queryTokens, searchTokens } from "../lib/clinicalCrypto.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";

export const lexiaRouter = Router();
lexiaRouter.use(authenticate);
lexiaRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, private");
  next();
});

const scope = (firmId: string, kind: string, id: string) => `lexia:${firmId}:${kind}:${id}`;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
const FIRM_HEADER = "x-lexia-firm";

type MatterRecord = Omit<LexMatterInput, "clientId" | "filedAt" | "normativeDate" | "reserved">;

interface Ctx {
  member: LexMember;
  principal: Principal;
}

/** Resolves the caller's membership; with several firms the client must say which one. */
async function context(req: Request): Promise<Ctx> {
  const wanted = req.get(FIRM_HEADER);
  const memberships = await prisma.lexMember.findMany({
    where: { userId: req.userId!, ...(wanted ? { firmId: wanted } : {}) },
    include: { assignments: { select: { matterId: true } } },
  });
  if (memberships.length === 0) throw new HttpError(403, "No pertenecés a ningún estudio.");
  if (memberships.length > 1) throw new HttpError(400, `Indicá el estudio con el encabezado ${FIRM_HEADER}.`);
  const member = memberships[0]!;
  return {
    member,
    principal: {
      userId: member.id,
      firmId: member.firmId,
      role: member.role as Role,
      mfa: member.mfaEnabled,
      assignedMatterIds: member.assignments.map((a) => a.matterId),
    },
  };
}

function need(ctx: Ctx, action: Action, type: ResourceType, extra: Partial<Resource> = {}) {
  const decision = authorize(ctx.principal, action, {
    type,
    firmId: ctx.principal.firmId,
    visibility: "firm",
    ...extra,
  });
  // 404 rather than 403 for resources outside the caller's reach: existence is not disclosed.
  if (!decision.allowed) throw new HttpError(extra.matterId || extra.clientId ? 404 : 403, decision.reason);
}

async function audit(ctx: Ctx, action: string, entityType: string, entityId?: string, metadata: Prisma.InputJsonValue = {}) {
  await prisma.lexAuditLog.create({
    data: { firmId: ctx.principal.firmId, actorId: ctx.member.id, action, entityType, entityId, metadata },
  });
}

const clientView = (row: LexClient) => ({
  ...decryptClinical<LexClientInput>(row.recordEncrypted, scope(row.firmId, "client", row.id)),
  id: row.id,
  archived: row.archived,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const matterView = (row: LexMatter, withPrivate: boolean) => {
  const rec = decryptClinical<MatterRecord>(row.recordEncrypted, scope(row.firmId, "matter", row.id));
  if (!withPrivate) rec.privateNotes = "";
  return {
    ...rec,
    id: row.id,
    clientId: row.clientId,
    kind: row.kind,
    status: row.status,
    reserved: row.reserved,
    filedAt: iso(row.filedAt),
    normativeDate: iso(row.normativeDate),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

// --- Firms ---------------------------------------------------------------

lexiaRouter.post(
  "/firms",
  asyncHandler(async (req, res) => {
    const { name } = lexFirmInputSchema.parse(req.body);
    const firm = await prisma.lexFirm.create({
      data: { name, members: { create: { userId: req.userId!, role: "owner" } } },
      include: { members: true },
    });
    res.status(201).json({ firm: { id: firm.id, name: firm.name }, memberId: firm.members[0]!.id });
  }),
);

lexiaRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const rows = await prisma.lexMember.findMany({ where: { userId: req.userId! }, include: { firm: true } });
    res.json({ memberships: rows.map((m) => ({ memberId: m.id, firmId: m.firmId, firmName: m.firm.name, role: m.role, mfaEnabled: m.mfaEnabled })) });
  }),
);

// --- Clients -------------------------------------------------------------

lexiaRouter.post(
  "/clients",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    need(ctx, "write", "client");
    const input = lexClientInputSchema.parse(req.body);
    const id = crypto.randomUUID();
    const row = await prisma.lexClient.create({
      data: {
        id,
        firmId: ctx.principal.firmId,
        recordEncrypted: encryptClinical(input, scope(ctx.principal.firmId, "client", id)),
        searchTokens: searchTokens(input.name, input.document, ctx.principal.firmId),
      },
    });
    await audit(ctx, "client.create", "client", id);
    res.status(201).json({ client: clientView(row) });
  }),
);

lexiaRouter.get(
  "/clients",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    need(ctx, "read", "client");
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const tokens = q ? queryTokens(q, ctx.principal.firmId) : [];
    const rows = await prisma.lexClient.findMany({
      where: { firmId: ctx.principal.firmId, archived: false, ...(tokens.length ? { searchTokens: { hasEvery: tokens } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json({ clients: rows.map(clientView) });
  }),
);

lexiaRouter.get(
  "/clients/:id",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const row = await prisma.lexClient.findFirst({ where: { id: String(req.params.id), firmId: ctx.principal.firmId } });
    if (!row) throw new HttpError(404, "Cliente inexistente.");
    need(ctx, "read", "client", { clientId: row.id });
    await audit(ctx, "client.read", "client", row.id);
    res.json({ client: clientView(row) });
  }),
);

// --- Matters (expedientes) ------------------------------------------------

lexiaRouter.post(
  "/matters",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    need(ctx, "write", "matter");
    const input = lexMatterInputSchema.parse(req.body);
    const client = await prisma.lexClient.findFirst({ where: { id: input.clientId, firmId: ctx.principal.firmId } });
    if (!client) throw new HttpError(404, "Cliente inexistente.");
    const { clientId, filedAt, normativeDate, reserved, ...record } = input;
    const id = crypto.randomUUID();
    const row = await prisma.lexMatter.create({
      data: {
        id,
        firmId: ctx.principal.firmId,
        clientId,
        kind: input.kind,
        reserved,
        filedAt: filedAt ? new Date(filedAt) : null,
        normativeDate: normativeDate ? new Date(normativeDate) : null,
        recordEncrypted: encryptClinical(record, scope(ctx.principal.firmId, "matter", id)),
        // The creator is the responsible lawyer unless the caller is staff without a legal role.
        assignments: { create: { memberId: ctx.member.id, capacity: "responsible" } },
      },
    });
    await audit(ctx, "matter.create", "matter", id);
    res.status(201).json({ matter: matterView(row, true) });
  }),
);

/** Loads a matter the caller may reach; anything else is reported as non-existent. */
async function reachableMatter(ctx: Ctx, id: string, action: Action = "read") {
  const row = await prisma.lexMatter.findFirst({ where: { id, firmId: ctx.principal.firmId } });
  if (!row) throw new HttpError(404, "Expediente inexistente.");
  need(ctx, action, "matter", { matterId: row.id, clientId: row.clientId });
  return row;
}

lexiaRouter.get(
  "/matters",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    need(ctx, "read", "matter");
    const managerial = ctx.principal.role === "owner" || ctx.principal.role === "admin";
    const rows = await prisma.lexMatter.findMany({
      where: {
        firmId: ctx.principal.firmId,
        ...(managerial ? {} : { id: { in: ctx.principal.assignedMatterIds } }),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    res.json({ matters: rows.map((r) => matterView(r, false)) });
  }),
);

lexiaRouter.get(
  "/matters/:id",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const row = await reachableMatter(ctx, String(req.params.id));
    const canSeePrivate = authorize(ctx.principal, "read", { type: "private_note", firmId: row.firmId, matterId: row.id, visibility: "firm" }).allowed;
    await audit(ctx, "matter.read", "matter", row.id);
    res.json({ matter: matterView(row, canSeePrivate) });
  }),
);

lexiaRouter.post(
  "/matters/:id/assignments",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    if (ctx.principal.role !== "owner" && ctx.principal.role !== "admin") throw new HttpError(403, "Solo la administración asigna expedientes.");
    const row = await reachableMatter(ctx, String(req.params.id), "write");
    const input = lexAssignmentInputSchema.parse(req.body);
    const member = await prisma.lexMember.findFirst({ where: { id: input.memberId, firmId: ctx.principal.firmId } });
    if (!member) throw new HttpError(404, "Miembro inexistente.");
    await prisma.lexMatterAssignment.upsert({
      where: { matterId_memberId: { matterId: row.id, memberId: member.id } },
      create: { matterId: row.id, memberId: member.id, capacity: input.capacity },
      update: { capacity: input.capacity },
    });
    await audit(ctx, "matter.assign", "matter", row.id, { memberId: member.id, capacity: input.capacity });
    res.status(204).send();
  }),
);

// --- Deadlines, tasks, auditor --------------------------------------------

lexiaRouter.post(
  "/matters/:id/deadlines",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const matter = await reachableMatter(ctx, String(req.params.id), "write");
    const input = lexDeadlineInputSchema.parse(req.body);
    let dueDate: string | undefined;
    let status: TrackedDeadline["status"];
    let basis: Prisma.InputJsonValue = {};
    if (input.calculation) {
      const result = computeDeadline(input.calculation);
      if (result.status === "calculated") {
        dueDate = result.dueDate;
        status = "calculated";
        basis = result.basis;
      } else {
        status = "insufficient_data";
        basis = { missing: result.missing };
      }
    } else {
      dueDate = input.estimatedDate;
      status = dueDate ? "estimated" : "insufficient_data";
      basis = dueDate ? { note: "Fecha estimada por el profesional; no es un plazo judicial confirmado." } : { missing: ["fecha"] };
    }
    const row = await prisma.lexDeadline.create({
      data: { matterId: matter.id, title: input.title, dueDate: dueDate ? new Date(dueDate) : null, status, basis },
    });
    await audit(ctx, "deadline.create", "deadline", row.id, { status });
    res.status(201).json({ deadline: { id: row.id, title: row.title, dueDate, status, basis } });
  }),
);

lexiaRouter.post(
  "/matters/:id/deadlines/:deadlineId/confirm",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const matter = await reachableMatter(ctx, String(req.params.id), "write");
    const row = await prisma.lexDeadline.findFirst({ where: { id: String(req.params.deadlineId), matterId: matter.id } });
    if (!row) throw new HttpError(404, "Vencimiento inexistente.");
    let confirmed: TrackedDeadline;
    try {
      confirmed = confirmDeadline(
        { id: row.id, title: row.title, dueDate: iso(row.dueDate) ?? null, status: row.status as TrackedDeadline["status"] },
        { userId: ctx.member.id, role: ctx.principal.role },
        new Date(),
      );
    } catch (e) {
      throw new HttpError(409, (e as Error).message);
    }
    await prisma.lexDeadline.update({
      where: { id: row.id },
      data: { status: "confirmed", confirmedById: ctx.member.id, confirmedAt: new Date(confirmed.confirmedAt!) },
    });
    await audit(ctx, "deadline.confirm", "deadline", row.id);
    res.json({ deadline: { id: row.id, status: "confirmed", dueDate: iso(row.dueDate) } });
  }),
);

lexiaRouter.post(
  "/matters/:id/tasks",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const matter = await reachableMatter(ctx, String(req.params.id), "write");
    const input = lexTaskInputSchema.parse(req.body);
    if (input.assigneeId) {
      const assignee = await prisma.lexMember.findFirst({ where: { id: input.assigneeId, firmId: ctx.principal.firmId } });
      if (!assignee) throw new HttpError(404, "Responsable inexistente en este estudio.");
    }
    const row = await prisma.lexTask.create({
      data: { matterId: matter.id, title: input.title, assigneeId: input.assigneeId, dueDate: input.dueDate ? new Date(input.dueDate) : null },
    });
    await audit(ctx, "task.create", "task", row.id);
    res.status(201).json({ task: { id: row.id, title: row.title, assigneeId: row.assigneeId } });
  }),
);

const auditQuerySchema = z.object({ requiredDocumentTypes: z.array(z.string().max(80)).max(50).default([]) });

lexiaRouter.post(
  "/matters/:id/audit",
  asyncHandler(async (req, res) => {
    const ctx = await context(req);
    const matter = await reachableMatter(ctx, String(req.params.id));
    const { requiredDocumentTypes } = auditQuerySchema.parse(req.body ?? {});
    const [assignments, deadlines, tasks, documents] = await Promise.all([
      prisma.lexMatterAssignment.findMany({ where: { matterId: matter.id, capacity: "responsible" } }),
      prisma.lexDeadline.findMany({ where: { matterId: matter.id } }),
      prisma.lexTask.findMany({ where: { matterId: matter.id } }),
      prisma.lexDocument.findMany({ where: { matterId: matter.id }, select: { docType: true } }),
    ]);
    const record = decryptClinical<MatterRecord>(matter.recordEncrypted, scope(matter.firmId, "matter", matter.id));
    const snapshot: MatterSnapshot = {
      id: matter.id,
      kind: matter.kind as MatterSnapshot["kind"],
      courtNumber: record.courtNumber || null,
      filedAt: iso(matter.filedAt) ?? null,
      responsibleLawyerIds: assignments.map((a) => a.memberId),
      chronology: [],
      deadlines: deadlines.map((d) => ({
        id: d.id,
        title: d.title,
        dueDate: iso(d.dueDate) ?? null,
        status: d.status as TrackedDeadline["status"],
        done: d.done,
      })),
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, assigneeId: t.assigneeId, done: t.done })),
      documentTypesPresent: documents.map((d) => d.docType).filter((t): t is string => Boolean(t)),
    };
    const alerts = auditMatter(snapshot, { today: new Date().toISOString().slice(0, 10), requiredDocumentTypes });
    // Persist new findings but keep any review decision already taken on an existing one.
    for (const a of alerts)
      await prisma.lexAlert.upsert({
        where: { id: a.id },
        create: { id: a.id, matterId: matter.id, rule: a.rule, priority: a.priority, payload: a as unknown as Prisma.InputJsonValue },
        update: { priority: a.priority, payload: a as unknown as Prisma.InputJsonValue },
      });
    const stored = await prisma.lexAlert.findMany({ where: { matterId: matter.id, id: { in: alerts.map((a) => a.id) } } });
    const status = new Map(stored.map((s) => [s.id, s.reviewStatus]));
    await audit(ctx, "matter.audit", "matter", matter.id, { alerts: alerts.length });
    res.json({ alerts: alerts.map((a) => ({ ...a, reviewStatus: status.get(a.id) ?? a.reviewStatus })) });
  }),
);
