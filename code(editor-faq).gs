/**
 * ID de tu hoja y nombre de la pestaña
 */
const SHEET_ID   = '1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU';
const SHEET_NAME = 'FAQ';

/**
 * Columnas (sin fila de cabecera)
 * 0: Pregunta
 * 1: Respuesta
 * 2: Categorías
 * 3: Palabras clave
 */
const COLS = {
  PREGUNTA: 0,
  RESPUESTA: 1,
  CATEGORIAS: 2,
  PALABRAS_CLAVE: 3,
};

/**
 * Gestor de peticiones OPTIONS para el pre-vuelo de CORS.
 * Permite que el navegador verifique los permisos antes de enviar la petición POST.
 * @param {object} e - El objeto de evento de la petición.
 * @returns {ContentService.TextOutput} Una respuesta con las cabeceras CORS necesarias.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Punto de entrada único para peticiones POST.
 * Las peticiones llegan vía fetch desde el HTML del editor.
 * @param {object} e - El objeto de evento de la petición POST.
 * @returns {ContentService.TextOutput} Una respuesta en formato JSON con cabeceras CORS.
 */
function doPost(e) {
  const body   = JSON.parse(e.postData.contents || '{}');
  const action = body.action || '';
  
  // Se han eliminado las acciones de gestión (update, delete).
  const result = ({  
    getFaqsAndFilters : getFaqsAndFilters, // Necesario para la comprobación de duplicados
    add               : addFaq,
    replace           : replaceFaq,
    bulkAdd           : bulkAdd,
    generate          : fakeGenerate, // placeholder
    refine            : fakeGenerate, // placeholder
  }[action] || unsupported)(body);

  // --- CORRECCIÓN AQUÍ ---
  // Se añade la cabecera 'Access-Control-Allow-Origin' para permitir el acceso desde cualquier origen.
  return ContentService
         .createTextOutput(JSON.stringify(result))
         .setMimeType(ContentService.MimeType.JSON)
         .setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Devuelve todas las filas para la comprobación de duplicados.
 * La hoja NO tiene fila de cabecera.
 */
function getFaqsAndFilters() {
  try {
    const sh    = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data  = sh.getDataRange().getValues();        // todas las filas
    const faqs  = [];
    data.forEach((row, i) => {
      // Saltar filas totalmente vacías
      if (row.join('').trim() === '') return;

      faqs.push({
        rowNumber     : i + 1,               // la hoja empieza en 1
        Pregunta      : row[COLS.PREGUNTA]        || '',
        Respuesta     : row[COLS.RESPUESTA]       || '',
        Categorias    : row[COLS.CATEGORIAS]      || '',
        PalabrasClave : row[COLS.PALABRAS_CLAVE]  || '',
      });
    });
    // Ya no se necesitan los filtros, solo las FAQs para la lógica de duplicados
    return { success:true, data:{ faqs }};
  } catch(err) {
    return { success:false, message:'Error en getFaqsAndFilters: ' + err };
  }
}

/* ----------------- Operaciones de Escritura -------------------- */

function addFaq({ faqData }) {
  try{
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sh.appendRow([
      faqData.pregunta      || '',
      faqData.respuesta     || '',
      faqData.categorias    || '',
      faqData.palabrasClave || ''
    ]);
    return { success:true, message:'Añadido correctamente.' };
  }catch(err){
    return { success:false, message:'Error al añadir: '+err };
  }
}

function replaceFaq({ rowNumber, faqData }) {
   try{
    const sh   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sh.getRange(rowNumber, 1, 1, 4).setValues([[
      faqData.pregunta      || '',
      faqData.respuesta     || '',
      faqData.categorias    || '',
      faqData.palabrasClave || ''
    ]]);
    return { success:true, message:'Actualizado correctamente.' };
  }catch(err){
    return { success:false, message:'Error al actualizar: '+err };
  }
}

function bulkAdd({ qnaArray }) {
  try{
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const rows = qnaArray.map(o=>[
      o.pregunta       || '',
      o.respuesta      || '',
      o.categorias     || '',
      o.palabrasClave  || ''
    ]);
    sh.getRange(sh.getLastRow()+1,1,rows.length,4).setValues(rows);
    return { success:true, message:`Se añadieron ${rows.length} filas.` };
  }catch(err){
    return { success:false, message:'Error en bulkAdd: '+err };
  }
}

/* ---------- Placeholders para IA (no implementados en servidor) ----------- */
function fakeGenerate(){ return {success:false, message:'No implementado en servidor'};}
function unsupported(){ return {success:false, message:'Acción no soportada'};}
