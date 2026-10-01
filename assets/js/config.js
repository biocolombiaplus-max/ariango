/* ==========================================================================
   CONFIGURACIÓN BASE — Ariango Consultores
   Estos valores se pueden cambiar sin tocar código desde el panel
   administrativo (/admin → Ajustes). Lo que se guarde allí tiene prioridad.
   ========================================================================== */
window.ARIANGO_CONFIG = {
  whatsapp: "573156002993",            // formato internacional, sin "+"
  whatsappVisible: "+57 315 600 2993",
  phone: "+573156002993",              // para el botón "Llamar"
  email: "gerencia@ariangoconsultores.com",
  address: "Cúcuta, Norte de Santander",
  hours: "Presencial con cita previa y virtual",
  mapQuery: "",                        // dirección exacta para el mapa (vacío = Cúcuta)
  waIntro: "Hola, Ariango Consultores 👋",

  // Base de datos en Google Sheets (URL /exec de Apps Script). Vacío = desactivado.
  googleSheetsEndpoint: "",
  // Aviso por correo con FormSubmit (requiere activar una vez desde el correo).
  formSubmitEnabled: true,

  // Analítica opcional
  ga4Id: "",        // ej. "G-XXXXXXXXXX"
  metaPixelId: ""   // ej. "123456789012345"
};
