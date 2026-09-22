import { config } from './config.js';
import { GeneradorCodigo } from './codigo.js';
import { mutar, leer, siguienteId, buscar, ahoraIso } from './storage.js';
import { aCentavos, redondear } from './monedero.js';
import { AppError, CodigoPagoError, ErrorValidacion } from './errores.js';
import { METODOS, METODO_POR_VALOR, ESTADO_MATRICULA, nombreCompleto, documento } from './enums.js';
import { fmtFecha, fmtFechaHora, fmtFechaHoraSeg, rangoDia } from './fechas.js';

const generador = new GeneradorCodigo(
    config.matricula.codigoPago.prefijo,
    config.matricula.codigoPago.longitud,
);

const dineroString = (centimos) => (centimos / 100).toFixed(2);

export function programaDefecto(db) {
    const precio = aCentavos(redondear(config.matricula.precioMatricula));
    let programa = db.programas.find((p) => p.codigo === config.matricula.programaDefecto.codigo);
    if (!programa) {
        programa = {
            id: siguienteId(db, 'programa'),
            codigo: config.matricula.programaDefecto.codigo,
            nombre: config.matricula.programaDefecto.nombre,
            descripcion: 'Programa único de la academia pre-universitaria.',
            intensidadHoraria: 0,
            duracionMeses: 1,
            precioCentimos: precio,
            cuposTotales: 0,
            activo: true,
            createdAt: ahoraIso(),
            updatedAt: ahoraIso(),
        };
        db.programas.push(programa);
    } else if (programa.precioCentimos !== precio) {
        programa.precioCentimos = precio;
        programa.updatedAt = ahoraIso();
    }
    return programa;
}

const CAMPOS_ASPIRANTE = {
    tipo_documento: 'tipoDocumento',
    numero_documento: 'numeroDocumento',
    nombres: 'nombres',
    apellidos: 'apellidos',
    fecha_nacimiento: 'fechaNacimiento',
    email: 'email',
    telefono: 'telefono',
    direccion: 'direccion',
    ciudad: 'ciudad',
    acudiente_nombre: 'acudienteNombre',
    acudiente_telefono: 'acudienteTelefono',
    autoriza_datos: 'autorizaDatos',
    modalidad: 'modalidad',
    turno: 'turno',
    apoderado_tipo_documento: 'apoderadoTipoDocumento',
    apoderado_numero_documento: 'apoderadoNumeroDocumento',
    apoderado_direccion: 'apoderadoDireccion',
};

const CLAVES_EXCLUIDAS = ['observaciones', 'metodo', 'valor_recibido', 'referencia', 'descuento', 'matricular', '_token'];

export function mapearAspirante(datos) {
    const resultado = {};
    for (const [clave, valor] of Object.entries(datos ?? {})) {
        if (CLAVES_EXCLUIDAS.includes(clave)) {
            continue;
        }
        const campo = CAMPOS_ASPIRANTE[clave];
        if (campo) {
            resultado[campo] = valor;
        }
    }
    if (resultado.fechaNacimiento === '' || resultado.fechaNacimiento === null || resultado.fechaNacimiento === undefined) {
        resultado.fechaNacimiento = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(resultado.fechaNacimiento))) {
        resultado.fechaNacimiento = String(resultado.fechaNacimiento);
    }
    return resultado;
}

function resolverAspirante(db, datos) {
    const limpio = mapearAspirante(datos);
    const tipo = String(limpio.tipoDocumento ?? '');
    const numeroDocumento = String(limpio.numeroDocumento ?? '');

    const existente = db.aspirantes.find((a) => a.tipoDocumento === tipo && a.numeroDocumento === numeroDocumento);

    if (existente) {
        const { tipoDocumento: _t, numeroDocumento: _n, ...resto } = limpio;
        Object.assign(existente, resto, { updatedAt: ahoraIso() });
        return existente;
    }

    const aspirante = {
        id: siguienteId(db, 'aspirante'),
        ...limpio,
        autorizaDatos: Boolean(limpio.autorizaDatos),
        createdAt: ahoraIso(),
        updatedAt: ahoraIso(),
    };
    db.aspirantes.push(aspirante);
    return aspirante;
}

export function formatearConsecutivo(consecutivo) {
    const digitos = Math.max(1, config.matricula.numeroMatricula.digitosConsecutivo);
    return String(consecutivo).padStart(digitos, '0');
}

export function generarNumeroMatriculaNuevo(db, anio = null) {
    const a = anio ?? new Date().getFullYear();
    const prefijo = `${String(a).padStart(4, '0')}-`;
    const conNumero = db.matriculas
        .filter((m) => m.numeroMatricula && m.numeroMatricula.startsWith(prefijo))
        .sort((x, y) => y.numeroMatricula.localeCompare(x.numeroMatricula));
    const consecutivo = conNumero.length > 0
        ? Number(conNumero[0].numeroMatricula.slice(prefijo.length)) + 1
        : 1;
    return `${prefijo}${formatearConsecutivo(consecutivo)}`;
}

function emitirCodigo(db, matricula, { valorCentimos = null, horasVigencia = null } = {}) {
    const ahora = new Date();

    for (const previo of db.codigosPago) {
        if (previo.matriculaId === matricula.id && previo.estado === 'pendiente' && new Date(previo.expiraAt) > ahora) {
            previo.estado = 'anulado';
            previo.anuladoAt = ahoraIso();
            previo.updatedAt = ahoraIso();
        }
    }

    let codigo = null;
    for (let intento = 0; intento < 10; intento += 1) {
        const candidato = generador.generar();
        if (!db.codigosPago.some((c) => c.codigo === candidato)) {
            codigo = candidato;
            break;
        }
    }
    if (codigo === null) {
        throw new AppError('No fue posible generar un código de pago único después de 10 intentos.', 'codigo_sin_generar', 409);
    }

    const vigencia = horasVigencia ?? config.matricula.codigoPago.vigenciaHoras;
    const expiraAt = new Date(ahora.getTime() + vigencia * 60 * 60 * 1000);

    const nuevo = {
        id: siguienteId(db, 'codigopago'),
        matriculaId: matricula.id,
        codigo,
        valorCentimos: valorCentimos ?? matricula.valorTotalCentimos,
        estado: 'pendiente',
        expiraAt: expiraAt.toISOString(),
        usadoAt: null,
        anuladoAt: null,
        createdAt: ahoraIso(),
        updatedAt: ahoraIso(),
    };
    db.codigosPago.push(nuevo);
    return nuevo;
}

function matriculaConRelaciones(db, matricula) {
    return {
        ...matricula,
        aspirante: buscar(db, 'aspirantes', matricula.aspiranteId),
        programa: buscar(db, 'programas', matricula.programaId),
        codigosPago: db.codigosPago
            .filter((c) => c.matriculaId === matricula.id)
            .sort((a, b) => b.id - a.id),
        pagos: db.pagos
            .filter((p) => p.matriculaId === matricula.id)
            .sort((a, b) => a.id - b.id),
    };
}

export function iniciarMatricula(datosAspirante, { descuento = 0, horasVigencia = null, observaciones = null } = {}) {
    return mutar((db) => {
        if (descuento < 0) {
            throw new AppError('El descuento no puede ser negativo.', 'descuento_negativo', 422);
        }

        const programa = programaDefecto(db);
        const precio = programa.precioCentimos / 100;

        if (descuento > precio) {
            throw new AppError('El descuento no puede ser mayor al precio de la matrícula.', 'descuento_mayor_al_precio', 422);
        }

        const aspirante = resolverAspirante(db, datosAspirante);
        const valorTotal = redondear(precio - descuento);

        const matricula = {
            id: siguienteId(db, 'matricula'),
            numeroMatricula: null,
            aspiranteId: aspirante.id,
            programaId: programa.id,
            estado: 'pendiente_pago',
            valorBaseCentimos: aCentavos(precio),
            descuentoCentimos: aCentavos(descuento),
            valorTotalCentimos: aCentavos(valorTotal),
            observaciones: observaciones ?? null,
            matriculadaAt: null,
            createdAt: ahoraIso(),
            updatedAt: ahoraIso(),
        };
        db.matriculas.push(matricula);

        emitirCodigo(db, matricula, { valorCentimos: matricula.valorTotalCentimos, horasVigencia });

        return matriculaConRelaciones(db, matricula);
    });
}

function pagoConRelaciones(db, pago) {
    return {
        ...pago,
        matricula: matriculaConRelaciones(db, buscar(db, 'matriculas', pago.matriculaId)),
        codigoPago: pago.codigoPagoId ? buscar(db, 'codigosPago', pago.codigoPagoId) : null,
    };
}

export function cobrarCodigo({
    codigoIngresado,
    metodo,
    valorRecibido = null,
    referencia = null,
    descuento = null,
    notas = null,
}) {
    return mutar((db) => {
        const canonico = generador.canonicalizar(codigoIngresado);

        if (canonico === null || !generador.esValido(canonico)) {
            throw CodigoPagoError.noEncontrado(codigoIngresado);
        }

        const met = METODO_POR_VALOR[metodo];
        if (!met) {
            throw CodigoPagoError.noEncontrado(codigoIngresado);
        }

        const codigoPago = db.codigosPago.find((c) => c.codigo === canonico);
        if (!codigoPago) {
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

        const matricula = buscar(db, 'matriculas', codigoPago.matriculaId);
        if (!matricula || !['borrador', 'pendiente_pago'].includes(matricula.estado)) {
            const estadoEtiqueta = estadoMatriculaEtiqueta(matricula?.estado);
            throw CodigoPagoError.matriculaNoPagable(estadoEtiqueta);
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

        const pago = {
            id: siguienteId(db, 'pago'),
            matriculaId: matricula.id,
            codigoPagoId: codigoPago.id,
            metodo,
            valorRecibidoCentimos: aCentavos(recibido),
            valorTotalCentimos: aCentavos(total),
            vueltoCentimos: aCentavos(redondear(recibido - total)),
            referencia: String(referencia ?? '').trim() || null,
            pagadoAt: ahoraIso(),
            ip: null,
            notas: notas ?? null,
            cierreCajaId: null,
            createdAt: ahoraIso(),
            updatedAt: ahoraIso(),
        };
        db.pagos.push(pago);

        codigoPago.estado = 'usado';
        codigoPago.valorCentimos = aCentavos(valorEsperado);
        codigoPago.usadoAt = ahoraIso();
        codigoPago.updatedAt = ahoraIso();

        const numeroNuevo = matricula.numeroMatricula ?? generarNumeroMatriculaNuevo(db);
        matricula.estado = 'matriculada';
        matricula.numeroMatricula = numeroNuevo;
        matricula.matriculadaAt = ahoraIso();
        matricula.descuentoCentimos = (matricula.descuentoCentimos ?? 0) + aCentavos(descuentoAplicado);
        matricula.valorTotalCentimos = aCentavos(valorEsperado);
        matricula.updatedAt = ahoraIso();

        return pagoConRelaciones(db, pago);
    });
}

export function matricularPresencial({
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

    const observacionFinal = `Presencial en caja. ${observaciones ?? ''}`.trim();
    const matricula = iniciarMatricula(datosAspirante, {
        descuento: 0,
        observaciones: observacionFinal,
    });

    const codigo = matricula.codigosPago[0].codigo;

    cobrarCodigo({
        codigoIngresado: codigo,
        metodo,
        valorRecibido,
        referencia,
        descuento,
        notas: `Matrícula presencial (${met.etiqueta}).`,
    });

    return mutar((db) => matriculaConRelaciones(db, buscar(db, 'matriculas', matricula.id)));
}

export function valorDeCodigo(codigo) {
    if (!codigo) {
        return null;
    }
    const canonico = generador.canonicalizar(codigo);
    if (canonico === null || !generador.esValido(canonico)) {
        return null;
    }
    const codigoPago = leer().codigosPago.find((c) => c.codigo === canonico);
    if (!codigoPago || codigoPago.estado !== 'pendiente' || new Date(codigoPago.expiraAt) < new Date()) {
        return null;
    }
    return codigoPago.valorCentimos / 100;
}

export function buscarCodigoVigente(codigo) {
    const db = leer();
    const c = String(codigo).toUpperCase().trim();
    const codigoPago = db.codigosPago.find((x) => x.codigo === c);

    if (!codigoPago || codigoPago.estado !== 'pendiente' || new Date(codigoPago.expiraAt) <= new Date()) {
        throw new AppError(
            'Este código de pago ya no es válido (usado, anulado o expirado).',
            'codigo_no_vigente',
            410,
        );
    }

    const matricula = buscar(db, 'matriculas', codigoPago.matriculaId);
    return {
        codigoPago,
        matricula: matriculaConRelaciones(db, matricula),
    };
}

export function estadoMatriculaEtiqueta(estado) {
    return ESTADO_MATRICULA[estado] ?? estado;
}

export function aspirantePorDocumento(tipoDocumento, numeroDocumento) {
    return leer().aspirantes.find((a) => a.tipoDocumento === String(tipoDocumento) && a.numeroDocumento === String(numeroDocumento));
}

export function transformarMatricula(m) {
    const vigente = m.codigosPago
        ? m.codigosPago.find((c) => c.estado === 'pendiente' && new Date(c.expiraAt) > new Date())
        : null;

    return {
        id: m.id,
        estado: m.estado,
        estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
        numero_matricula: m.numeroMatricula,
        descuento: (m.descuentoCentimos ?? 0) / 100,
        valor_total: m.valorTotalCentimos / 100,
        created_at: m.createdAt ? fmtFecha(new Date(m.createdAt)) : null,
        codigo_vigente: vigente
            ? { codigo: vigente.codigo, expira_at: fmtFechaHora(new Date(vigente.expiraAt)) }
            : null,
        pagos: (m.pagos ?? []).map((p) => ({
            metodo: p.metodo,
            pagado_at: p.pagadoAt ? fmtFechaHora(new Date(p.pagadoAt)) : null,
            valor_total: p.valorTotalCentimos / 100,
            valor_recibido: p.valorRecibidoCentimos / 100,
            vuelto: p.vueltoCentimos / 100,
        })),
    };
}

export function matriculasDeAspirante(aspiranteId) {
    const db = leer();
    return db.matriculas
        .filter((m) => m.aspiranteId === Number(aspiranteId))
        .sort((a, b) => b.id - a.id)
        .map((m) => transformarMatricula({
            ...m,
            codigosPago: db.codigosPago.filter((c) => c.matriculaId === m.id),
            pagos: db.pagos.filter((p) => p.matriculaId === m.id),
        }));
}

export function listarMatriculas(estados, page = 1, perPagina = 20) {
    const db = leer();
    const filtradas = db.matriculas
        .filter((m) => estados.includes(m.estado))
        .sort((a, b) => b.id - a.id);

    const total = filtradas.length;
    const inicio = (Math.max(1, Number(page) || 1) - 1) * perPagina;
    const pagina = filtradas.slice(inicio, inicio + perPagina);

    const filas = pagina.map((m) => {
        const conRel = matriculaConRelaciones(db, m);
        const pendiente = conRel.codigosPago.find((c) => c.estado === 'pendiente' && new Date(c.expiraAt) > new Date());
        const pagos = conRel.pagos;
        const ultimoPago = pagos.length ? [...pagos].sort((a, b) => new Date(b.pagadoAt) - new Date(a.pagadoAt))[0] : null;

        return {
            id: m.id,
            aspirante: nombreCompleto(conRel.aspirante),
            documento: documento(conRel.aspirante),
            valor_total: m.valorTotalCentimos / 100,
            estado: m.estado,
            estado_etiqueta: estadoMatriculaEtiqueta(m.estado),
            codigo_vigente: Boolean(pendiente),
            total_pagado: ultimoPago ? ultimoPago.valorTotalCentimos / 100 : m.valorTotalCentimos / 100,
            pagado_at: ultimoPago ? fmtFechaHoraSeg(new Date(ultimoPago.pagadoAt)) : null,
            ultimo_pago_id: ultimoPago?.id ?? null,
        };
    });

    return { total, filas };
}

export function reciboDePago(pagoId) {
    const db = leer();
    const pago = db.pagos.find((p) => p.id === Number(pagoId));
    if (!pago) {
        throw new AppError('El recibo no existe.', 'recibo_no_encontrado', 404);
    }
    return pagoConRelaciones(db, pago);
}

export function pagosPendientes(fecha) {
    const db = leer();
    const { inicio, fin } = rangoDia(fecha);
    return db.pagos
        .filter((p) => {
            const d = new Date(p.pagadoAt);
            return d >= inicio && d < fin && p.cierreCajaId === null;
        })
        .sort((a, b) => a.id - b.id)
        .map((p) => pagoConRelaciones(db, p));
}

export function resumenCierre(pagos) {
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

export async function huellaPagos(pagos) {
    const datos = pagos.map((p) => [
        p.id,
        p.metodo,
        dineroString(p.valorTotalCentimos),
        dineroString(p.valorRecibidoCentimos),
        dineroString(p.vueltoCentimos),
    ]);
    const bytes = new TextEncoder().encode(JSON.stringify(datos));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function resultadoCierre(diferenciaCentimos) {
    if (diferenciaCentimos > 0) {
        return 'Sobrante';
    }
    if (diferenciaCentimos < 0) {
        return 'Faltante';
    }
    return 'Cuadrado';
}

function centimos(importe) {
    const [entero, decimal = ''] = String(importe).split('.');
    const parte = (decimal + '00').slice(0, 2);
    return Number(entero || 0) * 100 + Number(parte || 0);
}

export function detallePago(pago) {
    return {
        recibo: String(pago.id).padStart(6, '0'),
        fecha: fmtFechaHoraSeg(new Date(pago.pagadoAt)),
        aspirante: nombreCompleto(pago.matricula.aspirante),
        documento: documento(pago.matricula.aspirante),
        metodo: METODO_POR_VALOR[pago.metodo]?.etiqueta ?? pago.metodo,
        total: pago.valorTotalCentimos / 100,
        recibido: pago.valorRecibidoCentimos / 100,
        vuelto: pago.vueltoCentimos / 100,
        referencia: pago.referencia ?? '',
    };
}

export async function cerrarCajaAccion({ fecha, fondo, contado, huellaCliente, observaciones }) {
    const pagos = pagosPendientes(fecha);

    if (pagos.length === 0) {
        throw new ErrorValidacion({ cierre: 'No hay pagos pendientes para cerrar en esta fecha.' });
    }
    if (await huellaPagos(pagos) !== huellaCliente) {
        throw new ErrorValidacion({ cierre: 'Los pagos cambiaron. Actualiza el resumen y revisa el reconteo antes de cerrar.' });
    }

    const r = resumenCierre(pagos);
    const fondoC = centimos(fondo);
    const contadoC = centimos(contado);
    const esperadoC = fondoC + r.efectivo;

    return mutar((db) => {
        const ids = pagos.map((p) => p.id);
        const pendientesPresentes = db.pagos.filter((p) => ids.includes(p.id) && p.cierreCajaId === null);
        if (pendientesPresentes.length !== ids.length) {
            throw new ErrorValidacion({ cierre: 'Otro cierre tomó estos pagos. Actualiza el resumen.' });
        }

        const cierre = {
            id: siguienteId(db, 'cierrecaja'),
            fecha,
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
            detalle: pagos.map(detallePago),
            createdAt: ahoraIso(),
            updatedAt: ahoraIso(),
        };
        db.cierres.push(cierre);

        for (const p of db.pagos) {
            if (ids.includes(p.id)) {
                p.cierreCajaId = cierre.id;
                p.updatedAt = ahoraIso();
            }
        }

        return cierre;
    });
}

export function listarCierres(fecha, page = 1, per = 10) {
    const db = leer();
    const { inicio, fin } = rangoDia(fecha);
    const filtrados = db.cierres
        .filter((c) => {
            const d = new Date(`${c.fecha}T12:00:00`);
            return d >= inicio && d < fin;
        })
        .sort((a, b) => b.id - a.id);

    const total = filtrados.length;
    const ini = (Math.max(1, Number(page) || 1) - 1) * per;
    const lista = filtrados.slice(ini, ini + per).map((c) => ({
        id: c.id,
        created_at: fmtFechaHoraSeg(new Date(c.createdAt)),
        cantidad: c.resumen?.cantidad ?? 0,
        total: c.resumen?.total ?? 0,
        fondo: c.fondoCentimos,
        esperado: c.esperadoCentimos,
        contado: c.contadoCentimos,
        diferencia: c.diferenciaCentimos,
        resultado: resultadoCierre(c.diferenciaCentimos),
        observaciones: c.observaciones,
    }));

    return { total, lista };
}

export function cierrePorId(id) {
    return leer().cierres.find((c) => c.id === Number(id)) ?? null;
}