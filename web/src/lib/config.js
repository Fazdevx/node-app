export const config = {
    matricula: {
        precioMatricula: 250,
        codigoPago: {
            prefijo: 'GAL',
            longitud: 6,
            vigenciaHoras: 48,
        },
        numeroMatricula: {
            digitosConsecutivo: 6,
        },
        programaDefecto: {
            codigo: 'PRE-UNI',
            nombre: 'Curso Pre-universitario',
        },
    },
    academia: {
        nombre: 'Academia Galileo',
        nit: '',
        direccion: '',
        telefono: '',
    },
    moneda: {
        codigo: 'PEN',
        simbolo: 'S/',
    },
};