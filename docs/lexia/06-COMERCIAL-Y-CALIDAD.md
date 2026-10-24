# 06 — Modelo comercial, cumplimiento y auditoría de calidad

## Planes (hipótesis a validar, **sin precios**)

| | Individual | Professional | Enterprise |
| --- | --- | --- | --- |
| Destino | Abogado independiente | Estudio pequeño | Estudio grande / área legal |
| Usuarios | 1 | varios, con roles y asignación | muchos, SSO |
| Límites a definir | expedientes, almacenamiento, páginas OCR/mes, consultas de IA/mes | ídem + automatizaciones, portal de clientes | ídem + región de datos, retención propia, soporte |

**No se recomiendan precios todavía.** Antes hay que calcular:

```
costo mensual por estudio =
    almacenamiento (GB × tarifa)  +  transferencia
  + OCR/extracción (páginas × costo)
  + IA: Σ consultas × (tokens de entrada × tarifa_in + tokens de salida × tarifa_out)
  + indexado/vectores (tokens de embedding × tarifa)  +  base de datos y cómputo prorrateados
  + soporte y cumplimiento
```

Insumos que faltan y no se inventan: tarifas vigentes del proveedor de IA y de nube elegidos, tamaño medio de un expediente (páginas), consultas por abogado/día. Medirlos en un piloto y recién ahí fijar límites y precio con margen.

## Cumplimiento — Ley 25.326 (evaluación técnica preliminar, no asesoramiento legal)

| Aspecto | Estado |
| --- | --- |
| Seguridad y confidencialidad de los datos (cifrado, control de acceso, auditoría) | Implementado parcialmente (ver 02) |
| Consentimiento / base legal para tratar datos de clientes y terceros | A definir con el estudio como responsable; LEXIA actúa como encargado |
| Transferencia internacional de datos (proveedores de IA/nube fuera del país) | **Compuerta técnica hecha** (`gateExternalAi`: región y acuerdo); la evaluación jurídica de adecuación y las cláusulas contractuales deben hacerlas profesionales |
| Derechos de acceso, rectificación y supresión | Pendiente (R-1) |
| Registro de bases de datos ante la autoridad de control | Evaluar con un especialista si corresponde al estudio y/o a LEXIA |
| Secreto profesional | Notas reservadas cifradas y fuera del portal; expedientes `reserved` no salen a IA externa por defecto |

Antes de comercializar: revisión por un abogado especialista en protección de datos y, si se aloja información sensible, pentest externo. Otras normas (p. ej. reglas de matriculación o deberes de reserva de cada colegio) no se evaluaron.

## Auditoría de calidad

**Hasta ahora existen únicamente verificaciones automáticas reales** (resultados en PROGRESS). **No se ha realizado ninguna simulación con perfiles de abogados ni prueba con usuarios reales, por lo que no se asigna ningún puntaje 0–100.** Inventar puntajes sería presentar como resultados algo que no ocurrió.

Método propuesto, cuando exista un asistente conectado:
1. Batería de casos sintéticos por especialidad (civil, laboral, penal, familia, comercial, tributario, administrativo, consumidor) escritos y **revisados por abogados de cada materia**; cada caso con respuesta esperada y fuentes esperadas.
2. Perfiles simulados (junior, senior, estudio) ejecutando tareas fijas; los informes se rotulan **“SIMULACIÓN”** y nunca se mezclan con pruebas con personas.
3. Dimensiones medidas con criterio explícito: utilidad, facilidad de uso, precisión jurídica (citas verificables correctas / totales), calidad de fuentes (oficial vs. secundaria), seguridad (casos de fuga e inyección superados), gestión documental, redacción, rendimiento, escalabilidad, viabilidad comercial.
4. Prioridad de errores: (1) pérdida de información, (2) violación de confidencialidad, (3) perjuicio procesal (plazo erróneo, cita inventada), (4) resto.
5. Umbral de salida de cada fase: 0 errores de tipo 1–3 en la batería.
