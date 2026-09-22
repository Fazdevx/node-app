import { config } from './config.js';

export const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const aCentavos = (n) => Math.round((n + Number.EPSILON) * 100);

export const aSoles = (c) => c / 100;

export const formatoEs = (n) =>
    Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const solesTexto = (n) => `${config.moneda.simbolo} ${Number(n).toFixed(2)}`;