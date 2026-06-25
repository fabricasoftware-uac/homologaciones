import { IconUsers as Users, IconShieldCheck as ShieldCheck } from "@tabler/icons-react";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { EncabezadoPagina } from "@/components/encabezado";
import { FormularioUsuario } from "./formulario";

// Gestión de administradores (solo admin; lo protege el middleware). Lista los admins actuales y
// permite crear nuevos. Usa el cliente de SERVICIO porque la lista de perfiles ajenos y los correos
// (en auth.users) no son visibles con la RLS normal.

type AdminFila = { id: string; nombre: string; email: string };

export default async function PaginaUsuarios() {
  const servicio = crearClienteServicio();

  const [{ data: perfiles }, listado] = await Promise.all([
    servicio.from("perfil").select("id, nombre").eq("rol", "admin"),
    servicio.auth.admin.listUsers(),
  ]);

  const correoPorId = new Map((listado.data?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const admins: AdminFila[] = ((perfiles as { id: string; nombre: string }[] | null) ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: correoPorId.get(p.id) ?? "—",
  }));

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Administra quién puede ingresar al panel y crea nuevos administradores."
        icono={Users}
      />

      <main className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-7">
          {/* Crear administrador */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              Nuevo administrador
            </h2>
            <FormularioUsuario />
          </section>

          {/* Administradores actuales */}
          <section className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500" style={{ animationDelay: "80ms" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Administradores ({admins.length})
            </h3>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-marca text-marca-fg flex items-center justify-center font-bold shrink-0">
                    {a.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{a.nombre}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{a.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-marca bg-marca/10 border border-marca/20 px-2.5 py-1 rounded-full shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </span>
                </div>
              ))}
              {admins.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No hay administradores.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
