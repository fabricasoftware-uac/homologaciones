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

// Espejo del enum rol_usuario (migración 0001 + roles de la 0028: asesor revisa los casos que el
// admin le asigna; verificador gestiona la inscripción de los casos aprobados).
export type Rol = "estudiante" | "admin" | "asesor" | "verificador";

// El usuario tal como lo muestra la app: su nombre y su rol. Vive en la tabla `perfil`,
// enlazada 1:1 con auth.users.
//
// `esAnonimo` NO vive en `perfil`: sale de auth.users.is_anonymous y lo resuelve el layout. Hace
// falta porque el rol no alcanza para saber si alguien puede cerrar sesión: un "estudiante" puede
// ser un INVITADO anónimo (sesión desechable, sin credenciales que recuperar) o una CUENTA
// REGISTRADA de verdad. Sin este dato, la UI trataba a ambos igual y dejaba a los registrados
// encerrados, sin ninguna forma de salir.
export type Perfil = {
  nombre: string;
  rol: Rol;
  esAnonimo: boolean;
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
  resolucion_men?: string | null;
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
  // Programa cursado en la IES origen (migración 0035).
  programa_origen_nombre?: string | null;
  // Datos de contacto e identificación legal del solicitante (migración 0009 y 0035).
  solicitante_nombre: string | null;
  solicitante_cedula?: string | null;
  solicitante_lugar_exp?: string | null;
  solicitante_celular: string | null;
  solicitante_correo: string | null;
  archivo_pdf: string | null;
  estado: EstadoCaso;
  semestre_sugerido: number | null;
  // Datos de la Resolución oficial (migración 0035).
  numero_resolucion?: string | null;
  periodo_matricula?: string | null;
  fecha_limite_pago?: string | null;
  folios_solicitud?: number | null;
  folios_certificado?: number | null;
  folios_contenidos?: number | null;
  creado_por_id?: string | null;
  // Nota que el admin le deja al estudiante (viaja en el veredicto y el acta).
  nota_admin: string | null;
  // Nota de uso interno del admin: NO viaja al estudiante ni al acta (migración 0016).
  nota_interna: string | null;
  // Token para que el invitado vuelva a su caso sin sesión (migración 0016).
  token_seguimiento: string;
  // Auditoría del veredicto: cuándo y qué admin cerró el caso (migración 0016).
  decidido_en: string | null;
  decidido_por: string | null;
  // Constancia de autorización de tratamiento de datos — Habeas Data (migración 0016).
  autorizo_datos: boolean;
  autorizo_en: string | null;
  creado_en: string;
};

// Cursos que el aspirante debe matricular en el primer período (Art. 3° Resolución, migración 0035).
export type CursoMatricula = {
  id: string;
  caso_id: string;
  asignatura_id: string;
  orden: number;
  creado_en: string;
};

// Un documento adicional que el estudiante adjunta al caso (p. ej. contenidos programáticos /
// syllabi), además del certificado de notas. Vive en el bucket privado `certificados` (migración 0018).
export type DocumentoCaso = {
  id: string;
  caso_id: string;
  tipo: string;
  ruta: string;
  nombre_archivo: string;
  creado_en: string;
};

// Una materia extraída del PDF de la universidad de origen del estudiante.
// La migración 0022 la generaliza como "unidad académica": puede ser una materia
// universitaria tradicional (tipo = 'materia'), una competencia del SENA (tipo =
// 'competencia') o cualquier otra estructura que surja en el futuro.
export type MateriaOrigen = {
  id: string;
  caso_id: string;
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  nota: string | null;
  semestre_origen: number | null;
  tipo: string;
  metadatos: Record<string, unknown> | null;
  intensidad_horaria: number | null;
};

// El emparejamiento materia_origen -> asignatura destino que propone la IA, con su % y estado.
export type Vinculo = {
  id: string;
  caso_id: string;
  materia_origen_id: string;
  asignatura_id: string;
  similitud: number;
  // Justificación corta que dio la IA al emparejar (migración 0017). Null en vínculos hechos a mano.
  razon: string | null;
  estado: EstadoVinculo;
  creado_en: string;
};
