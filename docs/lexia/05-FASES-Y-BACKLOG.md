# 05 — Fases y backlog

Estimaciones de costo: **no se incluyen cifras** hasta tener precios vigentes de infraestructura y modelos y volumen objetivo (ver 06). Se indica el esfuerzo relativo (S ≤ 1 sem, M ≈ 2–3, L ≈ 4–6, XL > 6, de un desarrollador).

## Fase 1 — MVP · estado: **parcial**
- **Objetivo:** un abogado o estudio gestiona clientes y expedientes con seguridad real.
- **Hecho y probado:** tenencia por estudio, roles, clientes cifrados, expedientes, asignaciones, plazos honestos, tareas, auditor (8 reglas), auditoría de accesos, motor de permisos.
- **Falta:** UI, MFA, almacenamiento/versionado de documentos, extracción de texto/OCR, visor, asistente conectado a un modelo, invitación de miembros.
- **Dependencias:** decisión de proveedor de almacenamiento y de IA (ver Decisiones abiertas).
- **Riesgos:** PDFs maliciosos o escaneados ilegibles; fuga entre clientes por un descuido en una consulta nueva → toda ruta nueva debe pasar por `context()`/`need()` y tener prueba de aislamiento.

## Fase 2 — Inteligencia jurídica · estado: **motor listo, sin contenido**
- **Objetivo:** respuestas con fuentes verificables.
- **Hecho:** `resolveCitation`/`verifyCitations` (vigencia por fecha, artículo, fuente), `searchCorpus` (filtros duros), `validateClaim`.
- **Falta:** persistir y cargar la biblioteca desde **fuentes oficiales** (p. ej. InfoLeg, Boletín Oficial, sitios provinciales; hay que verificar términos de uso de cada una), registro de modificaciones, índice vectorial, jurisprudencia y doctrina con licencia, análisis documental, extractor de cronología.
- **Criterio:** una norma derogada o de otra jurisdicción nunca aparece; una cita fuera de la biblioteca nunca se muestra como verificada (cubierto en pruebas unitarias con normas ficticias).
- **Riesgo mayor:** cobertura y actualidad del corpus. Sin corpus verificado el asistente debe decir “fuente no disponible”.

## Fase 3 — Productividad
Redactor con plantillas y versiones, agenda procesal, alertas por correo/push, honorarios. Dependencia: calendario judicial verificado por jurisdicción (hoy no se incluye ninguno; el cómputo de plazos lo exige).

## Fase 4 — Ecosistema
Portal del cliente (principal `client`, ya soportado por `authorize`), colaboración, integraciones, LEXIA Learn (separación real/simulado ya modelada en `mayUseForTraining`).

## Fase 5 — Comercialización
MFA obligatorio, pentest externo, copias y restauración probadas, métricas, suscripciones y facturación, pilotos con estudios reales, evaluación legal de Ley 25.326 por un profesional.

## Backlog priorizado (siguiente = primero)

| # | Ítem | Tam. | Por qué ahora |
| --- | --- | --- | --- |
| S-1 | Invitar miembros y cambiar rol (hoy solo vía base de datos) | S | Sin esto no hay estudios de más de una persona |
| S-2 | MFA TOTP + códigos de respaldo; exigirlo para owner/admin | M | Control de exportar/eliminar ya lo requiere |
| S-3 | Clave de cifrado dedicada por entorno + rotación | M | Riesgo de seguridad conocido |
| D-1 | Almacenamiento privado, subida con límites de tipo/tamaño, SHA-256, versiones, descarga firmada | L | Núcleo del MVP |
| D-2 | Extracción de texto PDF/DOCX y OCR en worker; estado por documento | L | El asistente depende de esto |
| U-1 | Pantallas: login/estudio, clientes, expediente, vencimientos, alertas | L | Nada de LEXIA es visible aún |
| D-3 | Visor documental | M | |
| A-1 | Asistente por expediente: contexto autorizado + `gateExternalAi` + `validateClaim` + proveedor | L | Requiere D-2 y decisión de proveedor |
| N-1 | Esquema y carga de biblioteca normativa desde fuentes oficiales; versionado | XL | Sin corpus no hay RAG jurídico |
| P-1 | Cronología, partes, pruebas, audiencias, historial de cambios | L | Completa el expediente |
| P-2 | Calendarios judiciales verificados por jurisdicción | M | Habilita plazos calculados reales |
| R-1 | Retención y eliminación según política del estudio; copias y restauración | M | |
| Q-1 | Evaluación simulada (ver 06) y pruebas de inyección con documentos hostiles | M | |
