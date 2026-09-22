import { config } from './lib/config.js';
import { TIPOS_DOCUMENTO, METODOS, ESTADO_MATRICULA, opciones, nombreCompleto, documento, METODO_POR_VALOR } from './lib/enums.js';
import { validar } from './lib/validar.js';
import { ErrorValidacion, AppError, CodigoPagoError } from './lib/errores.js';
import { paginar } from './lib/paginador.js';
import { fmtFecha, fmtFechaHora, fmtFechaHoraSeg, fmtCorta, rangoDia } from './lib/fechas.js';
import { leer, reinit } from './lib/storage.js';
import * as negocio from './lib/negocio.js';
import { qrSvg } from './lib/qr.js';
import { generarReciboPdfDataUrl } from './lib/pdf.js';
import { enlaceWhatsapp, nombreArchivo } from './lib/recibos.js';

const listaTipos = TIPOS_DOCUMENTO.map((t) => t.valor).join(',');
const listaMetodos = METODOS.map((m) => m.valor).join(',');
const hoy = () => fmtCorta(new Date());

function errorCliente(datos, status = 422) {
    const error = new Error(datos.message || 'No se pudo completar la solicitud.');
    error.status = status;
    error.datos = datos;
    return error;
}

function parsearRuta(ruta) {
    const [pathname, busqueda = ''] = String(ruta || '').split('?');
    const query = new URLSearchParams(busqueda);
    return { pathname, query, body: null };
}

const validarFechaOpcional = (query) => {
    if (query.get('fecha') !== undefined && query.get('fecha') !== '') {
        validar({ fecha: query.get('fecha') }, { fecha: ['required', 'date_format:Y-m-d', 'before_or_equal:today'] });
    }
};

const validarReciboPago = (pago, matricula) => {
    const a = matricula.aspirante;

    return {
        numero: String(pago.id).padStart(6, '0'),
        fecha: fmtFechaHora(new Date(pago.pagadoAt)),
        numero_matricula: matricula.numeroMatricula,
        estado_etiqueta: negocio.estadoMatriculaEtiqueta(matricula.estado),
        concepto: matricula.programa?.nombre ?? 'Matrícula pre-universitaria',
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
            metodo_etiqueta: METODO_POR_VALOR[pago.metodo]?.etiqueta ?? pago.metodo,
            codigo: pago.codigoPago?.codigo ?? null,
            referencia: pago.referencia,
            precio: matricula.valorBaseCentimos / 100,
            descuento: matricula.descuentoCentimos / 100,
            total: pago.valorTotalCentimos / 100,
            recibido: pago.valorRecibidoCentimos / 100,
            vuelto: pago.vueltoCentimos / 100,
            registrado_por: null,
        },
    };
};

async function rutaMatricula(metodo, { query, body }) {
    if (metodo === 'GET') {
        return {
            tiposDocumento: opciones(TIPOS_DOCUMENTO),
            precioMatricula: config.matricula.precioMatricula,
        };
    }

    try {
        validar(body, {
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

        const matricula = negocio.iniciarMatricula(body, {
            descuento: 0,
            observaciones: body.observaciones ?? null,
        });

        const codigo = matricula.codigosPago[0].codigo;

        return {
            redirect: `/codigo-pago/${encodeURIComponent(codigo)}`,
            exito: '¡Listo! Tu código de pago fue generado. Preséntalo en caja para finalizar tu matrícula.',
        };
    } catch (err) {
        throw errorCliente({ message: err.message, errors: err.campos ?? {} });
    }
}

async function rutaCodigoPago(codigo) {
    const { codigoPago, matricula } = negocio.buscarCodigoVigente(codigo);
    const qr = await qrSvg(codigoPago.codigo, 180);

    return {
        codigoPago: {
            codigo: codigoPago.codigo,
            valor: (codigoPago.valorCentimos / 100).toFixed(2),
            expira_at: fmtFechaHora(new Date(codigoPago.expiraAt)),
            aspirante: nombreCompleto(matricula.aspirante),
            qr,
        },
    };
}

function rutaMisPagos({ query }) {
    const tiposDocumento = opciones(TIPOS_DOCUMENTO);
    const tipo = query.get('tipo_documento');
    const numero = query.get('numero_documento');

    if (!tipo || !numero) {
        return { tiposDocumento, consultado: false, aspirante: null, matriculas: [] };
    }

    validar({ tipo_documento: tipo, numero_documento: numero }, {
        tipo_documento: ['required', `in:${listaTipos}`],
        numero_documento: ['required', 'max:30'],
    });

    const aspirante = negocio.aspirantePorDocumento(tipo, numero);
    if (!aspirante) {
        return { tiposDocumento, consultado: true, aspirante: null, matriculas: [] };
    }

    return {
        tiposDocumento,
        consultado: true,
        aspirante: { nombre: nombreCompleto(aspirante), documento: documento(aspirante) },
        matriculas: negocio.matriculasDeAspirante(aspirante.id),
    };
}

function rutaCaja({ query, body }, metodo) {
    if (metodo === 'GET') {
        const { codigo } = Object.fromEntries(query);
        const valorCodigo = negocio.valorDeCodigo(codigo ?? null);
        return {
            metodos: opciones(METODOS),
            valorCodigo,
            precioMatricula: config.matricula.precioMatricula,
        };
    }

    try {
        validar(body, {
            codigo: ['required', 'string', 'max:40'],
            metodo: ['required', `in:${listaMetodos}`],
            valor_recibido: ['nullable', 'numeric', 'min:0', 'max:99999999'],
            referencia: ['nullable', 'string', 'max:60'],
            descuento: ['nullable', 'numeric', 'min:0', 'max:99999999'],
        });

        const pago = negocio.cobrarCodigo({
            codigoIngresado: String(body.codigo),
            metodo: String(body.metodo),
            valorRecibido: body.valor_recibido ? Number(body.valor_recibido) : null,
            referencia: body.referencia,
            descuento: Number(body.descuento ?? 0),
            notas: null,
        });

        return {
            redirect: `/caja/recibo/${pago.id}`,
            exito: 'Pago registrado y matricula confirmada.',
        };
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            throw errorCliente({ errors: err.campos, valorCodigo: negocio.valorDeCodigo(body.codigo) });
        }
        if (err instanceof CodigoPagoError || err instanceof AppError) {
            throw errorCliente({ errors: { codigo: err.message }, valorCodigo: negocio.valorDeCodigo(body.codigo) });
        }
        throw err;
    }
}

async function rutaPresencial({ body }, metodo) {
    if (metodo === 'GET') {
        return {
            tiposDocumento: opciones(TIPOS_DOCUMENTO),
            metodos: opciones(METODOS),
            precioMatricula: config.matricula.precioMatricula,
        };
    }

    const datos = { ...(body ?? {}) };

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

        const matricula = negocio.matricularPresencial({
            datosAspirante: datos,
            metodo: String(datos.metodo),
            valorRecibido: datos.valor_recibido ? Number(datos.valor_recibido) : null,
            referencia: datos.referencia,
            descuento: Number(datos.descuento ?? 0),
            observaciones: String(datos.observaciones ?? '').replace(/^Presencial en caja\.\s*/, ''),
        });

        const ultimoPago = matricula.pagos[matricula.pagos.length - 1];

        return {
            redirect: `/caja/recibo/${ultimoPago?.id ?? 0}`,
            exito: 'Matricula presencial completada.',
        };
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            throw errorCliente({ errors: err.campos });
        }
        if (err instanceof AppError) {
            throw errorCliente({ errors: { metodo: err.message } });
        }
        throw err;
    }
}

function rutaListado(tipo, { query }) {
    const page = Number(query.get('page')) || 1;
    const perPagina = 20;
    const estados = tipo === 'pendientes' ? ['pendiente_pago', 'borrador'] : ['pagada', 'matriculada'];
    const uri = `/api/caja/matriculas/${tipo}`;

    const { total, filas } = negocio.listarMatriculas(estados, page, perPagina);

    return { matriculas: { ...paginar(page, total, perPagina, uri), data: filas } };
}

async function rutaRecibo(pagoId) {
    const pago = negocio.reciboDePago(pagoId);
    const pdfUrl = await generarReciboPdfDataUrl(pago, pago.matricula);

    return {
        recibo: {
            ...validarReciboPago(pago, pago.matricula),
            pdf_url: pdfUrl,
            whatsapp_url: `/api/caja/recibo/${pago.id}/whatsapp`,
        },
    };
}

async function rutaWhatsapp(pagoId, { body }) {
    const pago = negocio.reciboDePago(pagoId);
    const numero = body?.numero;

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
        throw errorCliente({ errors: errores });
    }

    let whatsappUrl;
    try {
        whatsappUrl = enlaceWhatsapp(pago, String(numero).trim());
    } catch (err) {
        throw errorCliente({ errors: { numero: err.message } });
    }

    const pdfUrl = await generarReciboPdfDataUrl(pago, pago.matricula);

    return {
        whatsapp_url: whatsappUrl,
        pdf_url: pdfUrl,
        nombre_archivo: nombreArchivo(pago.id),
    };
}

async function rutaCierresPreparar({ query }) {
    validarFechaOpcional(query);
    const fecha = query.get('fecha') ?? hoy();
    const pagos = negocio.pagosPendientes(fecha);
    const r = negocio.resumenCierre(pagos);

    return {
        fecha,
        resumen: { ...r, metodos: Object.values(r.metodos) },
        huella: await negocio.huellaPagos(pagos),
        pagos: pagos.map(negocio.detallePago),
    };
}

function rutaCierresLista({ query }) {
    validarFechaOpcional(query);
    const fecha = query.get('fecha') ?? hoy();
    const page = Number(query.get('page')) || 1;
    const per = 10;
    const uri = `/api/cierres/lista?fecha=${fecha}`;

    const { total, lista } = negocio.listarCierres(fecha, page, per);

    return { fecha, cierres: { ...paginar(page, total, per, uri), data: lista } };
}

async function rutaCierresGuardar({ body }) {
    try {
        validar(body, {
            fecha: ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            fondo: ['required', 'regex:/^[0-9]{1,9}(\\.[0-9]{1,2})?$/'],
            contado: ['required', 'regex:/^[0-9]{1,9}(\\.[0-9]{1,2})?$/'],
            huella: ['required', 'string', 'size:64'],
            observaciones: ['nullable', 'string', 'max:2000'],
        }, {
            fondo: { regex: 'El fondo debe ser un importe positivo o cero, con un máximo de 9 enteros y 2 decimales.' },
            contado: { regex: 'El efectivo contado debe ser un importe positivo o cero, con un máximo de 9 enteros y 2 decimales.' },
        });

        const cierre = await negocio.cerrarCajaAccion({
            fecha: String(body.fecha),
            fondo: String(body.fondo),
            contado: String(body.contado),
            huellaCliente: String(body.huella),
            observaciones: body.observaciones ?? null,
        });

        return {
            redirect: '/caja/cierres',
            exito: `Cierre #${cierre.id} guardado: ${negocio.resultadoCierre(cierre.diferenciaCentimos)}. Puedes seguir cobrando.`,
            cierre: {
                id: cierre.id,
                fecha_corta: fmtCorta(new Date(`${cierre.fecha}T12:00:00`)),
                exportar_url: '',
            },
        };
    } catch (err) {
        if (err instanceof ErrorValidacion) {
            throw errorCliente({ errors: err.campos });
        }
        throw err;
    }
}

function rutaReportes({ query }) {
    const estado = query.get('estado');
    const fechaInicio = query.get('fecha_inicio');
    const fechaFin = query.get('fecha_fin');
    const page = Number(query.get('page')) || 1;
    const per = 20;

    validar({ estado: estado ?? undefined, fecha_inicio: fechaInicio ?? undefined, fecha_fin: fechaFin ?? undefined }, {
        estado: ['nullable', `in:${Object.keys(ESTADO_MATRICULA).join(',')}`],
        fecha_inicio: ['nullable', 'date_format:Y-m-d'],
        fecha_fin: ['nullable', 'date_format:Y-m-d'],
    });

    const db = leer();
    const filtros = [];

    const dentroDeRango = (matricula) => {
        if (estado && matricula.estado !== estado) {
            return false;
        }
        if (fechaInicio || fechaFin) {
            const t = new Date(matricula.createdAt);
            if (fechaInicio && t < rangoDia(fechaInicio).inicio) {
                return false;
            }
            if (fechaFin && t >= rangoDia(fechaFin).fin) {
                return false;
            }
        }
        return true;
    };

    const filtradas = db.matriculas.filter(dentroDeRango).sort((a, b) => b.id - a.id);
    const total = filtradas.length;
    const inicio = (page - 1) * per;
    const pagina = filtradas.slice(inicio, inicio + per);

    const data = pagina.map((m) => {
        const aspirante = db.aspirantes.find((a) => a.id === m.aspiranteId);
        const programa = db.programas.find((p) => p.id === m.programaId);
        return {
            id: m.id,
            clave: m.numeroMatricula || String(m.id),
            aspirante: nombreCompleto(aspirante),
            documento: `${aspirante.tipoDocumento} ${aspirante.numeroDocumento}`.trim(),
            programa: programa?.nombre ?? 'Matrícula base',
            grupo: null,
            descuento: (m.descuentoCentimos ?? 0) / 100,
            valor_total: m.valorTotalCentimos / 100,
            estado: m.estado,
            estado_etiqueta: ESTADO_MATRICULA[m.estado] ?? m.estado,
            created_at: fmtFechaHora(new Date(m.createdAt)),
        };
    });

    const porEstado = {};
    for (const m of db.matriculas) {
        porEstado[m.estado] = (porEstado[m.estado] ?? 0) + 1;
    }
    const totalPagos = db.pagos.length;
    const montoTotal = db.pagos.reduce((acc, p) => acc + p.valorTotalCentimos, 0);

    const resumen = {
        total_matriculas: db.matriculas.length,
        pendientes: (porEstado.pendiente_pago ?? 0) + (porEstado.borrador ?? 0),
        completadas: (porEstado.pagada ?? 0) + (porEstado.matriculada ?? 0),
        canceladas: porEstado.cancelada ?? 0,
        total_pagos: totalPagos,
        monto_total: montoTotal / 100,
    };

    const filtrosQ = [];
    if (estado) {
        filtrosQ.push(`estado=${encodeURIComponent(estado)}`);
    }
    if (fechaInicio) {
        filtrosQ.push(`fecha_inicio=${encodeURIComponent(fechaInicio)}`);
    }
    if (fechaFin) {
        filtrosQ.push(`fecha_fin=${encodeURIComponent(fechaFin)}`);
    }
    const sufijo = filtrosQ.length ? `&${filtrosQ.join('&')}` : '';
    const uri = `/api/reportes${sufijo}`;

    return {
        matriculas: { ...paginar(page, total, per, uri), data },
        resumen,
        estados: ESTADO_MATRICULA,
        estado: estado ?? null,
        fecha_inicio: fechaInicio ?? null,
        fecha_fin: fechaFin ?? null,
    };
}

const rutas = [
    { metodo: 'GET', patron: /^\/api\/matricular$/, fn: (estado) => rutaMatricula('GET', estado) },
    { metodo: 'POST', patron: /^\/api\/matricular$/, fn: (estado) => rutaMatricula('POST', estado) },
    { metodo: 'GET', patron: /^\/api\/codigo-pago\/([^/]+)$/, fn: (_estado, co) => rutaCodigoPago(decodeURIComponent(co[1])) },
    { metodo: 'GET', patron: /^\/api\/mis-pagos$/, fn: (estado) => rutaMisPagos(estado) },
    { metodo: 'GET', patron: /^\/api\/caja$/, fn: (estado) => rutaCaja(estado, 'GET') },
    { metodo: 'POST', patron: /^\/api\/caja\/cobrar$/, fn: (estado) => rutaCaja(estado, 'POST') },
    { metodo: 'GET', patron: /^\/api\/caja\/presencial$/, fn: (estado) => rutaPresencial(estado, 'GET') },
    { metodo: 'POST', patron: /^\/api\/caja\/presencial$/, fn: (estado) => rutaPresencial(estado, 'POST') },
    { metodo: 'GET', patron: /^\/api\/caja\/matriculas\/pendientes$/, fn: (estado) => rutaListado('pendientes', estado) },
    { metodo: 'GET', patron: /^\/api\/caja\/matriculas\/completadas$/, fn: (estado) => rutaListado('completadas', estado) },
    { metodo: 'GET', patron: /^\/api\/caja\/recibo\/([^/]+)$/, fn: (_estado, co) => rutaRecibo(Number(decodeURIComponent(co[1]))) },
    { metodo: 'POST', patron: /^\/api\/caja\/recibo\/([^/]+)\/whatsapp$/, fn: (estado, co) => rutaWhatsapp(Number(decodeURIComponent(co[1])), estado) },
    { metodo: 'GET', patron: /^\/api\/cierres\/preparar$/, fn: (estado) => rutaCierresPreparar(estado) },
    { metodo: 'GET', patron: /^\/api\/cierres\/lista$/, fn: (estado) => rutaCierresLista(estado) },
    { metodo: 'POST', patron: /^\/api\/cierres\/guardar$/, fn: (estado) => rutaCierresGuardar(estado) },
    { metodo: 'GET', patron: /^\/api\/reportes$/, fn: (estado) => rutaReportes(estado) },
];

async function despachar(ruta, opciones = {}) {
    const metodo = String(opciones.method || 'GET').toUpperCase();
    const { pathname, query } = parsearRuta(ruta);
    const body = opciones.body ? JSON.parse(opciones.body) : null;

    if (ruta === '/api/reiniciar') {
        reinit();
        return { exito: 'Datos reiniciados.' };
    }

    const estado = { query, body };

    for (const r of rutas) {
        if (r.metodo !== metodo) {
            continue;
        }
        const coincidencia = r.patron.exec(pathname);
        if (coincidencia) {
            return r.fn(estado, coincidencia);
        }
    }

    throw errorCliente({ message: `Ruta ${metodo} ${pathname} no disponible.` }, 404);
}

export async function api(ruta, opciones = {}) {
    try {
        return await despachar(ruta, opciones);
    } catch (error) {
        if (error.status && error.datos) {
            throw error;
        }
        throw errorCliente({ message: error.message || 'No se pudo completar la solicitud.' }, error.http ?? 500);
    }
}

export const GET = (ruta) => api(ruta);

export const POST = (ruta, body) => api(ruta, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
});