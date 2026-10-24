export type Role = "owner" | "admin" | "lawyer" | "paralegal" | "admin_staff" | "read_only" | "client";
export type Action = "read" | "write" | "delete" | "share" | "ai_analyze" | "export";
export type ResourceType =
  | "client"
  | "matter"
  | "document"
  | "private_note"
  | "strategy"
  | "billing"
  | "audit_log"
  | "ai_analysis";

export interface Principal {
  userId: string;
  firmId: string;
  role: Role;
  mfa: boolean;
  /** Set for `client` principals: the only client they represent. */
  clientId?: string;
  assignedMatterIds: string[];
}

export interface Resource {
  type: ResourceType;
  firmId: string;
  clientId?: string;
  matterId?: string;
  /** `restricted` limits the resource to `restrictedTo` (plus owner/admin). */
  visibility: "firm" | "restricted" | "client_visible";
  restrictedTo?: string[];
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

const deny = (reason: string): Decision => ({ allowed: false, reason });
const allow = (reason: string): Decision => ({ allowed: true, reason });
const INTERNAL_ONLY: ResourceType[] = ["private_note", "strategy", "billing", "audit_log", "ai_analysis"];
const MFA_ACTIONS: Action[] = ["delete", "export", "share"];

export function authorize(p: Principal, action: Action, r: Resource): Decision {
  // 1. Tenant isolation comes first and has no exceptions.
  if (p.firmId !== r.firmId) return deny("Otro estudio jurídico.");

  // 2. Clients only ever see what was explicitly shared with them.
  if (p.role === "client") {
    if (INTERNAL_ONLY.includes(r.type)) return deny("Información interna del estudio.");
    if (action !== "read") return deny("El cliente solo puede consultar.");
    if (r.visibility !== "client_visible") return deny("No fue compartido con el cliente.");
    if (!p.clientId || p.clientId !== r.clientId) return deny("Pertenece a otro cliente.");
    return allow("Compartido con este cliente.");
  }

  if (MFA_ACTIONS.includes(action) && !p.mfa) return deny("Requiere verificación en dos pasos.");

  const managerial = p.role === "owner" || p.role === "admin";
  if (r.visibility === "restricted" && !managerial && !r.restrictedTo?.includes(p.userId))
    return deny("Recurso con acceso restringido.");

  if (!managerial && r.matterId && !p.assignedMatterIds.includes(r.matterId))
    return deny("No estás asignado a este expediente.");

  switch (p.role) {
    case "owner":
    case "admin":
      return allow("Administración del estudio.");
    case "lawyer":
      if (r.type === "audit_log") return deny("Solo la administración consulta la auditoría.");
      return allow("Abogado/a asignado.");
    case "paralegal":
      if (action === "delete" || action === "export" || action === "share") return deny("Acción reservada a abogados.");
      if (r.type === "strategy" || r.type === "private_note" || r.type === "billing" || r.type === "audit_log") return deny("Sin permiso sobre este tipo de recurso.");
      return allow("Colaborador asignado.");
    case "admin_staff":
      if (r.type === "billing" || r.type === "client" || r.type === "matter")
        return action === "delete" ? deny("Sin permiso para eliminar.") : allow("Gestión administrativa.");
      return deny("Sin permiso sobre contenido jurídico.");
    case "read_only":
      if (action !== "read") return deny("Rol de solo lectura.");
      if (INTERNAL_ONLY.includes(r.type)) return deny("Sin permiso sobre este tipo de recurso.");
      return allow("Lectura.");
    default:
      return deny("Rol desconocido.");
  }
}
