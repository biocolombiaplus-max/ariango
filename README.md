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

| `DATA_KEY` | Otro texto largo y aleatorio. Cifra los datos de los clientes. **No lo cambie nunca**: si lo cambia, los datos guardados no se podrán leer. |

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
- **✂️ Ajustar foto:** en cada fondo, en la foto de cada abogado y en la portada de cada caso. Arrastre la foto para moverla, use **Acercar** o elija **Foto completa** para que se vea entera sin recortes. Los fondos se pueden ajustar distinto para **computador** y **celular**.
- **⚙️ Ajustes:** WhatsApp, teléfono, correo, dirección, horario, mapa, saludo del mensaje de WhatsApp, Google Sheets, Google Analytics y Pixel de Meta.
- **🕘 Historial:** cada publicación guarda una copia. Puede restaurar cualquiera de las últimas 40.

> Los cambios se ven en el sitio en menos de 1 minuto después de tocar **Publicar**.

### Buenas prácticas legales al publicar
- Casos de éxito: pida **autorización escrita** del cliente y **tache** nombres, cédulas, NUIP, firmas, huellas y fotos (Ley 1581 de 2012 y secreto profesional).
- No prometa resultados ni tiempos exactos (Ley 1123 de 2007, Código Disciplinario del Abogado).
- No use superlativos que no pueda probar (por ejemplo, “el bufete más grande”), por el régimen de publicidad engañosa del Estatuto del Consumidor (Ley 1480 de 2011).

---

## CRM, documentos y portal del cliente

**Panel → 💼 Clientes** funciona como un embudo de ventas (estilo Kommo):

`Nuevo → Contactado → Propuesta enviada → Propuesta aceptada → Anticipo pagado → Contrato firmado → Documentación → En trámite → Finalizado` (y `Perdido`).

- Cada solicitud de la página web entra sola a **Nuevo**.
- **El embudo avanza solo:** al enviar la propuesta, cuando el cliente la firma, al registrar el pago, cuando firma el contrato y cuando envía sus documentos.
- La ficha del cliente sugiere **el siguiente paso** con un botón (saludar, cobrar el anticipo, enviar el contrato, pedir documentos, informar avances, pedir testimonio).
- **Documentos con vista previa en vivo:** propuesta, contrato, poder especial, acta de recepción de documentos, recibo de pago y documentos libres (autorización de datos, declaración, paz y salvo…). Se llenan con selectores rápidos y plantillas por servicio.
- **Portal del cliente** (`/cliente/…`, enlace privado): el cliente ve su avance, **firma con el dedo** desde el celular, descarga en PDF, sube fotos de sus documentos y ve las cuentas para pagar.
- Cada firma queda con un **certificado**: nombre, documento, fecha y hora, IP, dispositivo y huella SHA-256 del documento (Ley 527 de 1999 y Decreto 2364 de 2012).
- **Documentos y cuentas:** datos de la firma, firma de cada abogado, cuentas bancarias y plantillas de servicio (precio, plan de pagos, alcance, requisitos).
- Los datos de los clientes y sus archivos se guardan **cifrados** (AES-256-GCM).

## Documentos (Panel → 📄 Documentos)

- Todos los documentos del bufete en un solo lugar: buscar, filtrar por tipo, **editar, descargar en PDF y enviar por WhatsApp**.
- **Crear en dos pasos:** elija el tipo (poder, propuesta, contrato, acta, recibo u otro) y el cliente; o cree un cliente nuevo ahí mismo.
- **Poder especial** con modelos listos: nulidad de registro civil ante la Registraduría, proceso judicial de registro civil, sucesión en notaría, sucesión ante juez, trámite en Venezuela y trámites administrativos. Incluye:
  - varios poderdantes (por ejemplo, todos los herederos), cada uno con documento y calidad;
  - datos del asunto que se detectan solos (causante, fecha de fallecimiento, serial del registro, acta);
  - facultades expresas (arts. 74 y 77 del CGP), correo del apoderado inscrito en el Registro Nacional de Abogados y apoderado sustituto;
  - forma de otorgamiento: mensaje de datos (Ley 2213 de 2022, art. 5), presentación personal en notaría, consulado o apostilla para el exterior.

### Editar el texto del documento (como en Word)
- En cualquier documento toque **✍️ Editar sobre el documento** y escriba directamente en la hoja: **encabezado, cuerpo, firmas y pie de página**.
- Barra de herramientas: deshacer, negrita, cursiva, subrayado, títulos, listas, alinear, **＋ Párrafo**, **🗑 Quitar** (el párrafo donde está el cursor) y **＋ Insertar dato** (nombre, cédula, fecha, número, abogado, valores, causante…).
- Los datos del cliente y del caso **se siguen actualizando solos** aunque el texto se haya ajustado a mano. Las firmas dibujadas y el certificado de firma electrónica no se pueden alterar.
- **↩ Volver al texto automático** deshace los ajustes hechos a mano.
- **⭐ Guardar como plantilla** (solo administrador): los nuevos documentos de ese tipo, y de ese modelo de poder, empiezan con el texto ajustado. Las plantillas aparecen en **📄 Documentos → Plantillas del bufete**, donde se pueden quitar para volver al modelo original.

## Ficha del cliente (Clientes → Resumen)

- **Identificación:** nombres y apellidos por separado, tipo de documento colombiano (C.C., T.I., registro civil con NUIP, C.E., PPT, PEP, pasaporte) o venezolano (cédula V o E, pasaporte, partida de nacimiento), número, lugar y fecha de expedición, género y nacionalidad.
- **Contacto y residencia:** WhatsApp con **indicativo del país** (Colombia, Venezuela y 28 países más), teléfono alterno, correo, dirección, barrio, ciudad, departamento o estado y país.
- **Nacimiento y datos civiles:** fecha (calcula la edad y avisa si es menor de edad), lugar, departamento o estado y país de nacimiento, estado civil y profesión.
- **Datos del caso**, que se activan según el trámite: registro civil colombiano (NUIP, serial, oficina), partida venezolana (acta, folio, tomo, año, oficina, municipio, estado), padres, sucesión (causante, fallecimiento, último domicilio, herederos, testamento, bienes) y menor representado.
- Una barra muestra **qué datos faltan**; al tocar uno, lleva directo al campo.
- El poder y los demás documentos se llenan solos con estos datos, con el texto ajustado al género («identificada», «domiciliada», «casada»).

## Abogados y accesos

- **Panel → ⚖️ Abogados y accesos** (solo administrador): cree una cuenta por abogado con nombre, correo, contraseña inicial, cédula, tarjeta profesional y WhatsApp. El panel le arma el mensaje con los datos de acceso para enviárselo.
- **Roles:** *Abogado* ve solo sus casos y su perfil; *Administrador* ve y gestiona todo.
- **Ingreso:** los abogados entran con **correo y contraseña**. El administrador principal entra solo con `ADMIN_PASSWORD`.
- **Asignación:** en la ficha de cada cliente (campo «Abogado a cargo»), con aviso opcional al abogado por WhatsApp. También puede ser **automática por turnos** para las solicitudes de la página web.
- **Mi perfil:** cada abogado actualiza sus datos, **dibuja o sube su firma** (el fondo de la foto se vuelve transparente) y cambia su contraseña.
- **Firma del representante legal:** en Documentos y cuentas → «Firma de los abogados» → «Representante legal». Se usa en «Por LA FIRMA» de contratos y recibos.
- Al desactivar una cuenta o cambiarle la contraseña, sus sesiones abiertas se cierran.

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
