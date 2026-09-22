import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { ErrorValidacion } from '../lib/errores.js';
import { fmtFechaHoraSeg, rangoDia } from '../lib/fechas.js';
import { METODOS, METODO_POR_VALOR, nombreCompleto, documento } from '../enums.js';

const dineroString = (centimos) => (centimos / 100).toFixed(2);

/** importe "12.3" -> 1230 (milesimas no: centavos exactos). */
export function centimos(importe) {
    const [entero, decimal = ''] = String(importe).split('.');
    const parte = (decimal + '00').slice(0, 2);
    return Number(entero || 0) * 100 + Number(parte || 0);
}

/** Pagos sin cerrar de una fecha (ordenados por id). */
export async function pagosPendientes(tx, fecha) {
    const { inicio, fin } = rangoDia(fecha);
    return tx.pago.findMany({
        where: { pagadoAt: { gte: inicio, lt: fin }, cierreCajaId: null },
        orderBy: { id: 'asc' },
        include: { matricula: { include: { aspirante: true } } },
    });
}

export function resumen(pagos) {
    const r = {
        cantidad: pagos.length,
        total: 0,
        efectivo: 0,
        metodos: Object.fromEntries(METODOS.map((m) => [m.valor, { etiqueta: m.etiqueta, cantidad: 0, total: 0 }])),
    };

    for (const pago of pagos) {
        const total = pago.valorTotalCentimos;
        r.total += total;
        const m = r.metodos[pago.metodo];
        m.cantidad += 1;
        m.total += total;
        if (pago.metodo === 'efectivo') {
            r.efectivo += pago.valorRecibidoCentimos - pago.vueltoCentimos;
        }
    }

    return r;
}

/** Huella SHA-256 del listado de pagos (para detectar cambios al cerrar). */
export function huella(pagos) {
    const datos = pagos.map((p) => [
        p.id,
        p.metodo,
        dineroString(p.valorTotalCentimos),
        dineroString(p.valorRecibidoCentimos),
        dineroString(p.vueltoCentimos),
    ]);
    return crypto.createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}

export function resultado(diferenciaCentimos) {
    if (diferenciaCentimos > 0) {
        return 'Sobrante';
    }
    if (diferenciaCentimos < 0) {
        return 'Faltante';
    }
    return 'Cuadrado';
}

export async function cerrarCaja({ fecha, fondo, contado, huellaCliente, observaciones }) {
    return prisma.$transaction(async (tx) => {
        const pagos = await pagosPendientes(tx, fecha);

        if (pagos.length === 0) {
            throw new ErrorValidacion({ cierre: 'No hay pagos pendientes para cerrar en esta fecha.' });
        }
        if (huella(pagos) !== huellaCliente) {
            throw new ErrorValidacion({ cierre: 'Los pagos cambiaron. Actualiza el resumen y revisa el reconteo antes de cerrar.' });
        }

        const r = resumen(pagos);
        const fondoC = centimos(fondo);
        const contadoC = centimos(contado);
        const esperadoC = fondoC + r.efectivo;

        const [y, m, d] = fecha.split('-').map(Number);
        const cierre = await tx.cierreCaja.create({
            data: {
                fecha: new Date(y, m - 1, d, 0, 0, 0, 0),
                fondoCentimos: fondoC,
                contadoCentimos: contadoC,
                esperadoCentimos: esperadoC,
                diferenciaCentimos: contadoC - esperadoC,
                observaciones: observaciones ?? null,
                resumen: {
                    cantidad: r.cantidad,
                    total: r.total,
                    efectivo: r.efectivo,
                    metodos: METODOS.map((m) => r.metodos[m.valor]),
                },
                detalle: pagos.map((p) => ({
                    recibo: p.id,
                    fecha: fmtFechaHoraSeg(p.pagadoAt),
                    aspirante: nombreCompleto(p.matricula.aspirante),
                    documento: documento(p.matricula.aspirante),
                    metodo: METODO_POR_VALOR[p.metodo].etiqueta,
                    total: p.valorTotalCentimos / 100,
                    recibido: p.valorRecibidoCentimos / 100,
                    vuelto: p.vueltoCentimos / 100,
                    referencia: p.referencia ?? '',
                })),
            },
        });

        const actualizados = await tx.pago.updateMany({
            where: { id: { in: pagos.map((p) => p.id) }, cierreCajaId: null },
            data: { cierreCajaId: cierre.id },
        });

        if (actualizados.count !== pagos.length) {
            throw new ErrorValidacion({ cierre: 'Otro cierre tomó estos pagos. Actualiza el resumen.' });
        }

        return cierre;
    });
}