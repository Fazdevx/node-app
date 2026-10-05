import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RUTA_LOGO = path.join(__dirname, '../../web/public/logo-galileo-monocromo.png');

let logoBase64 = null;

export function logo() {
    if (logoBase64 === null) {
        logoBase64 = readFileSync(RUTA_LOGO).toString('base64');
    }
    return logoBase64;
}

export function imagenLogo() {
    return `data:image/png;base64,${logo()}`;
}
