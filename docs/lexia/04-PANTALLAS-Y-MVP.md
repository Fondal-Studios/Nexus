# 04 — Pantallas y diseño del MVP

## Mapa de pantallas

```
Inicio de sesión → (MFA) → Dashboard del estudio
├─ Dashboard        vencimientos próximos (con estado: estimado/calculado/confirmado), alertas del auditor por prioridad, agenda de hoy, tareas sin responsable
├─ Clientes         lista + búsqueda → ficha (datos, expedientes, documentación autorizada, honorarios, comunicaciones, permisos)
├─ Expedientes      lista con filtros (tipo, fuero, etapa, responsable) → expediente
│    ├─ Resumen     carátula, partes, tribunal, etapa, responsables, notas privadas
│    ├─ Cronología  actuaciones y audiencias, con documento de respaldo
│    ├─ Documentos  carga, versiones, comparación → Visor documental (PDF/imagen, texto extraído al costado)
│    ├─ Vencimientos y tareas
│    ├─ Alertas     las del auditor, cada una con evidencia, fuente, impacto, acción, incertidumbre y botón Confirmar / Descartar
│    └─ Asistente   chat que solo conoce este expediente; cada respuesta separa Hechos · Alegaciones · Inferencias · Pendientes y enlaza a su fuente
├─ Biblioteca       búsqueda normativa con filtros (jurisdicción, vigencia en una fecha, materia, jerarquía, fuente) y historial de versiones
├─ Redactor         plantillas del estudio → borrador con campos a confirmar → versiones y aprobación
├─ Agenda           audiencias, vencimientos y reuniones
├─ Honorarios       presupuestos, cobros, saldos por cliente
├─ LEXIA Learn      rutas, casos simulados (marcados “SIMULACIÓN”), tutor socrático
├─ Portal del cliente (aplicación separada, solo lo compartido)
└─ Configuración    estudio, miembros y roles, MFA, política de IA externa, retención, plantillas, integraciones
```

El camino crítico de uso: **abrir un expediente → hablar con el asistente en ≤ 2 toques**. En iPhone, navegación inferior con cinco destinos (Inicio, Expedientes, Asistente, Agenda, Más); en escritorio, barra lateral y panel del visor a doble columna.

## Estética

Azul marino profundo `#0B1F3A` (base), grafito `#2B2F36` (superficies), blanco `#FFFFFF` (texto/lienzo claro), dorado discreto `#B8975A` solo para acentos (estado activo, línea de foco). Tipografía sans moderna (Inter o equivalente del sistema). Alertas por prioridad con color **y** etiqueta de texto, nunca solo color. Los casos simulados llevan marca visible permanente.

## MVP (Fase 1) — alcance exacto

**Dentro:** registro/ingreso, creación de estudio, miembros con rol, clientes (cifrados, búsqueda), expedientes judiciales/administrativos/extrajudiciales/consultivos, asignación por expediente, vencimientos con estados honestos, tareas, auditor de expedientes, auditoría de accesos; luego carga documental, visor y asistente básico.

**Estado actual de implementación (ver PROGRESS):** el backend de todo lo anterior hasta el auditor existe y está probado. **No existe todavía:** carga de documentos, visor, asistente conectado a un modelo, y ninguna pantalla de LEXIA en el frontend.

**Fuera del MVP:** biblioteca normativa con contenido real, redactor, portal, honorarios, Learn.

## Criterios de aceptación del MVP

1. Dos estudios no ven datos del otro (prueba automática, **cumplida** en API).
2. Un abogado no asignado no accede al expediente (cumplida).
3. Un plazo sin datos suficientes jamás muestra una fecha (cumplida); una estimación no se puede confirmar (cumplida).
4. Subir un PDF y verlo en el visor con su versión y huella SHA-256 (pendiente).
5. El asistente responde solo con documentos del expediente abierto y rechaza una afirmación sin evidencia (motor de validación cumplido; integración pendiente).
6. Todo acceso queda en la auditoría (cumplida para clientes y expedientes).
