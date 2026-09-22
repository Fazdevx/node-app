import { prisma } from '../src/prisma.js';
import { programaDefecto, iniciarMatricula } from '../src/services/iniciarMatricula.js';
import { registrarPago } from '../src/services/registrarPago.js';

async function crearMatriculasDemo() {
    const datosBase = {
        tipo_documento: 'DNI',
        numero_documento: null,
        nombres: null,
        apellidos: null,
        fecha_nacimiento: null,
        email: null,
        telefono: null,
        direccion: null,
        ciudad: 'Piura',
        autoriza_datos: true,
    };
    const persona = (numero, nombres, apellidos, nacimiento, email, telefono, direccion) => ({
        ...datosBase,
        numero_documento: numero,
        nombres,
        apellidos,
        fecha_nacimiento: nacimiento,
        email,
        telefono,
        direccion,
    });

    // 1. Web: queda pendiente, el aspirante lleva el código a caja.
    const web = await prisma.$transaction((tx) =>
        iniciarMatricula(tx, persona(
            '1020304050',
            'Ana María',
            'Gómez Ruiz',
            '2000-05-10',
            'ana.gomez@example.com',
            '987654321',
            'Calle 10 # 5-20',
        ), { observaciones: 'Matrícula web: pendiente de pago.' }));
    const codigoWeb = web.codigosPago[0].codigo;
    console.log(`Demo pendiente de pago: código ${codigoWeb}`);

    // 2. Presencial en efectivo con descuento: S/ 250 - S/ 30 = S/ 220 (paga S/ 250, vuelto S/ 30).
    const efectivo = await prisma.$transaction((tx) =>
        iniciarMatricula(tx, persona(
            '44556677',
            'Jorge Luis',
            'Pérez Quispe',
            '1998-02-14',
            'jorge.perez@example.com',
            '912345678',
            'Av. Grau 123',
        ), { observaciones: 'Matrícula presencial en caja.' }));
    await prisma.$transaction((tx) => registrarPago(tx, {
        codigoIngresado: efectivo.codigosPago[0].codigo,
        metodo: 'efectivo',
        valorRecibido: 250,
        descuento: 30,
        notas: 'Descuento de S/ 30: paga con S/ 250, vuelto S/ 30.',
    }));

    // 3. Presencial con Yape: monto exacto + número de operación.
    const yape = await prisma.$transaction((tx) =>
        iniciarMatricula(tx, persona(
            '87654321',
            'Lucía Fernanda',
            'Ramos Flores',
            '2002-11-30',
            'lucia.ramos@example.com',
            '933445566',
            'Jr. Lima 456',
        ), { observaciones: 'Matrícula presencial, paga con Yape.' }));
    await prisma.$transaction((tx) => registrarPago(tx, {
        codigoIngresado: yape.codigosPago[0].codigo,
        metodo: 'yape',
        referencia: '123456',
        notas: 'Yape — últimos 6 dígitos de la operación.',
    }));
}

async function main() {
    const programa = await prisma.$transaction(programaDefecto);
    console.log(`Programa único: ${programa.nombre} — S/ ${(programa.precioCentimos / 100).toFixed(2)}`);

    await crearMatriculasDemo();
    console.log('Seed OK: programa PRE-UNI y 3 matrículas de demostración creadas.');
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());