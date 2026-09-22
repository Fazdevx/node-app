import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AppError } from './errores.js';
import { estadoMatriculaEtiqueta, nombreCompleto, documento, METODO_POR_VALOR } from '../enums.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RUTA_LOGO = path.join(__dirname, '../../web/public/logo-galileo-monocromo.png');
let logoBase64 = null;

function logo() {
    if (logoBase64 === null) {
        logoBase64 = readFileSync(RUTA_LOGO).toString('base64');
    }
    return logoBase64;
}

export const nombreArchivo = (pagoId) => `recibo-${String(pagoId).padStart(6, '0')}.pdf`;

export function mensajeRecibo(pago) {
    const matricula = pago.matricula;
    return [
        'Academia Galileo - Recibo de matricula',
        `Recibo #${String(pago.id).padStart(6, '0')}`,
        `Aspirante: ${nombreCompleto(matricula.aspirante)}`,
        `Total pagado: S/ ${Number(pago.valorTotalCentimos / 100).toFixed(2)}`,
        `Estado: ${estadoMatriculaEtiqueta(matricula.estado)}`,
        'Te adjuntamos el PDF del recibo.',
    ].join('\n');
}

export function enlaceWhatsapp(pago, numero) {
    const digitos = String(numero).replace(/[ ()-]/g, '').trim();

    let final = null;
    if (/^9[0-9]{8}$/.test(digitos)) {
        final = `51${digitos}`;
    } else if (/^\+?[1-9][0-9]{9,14}$/.test(digitos)) {
        final = digitos.replace(/^\+/, '');
    }

    if (final === null) {
        throw new AppError(
            'Ingresa un celular peruano de 9 dígitos o un número internacional con código de país (10 a 15 dígitos).',
            'numero_invalido',
            422,
            { numero: 'Ingresa un celular peruano de 9 dígitos o un número internacional con código de país (10 a 15 dígitos).' },
        );
    }

    return `https://wa.me/${final}?text=${encodeURIComponent(mensajeRecibo(pago))}`;
}

const fila = (label, valor) => [
    { text: String(label), style: 'celda' },
    { text: String(valor), style: 'celda' },
];

function constSectionTitulo(titulo) {
    return { text: titulo, style: 'h2' };
}

/**
 * Documento PDF del recibo (papel A4, igual estructura que el blade original).
 */
export function construirReciboPdf(pago, matricula) {
    const a = matricula.aspirante;
    const apoderadoDoc = [a.apoderadoTipoDocumento ?? '', a.apoderadoNumeroDocumento ?? '']
        .filter(Boolean).join(' ').trim();

    const filasPago = [
        fila('Medio', METODO_POR_VALOR[pago.metodo]?.etiqueta ?? pago.metodo),
    ];
    if (pago.codigoPago) {
        filasPago.push(fila('Código pagado', pago.codigoPago.codigo));
    }
    if (pago.referencia) {
        filasPago.push(fila('Referencia', pago.referencia));
    }
    filasPago.push(fila('Precio', `${config.moneda.simbolo} ${(matricula.valorBaseCentimos / 100).toFixed(2)}`));
    if ((matricula.descuentoCentimos ?? 0) > 0) {
        filasPago.push(fila('Descuento aplicado', `- ${config.moneda.simbolo} ${(matricula.descuentoCentimos / 100).toFixed(2)}`));
    }
    filasPago.push(fila('Total pagado', `${config.moneda.simbolo} ${(pago.valorTotalCentimos / 100).toFixed(2)}`));
    filasPago.push(fila('Recibido', `${config.moneda.simbolo} ${(pago.valorRecibidoCentimos / 100).toFixed(2)}`));
    if ((pago.vueltoCentimos ?? 0) > 0) {
        filasPago.push(fila('Vuelto', `${config.moneda.simbolo} ${(pago.vueltoCentimos / 100).toFixed(2)}`));
    }

    const fecha = new Date(pago.pagadoAt);
    const pad = (n) => String(n).padStart(2, '0');
    const fechaTexto = `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;

    const docWorksheetKin = {
        pageSize: 'A4',
        pageMargins: [42, 28, 42, 28],
        defaultStyle: { fontSize: 10, font: 'Roboto' },
        content: [
            {
                stack: [
                    { image: `data:image/png;base64,${logo()}`, width: 195, alignment: 'center' },
                    { text: 'Recibo de pago', style: 'h1', alignment: 'center' },
                    { text: 'Confirmación de matrícula · Academia Galileo', style: 'subtitulo', alignment: 'center' },
                ],
                margin: [0, 0, 0, 14],
            },
            {
                table: {
                    widths: ['*'],
                    body: [[{ text: `Recibo #${String(pago.id).padStart(6, '0')}`, style: 'numero', alignment: 'center' }]],
                },
                margin: [0, 0, 0, 4],
            },
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('Fecha', fechaTexto),
                        fila('N.º de matrícula', matricula.numeroMatricula || '—'),
                        fila('Estado', estadoMatriculaEtiqueta(matricula.estado)),
                    ],
                },
            },
            constSectionTitulo('Aspirante'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('Nombre', nombreCompleto(a)),
                        fila('Documento', documento(a)),
                        fila('Teléfono', a.telefono),
                    ],
                },
            },
            constSectionTitulo('Datos del apoderado'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('Nombre', a.acudienteNombre || 'No registrado'),
                        fila('Documento', apoderadoDoc || 'No registrado'),
                        fila('Dirección', a.apoderadoDireccion || 'No registrada'),
                        fila('Teléfono', a.acudienteTelefono || 'No registrado'),
                    ],
                },
            },
            constSectionTitulo('Matrícula'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [fila('Concepto', matricula.programa?.nombre ?? 'Matrícula pre-universitaria')],
                },
            },
            constSectionTitulo('Pago'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: filasPago,
                },
            },
            {
                text: 'Conserva este recibo, es tu comprobante de matrícula.',
                style: 'footer',
                margin: [0, 18, 0, 0],
            },
        ],
        styles: {
            h1: { fontSize: 15, bold: true, uppercase: true, letterSpacing: 2, margin: [0, 6, 0, 0] },
            subtitulo: { fontSize: 10, margin: [0, 2, 0, -4] },
            h2: {
                fontSize: 10,
                bold: true,
                uppercase: true,
                letterSpacing: 1,
                margin: [0, 12, 0, 7],
                decoration: 'underline',
                decorationStyle: 'dashed',
            },
            numero: {
                fontSize: 13,
                bold: true,
                letterSpacing: 1,
                margin: [0, 8, 0, 8],
                border: [true, true, true, true],
            },
            celda: {
                fontSize: 10,
                alignment: 'left',
            },
            footer: { fontSize: 9, alignment: 'center' },
        },
    };

    return docWorksheetKin;
}