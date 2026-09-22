import { config } from '../config.js';

/**
 * Número de matrícula definitivo AÑO-CONSECUTIVO (2026-000123).
 * El consecutivo se calcula con el máximo existente del año; la columna
 * UNIQUE de la base protege contra dos cajeros cobrando a la vez.
 */
export function formatearConsecutivo(consecutivo) {
    const digitos = Math.max(1, config.matricula.numeroMatricula.digitosConsecutivo);
    return String(consecutivo).padStart(digitos, '0');
}

export async function generarNumeroMatricula(tx, anio = null) {
    const a = anio ?? new Date().getFullYear();
    const prefijo = `${String(a).padStart(4, '0')}-`;

    const ultimo = await tx.matricula.findFirst({
        where: { numeroMatricula: { startsWith: prefijo } },
        orderBy: { numeroMatricula: 'desc' },
        select: { numeroMatricula: true },
    });

    const consecutivo = ultimo?.numeroMatricula
        ? Number(ultimo.numeroMatricula.slice(prefijo.length)) + 1
        : 1;

    return `${prefijo}${formatearConsecutivo(consecutivo)}`;
}