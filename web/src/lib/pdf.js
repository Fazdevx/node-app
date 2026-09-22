import pdfMake from 'pdfmake/build/pdfmake.js';
import fuentesVfs from 'pdfmake/build/vfs_fonts.js';
import { construirReciboPdf } from './recibos.js';

pdfMake.addVirtualFileSystem(fuentesVfs);
pdfMake.fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
    },
};

export async function generarReciboPdfDataUrl(pago, matricula) {
    const doc = await construirReciboPdf(pago, matricula);
    return pdfMake.createPdf(doc).getDataUrl();
}

export async function descargarReciboPdf(pago, matricula) {
    const doc = await construirReciboPdf(pago, matricula);
    pdfMake.createPdf(doc).download();
}