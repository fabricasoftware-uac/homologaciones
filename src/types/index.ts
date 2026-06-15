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
