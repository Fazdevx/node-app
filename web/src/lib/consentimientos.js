import { logoDataUrl } from './logo.js';
import { nombreCompleto, documento } from './enums.js';
import { config } from './config.js';

const TURNO_ETIQUETA = {
    mañana: 'Turno mañana',
    tarde: 'Turno tarde',
    ambos: 'Turno mañana y tarde',
};

const ANCHO_FIRMA = 230;

export const nombreArchivoConsentimiento = (matriculaId) =>
    `consentimiento-imagen-${String(matriculaId).padStart(6, '0')}.pdf`;

export const turnoEtiqueta = (turno) => TURNO_ETIQUETA[turno] ?? (turno ? String(turno) : '—');

export function fechaTexto(valor) {
    if (!valor) {
        return '—';
    }
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) {
        return String(valor);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function datosConsentimiento(matricula, { promotor = null, fecha = null } = {}) {
    const a = matricula.aspirante;
    const apoderadoNombre = a.acudienteNombre || 'No registrado';

    return {
        fecha: fechaTexto(fecha ?? matricula.consentimientoFirmadoAt ?? new Date()),
        matricula: matricula.numeroMatricula || '—',
        concepto: matricula.programa?.nombre ?? 'Matrícula pre-universitaria',
        turno: turnoEtiqueta(a.turno),
        estudiante: {
            nombre: nombreCompleto(a),
            documento: documento(a),
            nacimiento: fechaTexto(a.fechaNacimiento),
            telefono: a.telefono || 'No registrado',
            direccion: a.direccion || 'No registrada',
        },
        apoderado: {
            nombre: apoderadoNombre,
            documento: [a.apoderadoTipoDocumento ?? '', a.apoderadoNumeroDocumento ?? '']
                .filter(Boolean)
                .join(' ')
                .trim() || 'No registrado',
            telefono: a.acudienteTelefono || 'No registrado',
            direccion: a.apoderadoDireccion || 'No registrada',
        },
        promotor: promotor ? String(promotor) : null,
    };
}

export function textoConsentimiento(datos) {
    const academia = config.academia.nombre;
    const { apoderado, estudiante } = datos;

    return {
        intro:
            `Yo, ${apoderado.nombre}, identificado(a) con ${apoderado.documento}, en mi calidad de apoderado(a) legal `
            + `del(la) estudiante ${estudiante.nombre}, identificado(a) con ${estudiante.documento}, `
            + 'por medio del presente documento declaro y autorizo lo siguiente:',
        clausulas: [
            `PRIMERA. OTORGO AUTORIZACIÓN a la ${academia} para que, mientras el(la) estudiante se encuentre `
            + 'matriculado(a) en la academia y participe de sus clases, talleres y actividades, utilice y difunda su '
            + 'imagen —fotografías y videos captados dentro de las instalaciones de la academia— en el contenido de la '
            + 'academia publicado en sus redes sociales, sitio web y demás canales de comunicación.',
            'SEGUNDA. El uso de la imagen se limita al contenido educativo y a la promoción de las actividades de la '
            + 'academia, sin fines ajenos a sus servicios.',
            'TERCERA. La academia podrá editar, retocar y seleccionar el material, siempre que ello no altere de forma '
            + 'denigrante la imagen del(la) estudiante.',
            'CUARTA. Esta autorización es voluntaria y gratuita, y no genera vínculo ni contraprestación alguna.',
            `QUINTA. La autorización permanece vigente mientras el(la) estudiante se encuentre en la ${academia}, y podrá `
            + 'revocarse en cualquier momento mediante aviso escrito presentado en la academia.',
            'SEXTA. La academia no publicará imágenes del(la) estudiante sin contar con este consentimiento firmado por '
            + 'su apoderado(a).',
        ],
        cierre: 'En señal de conformidad, firman el presente documento el(la) apoderado(a) y el(la) responsable de promotoría.',
    };
}

const fila = (label, valor) => [
    { text: String(label), style: 'etiqueta' },
    { text: String(valor ?? '—'), style: 'celda' },
];

const seccion = (titulo) => ({ text: titulo, style: 'h2' });

function bloqueFirma(titulo, lineas) {
    return [
        { text: '', margin: [0, 26, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: ANCHO_FIRMA, y2: 0, lineWidth: 0.8 }] },
        { text: titulo, style: 'firmaTitulo', margin: [0, 4, 0, 0] },
        ...lineas.filter(Boolean).map((linea) => ({ text: linea, style: 'firmaDato' })),
    ];
}

export async function construirConsentimientoPdf(matricula, opciones = {}) {
    const datos = datosConsentimiento(matricula, opciones);
    const texto = textoConsentimiento(datos);
    const logo = await logoDataUrl();

    return {
        pageSize: 'A4',
        pageMargins: [36, 24, 36, 24],
        defaultStyle: { fontSize: 9.5, font: 'Roboto' },
        content: [
            {
                stack: [
                    ...(logo ? [{ image: logo, width: 150, alignment: 'center' }] : []),
                    { text: 'Consentimiento de uso de imagen', style: 'h1', alignment: 'center' },
                    { text: `Autorización para el contenido de la academia en redes sociales · ${config.academia.nombre}`, style: 'subtitulo', alignment: 'center' },
                ],
                margin: [0, 0, 0, 10],
            },
            seccion('Datos del estudiante'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('Nombre', datos.estudiante.nombre),
                        fila('Documento', datos.estudiante.documento),
                        fila('Fecha de nacimiento', datos.estudiante.nacimiento),
                        fila('Teléfono', datos.estudiante.telefono),
                        fila('Dirección', datos.estudiante.direccion),
                    ],
                },
            },
            seccion('Datos del apoderado'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('Nombre', datos.apoderado.nombre),
                        fila('Documento', datos.apoderado.documento),
                        fila('Teléfono', datos.apoderado.telefono),
                        fila('Dirección', datos.apoderado.direccion),
                    ],
                },
            },
            seccion('Matrícula'),
            {
                table: {
                    widths: ['32%', '68%'],
                    body: [
                        fila('N.º de matrícula', datos.matricula),
                        fila('Programa', datos.concepto),
                        fila('Turno', datos.turno),
                        fila('Fecha de emisión', datos.fecha),
                    ],
                },
            },
            seccion('Texto del consentimiento'),
            { text: texto.intro, style: 'parrafo', margin: [0, 0, 0, 7] },
            ...texto.clausulas.map((clausula) => ({
                text: clausula,
                style: 'clausula',
                margin: [0, 0, 0, 6],
            })),
            {
                text: texto.cierre,
                style: 'parrafo',
                bold: true,
                margin: [0, 9, 0, 0],
            },
            {
                table: {
                    widths: ['*', 30, '*'],
                    body: [[
                        {
                            stack: bloqueFirma('Firma del apoderado', [
                                datos.apoderado.nombre,
                                datos.apoderado.documento,
                            ]),
                        },
                        { text: '' },
                        {
                            stack: bloqueFirma('Firma de promotoría', [
                                datos.promotor,
                                `Fecha: ${datos.fecha}`,
                            ]),
                        },
                    ]],
                },
                margin: [0, 10, 0, 0],
            },
            {
                text: `${config.academia.nombre} · Documento interno de consentimiento. Consérvese firmado.`,
                style: 'footer',
                margin: [0, 12, 0, 0],
            },
        ],
        styles: {
            h1: { fontSize: 14, bold: true, uppercase: true, letterSpacing: 1.2, margin: [0, 5, 0, 0] },
            subtitulo: { fontSize: 9.5, margin: [0, 2, 0, -4] },
            h2: {
                fontSize: 9.5,
                bold: true,
                uppercase: true,
                letterSpacing: 1,
                margin: [0, 9, 0, 5],
                decoration: 'underline',
                decorationStyle: 'dashed',
            },
            etiqueta: { fontSize: 9, color: '#444444', bold: true },
            celda: { fontSize: 9.5, alignment: 'left' },
            parrafo: { fontSize: 9.5, alignment: 'justify', lineHeight: 1.2 },
            clausula: { fontSize: 9, alignment: 'justify', lineHeight: 1.15 },
            firmaTitulo: { fontSize: 9, bold: true, alignment: 'center', letterSpacing: 0.5 },
            firmaDato: { fontSize: 8.5, alignment: 'center', color: '#444444' },
            footer: { fontSize: 8.5, alignment: 'center', color: '#555555' },
        },
    };
}
