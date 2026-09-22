import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { routerApi } from './routes/index.js';
import { middlewareCsrf } from './middleware/csrf.js';
import { manejadorErrores } from './middleware/errores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizWeb = path.join(__dirname, '..', 'web');
const dist = path.join(raizWeb, 'dist');
const publico = path.join(raizWeb, 'public');

export function crearApp() {
    const app = express();
    app.disable('x-powered-by');

    app.use(express.json({ limit: '1mb' }));
    app.use(cookieParser());
    app.use(middlewareCsrf());

    app.use('/api', routerApi);

    app.use(express.static(publico));
    if (fs.existsSync(dist)) {
        app.use(express.static(dist));
    }

    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) {
            return next();
        }
        const index = path.join(dist, 'index.html');
        if (fs.existsSync(index)) {
            return res.sendFile(index);
        }
        return next();
    });

    app.use(manejadorErrores());

    return app;
}