import { config } from './config.js';
import { aCentavos } from './monedero.js';

const CLAVE = 'galileo_local_db_v1';

const ahora = () => new Date().toISOString();

function estructuraInicial() {
    const t = ahora();
    const precio = aCentavos(config.matricula.precioMatricula);
    const db = {
        version: 1,
        seq: {},
        programas: [{
            id: 1,
            codigo: config.matricula.programaDefecto.codigo,
            nombre: config.matricula.programaDefecto.nombre,
            descripcion: 'Programa único de la academia pre-universitaria.',
            intensidadHoraria: 0,
            duracionMeses: 1,
            precioCentimos: precio,
            cuposTotales: 0,
            activo: true,
            createdAt: t,
            updatedAt: t,
        }],
        aspirantes: [],
        matriculas: [],
        codigosPago: [],
        pagos: [],
        cierres: [],
    };
    recomputarSeq(db);
    return db;
}

function recomputarSeq(db) {
    const mapeo = {
        programa: 'programas',
        aspirante: 'aspirantes',
        matricula: 'matriculas',
        codigopago: 'codigosPago',
        pago: 'pagos',
        cierrecaja: 'cierres',
    };
    for (const [entidad, coleccion] of Object.entries(mapeo)) {
        const maxId = (db[coleccion] ?? []).reduce((mx, x) => Math.max(mx, Number(x.id) || 0), 0);
        db.seq[entidad] = maxId;
    }
}

function normalizar(db) {
    if (db && db.version === 1 && Array.isArray(db.programas) && Array.isArray(db.aspirantes)) {
        db.seq = db.seq ?? {};
        db.codigosPago = db.codigosPago ?? [];
        db.pagos = db.pagos ?? [];
        db.cierres = db.cierres ?? [];
        recomputarSeq(db);
        return db;
    }
    return estructuraInicial();
}

export function reinit() {
    try {
        localStorage.removeItem(CLAVE);
    } catch {
        /* sin almacenamiento disponible */
    }
}

export function leer() {
    try {
        const crudo = localStorage.getItem(CLAVE);
        return crudo ? normalizar(JSON.parse(crudo)) : estructuraInicial();
    } catch {
        return estructuraInicial();
    }
}

export function guardar(db) {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(db));
    } catch {
        /* cuota u almacenamiento no disponible */
    }
}

export function mutar(fn) {
    const db = leer();
    const resultado = fn(db);
    guardar(db);
    return resultado;
}

export function siguienteId(db, entidad) {
    const n = (db.seq[entidad] ?? 0) + 1;
    db.seq[entidad] = n;
    return n;
}

export function buscar(db, coleccion, id) {
    return db[coleccion].find((x) => x.id === Number(id));
}

export const ahoraIso = ahora;