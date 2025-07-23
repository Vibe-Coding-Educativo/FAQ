/**
 * @fileoverview Script para responder preguntas de usuarios usando Gemini API
 * basándose en el contenido de una hoja de cálculo de FAQs.
 * CORREGIDO: Añadido manejo de CORS para evitar errores de red.
 */

// --- CONFIGURACIÓN ---
const SHEET_ID = '1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU'; 
const SHEET_NAME = 'FAQ';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Handles HTTP OPTIONS requests for CORS preflight.
 * This is necessary to allow cross-origin POST requests from the browser.
 * @param {object} e - The event parameter.
 * @returns {ContentService.TextOutput} A response with CORS headers.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Punto de entrada para las peticiones POST desde la página web.
 * @param {object} e - El objeto de evento de la petición POST.
 * @returns {ContentService.TextOutput} - Una respuesta en formato JSON.
 */
function doPost(e) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!apiKey) {
      return createJsonResponse({ error: 'Error del servidor: La clave API no está configurada en las propiedades del script con el nombre "API_KEY".' });
    }

    const requestBody = JSON.parse(e.postData.contents);
    const userQuestion = requestBody.question;
    if (!userQuestion) {
      return createJsonResponse({ error: 'No se ha proporcionado ninguna pregunta.' });
    }

    const faqContext = getFaqContext();

    const prompt = `
      Eres un asistente virtual experto y servicial. Tu única tarea es responder a la pregunta del usuario basándote ESTRICTA Y ÚNICAMENTE en el siguiente contexto de Preguntas y Respuestas Frecuentes (FAQ).

      **Contexto de FAQs:**
      ${faqContext}

      **Instrucciones importantes:**
      1. Lee la "Pregunta del usuario" y busca la respuesta más relevante dentro del "Contexto de FAQs".
      2. Si encuentras una respuesta directa o muy relacionada, úsala para contestar. Puedes reformularla para que suene natural, pero no añadas información que no esté en el contexto.
      3. Si la respuesta no se encuentra en el contexto, DEBES responder amablemente que no tienes la información necesaria en tu base de conocimiento. No intentes adivinar ni usar conocimiento externo.
      4. Responde siempre en español.
      5. Utiliza formato Markdown para mejorar la legibilidad si es necesario (listas, negritas, etc.).

      **Pregunta del usuario:**
      "${userQuestion}"

      **Respuesta:**
    `;

    const geminiResponse = callGeminiAPI(prompt, apiKey);
    
    return createJsonResponse({ answer: geminiResponse });

  } catch (error) {
    Logger.log(`Error en doPost: ${error.toString()}`);
    return createJsonResponse({ error: `Ha ocurrido un error en el servidor: ${error.message}` });
  }
}

/**
 * Obtiene todas las FAQs de la hoja de cálculo y las formatea como texto.
 * @returns {string} - Una cadena de texto con todas las FAQs formateadas.
 */
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

/**
 * Llama a la API de Gemini con el prompt proporcionado.
 * @param {string} prompt - El prompt completo para la IA.
 * @param {string} apiKey - Tu clave API de Gemini.
 * @returns {string} - La respuesta de texto generada por la IA.
 */
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

/**
 * Crea un objeto de respuesta JSON estándar para el cliente.
 * @param {object} data - El objeto a serializar en JSON.
 * @returns {ContentService.TextOutput} - La respuesta JSON con cabeceras CORS.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*');
}
