# Arquitectura del Sistema de Homologaciones

## 1. Objetivo del proyecto

El sistema automatiza el proceso de **homologación de asignaturas** para estudiantes que migran entre instituciones de educación superior en Colombia. Un estudiante sube su certificado de notas en PDF, la IA extrae las materias cursadas, las compara contra el plan de estudios (pensum) de la universidad destino, propone equivalencias con porcentajes de similitud y estima el semestre al que ingresaría el estudiante. Un administrador revisa, confirma o ajusta las equivalencias y emite un acta oficial de homologación con firma y QR de verificación.

El flujo principal es:

```
Estudiante sube PDF → IA extrae materias → IA empareja con pensum destino
→ IA estima semestre → Admin revisa y decide → Se emite acta firmada con QR
```

---

## 2. Arquitectura general

### 2.1 Vista de alto nivel

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Estudiante   │    │   Next.js     │    │  Supabase     │
│  (invitado)   │───▶│  App Router   │───▶│  PostgreSQL   │
│               │    │  (Server      │    │  Storage      │
│  Sube PDF     │    │   Actions)    │    │  Auth         │
└──────────────┘    └──────┬───────┘    └──────────────┘
                           │
                    ┌──────┴───────┐
                    │   Motor IA    │
                    │  ┌─────────┐  │
                    │  │OpenRouter│  │ (primario)
                    │  │  Gemini  │  │ (fallback)
                    │  └─────────┘  │
                    └──────────────┘
                           │
                    ┌──────┴───────┐
                    │    Admin      │
                    │  Revisa caso  │
                    │  Confirma /    │
                    │  Rechaza /     │
                    │  Ajusta        │
                    └──────────────┘
```

### 2.2 Flujo completo de extremo a extremo

1. **Estudiante (invitado, sin registro)** accede al formulario público en `/homologar`
2. Completa datos de contacto, selecciona carrera destino y universidad de origen, adjunta su certificado de notas en PDF
3. Resuelve captcha (Cloudflare Turnstile)
4. El sistema valida que el PDF sea un documento académico real (IA: validación anti-spam)
5. Se crea sesión anónima en Supabase Auth
6. El PDF se sube a Supabase Storage (bucket privado `certificados`)
7. Se crea el registro `caso` con estado `procesando`
8. Se ejecuta el pipeline de IA (`procesarCaso`):
   - Extrae materias del certificado (IA: OpenRouter, o parser determinístico para SENA)
   - Empareja cada materia con las asignaturas del pensum destino (IA: OpenRouter o Gemini)
   - Estima el semestre sugerido (IA: Gemini o algoritmo determinístico)
   - Guarda vínculos en estado `pendiente`
   - Cambia el caso a `en_revision`
9. Se notifica al admin (campana de notificaciones) y se envía correo de recepción al estudiante
10. **Admin** revisa el caso en `/casos/[id]`:
    - Interfaz de dos columnas: materias origen vs. asignaturas destino
    - Confirma, rechaza o crea vínculos manualmente
    - Puede aprobar en lote sugerencias con alta similitud
    - Puede reprocesar el pipeline completo
11. Admin **finaliza el caso**: aprueba o rechaza, asigna semestre, escribe notas
12. Sistema genera **acta PDF** (si es aprobado) con tabla de equivalencias, créditos, QR de verificación
13. Se envía **correo de veredicto** al estudiante con enlace de seguimiento público (`/seguimiento/[token]`)

---

## 3. Tecnologías utilizadas

| Categoría | Tecnología | Versión / Notas |
|---|---|---|
| **Framework** | Next.js 14 | App Router, Server Actions, Route Handlers |
| **Lenguaje** | TypeScript 5.9 | |
| **Base de datos** | PostgreSQL | Vía Supabase |
| **Autenticación** | Supabase Auth | Anónimo (estudiantes) + email/password (admins) |
| **Autorización** | Row Level Security (RLS) | Políticas por bucket y tabla en Supabase |
| **Almacenamiento** | Supabase Storage | Buckets: `certificados` (privado), `planes` (público), `marca` (público) |
| **IA primaria** | OpenRouter | API compatible con OpenAI. Modelos gratuitos: `google/gemma-4-26b-a4b-it:free` (texto y visión), `openai/gpt-oss-20b:free` (respaldo) |
| **IA fallback** | Google Gemini | SDK `@google/genai` v2. Modelos: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| **Extracción PDF texto** | unpdf | Fork de pdf.js optimizado para Node/serverless |
| **OCR / Visión** | unpdf + @napi-rs/canvas | Renderizado de páginas a imagen → modelos de visión OpenRouter/Gemini |
| **Generación PDF** | @react-pdf/renderer | Actas de homologación |
| **QR** | qrcode | Verificación de actas |
| **Correo (dev)** | nodemailer | Vía Mailpit (SMTP local) |
| **Correo (prod)** | Resend API | Dominio verificado requerido |
| **UI** | React 18, Tailwind CSS 4, Radix UI (shadcn/ui) | |
| **Animaciones** | Motion (Framer Motion) | |
| **Notificaciones** | sileo | Toasts para feedback al usuario |
| **Captcha** | Cloudflare Turnstile | Anti-bot en formulario público |
| **Gráficas** | recharts | Dashboard de reportes |
| **Íconos** | @tabler/icons-react, lucide-react | |
| **Formularios** | react-hook-form (declarado), useFormState | |
| **Empaquetador** | pnpm | Workspace mode |

---

## 4. Modelo de datos

### 4.1 Diagrama de relaciones

```
auth.users ─── perfil (1:1)
                  │
                  ├── caso (1:N, estudiante_id)
                  │     ├── materia_origen (1:N, caso_id)
                  │     ├── vinculo (1:N, caso_id)
                  │     │     └── materia_origen (1:N, materia_origen_id)
                  │     │     └── asignatura (1:N, asignatura_id)
                  │     └── documento_caso (1:N, caso_id)
                  │
                  └── notificacion (implícito vía caso_id)

pensum ─── asignatura (1:N, pensum_id)
             └── vinculo (1:N, asignatura_id)

configuracion (singleton, id = 1)
plantilla_nota (sin FK)
```

### 4.2 Tablas

#### `perfil`
Perfil de usuario vinculado 1:1 con `auth.users`. Contiene `nombre` y `rol` (`estudiante` | `admin`). Se crea automáticamente vía trigger al insertar en `auth.users`.

#### `pensum`
Catálogo de planes de estudio de la universidad destino. Cada pensum tiene `carrera`, `version`, `activo` (boolean), y opcionalmente `archivo_pdf` (ruta en bucket `planes`). Unique constraint en `(carrera, version)`.

#### `asignatura`
Materias que componen un pensum destino. Cada una pertenece a un `pensum_id`, tiene `codigo` (opcional), `nombre`, `creditos` (smallint >= 0), y `semestre` (smallint > 0). Unique en `(pensum_id, codigo)`.

#### `caso`
El registro central: una solicitud de homologación. Contiene:
- Referencia al estudiante (`estudiante_id` → `perfil`)
- Referencia al pensum destino (`pensum_destino_id` → `pensum`)
- Datos de contacto del solicitante (nombre, celular, correo)
- Institución de origen (`institucion_origen_nombre`)
- Ruta del PDF en bucket (`archivo_pdf`)
- Estado: `procesando` → `en_revision` → `aprobado` | `rechazado`
- `semestre_sugerido`: estimación de la IA
- `token_seguimiento`: UUID para acceso público sin sesión
- `nota_admin`: visible al estudiante, `nota_interna`: solo admin
- `decidido_en`, `decidido_por`: trazabilidad de la decisión
- `autorizo_datos`, `autorizo_en`: consentimiento Habeas Data
- `ip_solicitante`: hash SHA-256 de la IP (para rate limiting)

#### `materia_origen`
Materias extraídas del certificado del estudiante. Cada una pertenece a un `caso_id`. Campos: `nombre`, `codigo`, `creditos`, `nota` (texto), `semestre_origen`. Las materias del SENA tienen `semestre_origen = null` y `creditos` = intensidad horaria.

#### `vinculo`
Relación entre una `materia_origen` y una `asignatura` destino. Es la propuesta de homologación. Campos: `similitud` (0-100), `razon` (justificación breve de la IA), `estado` (`pendiente` | `aprobado` | `rechazado`). `caso_id` está desnormalizado para consultas.

#### `documento_caso`
Documentos adicionales (contenidos programáticos / syllabi) subidos por el estudiante. Referencia al `caso_id`. Almacenados en bucket `certificados`.

#### `configuracion`
Singleton (id = 1) con la identidad visual de la institución: nombre, eslogan, logos, colores (primario, acento, eliminar), tema oscuro, fondo de login, colores de notificación, posición de notificaciones, nota mínima para homologación.

#### `notificacion`
Avisos persistentes para el admin (campana). Cada notificación tiene `tipo`, `titulo`, `cuerpo`, `caso_id` (opcional), `leida` (boolean).

#### `plantilla_nota`
Notas predefinidas reutilizables por el admin al finalizar casos.

### 4.3 Funciones PostgreSQL

| Función | Tipo | Propósito |
|---|---|---|
| `crear_perfil_para_usuario_nuevo()` | Trigger | Crea fila en `perfil` al insertar en `auth.users` |
| `es_admin()` | SECURITY DEFINER | Retorna true si el usuario autenticado tiene rol `admin` |
| `contar_homologaciones_recientes(ip_param text)` | SECURITY DEFINER | Cuenta envíos por IP y usuario en últimas 24h para rate limiting |

---

## 5. Flujo de homologación

### Paso 1 — Envío del estudiante (`crearHomologacion`)

1. **Validación de campos**: carrera destino, institución origen, nombre, celular, correo, autorización Habeas Data, archivo PDF (tipo, tamaño < 10 MB)
2. **Captcha**: verificación Cloudflare Turnstile
3. **Rate limiting**: consulta RPC `contar_homologaciones_recientes`, límite 10/día por IP y por usuario
4. **Validación de contenido**: extrae texto del PDF con `unpdf`. Si tiene >= 30 caracteres, llama a `validarDocumentoAcademico()` (IA) para verificar que sea un documento académico real. Si está escaneado, omite esta validación (fail-open: el admin lo revisa después)
5. **Sesión anónima**: si el estudiante no tiene sesión, crea una vía `signInAnonymously()`
6. **Subida del PDF**: a bucket `certificados` en ruta `{user_id}/{timestamp}.pdf`
7. **Creación del caso**: insert en `caso` con todos los datos, estado inicial `procesando`
8. **Pipeline IA**: llama a `procesarCaso(casoId, textoPdf, bytesPdf)`
9. **Notificación admin**: inserta en `notificacion` para la campana
10. **Documentos adicionales**: sube syllabi opcionales (máx 10, best-effort)
11. **Correo de recepción**: envía comprobante al estudiante (best-effort)
12. **Redirección**: lleva al estudiante a `/mis-homologaciones/{id}` donde ve la propuesta de la IA

### Paso 2 — Pipeline de IA (`procesarCaso`)

1. **Carga de datos**: lee `pensum_destino_id` e `institucion_origen_nombre` del caso. Detecta si es SENA (`/sena/i`)
2. **Carga del pensum destino**: obtiene todas las `asignatura` del pensum, ordenadas por semestre
3. **Extracción de materias origen** (tres caminos):
   - **SENA**: `parsearSENA(textoPdf)` — parser regex determinístico, 0 tokens
   - **Universitario con texto** (>= 30 chars): `extraerMateriasDeTexto(textoPdf)` — IA (OpenRouter → Gemini)
   - **Escaneado** (< 30 chars): `extraerMateriasPorVision(bytesPdf)` — OCR por visión (OpenRouter → Gemini)
4. **Guardado**: inserta materias extraídas en `materia_origen`
5. **Emparejamiento IA**: `emparejarMaterias(origen, destino, esSena)` — compara por nombre y contenido, devuelve vínculos con similitud 0-100 y justificación. Si es SENA, permite 1:N (una competencia → varias asignaturas)
6. **Guardado de vínculos**: inserta en `vinculo` con estado `pendiente`
7. **Estimación del semestre**:
   - Primero: `estimarSemestreConGemini()` — IA analiza el plan semestre a semestre
   - Fallback: `estimarSemestre()` — algoritmo de acumulación de créditos
8. **Finalización**: actualiza caso a `en_revision` con `semestre_sugerido`

### Paso 3 — Revisión del admin

1. El admin ve el caso en `/casos/[id]` con interfaz de dos columnas
2. Puede **confirmar** vínculos individuales o **rechazarlos**
3. Puede **confirmar en lote** sugerencias con similitud >= umbral
4. Puede **crear vínculos manualmente** (seleccionando materia origen + asignatura destino)
5. Puede **reprocesar** el pipeline completo (`reprocesarCaso`)
6. Al **finalizar**, elige veredicto (`aprobado` / `rechazado`), asigna semestre, escribe notas (pública e interna)

### Paso 4 — Acta y notificación

1. Si el caso es `aprobado`, el sistema genera un acta PDF con `@react-pdf/renderer`
2. El acta incluye: datos del estudiante, tabla de equivalencias, créditos totales, semestre asignado, QR de verificación
3. Se envía correo de veredicto al estudiante con enlace de seguimiento
4. El estudiante puede consultar su caso sin sesión vía `/seguimiento/{token}` y descargar el acta

---

## 6. Extracción de documentos

### 6.1 Certificados universitarios

**Librería**: `unpdf` (extracción de texto), OpenRouter/Gemini (IA)

**Antes de la IA**: si el documento es el reporte "SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE" (ver 6.3),
lo lee un parser determinístico y la IA no interviene.

**Flujo**:
1. `unpdf.extractText()` extrae el texto completo del PDF con `mergePages: true`
2. Si el texto tiene < 30 caracteres, se considera **escaneado** y se va por visión
3. `extraerMateriasDeTexto(texto)` envía los primeros 12000 caracteres a OpenRouter (primario) o Gemini (fallback)
4. El prompt (`SISTEMA`) pide extraer materias organizadas por semestre con: `nombre`, `codigo`, `creditos`, `nota`, `semestre_origen`
5. La respuesta se parsea como JSON (`{"materias": [...]}`) y se sanitiza (créditos y semestre deben ser enteros)

**Visión (PDFs escaneados)**:
1. `unpdf.renderPageAsImage()` + `@napi-rs/canvas` renderiza cada página a imagen (escala 1.5)
2. Una página por llamada a la IA de visión (máx 8 páginas)
3. Rotación round-robin entre modelos de visión para distribuir el cupo de tokens
4. Mismo formato de salida JSON que la extracción por texto

### 6.2 Certificados del SENA

**Estrategia**: parser determinístico con regex, **sin IA**

**Detección**: el nombre de la institución de origen (seleccionada por el estudiante en el formulario) contiene "SENA". Se consulta de `caso.institucion_origen_nombre` en la BD.

**Formato del SENA**: el certificado tiene una estructura predecible en todos los programas de formación titulada:
```
[NOMBRE DE LA COMPETENCIA]
[nota]  [A/D]  REGISTRO DE COMPETENCIAS EVALUADAS  EVAL  IH  [horas]
RESULTADOS DE APRENDIZAJE
01  [texto del RA 1]
02  [texto del RA 2]
...
```

**Parser** (`parsearSENA`):
1. Normaliza espacios múltiples a uno solo
2. Usa regex para encontrar cada bloque delimitado por `REGISTRO DE COMPETENCIAS EVALUADAS  EVAL  IH  <horas>  RESULTADOS DE APRENDIZAJE`
3. Extrae: nombre de la competencia, IH (horas), evaluación (A/D), y la lista de resultados de aprendizaje (separados por números de dos dígitos 01, 02, 03...)
4. El primer bloque incluye el encabezado institucional, que se recorta buscando `"aprobado:"`
5. Formatea la salida como `"Competencia:\n<nombre>\n\nResultados de aprendizaje:\n- <RA1>\n- <RA2>..."` en el campo `nombre`
6. `creditos` = valor IH, `nota` = `"Aprobado"`, `semestre_origen` = `null`

**Ventajas**: 0 tokens, 0 llamadas API, respuesta en milisegundos, 100% determinístico.

**Visión SENA**: si el PDF del SENA está escaneado (sin capa de texto), se usa `SISTEMA_VISION_SENA` (prompt de visión específico para SENA) que extrae competencias con el mismo formato.

### 6.3 Reporte "SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE"

**Estrategia**: parser determinístico por COORDENADAS, **sin IA** (`src/lib/extraccion/seguimiento-pensum-parser.ts`).

**Detección**: el documento trae el título `SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE` y el encabezado
de tabla (`Cod_Curso … Nombre_Curso … ----Nota----`). No depende de qué institución declaró el
estudiante: cualquier otro certificado sigue por el `ParserIA` sin enterarse.

**Formato**: el reporte lista el PLAN COMPLETO de la carrera (columna *CURSOS PENSUM*) y, al lado, lo
que el estudiante cursó (columna *CURSOS VISTOS*). Lo no cursado va relleno de asteriscos.

**Parser**:
1. `extraerRenglonesPdf` (`src/lib/pdf/extraer.ts`) reconstruye los renglones por posición. El texto
   unido no sirve: en el orden del content-stream las celdas de una fila salen revueltas.
2. Cada renglón se lee celda por celda: `No → Cod_Curso → Nombre → CR → [lado cursado]`.
3. El nombre se toma del PLAN (el de "cursos vistos" viene recortado por el ancho de la celda).
4. La nota es el único DECIMAL de la fila (créditos, número de fila y año son enteros).
5. Las filas sin nota NO se extraen: son casillas del plan que el estudiante no cursó.
6. Reconciliación con `Total Créditos Aprobados` del propio reporte, en el log.

**Ventajas**: 0 tokens, y evita el OCR por visión al que se iba antes (el relleno de asteriscos hundía
la proporción de letras del Quality Gate por debajo del umbral).

Ver `docs/ADR-004 Sin nota no hay materia.md`.

### 6.4 Regla común: sin nota no hay materia, y sin ganarla tampoco

`src/lib/extraccion/notas.ts` (`filtrarHomologables`) se aplica a TODO el camino universitario —el
parser de seguimiento y el `ParserIA`— y descarta, ya extraídas:

1. Las unidades **sin calificación real** (relleno, vacío, "en curso", "N/A"): no se cursaron.
2. Las **reprobadas**: solo se homologa lo ganado. El umbral es `configuracion.nota_minima` (3.0 por
   defecto, editable en `/configuracion`); `procesar.ts` lo lee y lo pasa como parámetro, así la capa
   de extracción no toca la base de datos.

**Excepción**: si NINGUNA unidad del documento trae nota, el certificado no reporta calificaciones y
se conservan todas (filtrar dejaría el caso vacío y no habría con qué decidir).

La escala colombiana (0.0-5.0, se gana desde 3.0) se interpreta en un solo archivo,
`src/lib/extraccion/escala-nota.ts` (`notaANumero`, `esNotaAprobada`), que usan tanto el filtro como
el estudio: el panel y el pipeline no pueden entender "3.0" de forma distinta. Ese módulo no importa
nada, para que el componente de cliente no arrastre `unpdf` ni el cliente de OpenRouter al navegador.

El **SENA queda fuera** de este filtro: sus competencias vienen con "Aprobado"/"No aprobado" y su
extracción tiene sus propias reglas (ver 6.2 y ADR-003).

---

## 7. Motor de IA

El sistema utiliza **dos proveedores de IA en cascada**: OpenRouter como primario y Google Gemini como fallback. Cada proveedor tiene su propia cadena de modelos con reintentos ante rate-limit.

### 7.1 Proveedores

#### OpenRouter (`src/lib/openrouter/cliente.ts`)
- **API**: `https://openrouter.ai/api/v1/chat/completions` (compatible con OpenAI)
- **Modelos texto**: `openai/gpt-oss-120b` → `openai/gpt-oss-20b` → `qwen/qwen3.6-27b`
- **Modelos ligeros**: `openai/gpt-oss-20b` → `qwen/qwen3.6-27b` → `openai/gpt-oss-120b`
- **Modelos visión**: `qwen/qwen3.6-27b` → `meta-llama/llama-4-scout-17b-16e-instruct`
- **Resiliencia**: reintentos ante 429 (rate-limit) con espera configurable (2.5s texto, 12s visión), máximo 2 reintentos por modelo antes de pasar al siguiente. Errores 401/403 abortan toda la cadena.

#### Google Gemini (`src/lib/gemini/cliente.ts`)
- **SDK**: `@google/genai` v2 (`GoogleGenAI`)
- **Modelos texto**: `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash`
- **Modelos visión**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash`
- **Resiliencia**: mismo patrón de cadena de modelos + reintentos que OpenRouter. Detecta errores `RESOURCE_EXHAUSTED` (créditos agotados).

### 7.2 Puntos de uso de IA

#### A. Validación de documento académico
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/ia/validar.ts` |
| **Función** | `validarDocumentoAcademico(texto)` |
| **Modelo** | Cadena ligera (OpenRouter → Gemini) |
| **Prompt** | Clasifica si el texto del PDF es un certificado académico legítimo vs. spam/publicidad/contenido adulto |
| **Entrada** | Primeros 3000 caracteres del PDF |
| **Salida** | `{ valido: boolean, motivo: string }` |
| **Objetivo** | Filtrar PDFs no académicos antes de gastar recursos en extracción |
| **Fallback** | Fail-open: si la IA no responde, `{ valido: true }` |

#### B. Extracción de materias (texto)
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/ia/extraer-materias.ts` |
| **Función** | `extraerMateriasDeTexto(texto)` |
| **Modelo** | Cadena completa (OpenRouter → Gemini) |
| **Prompt** | `SISTEMA`: extrae materias organizadas por semestre con nombre, código, créditos, nota, semestre |
| **Entrada** | Primeros 12000 caracteres del PDF |
| **Salida** | `{ materias: [{ nombre, codigo, creditos, nota, semestre_origen }] }` |
| **Objetivo** | Extraer la lista de materias cursadas del certificado universitario |
| **Fallback** | Lanza `ErrorIANoDisponible` si todos los modelos fallan |

#### C. Extracción de materias (visión/OCR)
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/ia/extraer-materias.ts` |
| **Función** | `extraerMateriasPorVision(bytes, esSena?)` |
| **Modelo** | Visión (OpenRouter → Gemini), round-robin por página |
| **Prompt** | `SISTEMA_VISION` o `SISTEMA_VISION_SENA`: igual que texto pero desde imágenes |
| **Entrada** | Imágenes de páginas del PDF (data URLs, escala 1.5, máx 8 páginas) |
| **Salida** | Igual que extracción por texto |
| **Objetivo** | Leer certificados escaneados sin capa de texto |
| **Fallback** | Lanza `ErrorIANoDisponible` si todas las páginas fallan |

#### D. Extracción de pensum (texto y visión)
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/ia/extraer-pensum.ts` |
| **Funciones** | `extraerAsignaturasDePensum(texto)`, `extraerAsignaturasPorVision(bytes)` |
| **Modelo** | Cadena completa (texto) / Visión (OpenRouter → Gemini) |
| **Prompt** | Extrae asignaturas del plan de estudios organizadas por semestre |
| **Entrada** | Texto del PDF del pensum o imágenes de sus páginas |
| **Salida** | `{ asignaturas: [{ nombre, codigo, creditos, semestre }] }` |
| **Objetivo** | Alimentar la base de datos de pensums cuando un admin sube un plan de estudios |

#### E. Emparejamiento de materias
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/ia/homologar.ts` |
| **Función** | `emparejarMaterias(origen, destino, permitirMultiplesPorOrigen)` |
| **Modelo** | Cadena ligera (OpenRouter → Gemini) |
| **Prompt** | `SISTEMA`: experto en homologación colombiana, empareja por nombre, temática y contenido. Una materia de origen puede equivaler a varias de destino (si `permitirMultiplesPorOrigen`). Incluye justificación breve |
| **Entrada** | JSON con `materias_origen` (índices numéricos) y `asignaturas_destino` (índices numéricos) |
| **Salida** | `{ vinculos: [{ materia, asignatura, similitud, razon }] }` |
| **Objetivo** | Encontrar equivalencias entre materias de origen y asignaturas del pensum destino |
| **Post-procesamiento** | Filtra similitud < 55%, greedy por mayor similitud. Si `permitirMultiplesPorOrigen` (SENA), no restringe el lado origen |
| **Fallback** | Retorna array vacío si la IA no responde |

#### F. Estimación del semestre
| Campo | Valor |
|---|---|
| **Archivo** | `src/lib/homologacion/procesar.ts` |
| **Función** | `estimarSemestreConGemini(asignaturas, homologadas)` |
| **Modelo** | `gemini-2.5-flash-lite` (directo, sin cadena) |
| **Prompt** | Asesor académico: analiza el plan semestre a semestre, indicando qué se homologó y qué no. Estima el primer semestre que quedaría por cursar |
| **Entrada** | Texto con resumen por semestre: créditos totales, materias homologadas y no homologadas |
| **Salida** | `{ semestre: number, razon: string }` |
| **Objetivo** | Estimar el semestre de ingreso del estudiante |
| **Fallback** | `estimarSemestre()`: algoritmo que acumula créditos por semestre y encuentra el primer semestre no cubierto |

---

## 8. Embeddings

**No existen embeddings en el sistema.**

No se utiliza pgvector ni ningún otro motor de embeddings. La búsqueda de similitud entre materias se realiza exclusivamente mediante comparación semántica vía LLM (el modelo recibe los nombres completos de las materias de origen y destino y decide si son equivalentes). No hay vectorización de contenidos académicos, nombres de materias ni resultados de aprendizaje.

---

## 9. Búsqueda

La búsqueda de similitud entre materias se realiza de dos formas complementarias:

### 9.1 Búsqueda semántica vía IA (primaria)

El motor principal de emparejamiento es el LLM (`emparejarMaterias` en `homologar.ts`). El modelo recibe dos listas completas (materias origen + asignaturas destino) y para cada materia de origen determina cuál(es) asignatura(s) destino son equivalentes, asignando un porcentaje de similitud (0-100) y una justificación breve. Esta es una comparación **semántica**, no vectorial: el modelo razona sobre los nombres, contenidos y áreas temáticas.

### 9.2 Búsqueda textual en UI (secundaria)

En la interfaz de administración, los filtros de búsqueda usan consultas SQL con `ilike` vía PostgREST:

```sql
solicitante_nombre.ilike.%termino%,solicitante_correo.ilike.%termino%,institucion_origen_nombre.ilike.%termino%
```

No hay búsqueda vectorial, ni índices de texto completo (tsvector). Todo el matching de homologación depende exclusivamente del LLM.

---

## 10. Problemas conocidos

### 10.1 Dependencia excesiva de IA
- La extracción de materias de certificados universitarios depende completamente de OpenRouter/Gemini. Si ambos proveedores fallan simultáneamente, el pipeline no puede extraer materias y el caso queda en `procesando` o `en_revision` sin datos.
- El emparejamiento de materias también depende 100% de IA. Sin IA, no hay sugerencias de homologación.
- La estimación del semestre usa Gemini como primario (el algoritmo determinístico es solo fallback).

### 10.2 Problemas de tokens y truncamiento
- La extracción por texto trunca a 12000 caracteres. Un certificado muy extenso puede perder materias al final.
- La extracción por visión limita a 8 páginas. Certificados más largos no se procesan completamente.
- `openai/gpt-oss-120b` es el modelo principal, pero frecuentemente está saturado (rate-limit 429), forzando fallback a modelos menos capaces.
- Gemini frecuentemente reporta `RESOURCE_EXHAUSTED` por créditos agotados en el tier gratuito.

### 10.3 Historial de problemas con extracción SENA
- Inicialmente se intentó extraer con IA (JSON mode), pero **todos** los modelos fallaron con `json_validate_failed` porque el formato tabular del SENA es muy distinto al universitario.
- Se intentó sin JSON mode, pero las respuestas quedaban truncadas por exceder los tokens de salida (~19 competencias con RAs largos).
- Se intentó extracción página por página (9 llamadas IA), pero era lento y costoso en tokens/créditos.
- **Solución actual**: parser regex determinístico. Funciona bien pero es frágil: cualquier cambio en el formato del SENA rompería el parser.

### 10.4 Rendimiento
- El pipeline de homologación es **síncrono**: el estudiante espera a que terminen todas las llamadas a IA (validación + extracción + emparejamiento + estimación) antes de ver el resultado. Con fallbacks y reintentos, puede tomar 10-30 segundos.
- La extracción por visión es particularmente lenta: renderiza cada página, la envía a la IA, espera respuesta. 8 páginas × 2-5 segundos = 16-40 segundos solo en extracción.
- No hay procesamiento asíncrono (queues, workers, background jobs).

### 10.5 Escalabilidad
- El límite diario es 10 homologaciones por IP/usuario. Sin ese límite, los costos de IA se dispararían.
- Cada homologación consume 3-5 llamadas a IA (validación, extracción, emparejamiento, estimación). Con 100 estudiantes/día serían 300-500 llamadas.
- La cuota DIARIA de los modelos gratuitos de OpenRouter (~50 requests/día por cuenta sin créditos) y los créditos de Gemini limitan el throughput.
- No hay caché de resultados de IA. Si dos estudiantes suben certificados similares, se procesan independientemente.

### 10.6 Costos
- OpenRouter tiene modelos gratuitos con un límite DIARIO por cuenta (no por modelo): al agotarse, la cadena se corta de inmediato y se va a Gemini.
- Gemini tiene créditos prepago. Cuando se agotan, todas las llamadas a Gemini fallan con `RESOURCE_EXHAUSTED`.
- No hay medición ni control de costos por caso.

### 10.7 Duplicidad de lógica
- Hay dos clientes de IA (OpenRouter y Gemini) con patrones casi idénticos (cadena de modelos, reintentos 429, visión) pero implementados por separado.
- Las funciones de extracción (`extraer-materias.ts` y `extraer-pensum.ts`) comparten patrones (texto + visión, parseo JSON, deduplicación) pero están duplicadas.
- El parseo y saneado de JSON está repetido en múltiples lugares.

### 10.8 Sin embeddings ni búsqueda semántica real
- El emparejamiento envía TODAS las materias de origen y TODAS las de destino en cada llamada. Esto escala mal: si el pensum tiene 60 materias y el certificado 50, el prompt es enorme.
- No hay vectorización de materias para búsqueda rápida por similitud. Cada matching es O(n×m) vía LLM.
- No hay caché de emparejamientos previos. Dos certificados del mismo programa se emparejan desde cero.

### 10.9 Acoplamiento del pipeline
- El pipeline `procesarCaso` está acoplado al flujo síncrono de Server Actions. No se puede ejecutar en background sin refactorizar.
- La detección SENA depende del nombre de la institución en la BD (frágil, sensible a typos o variaciones).

---

## 11. Código relevante

### 11.1 `src/lib/ia/` — Motor de IA (OpenRouter)

| Archivo | Propósito |
|---|---|
| `../openrouter/cliente.ts` | Cliente de bajo nivel para OpenRouter. Funciones `llamarOpenRouter()` (texto) y `llamarOpenRouterVision()` (visión). Cadena de modelos con fallback, reintentos ante 429, corte inmediato ante cuota diaria agotada, `ErrorIANoDisponible`. |
| `validar.ts` | `validarDocumentoAcademico()`: clasifica si el PDF es un documento académico legítimo. |
| `extraer-materias.ts` | `extraerMateriasDeTexto()`, `extraerMateriasPorVision()`: extrae materias del certificado del estudiante. El prompt exige solo lo CURSADO: una fila sin calificación no se extrae. |
| `../extraccion/seguimiento-pensum-parser.ts` | Parser determinístico por coordenadas del reporte "SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE" (ver 6.3). |
| `../extraccion/notas.ts` | `filtrarHomologables()`: descarta lo no cursado y lo reprobado (ver 6.4). |
| `../extraccion/escala-nota.ts` | La escala 0.0-5.0 en un solo sitio: `notaANumero()`, `esNotaAprobada()`. Sin imports (lo usa también el estudio, que es cliente). |
| `extraer-pensum.ts` | `extraerAsignaturasDePensum()`, `extraerAsignaturasPorVision()`: extrae asignaturas del plan de estudios. |
| `homologar.ts` | `emparejarMaterias()`: compara materias origen con asignaturas destino y devuelve vínculos con similitud. |

### 11.2 `src/lib/gemini/` — Motor de IA (Gemini)

| Archivo | Propósito |
|---|---|
| `cliente.ts` | Cliente de bajo nivel para Google Gemini. Funciones `llamarGemini()` (texto) y `llamarGeminiVision()` (visión). Mismo patrón de resiliencia que OpenRouter. |

### 11.3 `src/lib/homologacion/` — Pipeline de homologación

| Archivo | Propósito |
|---|---|
| `procesar.ts` | `procesarCaso()`: orquestador principal. Extrae materias, empareja, estima semestre, guarda resultados. `estimarSemestre()`: algoritmo determinístico de créditos. `estimarSemestreConGemini()`: estimación con IA. |
| `correo.ts` | `notificarVeredicto()`, `notificarRecepcion()`: envío de correos electrónicos (desarrollo: Mailpit, producción: Resend). |

### 11.4 `src/lib/supabase/` — Clientes de Supabase

| Archivo | Propósito |
|---|---|
| `servidor.ts` | Cliente con publishable key + cookies de sesión. Para Server Components y Server Actions. |
| `servicio.ts` | Cliente con secret key (bypass RLS). Para operaciones del sistema. |
| `navegador.ts` | Cliente para el navegador. |
| `middleware.ts` | Middleware de Next.js para refrescar sesión en cada request. |

### 11.5 `src/lib/pdf/` — Manejo de PDFs

| Archivo | Propósito |
|---|---|
| `extraer.ts` | `extraerTextoPdf()`: texto plano. `extraerPaginasPdf()`: texto sin unir páginas (SenaParser). `extraerRenglonesPdf()`: renglones con coordenadas, para leer TABLAS. |

### 11.6 `src/lib/acta/` — Generación de actas

| Archivo | Propósito |
|---|---|
| `documento.tsx` | Componente React para `@react-pdf/renderer`. Layout del acta de homologación. |
| `datos.ts` | `cargarHomologacionesAprobadas()`, `responderActa()`: carga datos y renderiza el PDF del acta con QR. |

### 11.7 `src/lib/marca/` — White-label / Branding

| Archivo | Propósito |
|---|---|
| `configuracion.ts` | Lee la configuración de marca desde BD. Genera variables CSS. Utilidades de color. |
| `fondos.ts` | Catálogo de fondos para el login (7 degradados). |
| `temas-oscuros.ts` | Catálogo de paletas para modo oscuro (5 temas). |
| `notif.ts` | Catálogo de posiciones para notificaciones (6 posiciones). |

### 11.8 `src/lib/seguridad/` — Seguridad

| Archivo | Propósito |
|---|---|
| `turnstile.ts` | `verificarTurnstile()`: verifica el token de Cloudflare Turnstile contra la API. |

### 11.9 `src/lib/auth/` — Autenticación

| Archivo | Propósito |
|---|---|
| `acciones.ts` | `cerrarSesion()`: server action para logout. |

### 11.10 `src/app/(app)/` — Rutas autenticadas (con sidebar)

| Ruta | Propósito |
|---|---|
| `/inicio` | Dashboard del admin |
| `/homologar` | Formulario público de solicitud de homologación |
| `/mis-homologaciones` | Lista de homologaciones del estudiante |
| `/casos` | Bandeja de casos del admin |
| `/casos/[id]` | Estudio detallado de un caso (interfaz de dos columnas) |
| `/carreras` | Gestión de pensums (subir PDF, ver/eliminar) |
| `/reportes` | Dashboard con gráficas (Recharts) |
| `/usuarios` | Gestión de usuarios admin |
| `/configuracion` | White-label: nombre, logo, colores, fuentes |

### 11.11 `src/app/seguimiento/[token]/` — Seguimiento público

Ruta sin autenticación. El estudiante accede con su `token_seguimiento` (recibido por correo). Puede ver el estado de su caso y descargar el acta si fue aprobado.

### 11.12 `src/types/index.ts`

Definiciones de tipos TypeScript para todas las entidades del dominio: `Perfil`, `Caso`, `Pensum`, `Asignatura`, `MateriaOrigen`, `Vinculo`, `DocumentoCaso`, `Notificacion`, `Configuracion`.

### 11.13 `src/data/instituciones-origen.ts`

Catálogo de ~66 instituciones de educación superior colombianas para el autocomplete del formulario.

---

## 12. Estado actual

### 12.1 Funcionalidades terminadas

- [x] Formulario público de solicitud de homologación con captcha
- [x] Sesión anónima para estudiantes (sin registro)
- [x] Validación de PDF académico con IA (anti-spam)
- [x] Extracción de materias de certificados universitarios (texto y visión/OCR)
- [x] Extracción de competencias del SENA (parser regex determinístico)
- [x] Extracción del reporte "SEGUIMIENTO PENSUM GENERAL POR ESTUDIANTE" (parser por coordenadas, solo lo cursado y ganado)
- [x] Extracción de asignaturas de pensums (texto y visión)
- [x] Emparejamiento IA entre materias origen y asignaturas destino
- [x] Estimación del semestre (IA + algoritmo determinístico)
- [x] Interfaz de administración para revisión de casos (dos columnas)
- [x] Confirmación/rechazo de vínculos individuales y en lote
- [x] Creación manual de vínculos
- [x] Reprocesamiento del pipeline
- [x] Generación de acta PDF con QR de verificación
- [x] Seguimiento público del caso vía token
- [x] Notificaciones al admin (campana)
- [x] Correos de recepción y veredicto (Mailpit dev / Resend prod)
- [x] White-label completo (nombre, logo, colores, temas, fondos, fuentes)
- [x] Rate limiting diario (10 solicitudes por IP/usuario)
- [x] Dashboard de reportes con gráficas
- [x] Exportación de casos a CSV
- [x] Subida de documentos adicionales (syllabi)
- [x] Notas internas (solo admin) y públicas (visibles al estudiante)
- [x] Plantillas de notas reutilizables
- [x] Doble proveedor IA con fallback (OpenRouter → Gemini)
- [x] Resiliencia ante rate-limits y fallos de modelos

### 12.2 Funcionalidades parcialmente implementadas

- [~] Detección SENA: depende del nombre exacto de la institución en la BD. Si el estudiante escribe "Sena" en minúscula o con variaciones, podría no detectarse (actualmente usa regex `/sena/i`).
- [~] Visión para SENA escaneado: el prompt de visión SENA existe pero no se ha probado exhaustivamente.
- [~] API routes en `/api/pensums` y `/api/homologaciones`: stubs vacíos, retornan 405.

### 12.3 Funcionalidades pendientes

- [ ] Procesamiento asíncrono del pipeline (queues/background jobs)
- [ ] Caché de resultados de IA (evitar re-procesar certificados idénticos)
- [ ] Búsqueda vectorial / embeddings para matching de materias
- [ ] Sistema de medición y control de costos de IA por caso
- [ ] Parser SENA robusto ante cambios de formato
- [~] Extracción de materias sin IA para certificados universitarios: hecho para el reporte de seguimiento de pensum (6.3); los demás formatos siguen con IA
- [ ] Soporte para múltiples páginas de certificado en visión (más de 8)
- [ ] Notificaciones en tiempo real para el estudiante (sin recargar)
- [ ] Firma digital en actas
- [ ] Integración con SNIES (catálogo oficial de IES colombianas)
- [ ] Tests automatizados

---

## 13. Fase 7 — Motor de decisión en cascada (implementado)

El emparejamiento dejó de ser un mega-prompt (todas las materias × todas las asignaturas) y pasó a
una CASCADA de costo creciente en `src/lib/homologacion/motor.ts` (`decidirVinculos`):

| Nivel | Mecanismo | Costo |
|---|---|---|
| 0 | **Caché de decisiones** (`decision_matching`): la decisión "¿qué cubre esta unidad en este pensum?" se reutiliza entre estudiantes (clave: hash de la unidad × pensum). Incluye decisiones negativas. | 0 tokens |
| 0.5 | **Patrones aprendidos** (`patron_homologacion`): pares (nombre normalizado → asignatura) que los asesores han confirmado 3+ veces. Generaliza donde el Nivel 0 falla. Ver 13.2. | 0 tokens |
| 1 | **Regla de nombre**: igualdad de nombre normalizado (tildes, mayúsculas, romanos finales) → vínculo 98%. | 0 tokens |
| 2 | **Vectores**: Top-10 candidatas por coseno pgvector (`buscar_asignaturas_similares`). | 0 tokens |
| 3 | **LLM por unidad** (`emparejarUnidad`): juzga UNA unidad contra sus pocas candidatas, con los RAs como evidencia. Su resultado se cachea. | la única llamada con costo |

Complementos:
- **Dedup por documento** (`caso.hash_documento`): un PDF ya procesado reutiliza unidades y
  embeddings del caso anterior (0 tokens de extracción). `procesar.ts → buscarExtraccionPrevia`.
- **Quality Gate** (`extraccion/calidad.ts`): valida que el texto extraído sea usable (proporción de
  letras, caracteres corruptos, separación de palabras) antes de parsear; si no, ruta a OCR.
- **SenaParser v2** (`extraccion/sena-parser.ts`): parsing ESTRUCTURAL por marcadores (limpia
  encabezados de página y firma; nombre = cola en caso mixto o última oración del segmento previo).
  El regex anterior desalineaba los bloques 2+ (nombres basura) y perdía competencias: con la
  constancia ADSI real pasa de 10 competencias (9 con nombre corrupto) a 19 competencias / 72 RAs /
  0 sin nombre.
- Resolución global por caso (greedy por similitud): cada asignatura destino se homologa a lo sumo
  una vez; una competencia SENA puede cubrir varias asignaturas.
- Fallback sin embeddings: el motor cae al emparejamiento legacy (una llamada contra todo el pensum).

Con el caché, el costo por programa repetido tiende a CERO: el primer estudiante de un programa paga
las llamadas; los siguientes reutilizan extracción (hash) y decisiones (caché).

### 13.1 Loop de aprendizaje (cierre de la Fase 7)

Las decisiones del ASESOR alimentan el caché: `vincular`, `desvincular` y `confirmarSugerencias`
llaman a `actualizarDecisionAdmin(materiaOrigenId)` (`motor.ts`), que upserta en `decision_matching`
el estado APROBADO actual de esa unidad contra el pensum del caso, con `fuente: 'admin'`.

- El siguiente estudiante del mismo programa recibe la decisión HUMANA en el Nivel 0 (0 tokens).
- Una decisión `admin` nunca es sobrescrita por la IA (`guardarDecision` la respeta).
- También se cachea el "no homologa nada" del asesor (decisión negativa).
- La corrección se hace UNA vez y aplica para siempre: el costo y el error del sistema DECRECEN con
  el uso.

**Límite de este mecanismo**: `decision_matching` acierta solo con texto IDÉNTICO (su clave es el
sha256 del `texto_embedding`: nombre + descripción + TODOS los resultados de aprendizaje). Basta un
RA redactado distinto para que el hash cambie y la decisión del asesor no se reutilice. En la
práctica cubre el mismo documento, no el mismo conocimiento. Eso lo resuelve 13.2.

### 13.2 Aprendizaje por patrones (Nivel 0.5)

Tabla `patron_homologacion` (migración `0032`) + `src/lib/homologacion/patrones.ts`. Aprende un
nivel por encima del caché exacto: la clave es el **nombre normalizado** de la unidad de origen ×
pensum × asignatura destino, con dos contadores.

| Acción del asesor | Efecto |
|---|---|
| `vincular` / `confirmarSugerencias` | `registrarPatronesAdmin` → +1 confirmación al par |
| `desvincular` | `registrarRechazoPatron` (ANTES del delete, si no la fila ya no existe) → +1 rechazo |

El motor aplica un patrón solo si acumula **≥ 3 confirmaciones** y estas **superan a los rechazos**.
La similitud propuesta es el promedio corrido de las aprobaciones, y la razón que ve el asesor dice
cuántas veces se confirmó.

- **Por qué contadores y no un booleano**: el asesor se corrige. Un par confirmado 2 veces y
  rechazado 5 no debe aplicarse nunca.
- **Por qué se aprende también del rechazo**: sin la mitad negativa, un par que la IA propone
  siempre y el asesor descarta siempre jamás acumularía evidencia en contra.
- **Atomicidad**: el contador se suma en una función SQL (`registrar_patron_homologacion`), no con
  read-modify-write desde la app: dos asesores revisando a la vez se pisarían los contadores.
- **Generalización**: `normalizarNombre` colapsa tildes, mayúsculas y romanos finales, así que
  "Matemáticas Aplicadas II", "MATEMATICAS APLICADAS 2" y "matematicas aplicadas ii" alimentan el
  MISMO patrón.

Va antes de la regla de nombre (Nivel 1) a propósito: una decisión humana repetida vale más que una
coincidencia textual.
