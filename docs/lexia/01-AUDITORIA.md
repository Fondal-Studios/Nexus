# 01 — Auditoría de repositorios

Fecha: 2026-10-24. Alcance: lo que se pudo leer en esta sesión. Se clonaron en **solo lectura** `ClinicIA`, `Fondal-Learn` y `Arquitecto-`; no se modificó ninguno. Cuando algo proviene del README y no de leer el código, se indica.

## Nexus (`drmarianojimenez94-sudo/Nexus`) — auditado en profundidad

Monorepo pnpm: `apps/api` (Express + Prisma + PostgreSQL), `apps/web` (Next.js 15 PWA), `apps/mobile` (Expo), `packages/shared` (Zod), `packages/verticals`, `database/`.

**Reutilizable y verificado en esta sesión** (la suite del API, 147 pruebas, pasa contra Postgres 16 local):

| Componente | Estado | Uso en LEXIA |
| --- | --- | --- |
| Auth JWT + refresh rotativo en cookies httpOnly, bcrypt 12 | Funcional, probado | Base de identidad (se suma membresía a estudio y MFA) |
| Cifrado AES-256-GCM con AAD por registro (`clinicalCrypto.ts`) | Funcional, probado | Datos personales y notas reservadas (`recordEncrypted`) |
| Índice de búsqueda por tokens HMAC | Funcional | Búsqueda de clientes sin guardar el nombre en claro |
| `audit_log` + patrón de mutaciones transaccionales | Funcional | Modelo de la auditoría de accesos de LEXIA (`lexia_audit_log`) |
| Rate limiting, helmet, CORS con lista blanca, validación Zod compartida | Funcional | Se reutiliza tal cual |
| Capa de proveedor de IA (`ai.ts`, Gemini/Anthropic) | Parcial | Solo interpreta intenciones y genera un resumen diario; **no hay RAG**, ni contexto por documento |
| Memoria contextual (`Memory`), agentes, voz, Google Workspace | Funcional para uso personal | Candidatos para Fase 3–4 (agenda, correo); no se reutilizan en el MVP |
| Fábrica de verticales (`packages/verticals`) | Funcional para medicina | La vertical `legal` es un **borrador generado** (`status: draft`, vocabulario vacío, marco legal con un marcador `todo.identificacion`): no es un producto jurídico. No se reutiliza |
| CI (lint, typecheck, test, build) | Funcional | Se mantiene |

**No existe** (confirmado por búsqueda en el código): MFA/TOTP, almacenamiento de archivos (el modelo `Attachment` guarda solo una URL), extracción de texto/OCR, búsqueda vectorial, multi-tenencia por estudio, control de acceso por rol/expediente, política de retención. La seguridad documentada (`NEXUS_SECURITY.md`) lista 2FA y backups como pendientes.

**Riesgo a notar:** el cifrado deriva su clave de `CLINICAL_DATA_KEY` o, si falta, de `AUTH_SECRET`. LEXIA reutiliza ese mecanismo con un AAD propio (`lexia:<estudio>:<tipo>:<id>`), pero antes de producción necesita clave dedicada por entorno y rotación (ver backlog S-3).

## ClinicIA (`Fondal-Studios/ClinicIA`) — leído el README, `package.json` y la estructura

Piloto educativo clínico en Node 22 sin dependencias pesadas (`pg`), con funciones Netlify (`tutor`, `structure-consulta`, etc.) y backend de cuentas, aulas, pagos y entrenamiento (`backend/*.mjs`, ~400 líneas).

- Útil como **referencia de patrones** para LEXIA Learn: tutor con personalidades fijadas en servidor, explicaciones después de responder, devolución de simulacros, taxonomía de errores, “no simular IA cuando no está configurada” (responde 503 explícito), límites de consumo por instancia.
- Su propio README declara: contenido **pendiente de validación docente**, límite de consumo **por instancia (no distribuido)**, sin aislamiento por usuario en la IA de pruebas. No es reutilizable tal cual para datos de clientes.
- Es contenido clínico: nada del banco de preguntas aplica a derecho.

## Fondal Learn (`Fondal-Studios/Fondal-Learn`) — leído el README y `docs/PRODUCT.md`

Prototipo estático (Node 22, sin dependencias) con 100 cursos-plantilla, lecciones, XP, rachas y repaso de errores. Según su README: el contenido fue redactado con IA **sin revisión experta**; no tiene cuentas, IA, extracción de PDF ni sincronización; la generación de cursos desde PDF es un plan, no una función.

- Reutilizable: el diseño de producto (progresión, repaso de errores, criterios para tratar instrucciones dentro de documentos como contenido no confiable) para LEXIA Learn en Fase 4.
- No reutilizable: los cursos y el motor sin cuentas. No se inspeccionó `public/core.js` a nivel de código.

## Arquitecto IA (`drmarianojimenez94-sudo/Arquitecto-`) — leído completo

El repositorio contiene **únicamente un README con el título** (“Arquitecto-”) en un commit inicial. **No hay código, cartera de clientes, portafolio ni gestión documental para reutilizar.** Esas funciones deben construirse en LEXIA; si existe otro repositorio de Arquitecto IA con contenido, hay que indicarlo para auditarlo.

## Conclusión

La base reutilizable real es **Nexus** (identidad, cifrado, auditoría, API, CI). De ClinicIA y Fondal Learn se toman *patrones de producto* para la capacitación, no código. Lo faltante crítico, en orden: multi-tenencia y permisos, almacenamiento documental privado, extracción de texto/OCR, biblioteca normativa verificada con recuperación, MFA y portal de cliente.
