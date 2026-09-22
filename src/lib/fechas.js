const pad = (n) => String(n).padStart(2, '0');

export const fmtFecha = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export const fmtFechaHora = (d) => `${fmtFecha(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const fmtFechaHoraSeg = (d) => `${fmtFecha(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Fecha 'YYYY-MM-DD' desde un Date (en tiempo local). */
export const fmtCorta = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Rango de un día 'YYYY-MM-DD' en Date locales. */
export const rangoDia = (fecha) => {
    const [y, m, d] = fecha.split('-').map(Number);
    const inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
    const fin = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return { inicio, fin };
};

export const esHoyOMenor = (fecha) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }
    const hoy = new Date();
    return fecha <= fmtCorta(hoy);
};