import crypto from 'node:crypto';
import { config } from '../config.js';

const firma = (texto) => crypto.createHmac('sha256', config.firmaSecreto).update(texto).digest('hex');

/** Genera una URL firmada temporalmente para una acción + id de pago. */
export function urlFirmada(accion, idPago, ttlSegundos, ruta = null) {
    const expira = Math.floor(Date.now() / 1000) + ttlSegundos;
    const firmaPred = firma(`${accion}|${idPago}|${expira}`);
    const base = ruta ?? `/api/caja/recibo/${idPago}/pdf`;
    return `${base}?pago=${idPago}&expires=${expira}&signature=${firmaPred}`;
}

/** Middleware Express: valida la firma de una URL firmada (action). */
export function middlewareUrlFirmada(accion) {
    return (req, res, next) => {
        const pago = Number(req.query.pago);
        const expira = Number(req.query.expires);
        const signature = String(req.query.signature ?? '');

        if (Number.isInteger(pago) && Number.isInteger(expira) && expira >= Math.floor(Date.now() / 1000)) {
            const esperada = firma(`${accion}|${pago}|${expira}`);
            const a = Buffer.from(esperada, 'hex');
            const b = Buffer.from(signature, 'hex');
            if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
                req.params.pago = String(pago);
                return next();
            }
        }

        return res.status(403).json({ message: 'La sesión o el enlace venció. Recarga el recibo e inténtalo de nuevo.' });
    };
}