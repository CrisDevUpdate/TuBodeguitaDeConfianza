/* core/helpers.js - shared pure utilities */
window.InventoryApp = window.InventoryApp || {};

function escaparHtmlInventario(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizarTextoBusqueda(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function referenciaNormalizada(ref) {
    return String(ref || '')
        .trim()
        .replace(/[\s-]+/g, '')
        .toUpperCase();
}

function normalizarMontoTransaccion(valor) {
    let texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    texto = texto.replace(/\s/g, '');
    if (texto.includes(',') && texto.includes('.')) {
        const ultimo = Math.max(texto.lastIndexOf(','), texto.lastIndexOf('.'));
        const entero = texto.slice(0, ultimo).replace(/[.,]/g, '');
        const decimal = texto.slice(ultimo + 1).replace(/\D/g, '');
        texto = `${entero}.${decimal}`;
    } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
}

function fechaHoraActual() {
    return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

window.InventoryApp.Helpers = Object.freeze({
    escaparHtmlInventario,
    normalizarTextoBusqueda,
    referenciaNormalizada,
    normalizarMontoTransaccion,
    fechaHoraActual
});
