import { Router } from 'express';
import { prisma } from '../prisma.js';
import { as } from '../middleware/errores.js';
import { validar } from '../lib/validar.js';
import { AppError } from '../lib/errores.js';
import { iniciarMatricula } from '../services/iniciarMatricula.js';
import { qrSvg } from '../lib/qr.js';
import { fmtFechaHora, fmtFecha } from '../lib/fechas.js';
import { TIPOS_DOCUMENTO, opciones, nombreCompleto, documento, estadoMatriculaEtiqueta } from '../enums.js';
import { config } from '../config.js';

const router = Router();
const listaTipos = TIPOS_DOCUMENTO.map((t) => t.valor).join(',');

export function estaVigente(codigoPago) {
    return codigoPago.estado === 'pendiente' && new Date(codigoPago.expiraAt) > new Date();
}

router.get('/matricular', as(async (_req, res) => {
    res.json({
        tiposDocumento: opciones(TIPOS_DOCUMENTO),
        precioMatricula: config.matricula.precioMatricula,
    });
}));

router.post('/matricular', as(async (req, res) => {
    const datos = req.body ?? {};
    validar(datos, {
        tipo_documento: ['required', 'string', `in:${listaTipos}`],
        numero_documento: ['required', 'string', 'max:30'],
        nombres: ['required', 'string', 'max:120'],
        apellidos: ['required', 'string', 'max:120'],
        fecha_nacimiento: ['required', 'date', 'before:today'],
        telefono: ['required', 'string', 'max:30'],
        email: ['nullable', 'email', 'max:180'],
        turno: ['required', 'string', 'in:mañana,tarde,ambos'],
        direccion: ['nullable', 'string', 'max:180'],
        ciudad: ['nullable', 'string', 'max:80'],
        acudiente_nombre: ['nullable', 'string', 'max:120'],
        acudiente_telefono: ['nullable', 'string', 'max:30'],
        autoriza_datos: ['nullable', 'boolean'],
        observaciones: ['nullable', 'string', 'max:500'],
    });

    const matricula = await prisma.$transaction((tx) => iniciarMatricula(tx, datos, {
        descuento: 0,
        observaciones: datos.observaciones ?? null,
    }));

    const codigo = matricula.codigosPago[0].codigo;

    res.json({
        redirect: `/codigo-pago/${encodeURIComponent(codigo)}`,
        exito: '¡Listo! Tu código de pago fue generado. Preséntalo en caja para finalizar tu matrícula.',
    });
}));

router.get('/codigo-pago/:codigo', as(async (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const codigoPago = await prisma.codigoPago.findUnique({ where: { codigo } });

    if (!codigoPago || !estaVigente(codigoPago)) {
        throw new AppError(
            'Este código de pago ya no es válido (usado, anulado o expirado).',
            'codigo_no_vigente',
            410,
        );
    }

    const matricula = await prisma.matricula.findUnique({
        where: { id: codigoPago.matriculaId },
        include: { aspirante: true },
    });

    const qr = await qrSvg(codigo, 180);

    res.json({
        codigoPago: {
            codigo,
            valor: (codigoPago.valorCentimos / 100).toFixed(2),
            expira_at: fmtFechaHora(codigoPago.expiraAt),
            aspirante: nombreCompleto(matricula.aspirante),
            qr,
        },
    });
}));

function transformarMatricula(m) {
    const pendiente = m.codigosPago.find((c) => c.estado === 'pendiente' && new Date(c.expiraAt) > new Date());

    return {
        id: m.id,
        estado: m.estado,
        estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
        numero_matricula: m.numeroMatricula,
        descuento: m.descuentoCentimos / 100,
        valor_total: m.valorTotalCentimos / 100,
        created_at: fmtFecha(m.createdAt),
        codigo_vigente: pendiente ? { codigo: pendiente.codigo, expira_at: fmtFechaHora(pendiente.expiraAt) } : null,
        pagos: m.pagos.map((p) => ({
            metodo: p.metodo,
            pagado_at: fmtFechaHora(p.pagadoAt),
            valor_total: p.valorTotalCentimos / 100,
            valor_recibido: p.valorRecibidoCentimos / 100,
            vuelto: p.vueltoCentimos / 100,
        })),
    };
}

router.get('/mis-pagos', as(async (req, res) => {
    const { tipo_documento, numero_documento } = req.query;
    const tiposDocumento = opciones(TIPOS_DOCUMENTO);

    if (!tipo_documento || !numero_documento) {
        return res.json({ tiposDocumento, consultado: false, aspirante: null, matriculas: [] });
    }

    validar(req.query, {
        tipo_documento: ['required', `in:${listaTipos}`],
        numero_documento: ['required', 'max:30'],
    });

    const aspirante = await prisma.aspirante.findFirst({
        where: { tipoDocumento: String(tipo_documento), numeroDocumento: String(numero_documento) },
    });

    if (!aspirante) {
        return res.json({ tiposDocumento, consultado: true, aspirante: null, matriculas: [] });
    }

    const matriculas = await prisma.matricula.findMany({
        where: { aspiranteId: aspirante.id },
        orderBy: { id: 'desc' },
        include: { pagos: true, codigosPago: true },
    });

    res.json({
        tiposDocumento,
        consultado: true,
        aspirante: { nombre: nombreCompleto(aspirante), documento: documento(aspirante) },
        matriculas: matriculas.map(transformarMatricula),
    });
}));

export { router as routerMatricula };