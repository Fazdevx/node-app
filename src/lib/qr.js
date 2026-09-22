import QRCode from 'qrcode';

/** Devuelve el código QR como SVG en color (para embeberse en la página). */
export async function qrSvg(texto, tamanio = 180) {
    return QRCode.toString(String(texto), {
        type: 'svg',
        width: tamanio,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
    });
}