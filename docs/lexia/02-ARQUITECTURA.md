# 02 — Arquitectura de LEXIA

## Decisiones y justificación

| Tema | Decisión | Por qué (y alternativa descartada) |
| --- | --- | --- |
| Frontend | Next.js (App Router) + React, PWA, ya presente en `apps/web` | Reutiliza shell, tema y PWA; iPhone y escritorio con una base. Descartado: app nativa primero (más costo; Expo ya existe en `apps/mobile` para una fase posterior) |
| Backend | Node.js + Express + TypeScript (el actual) | Ya contiene auth, cifrado, auditoría y 147 pruebas; un solo lenguaje con el contrato Zod compartido. Descartado: Python para todo el backend. Los pasos de OCR/extracción pesada pueden correr como **worker** separado (Python o Node) detrás de la cola, sin cambiar la API |
| Base de datos | PostgreSQL + Prisma | Integridad relacional para estudio→cliente→expediente; Gin para búsqueda por tokens; `pgvector` para vectores en la misma base (menos piezas que operar). Se revisa si el volumen normativo supera lo razonable para una sola instancia |
| Documentos | Almacenamiento de objetos **privado** (compatible S3), claves `lexia/<estudio>/<expediente>/<doc>/<versión>`, URLs firmadas de vida corta, SHA-256 por versión | Una base no es lugar para PDFs. Región y cifrado en reposo del proveedor a definir con el cliente (ver 06) |
| Búsqueda normativa | Recuperación **filtrar primero, puntuar después**: jurisdicción, vigencia en la fecha normativa del caso, materia, jerarquía, fuente. Hoy: léxica (`searchCorpus`). Después: híbrido con `pgvector` reemplazando solo la puntuación | Un filtro duro evita aplicar una ley derogada sin importar el ranking semántico |
| Cola de tareas | Tabla de trabajos en Postgres con worker (p. ej. `pg-boss`) para OCR, indexado y auditorías | Sin Redis que operar al inicio; se migra si la carga lo exige |
| IA | Interfaz de proveedor (como `NexusAIProvider`); el proveedor es configurable por estudio; compuerta `gateExternalAi` previa a toda llamada | Evita atarse a un proveedor y hace explícitas las garantías contractuales |
| Integraciones | Correo y calendario vía conectores OAuth ya existentes de Nexus (Google Workspace) | Fase 3 |
| CI/CD | El CI actual (lint, typecheck, test, build) + pruebas de aislamiento entre estudios como compuerta | |

No hay una cifra de costo o rendimiento medida todavía: ver 06 para el método y qué debe medirse antes de fijar precios.

## Módulos

```
packages/lexia        dominio puro, sin I/O (probado: 29 pruebas)
  deadlines           cómputo de plazos solo con datos suficientes + confirmación humana
  citations           biblioteca normativa versionada; resolución por fecha/jurisdicción/fuente
  retrieval           filtros duros + puntuación (reemplazable por vectores)
  claims              hecho / alegación / inferencia / pendiente, con evidencia verificable
  alerts              auditor determinista de expedientes (8 campos por alerta)
  access              tenencia por estudio, roles, asignación por expediente, visibilidad del cliente
  injection           detección de instrucciones en documentos + envoltorio con nonce
  aiGate              compuerta de IA externa y regla de entrenamiento
apps/api/routes/lexia estudios, clientes, expedientes, plazos, tareas, auditor, asignaciones
database/schema       tablas lexia_* (migración aditiva 20261024170000)
```

## Flujo del asistente por expediente (diseño; el LLM aún no está conectado)

1. El usuario abre el expediente y escribe. El servidor resuelve el *principal* (estudio, rol, asignaciones).
2. Se arma el contexto **solo** con documentos de ese expediente autorizados (`authorize(..., "ai_analyze")`). Un documento de otro expediente o cliente no entra.
3. `gateExternalAi` verifica habilitación del estudio, acuerdo de tratamiento de datos, no-entrenamiento/no-retención, región y reserva del expediente. Si falla, se informa qué falta y no se envía nada.
4. Cada documento se envuelve con `wrapUntrusted` y el prompt incluye `UNTRUSTED_DATA_RULE`; los hallazgos de `scanUntrusted` se muestran al usuario.
5. La respuesta debe ser un conjunto de `Claim` tipados. `validateClaim` rechaza: hechos sin documento, citas textuales que no están en el documento, normas fuera de la biblioteca, vigentes en otra fecha o sin fuente. Lo que no valida **no se muestra como conclusión**.
6. Los borradores y alertas quedan en estado `unreviewed` hasta que un abogado/a los acepta. Ninguna acción externa (presentación, envío) se ejecuta desde la IA.

## Seguridad como arquitectura

- Aislamiento: toda consulta lleva `firmId`; los recursos fuera de alcance responden 404 (no se revela su existencia). Pruebas de integración lo verifican.
- Datos personales y notas reservadas cifrados con AAD ligado a estudio/tipo/id (un registro copiado a otra fila no descifra).
- Auditoría de lecturas y escrituras (`lexia_audit_log`), visible solo para administración.
- Roles: owner, admin, lawyer, paralegal, admin_staff, read_only, client. Exportar, eliminar y compartir exigen MFA.
- **Pendiente (no implementado):** MFA real (el campo existe, no hay TOTP), almacenamiento y versionado de archivos, copias de seguridad propias, política de retención y eliminación, clave de cifrado dedicada y rotación, detección de PDFs maliciosos, límites de consumo de IA por estudio. Ver backlog.
