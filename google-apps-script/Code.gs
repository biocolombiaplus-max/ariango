/**
 * Ariango Consultores — Receptor de solicitudes de la página web.
 *
 * Guarda cada solicitud como una fila en Google Sheets (base de datos de
 * clientes potenciales) y envía un correo de aviso a gerencia.
 *
 * Instalación (5 minutos):
 * 1. Cree una hoja de cálculo nueva en Google Sheets (ej. "Leads Ariango").
 * 2. Menú Extensiones > Apps Script. Borre el contenido y pegue este archivo.
 * 3. Guarde. Botón "Implementar" > "Nueva implementación" > tipo "Aplicación web".
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Autorice los permisos y copie la URL que termina en /exec.
 * 5. Pegue esa URL en assets/js/config.js, en "googleSheetsEndpoint".
 */

var SHEET_NAME = 'Solicitudes';
var NOTIFY_EMAIL = 'gerencia@ariangoconsultores.com';
var SEND_EMAIL = true; // Ponga false si ya recibe el aviso por FormSubmit

var COLUMNS = [
  'fecha', 'nombre', 'telefono', 'email', 'ciudad', 'servicio', 'mensaje',
  'formulario', 'consentimiento', 'pagina',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'referrer', 'estado'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = (e && e.parameter) || {};
    if (p._honey) return json({ ok: true }); // bot

    var sheet = getSheet();
    var row = COLUMNS.map(function (c) {
      if (c === 'estado') return 'Nuevo';
      var v = (p[c] || '').toString().slice(0, 2000);
      // Evita inyección de fórmulas en la hoja
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });
    sheet.appendRow(row);

    if (SEND_EMAIL) {
      var wa = (p.telefono || '').replace(/\D/g, '');
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'Nueva solicitud web: ' + (p.servicio || '') + ' — ' + (p.nombre || ''),
        htmlBody:
          '<h2 style="font-family:Georgia,serif;color:#0A1A30">Nueva solicitud desde la página web</h2>' +
          '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">' +
          tr('Nombre', p.nombre) + tr('Teléfono', p.telefono) + tr('Correo', p.email) +
          tr('Ciudad', p.ciudad) + tr('Servicio', p.servicio) + tr('Mensaje', p.mensaje) +
          tr('Formulario', p.formulario) + tr('Fuente', [p.utm_source, p.utm_medium, p.utm_campaign].filter(String).join(' / ') || 'directo') +
          tr('Fecha', p.fecha) + '</table>' +
          (wa ? '<p><a href="https://wa.me/' + wa + '" style="background:#1FAF54;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Responder por WhatsApp</a></p>' : '')
      });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'Ariango leads' });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS.map(function (c) { return c.toUpperCase(); }));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold').setBackground('#0A1A30').setFontColor('#EBCB97');
  }
  return sheet;
}

function tr(k, v) {
  var safe = String(v || '—').replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; });
  return '<tr><td style="color:#9C6A2E"><b>' + k + '</b></td><td>' + safe + '</td></tr>';
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
