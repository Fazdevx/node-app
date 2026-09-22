export const TIPOS_DOCUMENTO = [
    { valor: 'DNI', etiqueta: 'DNI' },
    { valor: 'CE', etiqueta: 'Carné de extranjería' },
    { valor: 'PA', etiqueta: 'Pasaporte' },
    { valor: 'PTP_CPP', etiqueta: 'PTP / CPP' },
    { valor: 'PN', etiqueta: 'Partida de nacimiento' },
];

export const METODOS = [
    { valor: 'efectivo', etiqueta: 'Efectivo', requiereReferencia: false, permiteVuelto: true },
    { valor: 'yape', etiqueta: 'Yape', requiereReferencia: true, permiteVuelto: false },
    { valor: 'plin', etiqueta: 'Plin', requiereReferencia: true, permiteVuelto: false },
    { valor: 'transferencia', etiqueta: 'Transferencia bancaria', requiereReferencia: true, permiteVuelto: false },
    { valor: 'tarjeta', etiqueta: 'Tarjeta débito/crédito', requiereReferencia: true, permiteVuelto: false },
    { valor: 'otro', etiqueta: 'Otro', requiereReferencia: false, permiteVuelto: false },
];

export const ESTADO_MATRICULA = {
    borrador: 'Borrador',
    pendiente_pago: 'Pendiente de pago',
    pagada: 'Pagada',
    matriculada: 'Matriculada',
    cancelada: 'Cancelada',
    expirada: 'Expirada',
};

export const ESTADO_CODIGO = {
    pendiente: 'Pendiente de pago',
    usado: 'Pagado',
    anulado: 'Anulado',
};

export const METODO_POR_VALOR = Object.fromEntries(METODOS.map((m) => [m.valor, m]));

export const opciones = (lista) => Object.fromEntries(lista.map((x) => [x.valor, x.etiqueta]));

export const nombreCompleto = (a) => `${a.nombres} ${a.apellidos}`.trim();

export const documento = (a) => `${a.tipoDocumento} ${a.numeroDocumento}`.trim();

export const estadoMatriculaEtiqueta = (estado) => ESTADO_MATRICULA[estado] ?? estado;