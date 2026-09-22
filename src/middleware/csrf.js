import { randomBytes } from 'node:crypto';

const NOMBRE_COOKIE = 'XSRF-TOKEN';
const METODOS_PELIGROSOS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function middlewareCsrf() {
    return (req, res, next) => {
        if (!req.cookies?.[NOMBRE_COOKIE]) {
            const token = randomBytes(32).toString('hex');
            res.cookie(NOMBRE_COOKIE, token, {
                httpOnly: false,
                sameSite: 'lax',
                path: '/',
                secure: false,
            });
        }

        if (METODOS_PELIGROSOS.includes(req.method)) {
            const cabecera = req.headers['x-xsrf-token'] ?? req.headers['x-csrf-token'];
            const esperado = req.cookies?.[NOMBRE_COOKIE];
            if (!cabecera || !esperado || cabecera !== esperado) {
                return res.status(419).json({ message: 'La sesión expiró. Recarga la página e inténtalo de nuevo.' });
            }
        }

        next();
    };
}