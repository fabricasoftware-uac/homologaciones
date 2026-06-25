// Estado de carga del área de la app. Next lo muestra mientras renderiza en el servidor la página
// destino. Es sutil y con el color de marca: un cuadro que late con un anillo girando dentro.
export default function CargandoApp() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <span className="absolute w-16 h-16 rounded-2xl bg-marca/10 animate-ping" />
        <span className="relative w-11 h-11 rounded-xl bg-marca/10 border border-marca/20 flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-marca/25 border-t-marca animate-spin" />
        </span>
      </div>
    </div>
  );
}
