/**
 * @OnlyCurrentDoc
 * Backend y servidor web para la aplicación de gestión de FAQ.
 */

// --- CONSTANTES GLOBALES ---
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU/edit';
const SHEET_NAME = 'FAQ';

// --- UTILIDADES DE RESPUESTA HTTP ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (payload) => {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

  if (typeof output.setHeader === 'function') {
    Object.entries(corsHeaders).forEach(([key, value]) => output.setHeader(key, value));
  }
  return output;
};

// --- FUNCIONES DE UTILIDAD ---
const norm = s => s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, '_');
const splitList = v => v ? v.toString().split(/[;,|]/).map(x => x.trim()).filter(Boolean) : [];
const toCsvString = v => Array.isArray(v) ? v.join(', ') : (v || '');


// --- GESTOR DE PETICIONES ---
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
      // --- ACCIONES AÑADIDAS ---
      case 'updateData':
        response = updateData(body.data);
        break;
      case 'deleteData':
        response = deleteData(body.data);
        break;
      case 'manageCategories':
        response = manageCategories(body.data);
        break;
      // --- FIN DE ACCIONES AÑADIDAS ---
      default:
        response = { status: 'error', message: 'Acción no reconocida' };
    }
    
    return jsonResponse(response);
  } catch (error) {
    Logger.log(error.toString());
    const errorResponse = { status: 'error', message: error.toString() };
    return jsonResponse(errorResponse);
  }
}

function doGet() {
  return jsonResponse({ status: 'ok', message: 'FAQ backend activo' });
}

// --- FUNCIONES DE ACCESO A DATOS (API) ---

function getApiKey() {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!apiKey) throw new Error('La propiedad "API_KEY" no está configurada.');
    return { status: 'success', apiKey: apiKey };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: error.toString() };
  }
}

function getData() {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    if (!sheet) return { status: 'success', data: [] };
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length < 1) return { status: 'success', data: [] };

    const headers = values.shift();
    const headerIdx = {};
    headers.forEach((h, i) => headerIdx[norm(h)] = i);

    if (!('pregunta' in headerIdx)) {
        return { status: 'success', data: [] }; // Si no hay pregunta, probablemente está vacía
    }
    
    const data = values.map((row, index) => {
      const getCell = key => {
        const idx = headerIdx[key];
        return idx != null ? row[idx] : '';
      };
      
      const categoriasValue = getCell('categorias') || getCell('categorías');
      return {
        rowIndex: index + 2, // El índice real en la hoja (2 porque la cabecera es la 1)
        pregunta: getCell('pregunta'),
        respuesta: getCell('respuesta'),
        categorías: splitList(categoriasValue),
        palabras_clave: splitList(getCell('palabras_clave'))
      };
    });
    const filtered = data.filter(item => {
      const question = (item.pregunta || '').toString().trim();
      const answer = (item.respuesta || '').toString().trim();
      const cats = Array.isArray(item['categorías']) ? item['categorías'] : [];
      const kws = Array.isArray(item.palabras_clave) ? item.palabras_clave : [];
      const hasArrays = cats.length > 0 || kws.length > 0;
      return question || answer || hasArrays;
    });
    
    return { status: 'success', data: filtered };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: `Error al leer la hoja: ${error.toString()}` };
  }
}

function addData(data) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`La hoja "${SHEET_NAME}" no se encuentra.`);

    let headers;
    if (sheet.getLastRow() === 0) {
        headers = ['Pregunta', 'Respuesta', 'Categorías', 'Palabras clave'];
        sheet.appendRow(headers);
    } else {
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    const rowsToAdd = data.map(item => {
      const rowData = {};
      rowData['pregunta'] = item.pregunta || '';
      rowData['respuesta'] = item.respuesta || '';
      rowData['categorias'] = toCsvString(item.categorías || item.categorias);
      rowData['categorías'] = rowData['categorias'];
      rowData['palabras_clave'] = toCsvString(item.palabras_clave);
      return headers.map(header => rowData[norm(header)] || '');
    });

    if (rowsToAdd.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }
    
    return { status: 'success', message: `${rowsToAdd.length} fila(s) añadida(s) con éxito.` };
  } catch (error) {
    Logger.log(error.toString());
    return { status: 'error', message: `Error al escribir en la hoja: ${error.toString()}` };
  }
}

// --- NUEVA FUNCIÓN ---
function updateData(data) {
  try {
    const { rowIndex, rowData } = data;
    if (!rowIndex || !rowData) throw new Error('Faltan rowIndex o rowData para actualizar.');
    
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`La hoja "${SHEET_NAME}" no se encuentra.`);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const newRow = headers.map(header => {
        const key = norm(header);
        switch(key) {
            case 'pregunta':       return rowData.pregunta || '';
            case 'respuesta':      return rowData.respuesta || '';
            case 'categorias':
            case 'categorías':     return toCsvString(rowData.categorías || rowData.categorias);
            case 'palabras_clave': return toCsvString(rowData.palabras_clave);
            default:               return rowData[key] || '';
        }
    });

    sheet.getRange(parseInt(rowIndex), 1, 1, newRow.length).setValues([newRow]);
    
    return { status: 'success', message: 'Fila actualizada correctamente.' };
  } catch (error) {
    Logger.log(`Error en updateData: ${error.toString()}`);
    return { status: 'error', message: `Error al actualizar la fila: ${error.toString()}` };
  }
}

// --- NUEVA FUNCIÓN ---
function deleteData(data) {
  try {
    const { rowIndex } = data;
    if (!rowIndex) throw new Error('Falta rowIndex para eliminar la fila.');
    
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`La hoja "${SHEET_NAME}" no se encuentra.`);

    sheet.deleteRow(parseInt(rowIndex));

    return { status: 'success', message: 'Fila eliminada correctamente.' };
  } catch (error) {
    Logger.log(`Error en deleteData: ${error.toString()}`);
    return { status: 'error', message: `Error al eliminar la fila: ${error.toString()}` };
  }
}

// --- NUEVA FUNCIÓN ---
function manageCategories(data) {
    try {
        const { operation, oldName, newName, name } = data;
        const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error(`La hoja "${SHEET_NAME}" no se encuentra.`);

        const range = sheet.getDataRange();
        const values = range.getValues();
        if (values.length < 2) return { status: 'success', message: 'No hay datos para modificar.' };
        
        const headers = values.shift();
        const headerIdx = {};
        headers.forEach((h, i) => headerIdx[norm(h)] = i);

        const catIdx = headerIdx['categorias'] ?? headerIdx['categorías'];
        if (catIdx == null) throw new Error('No se encuentra la columna de categorías.');

        let modifiedCount = 0;
        const newValues = values.map(row => {
            let categories = splitList(row[catIdx]);
            let hasChanged = false;

            if (operation === 'rename' && oldName && newName && categories.includes(oldName)) {
                categories = categories.map(c => c === oldName ? newName : c);
                hasChanged = true;
            } else if (operation === 'delete' && name && categories.includes(name)) {
                categories = categories.filter(c => c !== name);
                hasChanged = true;
            }

            if (hasChanged) {
                row[catIdx] = toCsvString(categories);
                modifiedCount++;
            }
            return row;
        });

        if (modifiedCount > 0) {
            sheet.getRange(2, 1, newValues.length, newValues[0].length).setValues(newValues);
        }

        return { status: 'success', message: `Operación '${operation}' completada. ${modifiedCount} fila(s) afectada(s).` };
    } catch (error) {
        Logger.log(`Error en manageCategories: ${error.toString()}`);
        return { status: 'error', message: `Error al gestionar categorías: ${error.toString()}` };
    }
}
