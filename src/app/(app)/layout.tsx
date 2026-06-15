import { Sidebar } from "@/components/sidebar";

// Marco visual de la parte privada de la app: barra lateral de navegación + área de contenido.
// Todo lo que cuelga del grupo (app) asume un usuario con sesión iniciada. La protección real
// —mandar a /ingresar a quien no tenga sesión, y separar lo que ve el estudiante del admin—
// la conecta el middleware en el bloque siguiente; acá solo armamos el layout.
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 md:hidden">
          <span className="font-bold text-slate-900">TransfoEdu</span>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
