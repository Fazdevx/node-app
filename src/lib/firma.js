import crypto from 'node:crypto';
import { config } from '../config.js';

const firma = (texto) => crypto.createHmac('sha256', config.firmaSecreto).update(texto).digest('hex');

/** Genera una URL firmada temporalmente para una acción + id. */
export function urlFirmada(accion, id, ttlSegundos, ruta = null) {
    const idStr = id === null || id === undefined ? '0' : String(id);
    const expira = Math.floor(Date.now() / 1000) + ttlSegundos;
    const firmaPred = firma(`${accion}|${idStr}|${expira}`);
    const base = ruta ?? `/api/${accion.replace(/\./g, '/')}/${idStr}`;
    return `${base}?id=${encodeURIComponent(idStr)}&expires=${expira}&signature=${firmaPred}`;
}

/** Middleware Express: valida la firma de una URL firmada (accion). */
export function middlewareUrlFirmada(accion) {
    return (req, res, next) => {
        const idRaw = req.query.id ?? req.query.pago ?? req.query.matricula;
        const idStr = idRaw === undefined || idRaw === null ? '' : String(idRaw);
        const expira = Number(req.query.expires);
        const signature = String(req.query.signature ?? '');
        const deRuta = req.params.pago ?? req.params.matricula;

        const coincide = deRuta === undefined || String(deRuta) === idStr;

        if (idStr !== '' && coincide && Number.isInteger(expira) && expira >= Math.floor(Date.now() / 1000)) {
            const esperada = firma(`${accion}|${idStr}|${expira}`);
            const a = Buffer.from(esperada, 'hex');
            const b = Buffer.from(signature, 'hex');
            if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
                if (req.params.pago === undefined) {
                    req.params.pago = idStr;
                }
                if (req.params.matricula === undefined) {
                    req.params.matricula = idStr;
                }
                return next();
            }
        }

        return res.status(403).json({ message: 'La sesión o el enlace venció. Recarga la página e inténtalo de nuevo.' });
    };
}