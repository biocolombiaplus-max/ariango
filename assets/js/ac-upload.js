/* Subida de archivos para el panel y el editor visual.
   Las fotos se reducen y comprimen en el navegador antes de subirlas. */
(function () {
  "use strict";

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
      img.src = url;
    });
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  async function compress(file, opts) {
    opts = opts || {};
    var max = opts.maxSize || 2000;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    var keepAlpha = file.type === "image/png" && opts.keepPng;
    var loaded = await loadImage(file);
    var img = loaded.img;
    var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 600 * 1024) { URL.revokeObjectURL(loaded.url); return file; }
    var c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    var ctx = c.getContext("2d");
    if (!keepAlpha) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(loaded.url);
    var blob = keepAlpha ? await toBlob(c, "image/png") : await toBlob(c, "image/webp", 0.84);
    if (!blob || (!keepAlpha && blob.type !== "image/webp")) blob = await toBlob(c, "image/jpeg", 0.86);
    return blob && blob.size < file.size ? blob : file;
  }

  async function upload(file, opts) {
    var body = await compress(file, opts);
    if (body.size > 4 * 1024 * 1024) throw new Error("El archivo pesa más de 4 MB. Redúzcalo e intente de nuevo.");
    var r = await fetch("/api/upload?name=" + encodeURIComponent(file.name || "imagen"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": body.type || file.type, "x-ac-admin": "1" },
      body: body
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || "No se pudo subir el archivo");
    return data.url;
  }

  function pick(accept, multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = accept || "image/*";
      input.multiple = !!multiple;
      input.onchange = function () { resolve(Array.prototype.slice.call(input.files || [])); };
      input.click();
    });
  }

  window.ACUpload = { compress: compress, upload: upload, pick: pick };
})();
