# Ariango Consultores — Sitio web + Panel administrativo

Sitio de **Ariango Consultores** (Cúcuta, Colombia), bufete especializado en:

1. **Nulidad de Registro Civil (Colombia)** y **Nulidad de Partida de Nacimiento (Venezuela)** en casos de doble registro.
2. **Sucesiones y herencias** (notariales, judiciales y binacionales).

Incluye un **panel administrativo** (`/admin`) para editar la página sin saber programar.

---

## Qué tiene la página

| Sección | Para qué sirve (psicología de venta) |
|---|---|
| Portada + asistente de 2 pasos | Promesa clara y un formulario fácil: tocar una opción (compromiso pequeño) y luego dejar los datos. |
| “¿Le está pasando esto?” | La persona marca sus problemas → se identifica con el problema y recibe una invitación a actuar. |
| “No es su culpa” | Quita la culpa y la vergüenza, una barrera muy común en estos casos. |
| Explicado fácil + Antes / Después | Lenguaje sencillo para cualquier persona; contraste visual entre el problema y la solución. |
| “Entre más espere…” | Urgencia real y honesta (sin contadores falsos). |
| Servicios | Tres servicios claros, cada uno con su botón de solicitud. |
| Test de 30 segundos | Herramienta gratuita (reciprocidad) que muestra la ruta legal probable y lleva a WhatsApp con el resultado. |
| Proceso en 5 pasos | Reduce la incertidumbre. |
| Casos de éxito | Prueba social con documentos reales (administrable). |
| Equipo | Autoridad: el Dr. Walter Enrique Arias Moreno y su equipo de abogados (administrable). |
| La ley sin enredos | Normas vigentes explicadas en palabras simples, con las referencias exactas desplegables. |
| Compromiso | Garantías éticas: la verdad, todo por escrito, información constante y reserva. |
| Documentos, FAQ y contacto | Resuelve objeciones y cierra la venta. |

**En el celular** funciona como una app: barra inferior de navegación con botón central de WhatsApp, carruseles deslizables, menú en hoja inferior y formulario que sube desde abajo.

---

## Puesta en marcha en Vercel (una sola vez)

### 1. Base de datos para el panel (Vercel Blob)
1. En su proyecto de Vercel vaya a **Storage → Create Database → Blob**.
2. Nombre: `ariango-archivos`. Acceso: **Public**. Haga clic en **Create**.
3. Haga clic en **Connect Project**, elija el proyecto `ariango-consultores` y marque todos los entornos. Esto crea la variable `BLOB_READ_WRITE_TOKEN` de forma automática.

### 2. Contraseña del panel
En **Settings → Environment Variables** agregue:

| Nombre | Valor |
|---|---|
| `ADMIN_PASSWORD` | Una contraseña fuerte (mínimo 12 caracteres, con números y símbolos) |
| `SESSION_SECRET` | Un texto largo y aleatorio (por ejemplo, 40 letras y números al azar) |

### 3. Volver a desplegar
**Deployments → ⋯ (en el último) → Redeploy.** Las variables nuevas solo se aplican después de desplegar de nuevo.

### 4. Entrar al panel
Abra `https://ariangoconsultores.com/admin` (también aparece como **“Acceso”** o **“Ingreso administrativo”** en el pie de página y en el menú) e ingrese la contraseña.

---

## Cómo usar el panel

- **✏️ Editor visual:** abre la página en modo edición. Toque cualquier texto con borde punteado y escriba; seleccione palabras para ponerlas en **negrita** o en **dorado**. Cada sección tiene un botón **🖼 Fondo** para subir una imagen de fondo, y al tocar el logo puede cambiarlo. Al final toque **Publicar**.
- **🏆 Casos de éxito:** agregue casos con fotos o PDF de documentos, situación, solución, resultado y testimonio. Marque **“Caso real autorizado”** solo cuando tenga la autorización escrita del cliente.
- **👥 Equipo:** foto, nombre, cargo, especialidad y tarjeta profesional de cada abogado. El que marque como **destacado** aparece en grande.
- **🖼 Imágenes y fondos:** logo y fondo de cada una de las 14 secciones, con control de intensidad de la capa de color.
- **⚙️ Ajustes:** WhatsApp, teléfono, correo, dirección, horario, mapa, saludo del mensaje de WhatsApp, Google Sheets, Google Analytics y Pixel de Meta.
- **🕘 Historial:** cada publicación guarda una copia. Puede restaurar cualquiera de las últimas 40.

> Los cambios se ven en el sitio en menos de 1 minuto después de tocar **Publicar**.

### Buenas prácticas legales al publicar
- Casos de éxito: pida **autorización escrita** del cliente y **tache** nombres, cédulas, NUIP, firmas, huellas y fotos (Ley 1581 de 2012 y secreto profesional).
- No prometa resultados ni tiempos exactos (Ley 1123 de 2007, Código Disciplinario del Abogado).
- No use superlativos que no pueda probar (por ejemplo, “el bufete más grande”), por el régimen de publicidad engañosa del Estatuto del Consumidor (Ley 1480 de 2011).

---

## Captura de clientes (leads)

Cuando alguien deja sus datos:
1. Se guardan en **Google Sheets**, si está configurado, y se envía un **correo** de aviso (FormSubmit).
2. La persona pasa a **WhatsApp** con un mensaje ya escrito con su nombre, ciudad, servicio, resultado del test y su caso.
3. Se registra de qué campaña llegó (`utm_source`, `utm_campaign`, `gclid`, `fbclid`…).

**Google Sheets:** cree una hoja → *Extensiones → Apps Script* → pegue `google-apps-script/Code.gs` → *Implementar → Aplicación web* (Ejecutar como: Yo; Acceso: Cualquier usuario) → copie la URL `/exec` y péguela en **Panel → Ajustes**.

**Correo:** la primera solicitud envía a `gerencia@ariangoconsultores.com` un correo de activación de FormSubmit. Hay que confirmarlo una vez.

---

## Estructura

```
index.html                  Página principal
politica-de-privacidad.html Política de datos (Ley 1581 de 2012)
admin/                      Panel administrativo (index.html, admin.css, admin.js)
api/                        Funciones de Vercel: login, sesión, contenido, subida de archivos, historial
assets/css/styles.css       Estilos
assets/js/main.js           Página: asistente, test, casos, WhatsApp, contenido editable
assets/js/editor.js         Editor visual (solo con sesión de administrador)
assets/js/ac-upload.js      Compresión y subida de imágenes
assets/js/config.js         Valores por defecto de contacto
assets/js/defaults.js       Equipo y casos por defecto
google-apps-script/Code.gs  Receptor de solicitudes para Google Sheets
scripts/dev-server.mjs      Servidor local de pruebas
```

## Probar en local

```bash
npm install
ADMIN_PASSWORD=prueba123 npm run dev
# Sitio: http://localhost:3000   Panel: http://localhost:3000/admin/
```
En local, los cambios y las imágenes se guardan en la carpeta `.data/`.
