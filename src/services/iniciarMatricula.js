import { config } from '../config.js';
import { GeneradorCodigo } from '../lib/codigo.js';
import { aCentavos, redondear } from '../monedero.js';
import { AppError } from '../lib/errores.js';

const generador = new GeneradorCodigo(
    config.matricula.codigoPago.prefijo,
    config.matricula.codigoPago.longitud,
);

/**
 * Emite el código de pago de una matrícula. Solo puede existir un código
 * vigente por matrícula: al emitir uno nuevo, los anteriores quedan anulados.
 */
export async function emitirCodigo(tx, matricula, { valorCentimos = null, horasVigencia = null } = {}) {
    const ahora = new Date();

    await tx.codigoPago.updateMany({
        where: { matriculaId: matricula.id, estado: 'pendiente', expiraAt: { gt: ahora } },
        data: { estado: 'anulado', anuladoAt: ahora },
    });

    let codigo = null;
    for (let intento = 0; intento < 10; intento += 1) {
        const candidato = generador.generar();
        const existe = await tx.codigoPago.findUnique({ where: { codigo: candidato } });
        if (!existe) {
            codigo = candidato;
            break;
        }
    }
    if (codigo === null) {
        throw new AppError('No fue posible generar un código de pago único después de 10 intentos.', 'codigo_sin_generar', 409);
    }

    const vigencia = horasVigencia ?? config.matricula.codigoPago.vigenciaHoras;
    const expiraAt = new Date(ahora.getTime() + vigencia * 60 * 60 * 1000);

    return tx.codigoPago.create({
        data: {
            matriculaId: matricula.id,
            codigo,
            valorCentimos: valorCentimos ?? matricula.valorTotalCentimos,
            estado: 'pendiente',
            expiraAt,
        },
    });
}

/** Programa único (Programa::defecto): crea o actualiza el precio según config. */
export async function programaDefecto(tx) {
    const cfg = config.matricula;
    const precioCentimos = aCentavos(redondear(cfg.precioMatricula));
    const codigo = cfg.programaDefecto.codigo;

    const programa = await tx.programa.upsert({
        where: { codigo },
        update: {},
        create: {
            codigo,
            nombre: cfg.programaDefecto.nombre,
            descripcion: 'Programa único de la academia pre-universitaria.',
            intensidadHoraria: 0,
            duracionMeses: 1,
            precioCentimos,
            cuposTotales: 0,
            activo: true,
        },
    });

    if (programa.precioCentimos !== precioCentimos) {
        await tx.programa.update({ where: { id: programa.id }, data: { precioCentimos } });
        return { ...programa, precioCentimos };
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

/** Mapea los datos del formulario (snake) a los campos del modelo (camel). */
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
        const [y, m, d] = String(resultado.fechaNacimiento).split('-').map(Number);
        resultado.fechaNacimiento = new Date(y, m - 1, d);
    }
    return resultado;
}

async function resolverAspirante(tx, datos) {
    const limpio = mapearAspirante(datos);
    const tipo = String(limpio.tipoDocumento ?? '');
    const numeroDocumento = String(limpio.numeroDocumento ?? '');

    const existente = await tx.aspirante.findFirst({
        where: { tipoDocumento: tipo, numeroDocumento },
    });

    if (existente) {
        const { tipoDocumento: _t, numeroDocumento: _n, ...resto } = limpio;
        return tx.aspirante.update({ where: { id: existente.id }, data: resto });
    }

    return tx.aspirante.create({ data: limpio });
}

/**
 * Primer paso del flujo web: crea (o reutiliza) la ficha del aspirante, abre
 * la matrícula en "pendiente de pago" y emite el código de pago. Todas las
 * matrículas apuntan al programa único sin grupo.
 */
export async function iniciarMatricula(tx, datosAspirante, { descuento = 0, horasVigencia = null, observaciones = null } = {}) {
    if (descuento < 0) {
        throw new AppError('El descuento no puede ser negativo.', 'descuento_negativo', 422);
    }

    const programa = await programaDefecto(tx);
    const precio = programa.precioCentimos / 100;

    if (descuento > precio) {
        throw new AppError('El descuento no puede ser mayor al precio de la matrícula.', 'descuento_mayor_al_precio', 422);
    }

    const aspirante = await resolverAspirante(tx, datosAspirante);
    const valorTotal = redondear(precio - descuento);

    const matricula = await tx.matricula.create({
        data: {
            aspiranteId: aspirante.id,
            programaId: programa.id,
            estado: 'pendiente_pago',
            valorBaseCentimos: aCentavos(precio),
            descuentoCentimos: aCentavos(descuento),
            valorTotalCentimos: aCentavos(valorTotal),
            observaciones: observaciones ?? null,
        },
    });

    const codigo = await emitirCodigo(tx, matricula, { valorCentimos: matricula.valorTotalCentimos, horasVigencia });

    return tx.matricula.findUnique({
        where: { id: matricula.id },
        include: { aspirante: true, codigosPago: { orderBy: { id: 'desc' } } },
    });
}