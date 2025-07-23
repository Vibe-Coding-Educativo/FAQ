/**
 * @OnlyCurrentDoc
 * Backend y servidor web para la aplicación de gestión de FAQ.
 */

// --- CONSTANTES GLOBALES ---
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU/edit';
const SHEET_NAME = 'FAQ';

// La función doPost es la que realmente maneja las peticiones desde GitHub.
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let response;

    switch (body.action) {
      case 'getApiKey':
        response = getApiKey();
        break;
      case 'getData':
        response = getData();
        break;
      case 'addData':
        response = addData(body.data);
        break;
      default:
        response = { status: 'error', message: 'Acción no reconocida' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(error.toString());
    const errorResponse = { status: 'error', message: error.toString() };
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Obtiene la API Key de las propiedades del script.
 * @returns {Object} - Un objeto con la API key.
 */
function getApiKey() {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!apiKey) {
      throw new Error('La propiedad "API_KEY" no está configurada en las propiedades del script.');
    }
    return { status: 'success', apiKey: apiKey };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: error.toString() };
  }
}

/**
 * Obtiene todos los datos de la hoja de cálculo de la FAQ.
 * @returns {Object} - Un objeto con los datos de la FAQ.
 */
function getData() {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    if (!sheet) {
        return { status: 'success', data: [] };
    }
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length < 2) {
      return { status: 'success', data: [] };
    }

    // **CORRECCIÓN CLAVE**: Se valida que las cabeceras sean las esperadas.
    const headers = values.shift().map(h => h.toString().toLowerCase().trim().replace(/\s/g, '_'));
    const expectedHeaders = ['pregunta', 'respuesta', 'categorías', 'palabras_clave'];
    
    // Comprobamos si la primera cabecera es la que esperamos. Si no, es que la hoja está mal formateada.
    if(headers[0] !== expectedHeaders[0]){
      throw new Error(`Las cabeceras de la hoja de cálculo son incorrectas. Se esperaba "Pregunta" pero se encontró "${headers[0]}". Por favor, revisa la primera fila de tu Google Sheet.`);
    }

    const data = values.map(row => {
      const obj = {};
      expectedHeaders.forEach((header, i) => {
        // Asignamos los valores basándonos en las cabeceras esperadas para evitar errores.
        const cellValue = row[i] || '';
        if (header === 'categorías' || header === 'palabras_clave') {
          obj[header] = cellValue ? cellValue.toString().split(',').map(item => item.trim()) : [];
        } else {
          obj[header] = cellValue;
        }
      });
      return obj;
    });

    return { status: 'success', data: data };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: `Error al leer la hoja de cálculo: ${error.toString()}` };
  }
}

/**
 * Añade nuevas filas de datos a la hoja de cálculo.
 * @param {Array<Object>} data - Un array de objetos, donde cada objeto es una nueva FAQ.
 * @returns {Object} - Un objeto con el estado de la operación.
 */
function addData(data) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
     if (!sheet) {
      throw new Error(`La hoja con el nombre "${SHEET_NAME}" no se encuentra.`);
    }
    
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Pregunta', 'Respuesta', 'Categorías', 'Palabras clave']);
    }

    const rowsToAdd = data.map(item => {
      const categoriasStr = Array.isArray(item.categorias) ? item.categorias.join(', ') : '';
      const palabrasClaveStr = Array.isArray(item.palabras_clave) ? item.palabras_clave.join(', ') : '';
      
      return [
        item.pregunta || '',
        item.respuesta || '',
        categoriasStr,
        palabrasClaveStr
      ];
    });

    if (rowsToAdd.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }
    
    return { status: 'success', message: `${rowsToAdd.length} fila(s) añadida(s) con éxito.` };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: `Error al escribir en la hoja de cálculo: ${error.toString()}` };
  }
}
