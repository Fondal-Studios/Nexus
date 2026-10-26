# Nexus — secretario personal y fábrica de verticales

## Separación de productos (26/10/2026)

- **Nexus**: asistente personal, orquestador de proyectos y fábrica reutilizable de motores para otras verticales.
- **LexIA**: producto jurídico separado, repositorio `Fondal-Studios/LexIA`. La rama histórica `claude/lexia-foundation` se conserva solo como referencia de migración. No incorporar sus rutas, modelos ni UI jurídicos específicos al `main` de Nexus.
- Los motores que puedan reutilizarse se extraerán a paquetes compartidos versionados con interfaces de integración. Las bases de datos de productos permanecen separadas.

## Nuevo módulo: contactos inteligentes

Ruta: `/contacts`.

Primera versión: importación de agenda VCF y conversaciones CSV exportadas en lote desde ordenador; agrupación por interlocutor, conteo de mensajes, etiquetas no excluyentes y contador manual de pacientes. El importador opera en memoria del navegador y **no persiste los datos**. La entrada CSV es genérica y deberá contrastarse con archivos reales de iMazing.

**Siguientes requisitos todavía NO cumplidos:** persistencia PostgreSQL, entidades `Contact`, `Conversation`, `Message`, sincronización incremental, vinculación de identidades, revisión sugerida por IA, permisos por usuario, búsqueda semántica, navegación integrada y procesamiento en lotes sin límite de 50 MB.

WhatsApp personal no brinda una API oficial que permita leer continuamente todo su historial. No se deben almacenar credenciales de WhatsApp ni automatizar sesiones web no oficiales.
