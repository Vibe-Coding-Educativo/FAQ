// --- CONFIGURACIÓN ---
const SPREADSHEET_ID = '1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU';
const SHEET_NAME = 'FAQ';
// -------------------

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    let response;

    // --- ACCIONES DE GESTIÓN (CRUD) ---
    if (requestData.action === 'getFaqsAndFilters') {
      response = getFaqsAndFilters();
    } else if (requestData.action === 'updateFaq') {
      response = updateFaqInSheet(requestData.rowNumber, requestData.faqData);
    } else if (requestData.action === 'deleteFaq') {
      response = deleteFaqFromSheet(requestData.rowNumber);
    
    // --- ACCIONES DE IA Y ADICIÓN ---
    } else if (requestData.action === 'generate') {
      response = generateFaqSuggestion(requestData);
    } else if (requestData.action === 'refine') {
      response = refineFaqSuggestion(requestData.previousSuggestion, requestData.refinementInstruction);
    } else if (requestData.action === 'add') {
      response = addFaqToSheet(requestData.faqData);
    } else if (requestData.action === 'bulkAdd') {
      response = bulkAddFaqs(requestData.qnaArray);
    } else if (requestData.action === 'replace') {
      response = replaceFaqInSheet(requestData.rowNumber, requestData.faqData);
    } else {
      throw new Error("Acción no válida.");
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(error.toString());
    const errorResponse = { success: false, message: 'Error en el servidor: ' + error.toString() };
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNCIÓN DE GESTIÓN MEJORADA ---
function getFaqsAndFilters() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const faqs = [];
  const categories = new Set();
  const keywords = new Set();

  if (values.length > 1) {
    const headers = values[0].map(h => h.trim());
    const catIndex = headers.indexOf('Categorias');
    const keyIndex = headers.indexOf('PalabrasClave');

    for (let i = 1; i < values.length; i++) {
      let faq = {};
      faq['rowNumber'] = i + 1;
      headers.forEach((header, j) => {
        faq[header] = values[i][j];
      });
      faqs.push(faq);

      // Extraer categorías y palabras clave para los filtros
      if (catIndex > -1 && values[i][catIndex]) {
        values[i][catIndex].toString().split(';').forEach(cat => { if(cat.trim()) categories.add(cat.trim()) });
      }
      if (keyIndex > -1 && values[i][keyIndex]) {
        values[i][keyIndex].toString().split(',').forEach(key => { if(key.trim()) keywords.add(key.trim()) });
      }
    }
  }
  
  return { 
    success: true, 
    data: {
      faqs: faqs,
      filters: {
        categories: Array.from(categories).sort(),
        keywords: Array.from(keywords).sort()
      }
    } 
  };
}

function updateFaqInSheet(rowNumber, faqData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const range = sheet.getRange(rowNumber, 1, 1, 4);
  range.setValues([[ faqData.pregunta, faqData.respuesta, faqData.categorias, faqData.palabrasClave ]]);
  return { success: true, message: `FAQ de la fila ${rowNumber} actualizada.` };
}

function deleteFaqFromSheet(rowNumber) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sheet.deleteRow(rowNumber);
  return { success: true, message: `FAQ de la fila ${rowNumber} eliminada.` };
}


// --- FUNCIONES DE IA Y ADICIÓN (sin cambios) ---
// (Se incluyen para que el código esté completo)
function getSheetValues() { const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME); return sheet.getDataRange().getValues(); }
function getExistingQuestionsList(values) { if (!values || values.length < 2) return []; return values.slice(1).map(row => row[0] ? row[0].toString().trim() : ""); }
function generateFaqSuggestion(requestData) { const existingValues = getSheetValues(); const existingCategories = getUniqueCategoriesFromValues(existingValues); const existingQuestions = getExistingQuestionsList(existingValues); const textToCheck = requestData.categorizeOnly ? requestData.pregunta : requestData.userInput; const operationMode = requestData.categorizeOnly ? "SOLO_CATEGORIZAR" : "GENERACION_COMPLETA"; const prompt = `Eres un asistente experto en "vibe coding educativo". Tu tarea principal es evitar preguntas duplicadas en una FAQ analizando su significado (semántica). TAREA: Compara el "TEXTO A COMPROBAR" con la "LISTA DE PREGUNTAS EXISTENTES". TEXTO A COMPROBAR: "${textToCheck}" LISTA DE PREGUNTAS EXISTENTES:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')} EJEMPLO DE DUPLICADO SEMÁNTICO: La pregunta "¿Cómo comparto un vídeo de Telegram?" ES un duplicado de "¿Cómo puedo compartir un vídeo que alguien ha publicado en el grupo de Telegram?". INSTRUCCIONES DE SALIDA (JSON): 1. Decide si el SIGNIFICADO del "TEXTO A COMPROBAR" ya está cubierto por alguna pregunta de la lista. 2. SI ES SEMÁNTICAMENTE SIMILAR: Responde con { "status": "duplicate", "existing": { "Pregunta": "...", "Respuesta": "..." }, "suggestion": { ... } }. En 'existing' pon la pregunta y respuesta antiguas exactas. En 'suggestion' crea una versión mejorada. 3. SI ES NUEVO: Procede según el "MODO DE OPERACIÓN" y responde con { "status": "new", "suggestion": { ... } }. 4. REGLAS: Responde EXCLUSIVAMENTE con el objeto JSON. Prioriza las categorías existentes: [${existingCategories.join(', ')}]. CONTEXTO COMPLETO (para buscar la respuesta si encuentras un duplicado):\n${getValuesAsCsv(existingValues)}`; const apiResult = callGenerativeApi(prompt); if (apiResult.success && apiResult.data.status === 'duplicate') { const existingQuestionText = apiResult.data.existing.Pregunta; const rowNumber = findRowNumberOfQuestion(existingValues, existingQuestionText); if (rowNumber > -1) { apiResult.data.existing.rowNumber = rowNumber; } } return apiResult; }
function bulkAddFaqs(qnaArray) { if (!qnaArray || qnaArray.length === 0) { return { success: false, message: "No se proporcionaron preguntas para añadir." }; } const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME); const newRows = []; const existingValues = sheet.getDataRange().getValues(); const existingCategories = getUniqueCategoriesFromValues(existingValues); const existingQuestionsSet = new Set(existingValues.slice(1).map(row => row[0] ? row[0].toString().trim().toLowerCase() : "")); let skippedCount = 0; for (const qna of qnaArray) { const normalizedQuestion = qna.pregunta.trim().toLowerCase(); if (existingQuestionsSet.has(normalizedQuestion)) { skippedCount++; continue; } const prompt = `Eres un asistente experto que ayuda a un profesor a organizar una FAQ sobre "vibe coding educativo". TAREA: Te doy una Pregunta y Respuesta. Genera las 'Categorias' y 'PalabrasClave' apropiadas. PREGUNTA: "${qna.pregunta}" RESPUESTA: "${qna.respuesta}" CATEGORÍAS EXISTENTES: [${existingCategories.join(', ')}] INSTRUCCIONES: Prioriza categorías existentes. Devuelve solo un JSON con "Categorias" y "PalabrasClave". FORMATO JSON: { "Categorias": "...", "PalabrasClave": "..." }`; const categorizationResult = callGenerativeApi(prompt); if (categorizationResult.success) { newRows.push([ qna.pregunta, qna.respuesta, categorizationResult.data.Categorias || '', categorizationResult.data.PalabrasClave || '' ]); existingQuestionsSet.add(normalizedQuestion); } } if (newRows.length > 0) { sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows); } let message = `Proceso completado. Se han añadido ${newRows.length} nuevas FAQs.`; if (skippedCount > 0) { message += ` Se han omitido ${skippedCount} por ser duplicados.`; } return { success: true, message: message }; }
function replaceFaqInSheet(rowNumber, faqData) { const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME); const range = sheet.getRange(rowNumber, 1, 1, 4); range.setValues([[ faqData.pregunta, faqData.respuesta, faqData.categorias, faqData.palabrasClave ]]); return { success: true, message: `FAQ en la fila ${rowNumber} actualizada correctamente.` }; }
function refineFaqSuggestion(previousSuggestion, refinementInstruction) { const prompt = `Eres un asistente experto que ayuda a un profesor a crear una FAQ sobre "vibe coding educativo". PUBLICO OBJETIVO: Docentes con conocimientos limitados de programación. Usa un lenguaje claro y sencillo. TAREA: Refina la siguiente entrada de la FAQ basándote en la instrucción del profesor. ENTRADA ANTERIOR (JSON): ${JSON.stringify(previousSuggestion, null, 2)} INSTRUCCIÓN: "${refinementInstruction}" INSTRUCCIONES ADICIONALES: Aplica la mejora, manteniendo un lenguaje sencillo. Devuelve EXCLUSIVAMENTE en formato JSON. FORMATO JSON: { "Pregunta": "...", "Respuesta": "...", "Categorias": "...", "PalabrasClave": "..." }`; return callGenerativeApi(prompt); }
function callGenerativeApi(prompt) { const API_KEY = PropertiesService.getScriptProperties().getProperty('API_KEY'); if (!API_KEY) return { success: false, message: 'Error: API_KEY no configurada.' }; const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`; const payload = { contents: [{ parts: [{ text: prompt }] }] }; const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload) }; const response = UrlFetchApp.fetch(apiUrl, options); const jsonResponse = JSON.parse(response.getContentText()); let generatedText = jsonResponse.candidates[0].content.parts[0].text.trim(); let cleanedText = generatedText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, ''); const startIndex = cleanedText.indexOf('{'); const endIndex = cleanedText.lastIndexOf('}'); if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) { throw new Error("La respuesta de la IA no contenía un formato JSON válido. Respuesta: " + generatedText); } const finalJsonText = cleanedText.substring(startIndex, endIndex + 1); const faqData = JSON.parse(finalJsonText); return { success: true, data: faqData }; }
function addFaqToSheet(faqData) { const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME); sheet.appendRow([faqData.pregunta, faqData.respuesta, faqData.categorias, faqData.palabrasClave]); return { success: true, message: 'FAQ añadida correctamente a la hoja de cálculo.' }; }
function getUniqueCategoriesFromValues(values) { if (!values || values.length < 2) return []; const headers = values[0].map(h => h.trim()); const categoryIndex = headers.indexOf('Categorias'); if (categoryIndex === -1) return []; const categories = new Set(); values.slice(1).forEach(row => { if (row[categoryIndex]) { row[categoryIndex].toString().split(';').forEach(cat => { if (cat.trim()) categories.add(cat.trim()); }); } }); return Array.from(categories); }
function findRowNumberOfQuestion(values, questionToFind) { if (!values || !questionToFind) return -1; const rowIndex = values.findIndex(row => row[0] && row[0].toString().trim() === questionToFind.trim()); return rowIndex !== -1 ? rowIndex + 1 : -1; }
function getValuesAsCsv(values) { return values.map(row => row.map(cell => { let cellStr = String(cell).replace(/"/g, '""'); if (cellStr.includes(',') || cellStr.includes('\n')) { cellStr = `"${cellStr}"`; } return cellStr; }).join(',')).join('\n'); }
