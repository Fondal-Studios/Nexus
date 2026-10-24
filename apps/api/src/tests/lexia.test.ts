import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const app = createApp();
type Agent = ReturnType<typeof request.agent>;
let ana: Agent, beto: Agent, carla: Agent, intruso: Agent;
let firmId: string;
let betoMember: string;

async function signup(name: string, email: string): Promise<Agent> {
  const a = request.agent(app);
  const r = await a.post("/auth/register").send({ name, email, password: "supersecret123" });
  expect(r.status).toBe(201);
  return a;
}

beforeEach(async () => {
  ana = await signup("Ana Abogada", "ana@lexia.test");
  beto = await signup("Beto Abogado", "beto@lexia.test");
  carla = await signup("Carla Procuradora", "carla@lexia.test");
  intruso = await signup("Otro Estudio", "otro@lexia.test");
  const f = await ana.post("/lexia/firms").send({ name: "Estudio Ficticio" });
  expect(f.status).toBe(201);
  firmId = f.body.firm.id;
  // Test fixtures: attach Beto (lawyer) and Carla (paralegal) to the firm.
  const users = await prisma.user.findMany({ where: { email: { in: ["beto@lexia.test", "carla@lexia.test"] } } });
  for (const u of users) {
    const m = await prisma.lexMember.create({ data: { firmId, userId: u.id, role: u.email.startsWith("beto") ? "lawyer" : "paralegal" } });
    if (u.email.startsWith("beto")) betoMember = m.id;
  }
  const o = await intruso.post("/lexia/firms").send({ name: "Estudio Ajeno" });
  expect(o.status).toBe(201);
});

async function client(agent = ana, name = "Cliente Ficticio") {
  const r = await agent.post("/lexia/clients").send({ name, document: "20123456786", notes: "dato reservado" });
  expect(r.status).toBe(201);
  return r.body.client as { id: string };
}
async function matter(clientId: string, extra: object = {}) {
  const r = await ana.post("/lexia/matters").send({ clientId, kind: "judicial", caption: "Pérez c/ Gómez s/ daños", privateNotes: "estrategia reservada", ...extra });
  expect(r.status).toBe(201);
  return r.body.matter as { id: string };
}

describe("LEXIA tenancy", () => {
  it("rejects users without a firm", async () => {
    const solo = await signup("Sin Estudio", "solo@lexia.test");
    expect((await solo.get("/lexia/clients")).status).toBe(403);
  });

  it("never stores client data in clear text", async () => {
    const c = await client();
    const row = await prisma.lexClient.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.recordEncrypted).not.toContain("Cliente Ficticio");
    expect(row.recordEncrypted).not.toContain("20123456786");
    const m = await matter(c.id);
    const mrow = await prisma.lexMatter.findUniqueOrThrow({ where: { id: m.id } });
    expect(mrow.recordEncrypted).not.toContain("estrategia reservada");
  });

  it("isolates firms: another firm sees neither the client nor the matter", async () => {
    const c = await client();
    const m = await matter(c.id);
    expect((await intruso.get(`/lexia/clients/${c.id}`)).status).toBe(404);
    expect((await intruso.get(`/lexia/matters/${m.id}`)).status).toBe(404);
    expect((await intruso.get("/lexia/clients")).body.clients).toEqual([]);
    expect((await intruso.get("/lexia/matters")).body.matters).toEqual([]);
    const cross = await intruso.post("/lexia/matters").send({ clientId: c.id, kind: "advisory", caption: "Cruce" });
    expect(cross.status).toBe(404);
  });

  it("lets a lawyer see only the matters assigned to them, and 404s the rest", async () => {
    const c = await client();
    const m = await matter(c.id);
    expect((await beto.get(`/lexia/matters/${m.id}`)).status).toBe(404);
    expect((await beto.get("/lexia/matters")).body.matters).toHaveLength(0);
    const assign = await ana.post(`/lexia/matters/${m.id}/assignments`).send({ memberId: betoMember, capacity: "collaborator" });
    expect(assign.status).toBe(204);
    expect((await beto.get(`/lexia/matters/${m.id}`)).status).toBe(200);
    expect((await beto.get("/lexia/matters")).body.matters).toHaveLength(1);
    // Only administration can assign.
    expect((await beto.post(`/lexia/matters/${m.id}/assignments`).send({ memberId: betoMember })).status).toBe(403);
  });

  it("hides private notes from roles without access to them", async () => {
    const c = await client();
    const m = await matter(c.id);
    await ana.post(`/lexia/matters/${m.id}/assignments`).send({ memberId: (await prisma.lexMember.findFirstOrThrow({ where: { role: "paralegal" } })).id });
    expect((await ana.get(`/lexia/matters/${m.id}`)).body.matter.privateNotes).toBe("estrategia reservada");
    const seen = await carla.get(`/lexia/matters/${m.id}`);
    expect(seen.status).toBe(200);
    expect(seen.body.matter.privateNotes).toBe("");
    expect(JSON.stringify(seen.body)).not.toContain("estrategia reservada");
  });

  it("finds clients by name or document without exposing the index", async () => {
    await client(ana, "María Fernández");
    expect((await ana.get("/lexia/clients").query({ q: "fernan" })).body.clients).toHaveLength(1);
    expect((await ana.get("/lexia/clients").query({ q: "20123456" })).body.clients).toHaveLength(1);
    expect((await ana.get("/lexia/clients").query({ q: "zzzz" })).body.clients).toHaveLength(0);
    const row = await prisma.lexClient.findFirstOrThrow();
    expect(row.searchTokens.join(" ")).not.toContain("fernan");
  });

  it("writes an audit trail of reads and writes", async () => {
    const c = await client();
    await ana.get(`/lexia/clients/${c.id}`);
    const actions = (await prisma.lexAuditLog.findMany({ where: { firmId } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["client.create", "client.read"]));
  });
});

describe("LEXIA deadlines and auditor", () => {
  it("stores an estimate as estimated and refuses to confirm it", async () => {
    const m = await matter((await client()).id);
    const d = await ana.post(`/lexia/matters/${m.id}/deadlines`).send({ title: "Contestar", estimatedDate: "2026-12-01" });
    expect(d.body.deadline.status).toBe("estimated");
    const c = await ana.post(`/lexia/matters/${m.id}/deadlines/${d.body.deadline.id}/confirm`);
    expect(c.status).toBe(409);
  });

  it("reports missing data instead of computing a term", async () => {
    const m = await matter((await client()).id);
    const d = await ana.post(`/lexia/matters/${m.id}/deadlines`).send({ title: "Apelar", calculation: { notificationDate: "2026-03-02" } });
    expect(d.body.deadline.status).toBe("insufficient_data");
    expect(d.body.deadline.basis.missing).toEqual(expect.arrayContaining(["jurisdicción", "calendario judicial"]));
    expect(d.body.deadline.dueDate).toBeUndefined();
  });

  it("computes a term from a verified rule and calendar, then a lawyer confirms it", async () => {
    const m = await matter((await client()).id);
    const calculation = {
      jurisdiction: "AR-X",
      notificationDate: "2026-03-02",
      rule: { id: "fixture", description: "ficticia", days: 5, mode: "business", sourceCitationId: "fixture:ley-a", startsNextDay: true },
      calendar: { jurisdiction: "AR-X", nonWorkingDates: ["2026-03-04"], coverageFrom: "2026-01-01", coverageTo: "2026-12-31", source: "Calendario ficticio", verified: true },
    };
    const d = await ana.post(`/lexia/matters/${m.id}/deadlines`).send({ title: "Contestar", calculation });
    expect(d.body.deadline).toMatchObject({ status: "calculated", dueDate: "2026-03-10" });
    const ok = await ana.post(`/lexia/matters/${m.id}/deadlines/${d.body.deadline.id}/confirm`);
    expect(ok.status).toBe(200);
    expect(ok.body.deadline.status).toBe("confirmed");
  });

  it("runs the auditor and keeps review state between runs", async () => {
    const m = await matter((await client()).id, { courtNumber: "" });
    await ana.post(`/lexia/matters/${m.id}/tasks`).send({ title: "Pedir poder" });
    await ana.post(`/lexia/matters/${m.id}/deadlines`).send({ title: "Sin datos" });
    const first = await ana.post(`/lexia/matters/${m.id}/audit`).send({ requiredDocumentTypes: ["poder"] });
    expect(first.status).toBe(200);
    const rules = first.body.alerts.map((a: { rule: string }) => a.rule);
    expect(rules).toEqual(expect.arrayContaining(["matter.no_court_number", "task.no_owner", "deadline.insufficient_data", "documents.missing_required"]));
    expect(rules).not.toContain("matter.no_responsible"); // the creator is responsible
    await prisma.lexAlert.updateMany({ where: { rule: "task.no_owner" }, data: { reviewStatus: "dismissed" } });
    const second = await ana.post(`/lexia/matters/${m.id}/audit`).send({ requiredDocumentTypes: ["poder"] });
    expect(second.body.alerts.find((a: { rule: string }) => a.rule === "task.no_owner").reviewStatus).toBe("dismissed");
    expect(await prisma.lexAlert.count()).toBe(first.body.alerts.length);
  });

  it("rejects tasks assigned to someone outside the firm", async () => {
    const m = await matter((await client()).id);
    const outsider = await prisma.lexMember.findFirstOrThrow({ where: { firmId: { not: firmId } } });
    const r = await ana.post(`/lexia/matters/${m.id}/tasks`).send({ title: "Tarea", assigneeId: outsider.id });
    expect(r.status).toBe(404);
  });
});
