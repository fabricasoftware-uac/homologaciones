import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para el lado del NAVEGADOR (componentes "use client").
//
// Lo usan las pantallas que leen o escriben datos directamente desde el navegador:
// listar "mis homologaciones", arrastrar el PDF para subirlo, etc. Trabaja con la
// publishable key, que es segura de exponer porque las reglas RLS de la base de datos
// limitan qué fila puede ver o tocar cada usuario.
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
