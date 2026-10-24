# PROGRESS — estado real de LEXIA

Última actualización: 2026-10-24 · Rama: `claude/lexia-foundation` (desde `main` de Nexus). Sin PR abierto.

## Qué se hizo en esta sesión

1. Auditoría de Nexus (profunda) y lectura de ClinicIA, Fondal Learn y Arquitecto- (ver 01).
2. Diseño: arquitectura (02), modelo de datos (03), pantallas y MVP (04), fases y backlog (05), comercial y calidad (06).
3. Código nuevo, todo aditivo:
   - `packages/lexia`: dominio jurídico puro.
   - `packages/shared/src/lexia.ts`: contratos Zod.
   - `database/schema.prisma` + migración `20261024170000_lexia_foundation` (10 tablas `lexia_*`).
   - `apps/api/src/routes/lexia.ts`, montado en `/lexia`.
   - Pruebas: `packages/lexia/src/lexia.test.ts` y `apps/api/src/tests/lexia.test.ts`.

## Verificaciones ejecutadas (en esta sesión, sobre este código)

| Verificación | Resultado |
| --- | --- |
| `packages/lexia` tests | 29/29 pasan |
| `apps/api` suite completa (Postgres 16 local, migraciones aplicadas desde cero) | 147/147 pasan, incluidas 12 de LEXIA |
| `pnpm lint` (todo el monorepo) | sin errores |
| `tsc --noEmit` en `packages/lexia` y `apps/api` | sin errores |
| `pnpm build` de `apps/api` (bundle con `@nexus/lexia`) | compila |
| Build y tests de `apps/web`, `apps/mobile` y `packages/verticals` | **no ejecutados** (no se tocaron esos paquetes) |

Las pruebas usan normas, reglas y calendarios **ficticios** (`fixture:*`). LEXIA no contiene todavía ninguna ley, artículo, regla procesal ni feriado reales.

## Qué NO existe todavía (no asumir lo contrario)

Interfaz de LEXIA · MFA · carga/almacenamiento/visor de documentos · OCR · asistente conectado a un modelo · biblioteca normativa con contenido · invitación de miembros · cronología/partes/pruebas/audiencias · honorarios · redactor · portal del cliente · LEXIA Learn · suscripciones · despliegue. Ninguna simulación de usuarios ni evaluación de calidad se hizo.

## Decisiones abiertas (necesito tu definición)

1. **Nombre y alcance del repositorio:** ¿LEXIA convive en este repo (como hoy) o se separa a un repositorio propio? El pedido original decía “no modificar los proyectos originales sin autorización”; por eso todo es aditivo y en rama aparte.
2. **Proveedor de IA y región** para documentos de clientes, y si el estudio aceptará IA externa.
3. **Proveedor de almacenamiento** de documentos (región; Argentina vs. exterior).
4. **Fuentes normativas** autorizadas a ingerir y licencias para jurisprudencia/doctrina.
5. **Repositorio de Arquitecto IA:** el indicado está vacío; ¿hay otro?
6. Nombre: se usó **LEXIA** (el mensaje decía “Lexus” y el prompt “LEXIA”).

## Próximo paso recomendado

S-1 (miembros) → D-1/D-2 (documentos y extracción) → U-1 (pantallas) → A-1 (asistente). Detalle en 05.

## Cómo retomar

```bash
git checkout claude/lexia-foundation && pnpm install
# Postgres 16 con usuario nexus / base nexus_test (ver .env.example), luego:
pnpm db:deploy && pnpm --filter @nexus/lexia test && pnpm --filter @nexus/api test
```
