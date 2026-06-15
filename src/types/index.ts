// Tipos compartidos del dominio de homologaciones.
//
// Hoy cada página define sus propias interfaces por separado (Subject en
// /casos/[id], Case en /casos, ExtractedSubject en /carreras) y eso termina
// divergiendo. Aquí vamos a centralizar los tipos del dominio para que todo el
// proyecto hable el mismo idioma:
//
//   - Asignatura: una materia (nombre, código, créditos, intensidad, nota...).
//   - Pensum: el plan académico de una carrera (lista de asignaturas por semestre).
//   - Caso: una solicitud de homologación de un estudiante (origen -> destino).
//   - Vinculo: la relación origen<->destino que sugiere la IA, con su % y estado
//              (pendiente / aprobado / rechazado).
//
// Estos tipos también deberían reflejar las tablas que creemos en Supabase.

// Espejo del enum rol_usuario de la migración 0001.
export type Rol = "estudiante" | "admin";

// El usuario tal como lo muestra la app: su nombre y su rol. Vive en la tabla `perfil`,
// enlazada 1:1 con auth.users.
export type Perfil = {
  nombre: string;
  rol: Rol;
};

// --- Dominio de homologaciones (espejo de las tablas de la migración 0002) ---

export type EstadoCaso = "procesando" | "en_revision" | "aprobado" | "rechazado";
export type EstadoVinculo = "pendiente" | "aprobado" | "rechazado";

// Plan académico de una carrera de la Autónoma del Cauca (la universidad destino).
export type Pensum = {
  id: string;
  carrera: string;
  version: string;
  activo: boolean;
  creado_en: string;
};

// Una materia de un pensum destino.
export type Asignatura = {
  id: string;
  pensum_id: string;
  codigo: string | null;
  nombre: string;
  creditos: number;
  semestre: number;
};

// La solicitud de homologación de un estudiante. semestre_sugerido es el veredicto de la IA.
export type Caso = {
  id: string;
  estudiante_id: string;
  pensum_destino_id: string;
  institucion_origen_nombre: string;
  archivo_pdf: string | null;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  creado_en: string;
};

// Una materia extraída del PDF de la universidad de origen del estudiante.
export type MateriaOrigen = {
  id: string;
  caso_id: string;
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  nota: string | null;
  semestre_origen: number | null;
};

// El emparejamiento materia_origen -> asignatura destino que propone la IA, con su % y estado.
export type Vinculo = {
  id: string;
  caso_id: string;
  materia_origen_id: string;
  asignatura_id: string;
  similitud: number;
  estado: EstadoVinculo;
  creado_en: string;
};
