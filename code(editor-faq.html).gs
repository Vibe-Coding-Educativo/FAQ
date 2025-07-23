/**
 * ID de tu hoja y nombre de la pestaña
 */
const SHEET_ID   = '1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU';
const SHEET_NAME = 'FAQ';

/**
 * Columnas de la hoja de cálculo
 */
const COLS = {
  PREGUNTA: 0,
  RESPUESTA: 1,
  CATEGORIAS: 2,
  PALABRAS_CLAVE: 3,
};

/**
 * Gestor de peticiones OPTIONS para el "pre-flight" de CORS.
 * El navegador envía esta petición automáticamente antes de un POST
 * para asegurarse de que el servidor permite la comunicación.
 * @param {object} e El objeto de evento de la petición.
 * @returns {ContentService.TextOutput} Una respuesta con las cabeceras CORS.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Punto de entrada para las peticiones POST desde el cliente.
 * @param {object} e El objeto de evento de la petición POST.
 * @returns {ContentService.TextOutput} Una respuesta JSON con las cabeceras CORS.
 */
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';
    
    const result = ({  
      getFaqsAndFilters : getFaqsAndFilters,
      add               : addFaq,
      replace           : replaceFaq,
      bulkAdd           : bulkAdd,
      generate          : fakeGenerate,
      refine            : fakeGenerate,
    }[action] || unsupported)(body);

    // Se crea la respuesta y se añaden las cabeceras CORS
    return createJsonResponse(result);

  } catch (error) {
    const errorResponse = { success: false, message: `Error en el servidor: ${error.message}` };
    return createJsonResponse(errorResponse);
  }
}

/**
 * Crea una respuesta de texto en formato JSON y añade las cabeceras CORS.
 * Centralizar la creación de la respuesta asegura que las cabeceras siempre estén presentes.
 * @param {object} data El objeto a convertir en JSON.
 * @returns {ContentService.TextOutput} El objeto de respuesta final.
 */
function createJsonResponse(data) {
  return ContentService
         .createTextOutput(JSON.stringify(data))
         .setMimeType(ContentService.MimeType.JSON)
         .addHeader('Access-Control-Allow-Origin', '*'); // Permite el acceso desde cualquier origen
}


/* ================================================================== */
/* ================== LÓGICA DE LA APLICACIÓN ======================= */
/* ================================================================== */
// (El resto de tus funciones no necesitan cambios)


/**
 * Devuelve todas las filas para la comprobación de duplicados.
 */
function getFaqsAndFilters() {
  try {
    const sh    = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data  = sh.getDataRange().getValues();
    const faqs  = [];
    data.forEach((row, i) => {
      if (row.join('').trim() === '') return;
      faqs.push({
        rowNumber     : i + 1,
        Pregunta      : row[COLS.PREGUNTA]        || '',
        Respuesta     : row[COLS.RESPUESTA]       || '',
        Categorias    : row[COLS.CATEGORIAS]      || '',
        PalabrasClave : row[COLS.PALABRAS_CLAVE]  || '',
      });
    });
    return { success:true, data:{ faqs }};
  } catch(err) {
    return { success:false, message:'Error en getFaqsAndFilters: ' + err };
  }
}

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

function fakeGenerate(){ return {success:false, message:'No implementado en servidor'};}
function unsupported(){ return {success:false, message:'Acción no soportada'};}
