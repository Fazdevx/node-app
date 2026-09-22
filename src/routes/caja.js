import { Router } from 'express';
import { prisma } from '../prisma.js';
import { as } from '../middleware/errores.js';
import { validar } from '../lib/validar.js';
import { AppError, ErrorValidacion, CodigoPagoError } from '../lib/errores.js';
import { GeneradorCodigo } from '../lib/codigo.js';
import { registrarPago } from '../services/registrarPago.js';
import { matricularEnCaja } from '../services/matricularEnCaja.js';
import { generarPdfRecibo } from '../lib/pdf.js';
import { nombreArchivo, enlaceWhatsapp } from '../lib/recibos.js';
import { config } from '../config.js';
import { urlFirmada, middlewareUrlFirmada } from '../lib/firma.js';
import { paginar } from '../lib/paginador.js';
import { fmtFechaHora, fmtFecha, rangoDia } from '../lib/fechas.js';
import {
    TIPOS_DOCUMENTO,
    METODOS,
    opciones,
    nombreCompleto,
    documento,
    estadoMatriculaEtiqueta,
} from '../enums.js';

const router = Router();
const listaTipos = TIPOS_DOCUMENTO.map((t) => t.valor).join(',');
const listaMetodos = METODOS.map((m) => m.valor).join(',');
const generador = new GeneradorCodigo(config.matricula.codigoPago.prefijo, config.matricula.codigoPago.longitud);

async function valorDelCodigo(codigo) {
    if (!codigo) {
        return null;
    }
    const canonico = generador.canonicalizar(codigo);
    if (canonico === null || !generador.esValido(canonico)) {
        return null;
    }
    const codigoPago = await prisma.codigoPago.findUnique({ where: { codigo: canonico } });
    if (!codigoPago || codigoPago.estado !== 'pendiente' || new Date(codigoPago.expiraAt) < new Date()) {
        return null;
    }
    return codigoPago.valorCentimos / 100;
}

router.get('/', as(async (req, res) => {
    const { codigo } = req.query;
    const valorCodigo = codigo ? await valorDelCodigo(codigo) : null;

    res.json({
        metodos: opciones(METODOS),
        valorCodigo,
        precioMatricula: config.matricula.precioMatricula,
    });
}));

router.post('/cobrar', as(async (req, res) => {
    const datos = req.body ?? {};

    try {
        validar(datos, {
            codigo: ['required', 'string', 'max:40'],
            metodo: ['required', `in:${listaMetodos}`],
            valor_recibido: ['nullable', 'numeric', 'min:0', 'max:99999999'],
            referencia: ['nullable', 'string', 'max:60'],
            descuento: ['nullable', 'numeric', 'min:0', 'max:99999999'],
        });

        const pago = await prisma.$transaction((tx) => registrarPago(tx, {
            codigoIngresado: String(datos.codigo),
            metodo: String(datos.metodo),
            valorRecibido: datos.valor_recibido ? Number(datos.valor_recibido) : null,
            referencia: datos.referencia,
            descuento: Number(datos.descuento ?? 0),
            notas: null,
        }));

        return res.json({
            redirect: `/caja/recibo/${pago.id}`,
            exito: 'Pago registrado y matricula confirmada.',
        });
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            return res.status(422).json({ errors: err.campos, valorCodigo: await valorDelCodigo(datos.codigo) });
        }
        if (err instanceof CodigoPagoError || err instanceof AppError) {
            return res.status(422).json({ errors: { codigo: err.message }, valorCodigo: await valorDelCodigo(datos.codigo) });
        }
        throw err;
    }
}));

router.get('/presencial', as(async (_req, res) => {
    res.json({
        tiposDocumento: opciones(TIPOS_DOCUMENTO),
        metodos: opciones(METODOS),
        precioMatricula: config.matricula.precioMatricula,
    });
}));

router.post('/presencial', as(async (req, res) => {
    const datos = { ...(req.body ?? {}) };

    try {
        validar(datos, {
            tipo_documento: ['required', `in:${listaTipos}`],
            numero_documento: ['required', 'max:30'],
            nombres: ['required', 'max:120'],
            apellidos: ['required', 'max:120'],
            fecha_nacimiento: ['nullable', 'date', 'before:today'],
            telefono: ['nullable', 'max:30', 'required_without:celular'],
            celular: ['nullable', 'max:30', 'required_without:telefono'],
            turno: ['nullable', 'in:mañana,tarde,ambos', 'required_without:telefono'],
            apoderado_tipo_documento: ['nullable', `in:${listaTipos}`, 'required_with:turno,celular'],
            apoderado_numero_documento: ['nullable', 'max:30', 'required_with:turno,celular'],
            apoderado_nombre: ['nullable', 'max:120', 'required_with:turno,celular'],
            apoderado_direccion: ['nullable', 'max:180', 'required_with:turno,celular'],
            apoderado_telefono: ['nullable', 'max:30', 'required_with:turno,celular'],
            email: ['nullable', 'email', 'max:180'],
            modalidad: ['nullable', 'max:180'],
            ciudad: ['nullable', 'max:80'],
            acudiente_nombre: ['nullable', 'max:120'],
            acudiente_telefono: ['nullable', 'max:30'],
            autoriza_datos: ['nullable', 'boolean'],
            metodo: ['required', `in:${listaMetodos}`],
            valor_recibido: ['nullable', 'numeric', 'min:0', 'max:99999999'],
            referencia: ['nullable', 'max:60'],
            descuento: ['nullable', 'numeric', 'min:0', 'max:99999999'],
            observaciones: ['nullable', 'max:500'],
        });

        if (datos.celular !== '' && datos.celular !== undefined && datos.celular !== null) {
            datos.telefono = datos.celular;
        }
        if (datos.apoderado_nombre !== '' && datos.apoderado_nombre !== undefined && datos.apoderado_nombre !== null) {
            datos.acudiente_nombre = datos.apoderado_nombre;
        }
        if (datos.apoderado_telefono !== '' && datos.apoderado_telefono !== undefined && datos.apoderado_telefono !== null) {
            datos.acudiente_telefono = datos.apoderado_telefono;
        }
        delete datos.celular;
        delete datos.apoderado_nombre;
        delete datos.apoderado_telefono;

        const matricula = await matricularEnCaja({
            datosAspirante: datos,
            metodo: String(datos.metodo),
            valorRecibido: datos.valor_recibido ? Number(datos.valor_recibido) : null,
            referencia: datos.referencia,
            descuento: Number(datos.descuento ?? 0),
            observaciones: String(datos.observaciones ?? '').replace(/^Presencial en caja\.\s*/, ''),
        });

        const ultimoPago = matricula.pagos[matricula.pagos.length - 1];

        return res.json({
            redirect: `/caja/recibo/${ultimoPago?.id ?? 0}`,
            exito: 'Matricula presencial completada.',
        });
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            return res.status(422).json({ errors: err.campos });
        }
        if (err instanceof AppError) {
            return res.status(422).json({ errors: { metodo: err.message } });
        }
        throw err;
    }
}));

async function paginarMatriculas(estados, page, is) {
    const donde = { estado: { in: estados } };
    const total = await prisma.matricula.count({ where: donde });

    const filas = await prisma.matricula.findMany({
        where: donde,
        orderBy: { id: 'desc' },
        skip: is.skip,
        take: is.perPagina,
        include: is.include,
    });

    return filas.map((m) => {
        const pendienteCodigo = m.codigosPago?.find((c) => c.estado === 'pendiente' && new Date(c.expiraAt) > new Date());
        const ultimoPago = m.pagos?.length ? [...m.pagos].sort((a, b) => new Date(b.pagadoAt) - new Date(a.pagadoAt))[0] : null;

        return {
            id: m.id,
            aspirante: nombreCompleto(m.aspirante),
            documento: documento(m.aspirante),
            valor_total: m.valorTotalCentimos / 100,
            estado: m.estado,
            estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
            codigo_vigente: Boolean(pendienteCodigo),
            total_pagado: ultimoPago ? ultimoPago.valorTotalCentimos / 100 : m.valorTotalCentimos / 100,
            pagado_at: ultimoPago ? fmtFecha(ultimoPago.pagadoAt) : null,
            ultimo_pago_id: ultimoPago?.id ?? null,
        };
    });
}

router.get('/matriculas/pendientes', as(async (req, res) => {
    const uri = '/caja/matriculas/pendientes';
    const page = Number(req.query.page) || 1;
    const perPagina = 20;

    const donde = { estado: { in: ['pendiente_pago', 'borrador'] } };
    const total = await prisma.matricula.count({ where: donde });
    const filas = await prisma.matricula.findMany({
        where: donde,
        orderBy: { id: 'desc' },
        skip: (page - 1) * perPagina,
        take: perPagina,
        include: { aspirante: true, codigosPago: true },
    });

    const datos = filas.map((m) => ({
        id: m.id,
        aspirante: nombreCompleto(m.aspirante),
        documento: documento(m.aspirante),
        valor_total: m.valorTotalCentimos / 100,
        estado: m.estado,
        estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
        codigo_vigente: Boolean(m.codigosPago?.find((c) => c.estado === 'pendiente' && new Date(c.expiraAt) > new Date())),
    }));

    res.json({ matriculas: { ...paginar(page, total, perPagina, uri), data: datos } });
}));

router.get('/matriculas/completadas', as(async (req, res) => {
    const uri = '/caja/matriculas/completadas';
    const page = Number(req.query.page) || 1;
    const perPagina = 20;

    const donde = { estado: { in: ['pagada', 'matriculada'] } };
    const total = await prisma.matricula.count({ where: donde });
    const filas = await prisma.matricula.findMany({
        where: donde,
        orderBy: { id: 'desc' },
        skip: (page - 1) * perPagina,
        take: perPagina,
        include: { aspirante: true, pagos: true },
    });

    const datos = filas.map((m) => {
        const ultimoPago = m.pagos.length ? [...m.pagos].sort((a, b) => new Date(b.pagadoAt) - new Date(a.pagadoAt))[0] : null;
        return {
            id: m.id,
            aspirante: nombreCompleto(m.aspirante),
            documento: documento(m.aspirante),
            valor_total: m.valorTotalCentimos / 100,
            total_pagado: ultimoPago ? ultimoPago.valorTotalCentimos / 100 : m.valorTotalCentimos / 100,
            pagado_at: ultimoPago ? fmtFecha(ultimoPago.pagadoAt) : null,
            estado: m.estado,
            estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
            ultimo_pago_id: ultimoPago?.id ?? null,
        };
    });

    res.json({ matriculas: { ...paginar(page, total, perPagina, uri), data: datos } });
}));

const INCLUYE_RECIBO = {
    matricula: { include: { aspirante: true, programa: true } },
    codigoPago: true,
};

async function cargarPago(id) {
    const pago = await prisma.pago.findUnique({ where: { id: Number(id) }, include: INCLUYE_RECIBO });
    if (!pago) {
        throw new AppError('El recibo no existe.', 'recibo_no_encontrado', 404);
    }
    return pago;
}

router.get('/recibo/:pago', as(async (req, res) => {
    const pago = await cargarPago(req.params.pago);
    const a = pago.matricula.aspirante;
    const m = pago.matricula;

    res.json({
        recibo: {
            numero: String(pago.id).padStart(6, '0'),
            fecha: fmtFechaHora(pago.pagadoAt),
            numero_matricula: m.numeroMatricula,
            estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
            concepto: m.programa?.nombre ?? 'Matrícula pre-universitaria',
            aspirante: {
                nombre: nombreCompleto(a),
                documento: documento(a),
                telefono: a.telefono,
                acudiente_nombre: a.acudienteNombre,
                apoderado_documento: [a.apoderadoTipoDocumento ?? '', a.apoderadoNumeroDocumento ?? ''].filter(Boolean).join(' ').trim(),
                apoderado_direccion: a.apoderadoDireccion,
                acudiente_telefono: a.acudienteTelefono,
            },
            pago: {
                metodo_etiqueta: METODOS.find((x) => x.valor === pago.metodo)?.etiqueta ?? pago.metodo,
                codigo: pago.codigoPago?.codigo ?? null,
                referencia: pago.referencia,
                precio: m.valorBaseCentimos / 100,
                descuento: m.descuentoCentimos / 100,
                total: pago.valorTotalCentimos / 100,
                recibido: pago.valorRecibidoCentimos / 100,
                vuelto: pago.vueltoCentimos / 100,
                registrado_por: null,
            },
            pdf_url: urlFirmada('caja.recibo.pdf', pago.id, 3600),
            whatsapp_url: urlFirmada('caja.recibo.whatsapp', pago.id, 3600, `/api/caja/recibo/${pago.id}/whatsapp`),
        },
    });
}));

router.get('/recibo/:pago/pdf', middlewareUrlFirmada('caja.recibo.pdf'), as(async (req, res) => {
    const pago = await cargarPago(req.params.pago);
    const buffer = await generarPdfRecibo(pago, pago.matricula);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(pago.id)}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(Buffer.from(buffer));
}));

router.post('/recibo/:pago/whatsapp', middlewareUrlFirmada('caja.recibo.whatsapp'), as(async (req, res) => {
    const pago = await cargarPago(req.params.pago);
    const numero = req.body?.numero;

    const errores = {};
    if (numero === undefined || numero === null || String(numero).trim() === '') {
        errores.numero = 'Ingresa el número de WhatsApp.';
    } else if (typeof numero !== 'string') {
        errores.numero = 'Ingresa un número de WhatsApp válido.';
    } else if (String(numero).length > 30) {
        errores.numero = 'El número es demasiado largo.';
    } else if (!/^\+?[0-9 ()-]+$/.test(String(numero))) {
        errores.numero = 'Usa solo números, espacios, guiones y un + inicial opcional.';
    }

    if (Object.keys(errores).length > 0) {
        return res.status(422).json({ errors: errores });
    }

    const whatsappUrl = enlaceWhatsapp(pago, String(numero).trim());

    res.json({
        whatsapp_url: whatsappUrl,
        pdf_url: urlFirmada('caja.recibo.pdf', pago.id, 900),
        nombre_archivo: nombreArchivo(pago.id),
    });
}));

export { router as routerCaja };