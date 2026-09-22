import { Router } from 'express';
import { prisma } from '../prisma.js';
import { as } from '../middleware/errores.js';
import { validar } from '../lib/validar.js';
import { paginar } from '../lib/paginador.js';
import { fmtFechaHora, rangoDia } from '../lib/fechas.js';
import { ESTADO_MATRICULA, nombreCompleto } from '../enums.js';

const router = Router();

router.get('/', as(async (req, res) => {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    const page = Number(req.query.page) || 1;
    const per = 20;

    validar(req.query, {
        estado: [`nullable`, `in:${Object.keys(ESTADO_MATRICULA).join(',')}`],
        fecha_inicio: ['nullable', 'date_format:Y-m-d'],
        fecha_fin: ['nullable', 'date_format:Y-m-d'],
    });

    const donde = {};
    const filtros = [];
    if (estado) {
        donde.estado = String(estado);
        filtros.push(`estado=${encodeURIComponent(estado)}`);
    }
    if (fecha_inicio) {
        const { inicio } = rangoDia(String(fecha_inicio));
        donde.createdAt = { ...(donde.createdAt ?? {}), gte: inicio };
        filtros.push(`fecha_inicio=${encodeURIComponent(fecha_inicio)}`);
    }
    if (fecha_fin) {
        const { fin } = rangoDia(String(fecha_fin));
        donde.createdAt = { ...(donde.createdAt ?? {}), lt: fin };
        filtros.push(`fecha_fin=${encodeURIComponent(fecha_fin)}`);
    }

    const [total, matriculas] = await Promise.all([
        prisma.matricula.count({ where: donde }),
        prisma.matricula.findMany({
            where: donde,
            orderBy: { id: 'desc' },
            skip: (page - 1) * per,
            take: per,
            include: { aspirante: true, programa: true },
        }),
    ]);

    const data = matriculas.map((m) => ({
        id: m.id,
        clave: m.numeroMatricula || String(m.id),
        aspirante: nombreCompleto(m.aspirante),
        documento: `${m.aspirante.tipoDocumento} ${m.aspirante.numeroDocumento}`.trim(),
        programa: m.programa?.nombre ?? 'Matrícula base',
        grupo: null,
        descuento: (m.descuentoCentimos ?? 0) / 100,
        valor_total: m.valorTotalCentimos / 100,
        estado: m.estado,
        estado_etiqueta: ESTADO_MATRICULA[m.estado] ?? m.estado,
        created_at: fmtFechaHora(m.createdAt),
    }));

    const [totalMatriculas, porEstadoArr, agregadoPagos] = await Promise.all([
        prisma.matricula.count(),
        prisma.matricula.groupBy({ by: ['estado'], _count: { _all: true } }),
        prisma.pago.aggregate({ _count: { _all: true }, _sum: { valorTotalCentimos: true } }),
    ]);

    const porEstado = Object.fromEntries(porEstadoArr.map((d) => [d.estado, d._count._all]));

    const resumen = {
        total_matriculas: totalMatriculas,
        pendientes: (porEstado.pendiente_pago ?? 0) + (porEstado.borrador ?? 0),
        completadas: (porEstado.pagada ?? 0) + (porEstado.matriculada ?? 0),
        canceladas: porEstado.cancelada ?? 0,
        total_pagos: agregadoPagos._count._all,
        monto_total: (agregadoPagos._sum.valorTotalCentimos ?? 0) / 100,
    };

    const sufijo = filtros.length ? `&${filtros.join('&')}` : '';
    const uri = `/api/reportes${sufijo}`;

    res.json({
        matriculas: { ...paginar(page, total, per, uri), data },
        resumen,
        estados: ESTADO_MATRICULA,
        estado: estado ?? null,
        fecha_inicio: fecha_inicio ?? null,
        fecha_fin: fecha_fin ?? null,
    });
}));

export { router as routerReportes };