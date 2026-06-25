"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";

// Elimina un caso por completo. Corre con la sesión del admin (la RLS "Solo admin borra casos" es la
// que autoriza). Al borrar el caso, la base elimina en cascada sus materias de origen y vínculos.
// El certificado en Storage NO está cubierto por esa cascada, así que lo limpiamos aparte con el
// cliente de servicio (las policies del bucket son por carpeta del dueño, no del admin).
export async function eliminarCaso(formData: FormData) {
  const casoId = String(formData.get("casoId") ?? "");
  if (!casoId) return;

  const supabase = crearClienteServidor();

  // Leemos la ruta del PDF antes de borrar el caso.
  const { data: caso } = await supabase
    .from("caso")
    .select("archivo_pdf")
    .eq("id", casoId)
    .single();

  const { error } = await supabase.from("caso").delete().eq("id", casoId);
  if (error) return; // si la RLS o algo lo impide, no seguimos

  const ruta = (caso as { archivo_pdf: string | null } | null)?.archivo_pdf;
  if (ruta) {
    await crearClienteServicio().storage.from("certificados").remove([ruta]);
  }

  revalidatePath("/casos");
}
