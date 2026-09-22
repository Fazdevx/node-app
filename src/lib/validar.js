import { ErrorValidacion } from './errores.js';

const nombreCampo = (campo) => campo;

const mensajes = {
    required: (c) => `El campo ${nombreCampo(c)} es obligatorio.`,
    string: (c) => `El campo ${nombreCampo(c)} debe ser una cadena de caracteres.`,
    numeric: (c) => `El campo ${nombreCampo(c)} debe ser numérico.`,
    email: (c) => `El campo ${nombreCampo(c)} debe ser una dirección de correo válida.`,
    boolean: (c) => `El campo ${nombreCampo(c)} debe ser verdadero o falso.`,
    date: (c) => `El campo ${nombreCampo(c)} no es una fecha válida.`,
    in: (c) => `El campo ${nombreCampo(c)} seleccionado es inválido.`,
    max: (c, n) => `El campo ${nombreCampo(c)} no debe superar el máximo de ${n} caracteres.`,
    min: (c, n) => `El campo ${nombreCampo(c)} debe ser al menos ${n}.`,
    maxNum: (c, n) => `El campo ${nombreCampo(c)} no debe ser mayor que ${n}.`,
    minNum: (c, n) => `El campo ${nombreCampo(c)} debe ser como mínimo ${n}.`,
    regex: (c) => `El formato del campo ${nombreCampo(c)} es inválido.`,
    date_format: (c, f) => `El campo ${nombreCampo(c)} no coincide con el formato ${f}.`,
    before: (c) => `El campo ${nombreCampo(c)} debe ser una fecha anterior a hoy.`,
    before_or_equal: (c) => `El campo ${nombreCampo(c)} debe ser una fecha anterior o igual a hoy.`,
    size: (c, n) => `El campo ${nombreCampo(c)} debe tener exactamente ${n} caracteres.`,
};

/**
 * Valida un objeto de entrada contra un mapa de reglas (estilo Laravel).
 *
 * reglas: { campo: ['required', 'string', 'max:30', 'in:a,b', 'regex:/x/', ...] }
 *
 * Reglas disponibles: required, nullable, string, email, boolean, numeric,
 * date, in:a,b,c, max:N (cadena), min:N (numérico), max:N/numérico, regex:/…/,
 * date_format:Y-m-d, before:today, before_or_equal:today, size:N,
 * required_without:campo, required_with:a,b.
 */
export function validar(datos, reglas, mensajesCustom = {}) {
    const errores = {};

    for (const [campo, lista] of Object.entries(reglas)) {
        const valor = datos?.[campo];
        const esVacio = valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
        const tieneRequired = lista.some((r) => r === 'required');
        const tieneNullable = lista.some((r) => r === 'nullable');

        // required_with{out}: el campo es obligatorio si cierto otro existe / no existe.
        let requerimientoAdicional = false;
        for (const r of lista) {
            if (r.startsWith('required_with:')) {
                const otros = r.slice('required_with:'.length).split(',');
                if (otros.some((o) => {
                    const v = datos?.[o];
                    return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
                })) {
                    requerimientoAdicional = true;
                }
            }
            if (r.startsWith('required_without:')) {
                const otros = r.slice('required_without:'.length).split(',');
                if (otros.every((o) => {
                    const v = datos?.[o];
                    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
                })) {
                    requerimientoAdicional = true;
                }
            }
        }

        const obligatorio = tieneRequired || requerimientoAdicional;

        if (esVacio && obligatorio) {
            errores[campo] = msg('required', campo);
            continue;
        }

        if (esVacio && (tieneNullable || !obligatorio)) {
            continue;
        }

        const ponerMensaje = (r, params = []) => {
            if (!(campo in errores)) {
                errores[campo] = (mensajesCustom[campo] && mensajesCustom[campo][r]) || mensajes[r](campo, ...params);
            }
        };

        for (const r of lista) {
            if (r === 'required' || r === 'nullable' || r.startsWith('required_')) {
                continue;
            }
            if (r === 'string') {
                if (typeof valor !== 'string') {
                    ponerMensaje('string');
                }
            } else if (r === 'email') {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor ?? ''))) {
                    ponerMensaje('email');
                }
            } else if (r === 'boolean') {
                if (!['0', '1', 1, 0, true, false, 'true', 'false', 'on'].includes(valor)) {
                    ponerMensaje('boolean');
                }
            } else if (r === 'numeric') {
                const n = Number(valor);
                if (valor === '' || !Number.isFinite(n)) {
                    ponerMensaje('numeric');
                }
            } else if (r === 'date') {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || Number.isNaN(Date.parse(valor))) {
                    ponerMensaje('date');
                }
            } else if (r.startsWith('in:')) {
                const permitidos = r.slice(3).split(',');
                if (!permitidos.includes(String(valor))) {
                    ponerMensaje('in');
                }
            } else if (r.startsWith('regex:')) {
                const match = r.match(/^regex:\/(.*)\/$/);
                const re = new RegExp(match?.[1] ?? '');
                if (!re.test(String(valor))) {
                    ponerMensaje('regex');
                }
            } else if (r.startsWith('max:')) {
                const n = Number(r.slice(4));
                if (typeof valor === 'number' && Number(valor) > n) {
                    ponerMensaje('maxNum', [n]);
                } else if (typeof valor === 'string' && String(valor).length > n) {
                    ponerMensaje('max', [n]);
                }
            } else if (r.startsWith('min:')) {
                const n = Number(r.slice(4));
                if (typeof valor === 'number' && Number(valor) < n) {
                    ponerMensaje('minNum', [n]);
                }
            } else if (r.startsWith('size:')) {
                const n = Number(r.slice(5));
                if (String(valor).length !== n) {
                    ponerMensaje('size', [n]);
                }
            } else if (r.startsWith('date_format:')) {
                const formato = r.slice(12);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || Number.isNaN(Date.parse(valor))) {
                    ponerMensaje('date_format', [formato]);
                }
            } else if (r === 'before:today') {
                const hoy = new Date().toISOString().slice(0, 10);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || String(valor) >= hoy) {
                    ponerMensaje('before');
                }
            } else if (r === 'before_or_equal:today') {
                const hoy = new Date().toISOString().slice(0, 10);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || String(valor) > hoy) {
                    ponerMensaje('before_or_equal');
                }
            }
        }
    }

    function msg(tipo, campo) {
        return (mensajesCustom[campo] && mensajesCustom[campo][tipo])
            || mensajes[tipo](campo);
    }

    if (Object.keys(errores).length > 0) {
        throw new ErrorValidacion(errores);
    }
}