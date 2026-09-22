import { prisma } from '../prisma.js';
import { iniciarMatricula } from './iniciarMatricula.js';
import { registrarPago } from './registrarPago.js';
import { AppError } from '../lib/errores.js';
import { METODO_POR_VALOR } from '../enums.js';
import { redondear } from '../monedero.js';

/**
 * Matrícula presencial: el cajero llena los datos en ventanilla y cobra en
 * el mismo acto. Reutiliza iniciarMatricula (matrícula + código interno) y
 * registrarPago (valida método / referencia / vuelto): las reglas de negocio
 * viven en un solo lugar para ambos flujos.
 */
export async function matricularEnCaja({
    datosAspirante,
    metodo = 'efectivo',
    valorRecibido = null,
    referencia = null,
    descuento = 0,
    observaciones = null,
}) {
    const met = METODO_POR_VALOR[metodo];

    if (met.requiereReferencia && String(referencia ?? '').trim() === '') {
        throw new AppError(
            `El método ${met.etiqueta} exige el número de operación / referencia.`,
            'referencia_requerida',
            422,
        );
    }

    return prisma.$transaction(async (tx) => {
        const observacionFinal = `Presencial en caja. ${observaciones ?? ''}`.trim();

        const matricula = await iniciarMatricula(tx, datosAspirante, {
            descuento: 0,
            observaciones: observacionFinal,
        });

        const codigo = matricula.codigosPago[0].codigo;

        await registrarPago(tx, {
            codigoIngresado: codigo,
            metodo,
            valorRecibido,
            referencia,
            descuento,
            notas: `Matrícula presencial (${met.etiqueta}).`,
        });

        return tx.matricula.findUnique({
            where: { id: matricula.id },
            include: { aspirante: true, codigosPago: true, pagos: true },
        });
    });
}

/** Pre-calcula el vuelto para mostrarlo en pantalla antes de confirmar. */
export function simularVuelto(total, recibido = null) {
    const t = redondear(total);
    const r = redondear(recibido ?? t);

    return {
        total: t,
        recibido: r,
        vuelto: Math.max(0, redondear(r - t)),
        falta: Math.max(0, redondear(t - r)),
    };
}