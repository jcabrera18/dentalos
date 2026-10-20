// Datos del titular del Servicio y parámetros legales usados en las páginas
// /terms, /privacy y /dpa. FUENTE ÚNICA: actualizá acá cuando tengas razón
// social, CUIT y domicilio definitivos — las tres páginas lo toman de este archivo.
//
// Mientras no haya sociedad constituida, el Servicio puede operarse a título
// individual: poné tu nombre en `operator` y dejá `taxId` vacío hasta tener CUIT.

export const LEGAL = {
  // Nombre y apellido del titular, o razón social una vez constituida.
  operator: '[NOMBRE DEL TITULAR O RAZÓN SOCIAL]',
  // CUIT/CUIL. Dejar '' mientras no se tenga: se omite del texto automáticamente.
  taxId: '',
  // Domicilio de contacto (puede ser el real o uno de contacto).
  address: '[DOMICILIO DE CONTACTO]',
  // Jurisdicción para controversias, p. ej. 'la Ciudad Autónoma de Buenos Aires'.
  jurisdiction: '[JURISDICCIÓN]',
  emails: {
    legal: 'legal@vitalos.com.ar',
    privacy: 'privacidad@vitalos.com.ar',
  },
  // Fecha visible de última actualización de los documentos legales.
  lastUpdated: '20 de octubre de 2026',
} as const
