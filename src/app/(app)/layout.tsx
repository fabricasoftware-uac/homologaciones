import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { Sidebar } from "@/components/sidebar";
import type { Perfil } from "@/types";

// Marco visual de la parte privada de la app. Aquí leemos el perfil del usuario logueado una
// sola vez y se lo pasamos al sidebar; las páginas hijas no tienen que volver a pedirlo.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya bloquea el acceso sin sesión; este chequeo es defensa en profundidad
  // (y además le confirma a TypeScript que de aquí en adelante hay usuario).
  if (!user) {
    redirect("/ingresar");
  }

  const { data } = await supabase
    .from("perfil")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  // Si el perfil aún no existiera (no debería, lo crea el trigger al registrarse), mostramos
  // algo neutro en lugar de romper el layout.
  const perfil: Perfil = (data as Perfil | null) ?? { nombre: "Usuario", rol: "estudiante" };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar perfil={perfil} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 md:hidden">
          <span className="font-bold text-slate-900">TransfoEdu</span>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
