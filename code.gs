const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyuUrtNb72Faij5gp7qtgh-6_0Dh28YUiHW6_h-cc-ev92RkKiBKAJzlfN7eUndE0CsEw/exec';

// --- Estado Global ---
let allFaqs = [];
let duplicateData = {};
let currentRowToReplace = null;

// --- Elementos del DOM (Generales) ---
const loader = document.getElementById('loader');
const resultDiv = document.getElementById('result');
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(button.dataset.view).classList.add('active');
        if (button.dataset.view === 'manage-view') {
            loadAndRenderFaqs();
        }
    });
});

// --- Elementos del DOM (Vista Añadir) ---
// (Aquí se pegarían todos los getElementById de la vista de añadir)
const generateBtn = document.getElementById('generateBtn');

// --- Elementos del DOM (Vista Gestionar) ---
const searchInput = document.getElementById('searchInput');
const faqListContainer = document.getElementById('faq-list-container');

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


// --- Inicialización ---
function initializeAddView() {
    // Clona el contenido de la vista de añadir desde un template
    const addView = document.getElementById('add-view');
    addView.innerHTML = `
        <div class="tabs">
            <button class="tab-button active" onclick="showTab('single')">Entrada Individual</button>
            <button class="tab-button" onclick="showTab('bulk')">Entrada Múltiple</button>
        </div>
        <div id="single-entry-tab" class="tab-content active"> ... </div>
        <div id="bulk-entry-tab" class="tab-content"> ... </div>
        <div id="duplicate-alert"> ... </div>
        <div id="review-form"> ... </div>
    `;
    // Aquí se añadirían los event listeners para los botones de esta vista
}
// NOTA: Para mantener la brevedad, el script completo de la vista "Añadir" no se ha replicado aquí.
// El script completo de la versión anterior se debe integrar en este nuevo marco.
// A continuación se muestra la nueva lógica para la vista de GESTIÓN.

// --- Lógica de la Vista de Gestión ---

searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        renderFaqList(allFaqs);
        return;
    }
    const filteredFaqs = allFaqs.filter(faq => {
        return faq.Pregunta.toLowerCase().includes(searchTerm) ||
               faq.Respuesta.toLowerCase().includes(searchTerm) ||
               faq.Categorias.toLowerCase().includes(searchTerm) ||
               faq.PalabrasClave.toLowerCase().includes(searchTerm);
    });
    renderFaqList(filteredFaqs);
});

async function loadAndRenderFaqs() {
    setLoading(true);
    const result = await callApi({ action: 'getFaqs' });
    setLoading(false);
    if (result && result.success) {
        allFaqs = result.data;
        renderFaqList(allFaqs);
    }
}

function renderFaqList(faqs) {
    faqListContainer.innerHTML = '';
    if (faqs.length === 0) {
        faqListContainer.innerHTML = '<p>No se encontraron FAQs.</p>';
        return;
    }
    faqs.forEach(faq => {
        const item = document.createElement('div');
        item.className = 'faq-item';
        item.innerHTML = `
            <p>${faq.Pregunta}</p>
            <div class="faq-item-buttons">
                <button id="edit-btn">Editar</button>
                <button id="delete-btn">Borrar</button>
            </div>
        `;
        item.querySelector('#edit-btn').addEventListener('click', () => openEditModal(faq));
        item.querySelector('#delete-btn').addEventListener('click', () => handleDelete(faq.rowNumber));
        faqListContainer.appendChild(item);
    });
}

// --- Lógica del Modal de Edición ---

function openEditModal(faq) {
    modalRowNumber.value = faq.rowNumber;
    modalPregunta.value = faq.Pregunta;
    modalRespuesta.value = faq.Respuesta;
    updateMarkdownPreview(modalRespuesta.value, modalMarkdownPreview);
    
    clearContainer(modalCategoriasContainer);
    (faq.Categorias || '').split(/[,;]/).forEach(tag => createTag(tag, modalCategoriasContainer));

    clearContainer(modalPalabrasClaveContainer);
    (faq.PalabrasClave || '').split(/[,;]/).forEach(tag => createTag(tag, modalPalabrasClaveContainer));

    editModal.style.display = 'flex';
}

modalCancelBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

modalSaveBtn.addEventListener('click', async () => {
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
    
    if (result && result.success) {
        editModal.style.display = 'none';
        showResult(result.message, 'success');
        loadAndRenderFaqs(); // Recargar la lista
    }
});

async function handleDelete(rowNumber) {
    if (confirm(`¿Seguro que quieres borrar la FAQ de la fila ${rowNumber}? Esta acción no se puede deshacer.`)) {
        setLoading(true);
        const result = await callApi({ action: 'deleteFaq', rowNumber });
        setLoading(false);
        if (result && result.success) {
            showResult(result.message, 'success');
            loadAndRenderFaqs(); // Recargar la lista
        }
    }
}

// --- Lógica de la API (general) ---
async function callApi(payload) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!result.success) {
            showResult(result.message, 'error');
        }
        return result;
    } catch (error) {
        showResult('Error de conexión con el script: ' + error.message, 'error');
        return null;
    }
}

// --- Funciones de ayuda ---
// (Aquí se pegarían las funciones de ayuda como setLoading, showResult, createTag, etc.)
function setLoading(isLoading) { loader.style.display = isLoading ? 'block' : 'none'; }
function showResult(message, type) { resultDiv.textContent = message; resultDiv.className = `result-message ${type}`; resultDiv.style.display = 'block'; setTimeout(() => resultDiv.style.display = 'none', 4000); }
function createTag(text, container) { const tagText = text.trim(); if (!tagText) return; const tagEl = document.createElement('div'); tagEl.className = 'tag'; tagEl.innerHTML = `<span>${tagText}</span><span class="remove-tag" title="Eliminar">x</span>`; tagEl.querySelector('.remove-tag').addEventListener('click', () => tagEl.remove()); container.appendChild(tagEl); }
function getTagsAsString(container, separator) { return Array.from(container.querySelectorAll('.tag span:first-child')).map(t => t.textContent).join(separator); }
function clearContainer(container) { container.innerHTML = ''; }
function updateMarkdownPreview(markdownText, previewElement) { previewElement.innerHTML = marked.parse(markdownText); }
// ... y el resto del script de la vista de añadir.
