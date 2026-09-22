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

export async function generarPdfRecibo(pago, matricula) {
    const doc = construirReciboPdf(pago, matricula);
    const buffer = await pdfMake.createPdf(doc).getBuffer();
    return buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
}