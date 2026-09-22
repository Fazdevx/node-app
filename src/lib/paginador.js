import { config } from '../config.js';

/**
 * Paginador con la forma del paginador de Laravel (lo que consume
 * el componente React Paginacion).
 */
export function paginar(pagina, total, perPagina = 20, uri = '/?') {
    const ultima = Math.max(1, Math.ceil(total / perPagina));
    const actual = Math.min(Math.max(1, Number(pagina) || 1), ultima);

    const from = total === 0 ? null : (actual - 1) * perPagina + 1;
    const to = total === 0 ? null : Math.min(actual * perPagina, total);

    const conSeparador = uri.includes('?') ? '&' : '?';
    const construir = (p) => `${uri}${conSeparador}page=${p}`;

    const links = [{
        url: actual > 1 ? construir(actual - 1) : null,
        label: '&laquo; Anterior',
        active: false,
    }];
    for (let p = 1; p <= ultima; p += 1) {
        links.push({ url: construir(p), label: String(p), active: p === actual });
    }
    links.push({
        url: actual < ultima ? construir(actual + 1) : null,
        label: 'Siguiente &raquo;',
        active: false,
    });

    return {
        current_page: actual,
        data: [],
        first_page_url: construir(1),
        from,
        last_page: ultima,
        last_page_url: construir(ultima),
        links,
        next_page_url: actual < ultima ? construir(actual + 1) : null,
        path: uri.split('?')[0],
        per_page: perPagina,
        prev_page_url: actual > 1 ? construir(actual - 1) : null,
        to,
        total,
    };
}

export const PAGINAS_POR_PAGINA = 20;