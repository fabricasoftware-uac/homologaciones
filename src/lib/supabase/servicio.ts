import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase con la SECRET KEY: acceso total saltándose la RLS. SOLO servidor (jamás el
// navegador). Es el cliente "del sistema": lo usa el pipeline de homologación para escribir lo que
// el invitado NO puede tocar —materia_origen y vínculos— y para actualizar el estado del caso.
//
// No persiste sesión ni refresca tokens: no actúa en nombre de ningún usuario, sino del sistema.
export function crearClienteServicio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
