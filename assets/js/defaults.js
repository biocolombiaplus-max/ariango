/* ==========================================================================
   Contenido por defecto de las secciones administrables.
   Lo que se guarde desde el panel (/admin) reemplaza estos valores.
   ========================================================================== */
window.AC_DEFAULTS = {
  team: [
    {
      id: "walter",
      visible: true,
      destacado: true,
      nombre: "Dr. Walter Enrique Arias Moreno",
      cargo: "Asesor jurídico principal · Director",
      especialidad: "Registro civil, nacionalidad, familia y sucesiones",
      tarjeta: "",
      bio: "Más de 30 años de experiencia acompañando a familias de la frontera colombo-venezolana a resolver sus problemas de identidad y de herencia.",
      foto: ""
    }
  ],

  /* Casos de ejemplo. Desde el panel, reemplácelos por casos reales
     (con autorización del cliente y datos personales tachados).
     Mientras "real" sea false, se muestran con la etiqueta "Caso ilustrativo". */
  cases: [
    {
      id: "ej-1",
      visible: true,
      real: false,
      categoria: "Nulidad en Colombia",
      titulo: "Nació en San Cristóbal, pero estaba registrada en Cúcuta",
      situacion: "Le negaron el pasaporte por tener dos registros de nacimiento.",
      solucion: "Se anuló el registro colombiano y, por ser hija de madre colombiana, se hizo un nuevo registro como colombiana nacida en el exterior.",
      resultado: "Una sola identidad, con nacionalidad colombiana y pasaporte en trámite.",
      tiempo: "",
      ciudad: "Cúcuta",
      cliente: "",
      testimonio: "",
      imagenes: []
    },
    {
      id: "ej-2",
      visible: true,
      real: false,
      categoria: "Nulidad en Venezuela",
      titulo: "Nació en Cúcuta y también tenía partida venezolana",
      situacion: "Vive en Colombia y la doble identidad le bloqueaba trámites de salud y trabajo.",
      solucion: "Se tramitó la nulidad del acta de nacimiento venezolana con poder apostillado.",
      resultado: "Identidad colombiana única y en regla.",
      tiempo: "",
      ciudad: "Villa del Rosario",
      cliente: "",
      testimonio: "",
      imagenes: []
    },
    {
      id: "ej-3",
      visible: true,
      real: false,
      categoria: "Sucesión binacional",
      titulo: "Una casa en Cúcuta y un apartamento en Venezuela",
      situacion: "Cuatro hermanos no podían vender ni escriturar los bienes de su padre.",
      solucion: "Sucesión notarial en Colombia y coordinación de los trámites para el bien en Venezuela.",
      resultado: "Bienes a nombre de los herederos, con impuestos al día.",
      tiempo: "",
      ciudad: "Cúcuta",
      cliente: "",
      testimonio: "",
      imagenes: []
    }
  ]
};
