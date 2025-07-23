
/**
 * Script unificado FAQ VCE
 * Combina la lógica de respuesta a preguntas (Gemini) y la gestión de la hoja de FAQs.
 * Incluye cabeceras CORS en TODAS las respuestas.
 */

// --- CONFIGURACIÓN GENERAL ---
const SHEET_ID = '1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU';
const SHEET_NAME = 'FAQ';
const GEMINI_MODEL = 'gemini-2.5-flash';

/* ---- CORS helper ---- */
function corsHeaders(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ---- OPTIONS para preflight ---- */
function doOptions(e){
  return corsHeaders(ContentService.createTextOutput(''));
}



function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';

    // --- Rutas de gestión de FAQs ---
    if(action){
      const result = ({
        getFaqsAndFilters : getFaqsAndFilters,
        add               : addFaq,
        replace           : replaceFaq,
        bulkAdd           : bulkAdd,
        generate          : fakeGenerate,
        refine            : fakeGenerate,
      }[action] || unsupported)(body);

      return corsHeaders(ContentService.createTextOutput(JSON.stringify(result))
                        .setMimeType(ContentService.MimeType.JSON));

    }

    // --- Ruta de consulta (sin 'action') ---
    const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!apiKey){
      return corsHeaders(ContentService.createTextOutput(JSON.stringify({error:'API_KEY no establecida'}))
                        .setMimeType(ContentService.MimeType.JSON));
    }
    const userQuestion = body.question;
    if (!userQuestion){
      return corsHeaders(ContentService.createTextOutput(JSON.stringify({error:'No se proporcionó pregunta'}))
                        .setMimeType(ContentService.MimeType.JSON));
    }

    const faqContext = getFaqContext();
    const prompt = `
Eres un asistente virtual experto y servicial. Tu única tarea es responder basándote **exclusivamente** en el siguiente contexto de Preguntas y Respuestas Frecuentes (FAQ).

**Contexto de FAQs:**
${faqContext}

**Instrucciones importantes:**
1. Lee la "Pregunta del usuario" y busca la respuesta más relevante dentro del "Contexto de FAQs".
2. Si encuentras una respuesta directa o muy relacionada, responde de forma clara y concisa, en tono natural, pero **no** añadas información que no esté en el contexto.
3. Si la respuesta no se encuentra en el contexto, DEBES responder: "Lo siento, no dispongo de esa información en este momento." No intentes adivinar ni usar conocimiento externo.
4. Responde siempre en español.
5. Utiliza formato Markdown para mejorar la legibilidad si es necesario (listas, negritas, etc.).

**Pregunta del usuario:**
"${userQuestion}"

**Respuesta:**
`;

    const geminiResponse = callGeminiAPI(prompt, apiKey);
    return corsHeaders(ContentService.createTextOutput(JSON.stringify({answer:geminiResponse}))
                      .setMimeType(ContentService.MimeType.JSON));

  }catch(err){
    Logger.log('Error en doPost unificado: ' + err);
    return corsHeaders(ContentService.createTextOutput(JSON.stringify({error:err.message}))
                      .setMimeType(ContentService.MimeType.JSON));
  }
}


function getFaqContext() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const faqs = data.slice(1); 

    let context = '';
    faqs.forEach((row, index) => {
      const question = row[0];
      const answer = row[1];
      if (question && answer) {
        context += `P: ${question}\nR: ${answer}\n---\n`;
      }
    });
    return context;
  } catch (error) {
    Logger.log(`Error en getFaqContext: ${error.toString()}`);
    throw new Error('No se pudo leer la base de datos de FAQs.');
  }
}

function callGeminiAPI(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  
  const payload = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }],
    "generationConfig": {
      "temperature": 0.3,
      "topP": 1,
      "topK": 32,
      "maxOutputTokens": 1024,
    }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 200) {
    const jsonResponse = JSON.parse(responseBody);
    return jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || "La IA no proporcionó una respuesta válida.";
  } else {
    Logger.log(`Error de la API de Gemini [${responseCode}]: ${responseBody}`);
    throw new Error('El servicio de IA no está disponible en este momento.');
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*').setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS').setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

function addFaq({ faqData }

function replaceFaq({ rowNumber, faqData }

function bulkAdd({ qnaArray }

function fakeGenerate(){ return {success:false, message:'No implementado en servidor'};}

function unsupported(){ return {success:false, message:'Acción no soportada'};}
