import { Router } from 'express';
import { prisma } from '../prisma.js';
import { as } from '../middleware/errores.js';
import { validar } from '../lib/validar.js';
import { ErrorValidacion } from '../lib/errores.js';
import { pagosPendientes, resumen, huella, cerrarCaja } from '../services/cierreCaja.js';
import { fmtCorta, fmtFechaHoraSeg, rangoDia } from '../lib/fechas.js';
import { generarExcelCierre } from '../lib/excel.js';
import { urlFirmada, middlewareUrlFirmada } from '../lib/firma.js';
import { paginar } from '../lib/paginador.js';
import { nombreCompleto, documento, METODO_POR_VALOR } from '../enums.js';

const router = Router();
const hoy = () => fmtCorta(new Date());

function detalle(p) {
    return {
        recibo: String(p.id).padStart(6, '0'),
        fecha: fmtFechaHoraSeg(p.pagadoAt),
        aspirante: nombreCompleto(p.matricula.aspirante),
        documento: documento(p.matricula.aspirante),
        metodo: METODO_POR_VALOR[p.metodo]?.etiqueta ?? p.metodo,
        total: p.valorTotalCentimos / 100,
        recibido: p.valorRecibidoCentimos / 100,
        vuelto: p.vueltoCentimos / 100,
        referencia: p.referencia ?? '',
    };
}

const resultado = (c) => (c.diferenciaCentimos > 0 ? 'Sobrante' : c.diferenciaCentimos < 0 ? 'Faltante' : 'Cuadrado');

const validarFechaOpcional = (query) => {
    if (query.fecha !== undefined && query.fecha !== '') {
        validar(query, { fecha: ['required', 'date_format:Y-m-d', 'before_or_equal:today'] });
    }
};

router.get('/preparar', as(async (req, res) => {
    validarFechaOpcional(req.query);
    const fecha = req.query.fecha ?? hoy();
    const pagos = await pagosPendientes(prisma, fecha);
    const r = resumen(pagos);

    res.json({
        fecha,
        resumen: { ...r, metodos: Object.values(r.metodos) },
        huella: huella(pagos),
        pagos: pagos.map(detalle),
    });
}));

router.get('/lista', as(async (req, res) => {
    validarFechaOpcional(req.query);
    const fecha = req.query.fecha ?? hoy();
    const page = Number(req.query.page) || 1;
    const per = 10;
    const { inicio, fin } = rangoDia(fecha);
    const donde = { fecha: { gte: inicio, lt: fin } };

    const total = await prisma.cierreCaja.count({ where: donde });
    const lista = await prisma.cierreCaja.findMany({
        where: donde,
        orderBy: { id: 'desc' },
        skip: (page - 1) * per,
        take: per,
    });

    const data = lista.map((c) => ({
        id: c.id,
        created_at: fmtFechaHoraSeg(c.createdAt),
        cantidad: c.resumen?.cantidad ?? 0,
        total: c.resumen?.total ?? 0,
        fondo: c.fondoCentimos,
        esperado: c.esperadoCentimos,
        contado: c.contadoCentimos,
        diferencia: c.diferenciaCentimos,
        resultado: resultado(c),
        observaciones: c.observaciones,
        exportar_url: urlFirmada('caja.cierre.exportar', c.id, 3600, `/api/cierres/${c.id}/exportar`),
    }));

    res.json({ fecha, cierres: { ...paginar(page, total, per, `/api/cierres/lista?fecha=${fecha}`), data } });
}));

router.post('/guardar', as(async (req, res) => {
    const datos = req.body ?? {};

    try {
        validar(datos, {
            fecha: ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            fondo: ['required', 'regex:/^[0-9]{1,9}(\\.[0-9]{1,2})?$/'],
            contado: ['required', 'regex:/^[0-9]{1,9}(\\.[0-9]{1,2})?$/'],
            huella: ['required', 'string', 'size:64'],
            observaciones: ['nullable', 'string', 'max:2000'],
        }, {
            fondo: { regex: 'El fondo debe ser un importe positivo o cero, con un máximo de 9 enteros y 2 decimales.' },
            contado: { regex: 'El efectivo contado debe ser un importe positivo o cero, con un máximo de 9 enteros y 2 decimales.' },
        });

        const cierre = await cerrarCaja({
            fecha: String(datos.fecha),
            fondo: String(datos.fondo),
            contado: String(datos.contado),
            huellaCliente: String(datos.huella),
            observaciones: datos.observaciones ?? null,
        });

        res.json({
            redirect: '/caja/cierres',
            exito: `Cierre #${cierre.id} guardado: ${resultado(cierre)}. Puedes seguir cobrando.`,
            cierre: {
                id: cierre.id,
                fecha_corta: fmtCorta(cierre.fecha),
                exportar_url: urlFirmada('caja.cierre.exportar', cierre.id, 3600, `/api/cierres/${cierre.id}/exportar`),
            },
        });
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            return res.status(422).json({ errors: err.campos });
        }
        throw err;
    }
}));

router.get('/:pago/exportar', middlewareUrlFirmada('caja.cierre.exportar'), as(async (req, res) => {
    const cierre = await prisma.cierreCaja.findUnique({ where: { id: Number(req.params.pago) } });
    if (!cierre) {
        return res.status(404).json({ message: 'El cierre no existe.' });
    }

    const buffer = await generarExcelCierre(cierre);
    const nombre = `cierre-caja-${fmtCorta(cierre.fecha)}-${cierre.id}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(Buffer.from(buffer));
}));

export { router as routerCierres };