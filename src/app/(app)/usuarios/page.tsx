import { IconUsers as Users } from "@tabler/icons-react";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoPagina } from "@/components/encabezado";
import type { Rol } from "@/types";
import { EditorUsuario } from "./editor-usuario";
import { FormularioUsuario } from "./formulario";
import { SelectorRol } from "./selector-rol";

// Gestión del staff del panel (solo admin; lo protege el middleware): administradores, asesores
// (revisan los casos que se les asignen) y verificadores (gestionan la inscripción de aprobados).
// Usa el cliente de SERVICIO porque la lista de perfiles ajenos y los correos (en auth.users) no son
// visibles con la RLS normal.

type StaffFila = { id: string; nombre: string; email: string; rol: Rol };

const SECCIONES: { rol: Rol; titulo: string; badge: string }[] = [
  { rol: "admin", titulo: "Administradores", badge: "Admin" },
  { rol: "asesor", titulo: "Asesores", badge: "Asesor" },
  { rol: "verificador", titulo: "Verificadores", badge: "Verificador" },
];

const BADGE_ROL: Record<string, string> = {
  admin: "text-marca bg-marca/10 border-marca/20",
  asesor: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30",
  verificador:
    "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
};

export default async function PaginaUsuarios() {
  const servicio = crearClienteServicio();
  const sesion = crearClienteServidor();

  const [{ data: perfiles }, listado, medata] = await Promise.all([
    servicio
      .from("perfil")
      .select("id, nombre, rol")
      .in("rol", ["admin", "asesor", "verificador"])
      .order("nombre"),
    servicio.auth.admin.listUsers(),
    sesion.auth.getUser(),
  ]);

  const miId = medata.data.user?.id ?? null;
  const correoPorId = new Map((listado.data?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const staff: StaffFila[] = (
    (perfiles as { id: string; nombre: string; rol: Rol }[] | null) ?? []
  ).map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, email: correoPorId.get(p.id) ?? "—" }));

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Administra el equipo del panel: administradores, asesores y verificadores."
        icono={Users}
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-7">
          {/* Crear miembro del staff */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              Nuevo usuario del panel
            </h2>
            <FormularioUsuario />
          </section>

          {SECCIONES.map(({ rol, titulo, badge }, i) => {
            const filas = staff.filter((s) => s.rol === rol);
            return (
              <section
                key={rol}
                className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
                style={{ animationDelay: `${80 + i * 60}ms` }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  {titulo} ({filas.length})
                </h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {filas.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-full bg-marca text-marca-fg flex items-center justify-center font-bold shrink-0">
                        {s.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {s.nombre}
                          {s.id === miId && (
                            <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-500">(tú)</span>
                          )}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{s.email}</p>
                      </div>
                      <span
                        className={`inline-flex items-center text-xs font-semibold border px-2.5 py-1 rounded-full shrink-0 ${BADGE_ROL[s.rol]}`}
                      >
                        {badge}
                      </span>
                      <SelectorRol usuarioId={s.id} rol={s.rol} deshabilitado={s.id === miId} />
                      <EditorUsuario
                        usuarioId={s.id}
                        nombre={s.nombre}
                        email={s.email}
                        esYo={s.id === miId}
                      />
                    </div>
                  ))}
                  {filas.length === 0 && (
                    <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Nadie tiene este rol todavía.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
