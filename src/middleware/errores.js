import { AppError, ErrorValidacion } from '../lib/errores.js';

export function manejadorErrores() {
    return (err, _req, res, _next) => {
        if (err instanceof ErrorValidacion) {
            return res.status(422).json({ message: err.message, errors: err.campos });
        }

        if (err instanceof AppError) {
            if (err.http === 410) {
                return res.status(410).json({ message: err.message });
            }
            if (err.http === 404) {
                return res.status(404).json({ message: err.message });
            }
            if ((err.http ?? 0) >= 500) {
                console.error(err);
                return res.status(err.http).json({ message: err.message });
            }
            return res.status(err.http ?? 422).json({ message: err.message, errors: err.campos ?? {} });
        }

        console.error(err);
        return res.status(500).json({ message: 'Ocurrió un error en el servidor.' });
    };
}

/** Envuelve un handler async para que los errores lleguen al manejador. */
export const as =
    (fn) =>
    (req, res, next) =>
        Promise.resolve(fn(req, res, next)).catch(next);