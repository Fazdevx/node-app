import 'dotenv/config';

const numero = (v, d) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : d;
};

const entero = (v, d) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
};

const puerto = entero(process.env.PORT, 4000);

export const config = {
    puerto,
    baseUrl: process.env.APP_URL || `http://localhost:${puerto}`,
    claveAplicacion: process.env.APP_KEY || 'galileo-app-key-dev',
    matricula: {
        precioMatricula: numero(process.env.MATRICULAS_PRECIO_MATRICULA, 250),
        codigoPago: {
            prefijo: process.env.MATRICULAS_CODIGO_PREFIJO || 'GAL',
            longitud: entero(process.env.MATRICULAS_CODIGO_LONGITUD, 6),
            vigenciaHoras: entero(process.env.MATRICULAS_CODIGO_VIGENCIA_HORAS, 48),
        },
        numeroMatricula: {
            digitosConsecutivo: entero(process.env.MATRICULAS_NUMERO_DIGITOS, 6),
        },
        programaDefecto: {
            codigo: process.env.MATRICULAS_PROGRAMA_DEFECTO_CODIGO || 'PRE-UNI',
            nombre: process.env.MATRICULAS_PROGRAMA_DEFECTO_NOMBRE || 'Curso Pre-universitario',
        },
    },
    academia: {
        nombre: process.env.ACADEMIA_NOMBRE || 'Academia Galileo',
        nit: process.env.ACADEMIA_NIT || '',
        direccion: process.env.ACADEMIA_DIRECCION || '',
        telefono: process.env.ACADEMIA_TELEFONO || '',
    },
    moneda: {
        codigo: process.env.MATRICULAS_MONEDA || 'PEN',
        simbolo: process.env.MATRICULAS_MONEDA_SIMBOLO || 'S/',
    },
    firmaSecreto: process.env.SIGN_URL_SECRET || 'galileo-firma-dev',
};