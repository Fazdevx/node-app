const CSRF_COOKIE = 'XSRF-TOKEN';
const METODOS_PELIGROSOS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function tokenCsrf() {
    const inicio = document.cookie.indexOf(`${CSRF_COOKIE}=`);
    if (inicio === -1) {
        return '';
    }
    const desde = inicio + CSRF_COOKIE.length + 1;
    const hasta = document.cookie.indexOf(';', desde);
    const valor = hasta === -1 ? document.cookie.slice(desde) : document.cookie.slice(desde, hasta);
    try {
        return decodeURIComponent(valor);
    } catch {
        return valor;
    }
}

/**
 * fetch con CSRF estilo Laravel: en mutaciones se envía la cabecera
 * X-XSRF-TOKEN con la cookie XSRF-TOKEN emitida por el servidor.
 */
export async function api(ruta, opciones = {}) {
    const { headers, ...resto } = opciones;
    const metodo = String(resto.method || 'GET').toUpperCase();

    const cabeceras = { Accept: 'application/json' };
    if (resto.body !== undefined) {
        cabeceras['Content-Type'] = 'application/json';
    }
    if (METODOS_PELIGROSOS.includes(metodo)) {
        const token = tokenCsrf();
        if (token) {
            cabeceras['X-XSRF-TOKEN'] = token;
        }
    }
    Object.assign(cabeceras, headers);

    const respuesta = await fetch(ruta, { ...resto, method: metodo, headers: cabeceras });

    if (respuesta.status === 419) {
        throw new Error('La sesión expiró. Recarga la página e inténtalo de nuevo.');
    }

    let datos = null;
    if (respuesta.headers.get('content-type')?.includes('application/json')) {
        datos = await respuesta.json().catch(() => ({}));
    }

    if (!respuesta.ok) {
        const error = new Error(datos?.message || 'No se pudo completar la solicitud.');
        error.status = respuesta.status;
        error.datos = datos;
        throw error;
    }

    return datos;
}

export const GET = (ruta) => api(ruta);

export const POST = (ruta, body) => api(ruta, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
});