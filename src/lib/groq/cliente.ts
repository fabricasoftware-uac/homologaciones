// Inicialización del cliente de Groq.
//
// Aquí configuramos la conexión con Groq leyendo la GROQ_API_KEY desde las
// variables de entorno. Este archivo SOLO debe importarse desde código de
// servidor (route handlers), nunca desde un componente del navegador, para que
// la API key no quede expuesta.
