/* ==========================================================================
   CONFIGURACIÓN DEL SITIO — Ariango Consultores
   Edite solo este archivo para cambiar datos de contacto e integraciones.
   ========================================================================== */
window.ARIANGO_CONFIG = {
  // WhatsApp en formato internacional, sin "+" ni espacios (57 = Colombia)
  whatsapp: "573156002993",
  whatsappVisible: "+57 315 600 2993",
  email: "gerencia@ariangoconsultores.com",

  // 1) Base de datos de clientes potenciales en Google Sheets.
  //    Pegue aquí la URL de la "Aplicación web" de Google Apps Script
  //    (vea google-apps-script/Code.gs y el README). Si se deja vacío, se omite.
  googleSheetsEndpoint: "",

  // 2) Notificación por correo de cada solicitud vía FormSubmit (gratis).
  //    La primera solicitud enviará un correo de activación a la dirección
  //    indicada; hay que confirmarlo una sola vez. Poner false para desactivar.
  formSubmitEnabled: true,

  // 3) Analítica opcional (dejar vacío si no se usa)
  ga4Id: "",        // ej. "G-XXXXXXXXXX"
  metaPixelId: ""   // ej. "123456789012345"
};
