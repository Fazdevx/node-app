import { prisma } from '../prisma.js';
import { GeneradorCodigo } from '../lib/codigo.js';
import { aCentavos, redondear } from '../monedero.js';
import { generarNumeroMatricula } from '../lib/numeroMatricula.js';
import { CodigoPagoError } from '../lib/errores.js';
import { config } from '../config.js';
import { METODO_POR_VALOR, ESTADO_MATRICULA } from '../enums.js';

const generador = new GeneradorCodigo(
    config.matricula.codigoPago.prefijo,
    config.matricula.codigoPago.longitud,
);

/**
 * Segundo paso del flujo: el cajero digita o escanea el código y el sistema
 * valida (existe, vigente, valor) y confirma la matrícula. Todo ocurre en una
 * transacción para que dos cajas no cobren el mismo código a la vez.
 */
export async function registrarPago(tx = prisma, {
    codigoIngresado,
    metodo,
    valorRecibido = null,
    referencia = null,
    descuento = null,
    notas = null,
    matricular = true,
}) {
    const canonico = generador.canonicalizar(codigoIngresado);

    if (canonico === null || !generador.esValido(canonico)) {
        throw CodigoPagoError.noEncontrado(codigoIngresado);
    }

    const met = METODO_POR_VALOR[metodo];

    const codigoPago = await tx.codigoPago.findUnique({ where: { codigo: canonico } });
    if (codigoPago === null) {
        throw CodigoPagoError.noEncontrado(codigoIngresado);
    }

    if (codigoPago.estado === 'usado') {
        throw CodigoPagoError.yaUsado(codigoPago.codigo);
    }
    if (codigoPago.estado === 'anulado') {
        throw CodigoPagoError.anulado(codigoPago.codigo);
    }
    if (new Date(codigoPago.expiraAt) < new Date()) {
        throw CodigoPagoError.expirado(codigoPago.codigo);
    }

    const matricula = await tx.matricula.findUnique({ where: { id: codigoPago.matriculaId } });
    if (!matricula || !['borrador', 'pendiente_pago'].includes(matricula.estado)) {
        throw CodigoPagoError.matriculaNoPagable(ESTADO_MATRICULA[matricula.estado]);
    }

    const valorCodigo = codigoPago.valorCentimos / 100;
    const descuentoAplicado = redondear(Math.max(0, descuento ?? 0));

    if (descuentoAplicado > valorCodigo) {
        throw CodigoPagoError.descuentoMayorAlValor(valorCodigo, descuentoAplicado);
    }

    const valorEsperado = redondear(valorCodigo - descuentoAplicado);
    const recibido = valorRecibido ?? valorEsperado;
    const total = met.permiteVuelto ? valorEsperado : redondear(recibido);

    if (met.permiteVuelto && redondear(recibido) < redondear(valorEsperado)) {
        throw CodigoPagoError.valorInsuficiente(valorEsperado, recibido);
    }
    if (!met.permiteVuelto && redondear(recibido) !== redondear(valorEsperado)) {
        throw CodigoPagoError.valorDebeSerExacto(valorEsperado, recibido);
    }
    if (met.requiereReferencia && String(referencia ?? '').trim() === '') {
        throw CodigoPagoError.referenciaRequerida(met.etiqueta);
    }

    const ahora = new Date();

    const pago = await tx.pago.create({
        data: {
            matriculaId: matricula.id,
            codigoPagoId: codigoPago.id,
            metodo,
            valorRecibidoCentimos: aCentavos(recibido),
            valorTotalCentimos: aCentavos(total),
            vueltoCentimos: aCentavos(redondear(recibido - total)),
            referencia: String(referencia ?? '').trim() || null,
            pagadoAt: ahora,
            ip: null,
            notas: notas ?? null,
        },
    });

    await tx.codigoPago.update({
        where: { id: codigoPago.id },
        data: { estado: 'usado', valorCentimos: aCentavos(valorEsperado), usadoAt: ahora },
    });

    const numeroNuevo = matricular
        ? (matricula.numeroMatricula ?? await generarNumeroMatricula(tx))
        : matricula.numeroMatricula;

    await tx.matricula.update({
        where: { id: matricula.id },
        data: {
            estado: matricular ? 'matriculada' : 'pagada',
            numeroMatricula: numeroNuevo,
            matriculadaAt: matricular ? ahora : matricula.matriculadaAt,
            descuentoCentimos: (matricula.descuentoCentimos ?? 0) + aCentavos(descuentoAplicado),
            valorTotalCentimos: aCentavos(valorEsperado),
        },
    });

    return tx.pago.findUnique({
        where: { id: pago.id },
        include: {
            matricula: { include: { aspirante: true, programa: true } },
            codigoPago: true,
        },
    });
}