import { NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { responderActa, SELECCION_CASO_ACTA, type CasoActa } from "@/lib/acta/datos";

// Acta de homologación del lado del ADMIN. La ruta cuelga de /casos, así que el middleware ya la
// restringe a admin. Lee el caso con la sesión (RLS de admin) y genera el PDF.
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("caso")
    .select(SELECCION_CASO_ACTA)
    .eq("id", params.id)
    .single();
  if (!data) return new Response("Caso no encontrado.", { status: 404 });
  const formato = request.nextUrl.searchParams.get("formato") === "docx" ? "docx" : "pdf";
  return responderActa(supabase, data as unknown as CasoActa, formato);
}
