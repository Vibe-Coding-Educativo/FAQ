/**
 * @OnlyCurrentDoc
 * Backend y servidor web para la aplicación de gestión de FAQ.
 * Versión final con todas las funciones para el editor avanzado.
 */

// --- CONSTANTES GLOBALES ---
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1JuiO4-mm_SJRUaERW3soThRn-LpZMy1R3x3RRuc0ArU/edit';
const SHEET_NAME = 'FAQ';

/**
 * Maneja todas las peticiones POST desde las aplicaciones web.
 */
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
      case 'updateData':
        response = updateData(body.data);
        break;
      case 'deleteData':
        response = deleteData(body.data);
        break;
      case 'manageCategories':
        response = manageCategories(body.data);
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
 * Obtiene todos los datos de la FAQ.
 * VERSIÓN DEFINITIVA: Robusta, no depende del orden de las columnas y es inmune a los acentos.
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

    const headerRow = values.shift();
    
    const headerMap = {};
    headerRow.forEach((header, index) => {
      const normalizedHeader = header.toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Elimina acentos
        .toLowerCase()
        .trim()
        .replace(/\s/g, '_');
      
      if (normalizedHeader) {
        headerMap[normalizedHeader] = index;
      }
    });
    
    const data = values.map((row, index) => {
      const obj = {
        rowIndex: index + 2
      };
      
      const preguntaIndex = headerMap['pregunta'];
      const respuestaIndex = headerMap['respuesta'];
      const categoriasIndex = headerMap['categorias'];
      const palabrasClaveIndex = headerMap['palabras_clave'];

      obj.pregunta = (preguntaIndex !== undefined) ? row[preguntaIndex] || '' : '';
      obj.respuesta = (respuestaIndex !== undefined) ? row[respuestaIndex] || '' : '';
      
      const categoriasRaw = (categoriasIndex !== undefined) ? row[categoriasIndex] || '' : '';
      obj.categorias = categoriasRaw ? categoriasRaw.toString().split(',').map(item => item.trim()).filter(Boolean) : [];
      
      const palabrasClaveRaw = (palabrasClaveIndex !== undefined) ? row[palabrasClaveIndex] || '' : '';
      obj.palabras_clave = palabrasClaveRaw ? palabrasClaveRaw.toString().split(',').map(item => item.trim()).filter(Boolean) : [];

      if (obj.pregunta || obj.respuesta) {
        return obj;
      }
      return null;
    }).filter(Boolean);

    return { status: 'success', data: data };
  } catch (error) {
    Logger.log(`Error en getData: ${error.toString()}`);
    return { status: 'error', message: `Error inesperado al leer la hoja: ${error.toString()}` };
  }
}

/**
 * Añade nuevas filas de datos a la hoja de cálculo.
 */
function addData(data) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
     if (!sheet) {
      throw new Error(`La hoja con el nombre "${SHEET_NAME}" no se encuentra.`);
    }
    
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Pregunta', 'Respuesta', 'Categorias', 'Palabras_clave']);
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

/**
 * Actualiza una fila específica en la hoja de cálculo.
 */
function updateData(payload) {
  const { rowIndex, rowData } = payload;
  if (!rowIndex || !rowData) {
    return { status: 'error', message: 'Faltan datos (rowIndex o rowData) para la actualización.' };
  }
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    const range = sheet.getRange(rowIndex, 1, 1, 4); 
    
    const categoriasStr = Array.isArray(rowData.categorias) ? rowData.categorias.join(', ') : '';
    const palabrasClaveStr = Array.isArray(rowData.palabras_clave) ? rowData.palabras_clave.join(', ') : '';

    range.setValues([[
      rowData.pregunta,
      rowData.respuesta,
      categoriasStr,
      palabrasClaveStr
    ]]);

    return { status: 'success', message: `Fila ${rowIndex} actualizada.` };
  } catch (error) {
    Logger.log(`Error al actualizar fila ${rowIndex}: ${error.toString()}`);
    return { status: 'error', message: `Error al actualizar: ${error.toString()}` };
  }
}

/**
 * Elimina una fila específica de la hoja de cálculo.
 */
function deleteData(payload) {
  const { rowIndex } = payload;
  if (!rowIndex) {
    return { status: 'error', message: 'Falta el índice de la fila (rowIndex) para eliminar.' };
  }
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    sheet.deleteRow(rowIndex);
    return { status: 'success', message: `Fila ${rowIndex} eliminada.` };
  } catch (error) {
    Logger.log(`Error al eliminar fila ${rowIndex}: ${error.toString()}`);
    return { status: 'error', message: `Error al eliminar: ${error.toString()}` };
  }
}

/**
 * Gestiona operaciones de categorías (renombrar, eliminar) en toda la hoja.
 */
function manageCategories(payload) {
  const { operation, oldName, newName, name } = payload;
  
  if (!operation || !(oldName || name)) {
    return { status: 'error', message: 'Operación o nombre de categoría no especificado.' };
  }

  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SHEET_NAME);
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    const headers = values[0].map(h => h.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s/g, '_'));
    const catIndex = headers.indexOf('categorias');
    
    if (catIndex === -1) {
      throw new Error('No se encontró la columna "Categorias" en la hoja.');
    }

    let modifiedCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let categoriesStr = row[catIndex] || '';
      if (!categoriesStr) continue;

      let categoriesArr = categoriesStr.split(',').map(c => c.trim()).filter(Boolean);
      let originalLength = categoriesArr.length;
      let needsUpdate = false;

      if (operation === 'rename') {
        const indexToRename = categoriesArr.indexOf(oldName);
        if (indexToRename !== -1) {
          categoriesArr[indexToRename] = newName.trim();
          needsUpdate = true;
        }
      } else if (operation === 'delete') {
        categoriesArr = categoriesArr.filter(c => c !== name);
        if (categoriesArr.length < originalLength) {
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        values[i][catIndex] = categoriesArr.join(', ');
        modifiedCount++;
      }
    }
    
    if (modifiedCount > 0) {
      range.setValues(values);
      return { status: 'success', message: `Operación completada. Se actualizaron ${modifiedCount} registros.` };
    } else {
      return { status: 'success', message: 'Operación completada. No se encontraron registros que modificar.' };
    }

  } catch (error) {
    Logger.log(`Error en manageCategories: ${error.toString()}`);
    return { status: 'error', message: `Error al gestionar categorías: ${error.toString()}` };
  }
}
