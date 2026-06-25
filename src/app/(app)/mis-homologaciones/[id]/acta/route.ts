import { NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { responderActa, SELECCION_CASO_ACTA, type CasoActa } from "@/lib/acta/datos";

// Acta de homologación del lado del ESTUDIANTE (sesión propia). La RLS "Ver mis casos" garantiza que
// solo pueda descargar el acta de su propio caso (si pone otro id, no encuentra nada -> 404).
export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("caso")
    .select(SELECCION_CASO_ACTA)
    .eq("id", params.id)
    .single();
  if (!data) return new Response("Caso no encontrado.", { status: 404 });
  return responderActa(supabase, data as unknown as CasoActa);
}
