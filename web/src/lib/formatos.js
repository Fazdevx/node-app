export const soles = (n) => {
    const valor = Number(n);

    return `S/ ${Number.isFinite(valor) ? valor.toFixed(2) : '0.00'}`;
};

const pad = (n) => String(n).padStart(2, '0');

function partes(str) {
    if (!str) {
        return null;
    }

    const conHora = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (conHora) {
        return { y: +conHora[1], mo: +conHora[2], d: +conHora[3], h: +conHora[4], mi: +conHora[5] };
    }

    const soloFecha = String(str).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (soloFecha) {
        return { y: +soloFecha[1], mo: +soloFecha[2], d: +soloFecha[3], h: 0, mi: 0 };
    }

    return null;
}

export const fechaCorta = (str) => {
    const p = partes(str);

    return p ? `${pad(p.d)}/${pad(p.mo)}/${p.y}` : (str || '—');
};

export const fechaHora = (str) => {
    const p = partes(str);

    return p ? `${pad(p.d)}/${pad(p.mo)}/${p.y} ${pad(p.h)}:${pad(p.mi)}` : (str || '—');
};

export const METODO_PAGO = {
    efectivo: 'Efectivo',
    yape: 'Yape',
    plin: 'Plin',
    transferencia: 'Transferencia bancaria',
    tarjeta: 'Tarjeta débito/crédito',
    otro: 'Otro',
};

export const ESTADO_MATRICULA = {
    borrador: 'Borrador',
    pendiente_pago: 'Pendiente de pago',
    pagada: 'Pagada',
    matriculada: 'Matriculada',
    cancelada: 'Cancelada',
    expirada: 'Expirada',
};

export const METODOS_DIGITALES = ['yape', 'plin', 'transferencia', 'tarjeta'];