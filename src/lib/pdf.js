import pdfMake from 'pdfmake/build/pdfmake.js';
import fuentesVfs from 'pdfmake/build/vfs_fonts.js';
import { construirReciboPdf } from './recibos.js';
import { construirConsentimientoPdf } from './consentimientos.js';

pdfMake.addVirtualFileSystem(fuentesVfs);
pdfMake.fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
    },
};

async function aBuffer(doc) {
    const buffer = await pdfMake.createPdf(doc).getBuffer();
    return buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
}

export async function generarPdfRecibo(pago, matricula) {
    return aBuffer(construirReciboPdf(pago, matricula));
}

export async function generarPdfConsentimiento(matricula, opciones = {}) {
    return aBuffer(construirConsentimientoPdf(matricula, opciones));
}