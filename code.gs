
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
 * Punto de entrada único
 * Las peticiones llegan vía fetch desde el HTML
 */
function doPost(e) {
  const body   = JSON.parse(e.postData.contents || '{}');
  const action = body.action || '';
  const result = ({  
    getFaqsAndFilters : getFaqsAndFilters,
    add               : addFaq,
    replace           : replaceFaq,
    updateFaq         : updateFaq,
    deleteFaq         : deleteFaq,
    bulkAdd           : bulkAdd,
    generate          : fakeGenerate, // placeholder
    refine            : fakeGenerate, // placeholder
  }[action] || unsupported)(body);

  return ContentService
         .createTextOutput(JSON.stringify(result))
         .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Devuelve todas las filas y los filtros únicos de categorías / palabras clave.
 * La hoja NO tiene fila de cabecera, así que construimos los nombres a mano.
 */
function getFaqsAndFilters() {
  try {
    const sh    = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data  = sh.getDataRange().getValues();        // todas las filas
    const faqs  = [];
    const cats  = new Set();
    const keys  = new Set();

    data.forEach((row, i) => {
      // Saltar filas totalmente vacías
      if (row.join('').trim() === '') return;

      const faq = {
        rowNumber     : i + 1,               // la hoja empieza en 1
        Pregunta      : row[COLS.PREGUNTA]        || '',
        Respuesta     : row[COLS.RESPUESTA]       || '',
        Categorias    : row[COLS.CATEGORIAS]      || '',
        PalabrasClave : row[COLS.PALABRAS_CLAVE]  || '',
      };
      faqs.push(faq);

      // Construir los filtros únicos
      faq.Categorias.split(/[,;]/).forEach(c => {
        const v = c.trim();
        if (v) cats.add(v);
      });
      faq.PalabrasClave.split(',').forEach(k => {
        const v = k.trim();
        if (v) keys.add(v);
      });
    });

    return { success:true, data:{
      faqs,
      filters:{
        categories:[...cats].sort(),
        keywords:[...keys].sort()
      }
    }};
  } catch(err) {
    return { success:false, message:'Error en getFaqsAndFilters: ' + err };
  }
}

/* ----------------- Operaciones CRUD básicas -------------------- */

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
  return updateFaq({ rowNumber, faqData });
}

function updateFaq({ rowNumber, faqData }) {
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

function deleteFaq({ rowNumber }) {
  try{
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sh.deleteRow(rowNumber);
    return { success:true, message:'Fila eliminada.' };
  }catch(err){
    return { success:false, message:'Error al borrar: '+err };
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
