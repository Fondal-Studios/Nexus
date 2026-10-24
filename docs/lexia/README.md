# LEXIA — plataforma de gestión jurídica asistida por IA

Documentación viva del proyecto. **Si retomás el trabajo, empezá por [PROGRESS.md](PROGRESS.md).**

LEXIA nace dentro de este monorepo (rama `claude/lexia-foundation`) reutilizando la infraestructura de NEXUS. NEXUS sigue funcionando sin cambios: todo lo de LEXIA es aditivo (paquete `packages/lexia`, rutas `/lexia`, tablas `lexia_*`).

| Documento | Contenido |
| --- | --- |
| [01-AUDITORIA.md](01-AUDITORIA.md) | Qué hay realmente en Nexus, ClinicIA, Fondal Learn y Arquitecto-, y qué se reutiliza |
| [02-ARQUITECTURA.md](02-ARQUITECTURA.md) | Arquitectura SaaS, decisiones justificadas, seguridad, IA/RAG |
| [03-MODELO-DE-DATOS.md](03-MODELO-DE-DATOS.md) | Entidades, relaciones y qué va cifrado |
| [04-PANTALLAS-Y-MVP.md](04-PANTALLAS-Y-MVP.md) | Mapa de pantallas, diseño del MVP, estética |
| [05-FASES-Y-BACKLOG.md](05-FASES-Y-BACKLOG.md) | Las cinco fases (objetivo, criterios, riesgos) y backlog priorizado |
| [06-COMERCIAL-Y-CALIDAD.md](06-COMERCIAL-Y-CALIDAD.md) | Planes, método de costos, cumplimiento Ley 25.326, método de auditoría |
| [PROGRESS.md](PROGRESS.md) | Estado real, verificaciones ejecutadas, pendientes y decisiones abiertas |

## Principios no negociables (se aplican a todo el código)

1. **Nada inventado.** Ninguna ley, artículo, cita, plazo o resultado sale de la memoria del modelo: solo de la biblioteca normativa verificada (`resolveCitation`). Lo que no se puede verificar se declara.
2. **Un plazo estimado nunca es un plazo confirmado.** Los vencimientos solo se calculan con jurisdicción, notificación, regla con fuente y calendario judicial verificado; un abogado/a los confirma (`computeDeadline`, `confirmDeadline`).
3. **Hecho ≠ alegación ≠ inferencia ≠ pendiente.** Toda afirmación de la IA lleva tipo, evidencia y grado de incertidumbre (`validateClaim`).
4. **Humano en el circuito.** La IA propone; nada se presenta, envía ni confirma sin revisión y autorización de un profesional.
5. **Aislamiento por estudio y por expediente.** Un documento de otro cliente no puede llegar al contexto del asistente (`authorize`, `gateExternalAi`).
6. **Fail-closed con la IA externa.** Sin acuerdo de tratamiento de datos, región autorizada y habilitación del estudio, nada sale (`gateExternalAi`).
