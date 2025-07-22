const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyuUrtNb72Faij5gp7qtgh-6_0Dh28YUiHW6_h-cc-ev92RkKiBKAJzlfN7eUndE0CsEw/exec';

// --- Estado Global ---
let allFaqs = [];
let allFilters = { categories: [], keywords: [] };
let activeFilter = { type: null, value: null };
let duplicateData = {};
let currentRowToReplace = null;

// --- Elementos del DOM (Generales) ---
const loader = document.getElementById('loader');
const resultDiv = document.getElementById('result');

// --- Lógica de Navegación Principal ---
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(e.currentTarget.dataset.view).classList.add('active');
        if (e.currentTarget.dataset.view === 'manage-view') {
            loadAndRenderManageView();
        }
    });
});

// --- Elementos del DOM (Vista Añadir) ---
const generateBtn = document.getElementById('generateBtn');
const refineBtn = document.getElementById('refineBtn');
const addBtn = document.getElementById('addBtn');
const replaceBtn = document.getElementById('replaceBtn');
const discardBtn = document.getElementById('discardBtn');
const bulkProcessBtn = document.getElementById('bulkProcessBtn');
const categorizeOnlyCheckbox = document.getElementById('categorizeOnlyCheckbox');
const reviewForm = document.getElementById('review-form');
const duplicateAlert = document.getElementById('duplicate-alert');
const reviewPregunta = document.getElementById('reviewPregunta');
const reviewRespuesta = document.getElementById('reviewRespuesta');
const markdownPreview = document.getElementById('markdown-preview');
const refinementInput = document.getElementById('refinementInput');
const categoriasContainer = document.getElementById('categoriasContainer');
const addCategoriaInput = document.getElementById('addCategoriaInput');
const palabrasClaveContainer = document.getElementById('palabrasClaveContainer');
const addPalabraClaveInput = document.getElementById('addPalabraClaveInput');
const existingQuestionDiv = document.getElementById('existing-question');
const suggestedQuestionDiv = document.getElementById('suggested-question');
const normalGenerationSection = document.getElementById('normal-generation-section');
const categorizeOnlySection = document.getElementById('categorize-only-section');
const userInput = document.getElementById('userInput');
const categorizeQuestion = document.getElementById('categorize-question');
const categorizeAnswer = document.getElementById('categorize-answer');
const bulkInput = document.getElementById('bulkInput');

// --- Elementos del DOM (Vista Gestionar) ---
const searchInput = document.getElementById('searchInput');
const faqListContainer = document.getElementById('faq-list-container');
const categoryFiltersContainer = document.getElementById('category-filters');
const keywordFiltersContainer = document.getElementById('keyword-filters');

// --- Elementos del DOM (Modal Edición) ---
const editModal = document.getElementById('edit-modal');
const modalRowNumber = document.getElementById('modal-row-number');
const modalPregunta = document.getElementById('modal-pregunta');
const modalRespuesta = document.getElementById('modal-respuesta');
const modalMarkdownPreview = document.getElementById('modal-markdown-preview');
const modalCategoriasContainer = document.getElementById('modal-categorias-container');
const modalAddCategoria = document.getElementById('modal-add-categoria');
const modalPalabrasClaveContainer = document.getElementById('modal-palabrasclave-container');
const modalAddPalabraClave = document.getElementById('modal-add-palabraclave');
const modalSaveBtn = document.getElementById('modal-save');
const modalCancelBtn = document.getElementById('modal-cancel');

// --- Event Listeners ---
generateBtn.addEventListener('click', handleGenerate);
refineBtn.addEventListener('click', handleRefine);
addBtn.addEventListener('click', handleSave);
replaceBtn.addEventListener('click', handleReplace);
discardBtn.addEventListener('click', handleDiscard);
bulkProcessBtn.addEventListener('click', handleBulkProcess);
categorizeOnlyCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    normalGenerationSection.style.display = isChecked ? 'none' : 'block';
    categorizeOnlySection.style.display = isChecked ? 'block' : 'none';
});
setupTagInput(addCategoriaInput, categoriasContainer);
setupTagInput(addPalabraClaveInput, palabrasClaveContainer);
reviewRespuesta.addEventListener('input', () => updateMarkdownPreview(reviewRespuesta.value, markdownPreview));
searchInput.addEventListener('input', applyFiltersAndSearch);
modalRespuesta.addEventListener('input', () => updateMarkdownPreview(modalRespuesta.value, modalMarkdownPreview));
setupTagInput(modalAddCategoria, modalCategoriasContainer);
setupTagInput(modalAddPalabraClave, modalPalabrasClaveContainer);
modalCancelBtn.addEventListener('click', () => editModal.style.display = 'none');
modalSaveBtn.addEventListener('click', handleModalSave);
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        showTab(e.currentTarget.dataset.tab);
    });
});

// --- Manejadores de eventos (Vista Añadir) ---
async function handleGenerate() {
    let payload;
    if (categorizeOnlyCheckbox.checked) {
        const question = categorizeQuestion.value.trim();
        const answer = categorizeAnswer.value.trim();
        if (!question || !answer) return showResult('Por favor, introduce la pregunta y la respuesta.', 'error');
        payload = { action: 'generate', pregunta: question, respuesta: answer, categorizeOnly: true };
    } else {
        const userText = userInput.value.trim();
        if (!userText) return showResult('Por favor, introduce un tema.', 'error');
        payload = { action: 'generate', userInput: userText, categorizeOnly: false };
    }
    currentRowToReplace = null;
    addBtn.textContent = 'Aprobar y Añadir a la Hoja de Cálculo';
    await callApi(payload);
}
async function handleBulkProcess() {
    const text = bulkInput.value.trim();
    if (!text) return showResult('El campo de texto para entrada múltiple está vacío.', 'error');
    const entries = text.split(/---\s*/);
    const qnaArray = [];
    for (const entry of entries) {
        if (!entry.trim()) continue;
        const match = entry.trim().match(/^[Pp]:\s*([\s\S]+?)\s*(\r\n|\n|\r)+\s*[Rr]:\s*([\s\S]+)$/);
        if (match && match[1] && match[3]) {
            qnaArray.push({ pregunta: match[1].trim(), respuesta: match[3].trim() });
        }
    }
    if (qnaArray.length === 0) return showResult('No se encontraron entradas válidas. Asegúrate de usar el formato "P: ... R: ... ---".', 'error');
    await callApi({ action: 'bulkAdd', qnaArray });
}
async function handleRefine() {
    const refinementInstruction = refinementInput.value.trim();
    if (!refinementInstruction) return showResult('Por favor, introduce una instrucción para refinar.', 'error');
    const previousSuggestion = { Pregunta: reviewPregunta.value, Respuesta: reviewRespuesta.value, Categorias: getTagsAsString(categoriasContainer, ';'), PalabrasClave: getTagsAsString(palabrasClaveContainer, ',') };
    await callApi({ action: 'refine', previousSuggestion, refinementInstruction });
    refinementInput.value = '';
}
async function handleSave() {
    const faqData = { pregunta: reviewPregunta.value, respuesta: reviewRespuesta.value, categorias: getTagsAsString(categoriasContainer, ';'), palabrasClave: getTagsAsString(palabrasClaveContainer, ',') };
    let payload;
    if (currentRowToReplace) {
        payload = { action: 'replace', rowNumber: currentRowToReplace, faqData };
    } else {
        payload = { action: 'add', faqData };
    }
    await callApi(payload);
}
function handleReplace() {
    currentRowToReplace = duplicateData.existing.rowNumber;
    addBtn.textContent = `Aprobar y Reemplazar Fila ${currentRowToReplace}`;
    populateReviewForm(duplicateData.suggestion);
    hideAllSections();
    reviewForm.style.display = 'block';
}
function handleDiscard() {
    hideAllSections();
    showResult('Operación cancelada. La sugerencia ha sido descartada.', 'success');
}

// --- Manejadores de eventos (Vista Gestionar y Modal) ---
function applyFiltersAndSearch() {
    let filteredList = [...allFaqs];
    const searchTerm = searchInput.value.toLowerCase();

    if (activeFilter.type && activeFilter.value) {
        const key = activeFilter.type === 'category' ? 'Categorias' : 'PalabrasClave';
        const separator = activeFilter.type === 'category' ? ';' : ',';
        filteredList = filteredList.filter(faq => 
            (faq[key] || '').toLowerCase().split(separator).map(t => t.trim()).includes(activeFilter.value)
        );
    }

    if (searchTerm) {
        filteredList = filteredList.filter(faq => {
            const question = faq.Pregunta ? faq.Pregunta.toLowerCase() : '';
            const answer = faq.Respuesta ? faq.Respuesta.toLowerCase() : '';
            const categories = faq.Categorias ? faq.Categorias.toLowerCase() : '';
            const keywords = faq.PalabrasClave ? faq.PalabrasClave.toLowerCase() : '';
            return question.includes(searchTerm) || answer.includes(searchTerm) || categories.includes(searchTerm) || keywords.includes(searchTerm);
        });
    }
    renderFaqList(filteredList);
}

async function loadAndRenderManageView() {
    setLoading(true);
    const result = await callApi({ action: 'getFaqsAndFilters' });
    setLoading(false);

    console.log('→ result.data recibido:', JSON.stringify(result.data, null, 2));

    const isSuccess = result && (result.success === true || result.ok === true || result.status === 'success');
    if (!isSuccess) {
        showResult(result.message || 'Respuesta inválida del servidor', 'error');
        return;
    }

    const rawFaqs = result.data.faqs || [];
    allFaqs = rawFaqs
        .filter(f => f.Pregunta && f.Pregunta.trim() !== '')
        .sort((a, b) => a.Pregunta.localeCompare(b.Pregunta));

    allFilters = result.data.filters || { categories: [], keywords: [] };
    renderFilterButtons();
    applyFiltersAndSearch();
}

async function handleModalSave() {
    const faqData = {
        pregunta: modalPregunta.value,
        respuesta: modalRespuesta.value,
        categorias: getTagsAsString(modalCategoriasContainer, ';'),
        palabrasClave: getTagsAsString(modalPalabrasClaveContainer, ',')
    };
    const rowNumber = modalRowNumber.value;
    setLoading(true);
    const result = await callApi({ action: 'updateFaq', rowNumber, faqData });
    setLoading(false);
    if (result && (result.success || result.ok)) {
        editModal.style.display = 'none';
        showResult(result.message, 'success');
        loadAndRenderManageView();
    }
}
async function handleDelete(rowNumber, question) {
    if (confirm(`¿Seguro que quieres borrar la pregunta "${question}"? Esta acción no se puede deshacer.`)) {
        setLoading(true);
        const result = await callApi({ action: 'deleteFaq', rowNumber });
        setLoading(false);
        if (result && (result.success || result.ok)) {
            showResult(result.message, 'success');
            loadAndRenderManageView();
        }
    }
}

// --- Lógica principal de la API ---

async function callApi(payload) {
    setLoading(true);
    if (payload.action === 'generate' || payload.action === 'bulkAdd') {
        hideAllSections();
    }
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        // registro global
        console.log(`API result [${payload.action}]:`, result);

        const isSuccess = result.success === true || result.ok === true || result.status === 'success';

        if (!isSuccess) {
            showResult(result.message || 'Error en la respuesta del script.', 'error');
        } else if (payload.action !== 'getFaqsAndFilters') {
            handleSuccess(payload.action, result);
        }
        return result;
    } catch (error) {
        showResult('Error de conexión con el script: ' + error.message, 'error');
        return null;
    } finally {
        setLoading(false);
    }
}


function handleSuccess(action, result) {
    if (action === 'add' || action === 'replace' || action === 'bulkAdd') {
        showResult(result.message || 'Operación completada.', 'success');
        userInput.value = ''; 
        categorizeQuestion.value = ''; 
        categorizeAnswer.value = ''; 
        bulkInput.value = '';
        currentRowToReplace = null;
        addBtn.textContent = 'Aprobar y Añadir a la Hoja de Cálculo';
    } else if (result.data && result.data.status === 'duplicate') {
        populateDuplicateAlert(result.data);
    } else {
        const suggestion = (result.data.status === 'new') ? result.data.suggestion : result.data;
        populateReviewForm(suggestion);
    }
}

// --- Funciones de renderizado y UI ---
function renderFaqList(faqs) {
    faqListContainer.innerHTML = '';
    if (faqs.length === 0) { 
        faqListContainer.innerHTML = '<p>No se encontraron FAQs con los filtros aplicados.</p>'; 
        return; 
    }
    faqs.forEach(faq => {
        const item = document.createElement('details');
        item.className = 'faq-item';
        const qText = faq.Pregunta || faq.pregunta || '(sin pregunta)';
        
        const answerHtml = marked.parse(faq.Respuesta || '');
        const categoriesText = (faq.Categorias || '').split(/[,;]/).filter(t => t.trim()).join(', ');
        const keywordsText = (faq.PalabrasClave || '').split(/[,;]/).filter(t => t.trim()).join(', ');

        item.innerHTML = `
            <summary>${qText}</summary>
            <div class="faq-item-content">
                ${answerHtml}
                <hr>
                <p><strong>Categorías:</strong> ${categoriesText || '<em>ninguna</em>'}</p>
                <p><strong>Palabras Clave:</strong> ${keywordsText || '<em>ninguna</em>'}</p>
                <div class="faq-item-buttons">
                    <button class="edit">Editar</button>
                    <button class="delete">Borrar</button>
                </div>
            </div>
        `;

        item.querySelector('button.edit').addEventListener('click', (e) => {
            e.preventDefault(); 
            openEditModal(faq);
        });
        item.querySelector('button.delete').addEventListener('click', (e) => {
            e.preventDefault();
            handleDelete(faq.rowNumber, qText);
        });
        faqListContainer.appendChild(item);
    });
}

function populateReviewForm(data) {
    reviewPregunta.value = data.Pregunta || ''; 
    reviewRespuesta.value = data.Respuesta || '';
    updateMarkdownPreview(reviewRespuesta.value, markdownPreview);
    clearContainer(categoriasContainer); 
    (data.Categorias || '').split(/[,;]/).forEach(tag => createTag(tag, categoriasContainer));
    clearContainer(palabrasClaveContainer); 
    (data.PalabrasClave || '').split(/[,;]/).forEach(tag => createTag(tag, palabrasClaveContainer));
    reviewForm.style.display = 'block';
}
function populateDuplicateAlert(data) {
    duplicateData = data;
    existingQuestionDiv.innerHTML = `<strong>P:</strong> ${data.existing.Pregunta}<br><strong>R:</strong> ${data.existing.Respuesta}`;
    suggestedQuestionDiv.innerHTML = `<strong>P:</strong> ${data.suggestion.Pregunta}<br><strong>R:</strong> ${data.suggestion.Respuesta}`;
    duplicateAlert.style.display = 'block';
}
function openEditModal(faq) {
    modalRowNumber.value = faq.rowNumber ?? '';
    modalPregunta.value = faq.Pregunta ?? faq.pregunta ?? '';
    modalRespuesta.value = faq.Respuesta ?? faq.respuesta ?? '';
    updateMarkdownPreview(modalRespuesta.value, modalMarkdownPreview);
    clearContainer(modalCategoriasContainer); 
    (faq.Categorias || '').split(/[,;]/).forEach(tag => createTag(tag, modalCategoriasContainer));
    clearContainer(modalPalabrasClaveContainer); 
    (faq.PalabrasClave || '').split(/[,;]/).forEach(tag => createTag(tag, modalPalabrasClaveContainer));
    editModal.style.display = 'flex';
}
function hideAllSections() { 
    reviewForm.style.display = 'none'; 
    duplicateAlert.style.display = 'none'; 
    resultDiv.style.display = 'none'; 
}
function setLoading(isLoading) {
    loader.style.display = isLoading ? 'block' : 'none';
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = isLoading);
}
function showResult(message, type) { 
    resultDiv.textContent = message; 
    resultDiv.className = `result-message ${type}`; 
    resultDiv.style.display = 'block'; 
    setTimeout(() => { resultDiv.style.display = 'none'; }, 4000); 
}
function updateMarkdownPreview(markdownText, previewElement) { 
    previewElement.innerHTML = marked.parse(markdownText || ''); 
}
function setupTagInput(inputElement, container) { 
    inputElement.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            createTag(inputElement.value, container); 
            inputElement.value = ''; 
        } 
    }); 
}
function createTag(text, container) { 
    const tagText = text.trim(); 
    if (!tagText) return; 
    const tagEl = document.createElement('div'); 
    tagEl.className = 'tag'; 
    tagEl.innerHTML = `<span>${tagText}</span><span class="remove-tag" title="Eliminar">x</span>`; 
    tagEl.querySelector('.remove-tag').addEventListener('click', () => tagEl.remove()); 
    container.appendChild(tagEl); 
}
function getTagsAsString(container, separator) { 
    return Array.from(container.querySelectorAll('.tag span:first-child')).map(t => t.textContent).join(separator); 
}
function clearContainer(container) { 
    container.innerHTML = ''; 
}
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + '-entry-tab').classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
}
function renderFilterButtons() {
    renderButtonGroup(categoryFiltersContainer, allFilters.categories, 'category');
    renderButtonGroup(keywordFiltersContainer, allFilters.keywords, 'keyword');
}
function renderButtonGroup(container, items, type) {
    container.innerHTML = '';
    const allButton = createFilterButton('Todas', type, null);
    allButton.classList.add('active');
    container.appendChild(allButton);
    items.forEach(item => container.appendChild(createFilterButton(item, type, item)));
}
function createFilterButton(text, type, value) {
    const button = document.createElement('button');
    button.className = 'filter-button';
    button.textContent = text;
    button.dataset.type = type;
    button.dataset.value = value || 'all';
    button.addEventListener('click', (e) => {
        const clickedButton = e.currentTarget;
        
        // Gestionar el estado activo dentro del mismo grupo
        const parentContainer = clickedButton.parentElement;
        parentContainer.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');

        // Resetear el otro grupo de filtros
        const otherContainerId = parentContainer.id === 'category-filters' ? '#keyword-filters' : '#category-filters';
        document.querySelector(otherContainerId).querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`${otherContainerId} .filter-button[data-value="all"]`).classList.add('active');

        activeFilter = { 
            type: clickedButton.dataset.value === 'all' ? null : type, 
            value: clickedButton.dataset.value === 'all' ? null : value 
        };
        applyFiltersAndSearch();
    });
    return button;
}
