import { NextRequest } from "next/server";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { responderActa, SELECCION_CASO_ACTA, type CasoActa } from "@/lib/acta/datos";

// Acta de homologación del lado del ESTUDIANTE QUE PERDIÓ LA SESIÓN: se identifica por el token de
// seguimiento que llegó en el correo, sin iniciar sesión. Por eso usa el cliente de SERVICIO (lee el
// caso por token saltándose la RLS). Solo expone el acta de casos aprobados (lo valida responderActa).
export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = crearClienteServicio();
  const { data } = await supabase
    .from("caso")
    .select(SELECCION_CASO_ACTA)
    .eq("token_seguimiento", params.token)
    .single();
  if (!data) return new Response("Caso no encontrado.", { status: 404 });
  return responderActa(supabase, data as unknown as CasoActa);
}
