# Ariango Consultores — Landing page

Sitio web de una sola página para **Ariango Consultores** (Cúcuta, Colombia), un bufete especializado en:

1. **Nulidad de Registro Civil de Nacimiento (Colombia)** y **Nulidad de Partida de Nacimiento (Venezuela)** en casos de doble registro.
2. **Sucesiones y herencias** (notariales, judiciales y binacionales).

Es un sitio estático (HTML + CSS + JS, sin dependencias). Se puede alojar en cualquier hosting: cPanel, Netlify, Vercel, GitHub Pages, Hostinger, etc.

## Estructura

```
index.html                    Landing principal
politica-de-privacidad.html   Política de Tratamiento de Datos (Ley 1581 de 2012)
assets/css/styles.css         Estilos
assets/js/config.js           ← DATOS DE CONTACTO E INTEGRACIONES (editar aquí)
assets/js/main.js             Formularios, WhatsApp, menú, animaciones
assets/img/                   Logo, favicon, imágenes
google-apps-script/Code.gs    Receptor de solicitudes para Google Sheets
robots.txt, sitemap.xml       SEO
```

## Cómo funciona la captura de solicitudes

Cuando alguien llena un formulario (el del inicio, el de contacto o la ventana que abre cualquier botón de WhatsApp):

1. Se validan los datos y la autorización de tratamiento de datos.
2. La solicitud se guarda en **Google Sheets** (si está configurado) y se envía un **correo** a `gerencia@ariangoconsultores.com`.
3. La persona pasa a **WhatsApp (+57 315 600 2993)** con un mensaje ya escrito con su nombre, ciudad, servicio y caso, para que solo tenga que tocar “Enviar”.

Además se guardan los parámetros de campaña (`utm_source`, `utm_campaign`, `gclid`, `fbclid`…) para saber de qué anuncio llega cada cliente.

### Puesta en marcha (una sola vez)

**A. Correo de aviso (FormSubmit):** con la primera solicitud de prueba llega a `gerencia@ariangoconsultores.com` un correo de **activación** de FormSubmit. Hay que abrirlo y confirmar. Desde ese momento llega un correo por cada solicitud.

**B. Base de datos en Google Sheets (recomendado):**
1. Cree una hoja en Google Sheets → *Extensiones → Apps Script*.
2. Pegue el contenido de `google-apps-script/Code.gs` y guarde.
3. *Implementar → Nueva implementación → Aplicación web* · Ejecutar como: **Yo** · Acceso: **Cualquier usuario**.
4. Copie la URL `/exec` y péguela en `assets/js/config.js` → `googleSheetsEndpoint`.
5. Si usa Sheets, puede desactivar FormSubmit (`formSubmitEnabled: false`), porque el script también envía el correo.

**C. Analítica (opcional):** en `config.js`, ponga el ID de Google Analytics 4 (`ga4Id`) y/o del Pixel de Meta (`metaPixelId`). El envío de un formulario cuenta como evento `generate_lead` / `Lead`.

## Antes de publicar

- [ ] Reemplazar el bloque con el logo en la sección **Nosotros** por una foto profesional del Dr. Walter Enrique Arias Moreno (en `index.html` hay un comentario que indica dónde).
- [ ] Agregar la **dirección exacta** de la oficina y actualizar el mapa (sección Contacto) y los datos estructurados.
- [ ] Revisar que el texto legal coincida con la forma de trabajar del bufete (por ejemplo, si se trabaja con apoderados en Venezuela).
- [ ] Agregar testimonios **reales** cuando haya, con autorización de los clientes.
- [ ] Hacer una solicitud de prueba y confirmar el correo de activación de FormSubmit.

## Ver el sitio en local

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```
