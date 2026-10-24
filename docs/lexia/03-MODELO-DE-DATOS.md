# 03 — Modelo de datos

Implementado en `database/schema.prisma` (migración aditiva `20261024170000_lexia_foundation`, aplicada y probada sobre Postgres 16). Tablas `lexia_*`; ninguna tabla de Nexus se modificó salvo la relación inversa `User.lexiaMemberships`.

```
LexFirm 1─* LexMember *─1 User
LexFirm 1─* LexClient 1─* LexMatter
LexMatter *─* LexMember        (LexMatterAssignment: responsible | collaborator)
LexMatter 1─* LexDocument | LexDeadline | LexTask | LexAlert
LexFirm 1─* LexAuditLog
```

| Tabla | Claro (filtrable) | Cifrado (`recordEncrypted`, AES-256-GCM) |
| --- | --- | --- |
| `lexia_firms` | nombre, política de IA externa (`externalAiEnabled`, `allowedAiRegions`) | — |
| `lexia_members` | rol, `mfaEnabled` | — |
| `lexia_clients` | estudio, archivado, versión | nombre, documento, teléfono, email, domicilio, notas; índice de búsqueda en HMAC de prefijos |
| `lexia_matters` | cliente, tipo (judicial/administrativo/extrajudicial/consultivo), estado, `reserved`, fecha de promoción, fecha normativa | carátula, número judicial, fuero, jurisdicción, tribunal, etapa, **notas privadas** |
| `lexia_documents` | expediente, visibilidad, tipo, clave de objeto privado, SHA-256, tamaño, versión y versión previa | texto extraído |
| `lexia_deadlines` | título, fecha, estado (`estimated`/`calculated`/`confirmed`/`insufficient_data`), base del cálculo, quién confirmó | — |
| `lexia_tasks` | título, responsable (opcional: el auditor la marca), fecha | — |
| `lexia_alerts` | regla, prioridad, estado de revisión, quién revisó; `payload` con los 8 campos | — |
| `lexia_audit_log` | actor, acción, entidad, metadatos | — |

## Cubierto y no cubierto respecto del pedido

Cubierto en el esquema: cliente, expediente, partes por asignación de abogados, vencimientos, tareas, alertas, versionado de documento, auditoría.

**Aún sin tabla** (backlog): relaciones entre clientes y contrapartes, partes intervinientes del expediente, cronología de actuaciones, pruebas, audiencias, contratos de servicio, honorarios y movimientos, comunicaciones, historial de cambios del expediente, versiones de borradores, biblioteca normativa persistida (hoy `Corpus` en memoria para probar el motor), usuarios de portal de cliente. Las rutas de carga/descarga de documentos tampoco existen todavía: la tabla está, el almacenamiento no.
