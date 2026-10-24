import { authorize, type Principal, type Resource } from "./access";
import { scanUntrusted } from "./injection";

export interface ProviderPolicy {
  id: string;
  /** Data-processing agreement signed with this provider for this firm. */
  dpaSigned: boolean;
  /** Provider contractually does not train on or retain inputs. */
  noTrainingNoRetention: boolean;
  /** Where data is processed; compared against `allowedRegions`. */
  region: string;
}

export interface FirmAiPolicy {
  externalAiEnabled: boolean;
  allowedRegions: string[];
  /** Matters flagged reserved never go out unless the firm opted in explicitly. */
  allowReservedMatters: boolean;
}

export interface AiRequestDoc {
  documentId: string;
  matterId: string;
  firmId: string;
  clientId?: string;
  reserved: boolean;
  text: string;
}

export interface GateDecision {
  allowed: boolean;
  reasons: string[];
  /** Injection findings do not block by themselves; they must be shown to the user. */
  injectionFindings: { documentId: string; id: string }[];
}

/**
 * Decides whether documents may be sent to an external model. Fails closed:
 * every unmet condition is listed so the user sees what to configure.
 */
export function gateExternalAi(
  principal: Principal,
  provider: ProviderPolicy | undefined,
  firm: FirmAiPolicy,
  matterId: string,
  docs: AiRequestDoc[],
): GateDecision {
  const reasons: string[] = [];
  if (!firm.externalAiEnabled) reasons.push("El estudio no habilitó IA externa.");
  if (!provider) reasons.push("No hay proveedor de IA configurado.");
  else {
    if (!provider.dpaSigned) reasons.push("Falta el acuerdo de tratamiento de datos con el proveedor.");
    if (!provider.noTrainingNoRetention) reasons.push("El proveedor no garantiza no entrenar ni retener los datos.");
    if (!firm.allowedRegions.includes(provider.region)) reasons.push(`La región ${provider.region} no está autorizada por el estudio.`);
  }
  const injectionFindings: GateDecision["injectionFindings"] = [];
  for (const d of docs) {
    if (d.matterId !== matterId) reasons.push(`El documento ${d.documentId} pertenece a otro expediente.`);
    if (d.reserved && !firm.allowReservedMatters) reasons.push(`El documento ${d.documentId} es reservado.`);
    const res: Resource = { type: "document", firmId: d.firmId, matterId: d.matterId, clientId: d.clientId, visibility: "firm" };
    const dec = authorize(principal, "ai_analyze", res);
    if (!dec.allowed) reasons.push(`Sin permiso para analizar ${d.documentId}: ${dec.reason}`);
    for (const f of scanUntrusted(d.text)) injectionFindings.push({ documentId: d.documentId, id: f.id });
  }
  return { allowed: reasons.length === 0, reasons, injectionFindings };
}

/** Real client data is never used for training or simulations without a recorded legal basis and authorization. */
export function mayUseForTraining(doc: {
  origin: "real" | "simulated";
  trainingConsent?: { legalBasis: string; authorizedBy: string };
}): boolean {
  if (doc.origin === "simulated") return true;
  return Boolean(doc.trainingConsent?.legalBasis && doc.trainingConsent.authorizedBy);
}
