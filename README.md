<p align="center">
  <img src=".github/banner.svg" alt="Homologaciones" width="100%">
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white"></a>
  <a href="#"><img src="https://img.shields.io/badge/Supabase-Postgres%20%C2%B7%20Auth%20%C2%B7%20Storage-3ecf8e?logo=supabase&logoColor=white"></a>
  <a href="#"><img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white"></a>
  <a href="#"><img src="https://img.shields.io/badge/IA-Groq-f55036"></a>
</p>

# Homologaciones

Plataforma para gestionar las **homologaciones de materias** de la Universidad Autónoma del Cauca. Un aspirante que viene de otra institución sube su certificado de notas, el sistema lee las materias y las empareja contra el plan de estudios de destino con ayuda de IA, y un comité revisa el resultado y emite un acta verificable. Lo que antes era un cruce manual de pensums, hoja por hoja, queda reducido a una solicitud que llega ya pre-analizada.

---

## El problema

Homologar una carrera implica comparar las materias aprobadas en la universidad de origen contra el pensum de destino, decidir cuáles equivalen y estimar en qué semestre quedaría el estudiante. Hacerlo a mano es lento, propenso a errores y difícil de auditar.

Esta plataforma cubre el flujo completo de punta a punta:

1. **El aspirante** entra sin necesidad de crear una cuenta, sube su certificado en PDF, elige la carrera a la que aspira y deja sus datos de contacto.
2. **El sistema** extrae las materias del PDF, las empareja con las asignaturas del plan destino y propone un porcentaje de similitud y un semestre estimado.
3. **El comité** revisa caso por caso desde un panel administrativo, aprueba o rechaza cada equivalencia y deja una nota para el solicitante.
4. **Se emite un acta** en PDF con un código QR que permite verificar su autenticidad, y el resultado le llega al aspirante por correo con un enlace de seguimiento.

---

## Cómo funciona el análisis con IA

El corazón del sistema es un pipeline que corre del lado del servidor cuando se envía una solicitud:

- **Extracción del PDF.** Se lee la capa de texto del certificado. Si el documento está escaneado (sin texto seleccionable), se renderizan las páginas a imagen y se usan modelos de visión para leerlas.
- **Emparejamiento.** Las materias de origen se comparan contra las asignaturas del pensum destino. La IA propone los vínculos con un porcentaje de similitud y una breve justificación de cada coincidencia.
- **Estimación de semestre.** No se delega en la IA: se calcula en código recorriendo el plan semestre a semestre y acumulando los créditos que el estudiante alcanza a homologar, hasta encontrar el primer semestre que todavía tendría que cursar.
- **Resiliencia.** El proveedor de IA (Groq) se consume a través de una **cadena de modelos con _fallback_**: si uno se queda sin cuota o queda fuera de servicio, se pasa automáticamente al siguiente. Los vínculos siempre quedan en estado *pendiente* hasta que un humano los confirma.

La IA sugiere; el comité decide. Ningún veredicto sale sin revisión humana.

---

## Funcionalidades

**Para el aspirante (acceso público, sin registro)**
- Formulario guiado de solicitud con carga de certificado y documentos de apoyo (contenidos programáticos).
- Onboarding interactivo la primera vez.
- Página de seguimiento por *token*: vuelve a su caso y consulta el estado sin tener que iniciar sesión.
- Descarga del acta de homologación cuando el caso es aprobado.

**Para el comité / administración**
- Bandeja de **casos de estudio** con el detalle de cada solicitud, las materias detectadas y los vínculos sugeridos para aprobar o rechazar uno a uno.
- Gestión de **planes académicos** (pensums), con carga de planes de estudio desde PDF.
- **Reportes** con gráficas de volumen y estado de las homologaciones.
- Gestión de **usuarios** y de **roles**.
- **Personalización de marca**: nombre de la institución, logo (claro y oscuro), color de acento, eslogan y fondo de la pantalla de ingreso.
- **Notificaciones en tiempo real** de casos nuevos.
- Generación de **actas en PDF** con folio, QR de verificación y la firma de marca de la institución.

**Transversal**
- Autenticación y autorización por rol (estudiante / administrador).
- Seguridad de datos a nivel de fila (RLS) en la base de datos.
- Protección anti-bots con Cloudflare Turnstile y límite de envíos.
- Tema claro / oscuro.
- Constancia de autorización de tratamiento de datos (Habeas Data).

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router, Server Actions, Route Handlers) |
| Lenguaje | TypeScript |
| UI | Tailwind CSS v4, componentes shadcn/ui (Radix), animaciones con Motion |
| Backend / datos | Supabase — PostgreSQL, Auth, Storage privado, Realtime, RLS |
| IA | Groq (LLM y modelos de visión) con cadena de modelos de respaldo |
| PDF | `unpdf` (extracción de texto), `@napi-rs/canvas` (render de páginas escaneadas), `@react-pdf/renderer` (acta) |
| Otros | QR de verificación, correo transaccional, gráficas con Recharts |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (app)/            # Área autenticada / con sidebar
│   │   ├── homologar/        # Flujo de solicitud del aspirante
│   │   ├── mis-homologaciones/
│   │   ├── casos/            # Bandeja del comité + detalle + acta + export
│   │   ├── carreras/         # Planes académicos (pensums)
│   │   ├── reportes/         # Gráficas
│   │   ├── usuarios/
│   │   └── configuracion/    # Marca y ajustes
│   ├── seguimiento/[token]/  # Consulta pública del caso por token
│   ├── ingresar/             # Acceso del administrador
│   └── api/                  # Endpoints públicos (pensums, homologaciones)
├── lib/
│   ├── groq/             # Cliente, extracción de materias/pensum, emparejamiento
│   ├── homologacion/     # Orquestación del pipeline + correo
│   ├── acta/             # Armado y render del acta en PDF
│   ├── pdf/              # Extracción de texto del certificado
│   ├── supabase/         # Clientes (navegador, servidor, servicio, middleware)
│   ├── seguridad/        # Turnstile
│   └── marca/            # Configuración de marca y temas
├── components/           # UI compartida (sidebar, notificaciones, etc.)
├── data/                 # Catálogos (instituciones de origen)
└── types/                # Tipos del dominio (Caso, Pensum, Asignatura, Vínculo…)

supabase/
├── migrations/           # Esquema versionado (0001 → 0021)
└── seed.sql              # Planes de estudio reales de la Autónoma del Cauca
```

El esquema de base de datos está versionado en migraciones, con políticas RLS pensadas para que un solicitante solo pueda leer y nunca alterar los vínculos o las materias que genera el sistema.

---

## Puesta en marcha

### Requisitos

- Node.js 18+ y [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/) (para el Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Una API key de [Groq](https://console.groq.com/)

### Instalación

```bash
pnpm install          # dependencias
pnpm db:start         # levanta Supabase local (Postgres, Auth, Storage)
pnpm db:reset         # aplica migraciones + seed (planes de estudio reales)
cp .env.example .env  # configura las variables (ver abajo)
pnpm dev              # http://localhost:3000
```

> `pnpm db:reset` recrea la base desde cero y **borra los usuarios de Auth**. Para aplicar migraciones nuevas sin perder datos, usa `pnpm db:migrate`.

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `GROQ_API_KEY` | Clave de Groq para el análisis con IA. Solo backend. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase. |
| `SUPABASE_SECRET_KEY` | Clave de servicio (acceso total). **Nunca** debe llegar al navegador. |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio, para los enlaces de seguimiento. |
| `RESEND_API_KEY` / `CORREO_REMITENTE` | Correo transaccional del veredicto. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (anti-bots). |

### Scripts

| Script | Acción |
|--------|--------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y arranque de producción |
| `pnpm db:start` / `pnpm db:stop` | Levanta / detiene Supabase local |
| `pnpm db:migrate` | Aplica migraciones pendientes (no borra datos) |
| `pnpm db:reset` | Recrea la base desde cero (migraciones + seed) |
| `pnpm db:status` | Muestra credenciales y estado del entorno local |

---

## Roles

- **Aspirante / estudiante** — acceso público. Envía su solicitud y sigue su estado por *token*; no necesita cuenta.
- **Administrador** — inicia sesión y accede al panel completo: casos, planes académicos, reportes, usuarios y configuración de marca.

La navegación, las vistas y los permisos cambian según el rol, tanto en la interfaz como en las políticas de la base de datos.

---

## Estado

El proyecto cubre el flujo completo de homologación: solicitud, análisis asistido por IA, revisión del comité y emisión del acta. El esquema de datos, el panel administrativo y el flujo del aspirante están operativos sobre un entorno local de Supabase, con los planes de estudio reales de la institución cargados desde el seed.

---

<sub>Proyecto desarrollado para la Universidad Autónoma del Cauca · Fábrica de Software.</sub>
