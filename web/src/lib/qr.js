import QRCode from 'qrcode';

export async function qrSvg(texto, tamanio = 180) {
    return QRCode.toString(String(texto), {
        type: 'svg',
        width: tamanio,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
    });
}