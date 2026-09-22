import { formatoEs } from '../monedero.js';

export class AppError extends Error {
    constructor(message, codigo = 'app_error', http = 422, campos = null) {
        super(message);
        this.name = 'AppError';
        this.codigo = codigo;
        this.http = http;
        this.campos = campos;
    }
}

/**
 * Errores de negocio del cobro por código de pago (el cajero digitó un
 * código que no se puede cobrar). Cada caso tiene su código legible.
 */
export class CodigoPagoError extends AppError {
    constructor(message, codigoError) {
        super(message, codigoError, 422);
        this.codigoError = codigoError;
    }

    static noEncontrado(codigo) {
        return new CodigoPagoError(
            `No existe ningun codigo de pago "${codigo}". Verifica que este bien escrito.`,
            'codigo_no_encontrado',
        );
    }

    static yaUsado(codigo) {
        return new CodigoPagoError(
            `El codigo "${codigo}" ya fue usado y no se puede cobrar dos veces.`,
            'codigo_ya_usado',
        );
    }

    static anulado(codigo) {
        return new CodigoPagoError(
            `El codigo "${codigo}" fue anulado (se emitio uno nuevo). Usa el codigo vigente.`,
            'codigo_anulado',
        );
    }

    static expirado(codigo) {
        return new CodigoPagoError(
            `El codigo "${codigo}" vencio. Emite un codigo nuevo para esta matricula.`,
            'codigo_expirado',
        );
    }

    static matriculaNoPagable(estado) {
        return new CodigoPagoError(
            `La matricula esta en estado "${estado}" y ya no admite pagos.`,
            'matricula_no_pagable',
        );
    }

    static valorInsuficiente(esperado, recibido) {
        return new CodigoPagoError(
            `El valor recibido (${formatoEs(recibido)}) es menor al valor del codigo de pago (${formatoEs(esperado)}).`,
            'valor_insuficiente',
        );
    }

    static valorDebeSerExacto(esperado, recibido) {
        return new CodigoPagoError(
            `Con este medio el monto debe ser exacto: esperado ${formatoEs(esperado)}, recibido ${formatoEs(recibido)}.`,
            'valor_debe_ser_exacto',
        );
    }

    static descuentoMayorAlValor(valor, descuento) {
        return new CodigoPagoError(
            `El descuento (${formatoEs(descuento)}) no puede ser mayor al valor del codigo de pago (${formatoEs(valor)}).`,
            'descuento_mayor_al_valor',
        );
    }

    static referenciaRequerida(metodo) {
        return new CodigoPagoError(
            `Con ${metodo} debes digitar el numero de operacion (referencia).`,
            'referencia_requerida',
        );
    }
}

/** Validación de formularios compuesta (mensaje global + mapa de errores por campo). */
export class ErrorValidacion extends AppError {
    constructor(campos) {
        super('Los datos enviados no son válidos.', 'validation_failed', 422, campos);
    }
}

export const esMayorDeEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) {
        return true;
    }
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
        edad -= 1;
    }
    return edad >= 18;
};