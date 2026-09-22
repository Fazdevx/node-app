import { randomInt } from 'node:crypto';

/**
 * Genera y valida los códigos de pago: PREFIJO-AÑO-CUERPO-VERIFICADOR
 * (GAL-2026-7F3K9Q-M). El alfabeto base-32 excluye caracteres ambiguos
 * (0/O, 1/I/L) y el último carácter es un dígito verificador por suma
 * ponderada módulo 32.
 */
const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export class GeneradorCodigo {
    constructor(prefijo = 'GAL', longitudCuerpo = 6) {
        if (longitudCuerpo < 4) {
            throw new Error('El cuerpo del código debe tener al menos 4 caracteres.');
        }
        this.prefijo = String(prefijo);
        this.longitudCuerpo = Number(longitudCuerpo);
    }

    cuerpoAleatorio() {
        let cuerpo = '';
        for (let i = 0; i < this.longitudCuerpo; i += 1) {
            cuerpo += ALFABETO[randomInt(0, ALFABETO.length)];
        }
        return cuerpo;
    }

    digitoVerificador(cuerpo) {
        let suma = 0;
        for (let posicion = 0; posicion < cuerpo.length; posicion += 1) {
            const valor = ALFABETO.indexOf(cuerpo[posicion]);
            if (valor === -1) {
                throw new Error(`El carácter "${cuerpo[posicion]}" no pertenece al alfabeto del código de pago.`);
            }
            suma += (posicion + 1) * valor;
        }
        return ALFABETO[suma % ALFABETO.length];
    }

    componer(anio, cuerpo, verificador = null) {
        const v = verificador ?? this.digitoVerificador(cuerpo);
        return `${String(this.prefijo).toUpperCase()}-${String(anio).padStart(4, '0')}-${cuerpo}-${v}`;
    }

    generar(anio = null) {
        const a = anio ?? new Date().getFullYear();
        return this.componer(a, this.cuerpoAleatorio());
    }

    canonicalizar(entrada) {
        const limpio = String(entrada ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const longitudEsperada = this.prefijo.length + 4 + this.longitudCuerpo + 1;
        if (limpio.length !== longitudEsperada) {
            return null;
        }

        const prefijo = limpio.slice(0, this.prefijo.length);
        if (prefijo !== this.prefijo.toUpperCase()) {
            return null;
        }

        const anio = limpio.slice(this.prefijo.length, this.prefijo.length + 4);
        const cuerpo = limpio.slice(this.prefijo.length + 4, this.prefijo.length + 4 + this.longitudCuerpo);
        const verificador = limpio.slice(-1);

        if (!/^\d{4}$/.test(anio)) {
            return null;
        }

        const resto = cuerpo + verificador;
        if ([...resto].some((c) => ALFABETO.indexOf(c) === -1)) {
            return null;
        }

        return this.componer(Number(anio), cuerpo, verificador);
    }

    analizar(entrada) {
        const canonico = this.canonicalizar(entrada);
        if (canonico === null) {
            return null;
        }
        const [prefijo, anio, cuerpo, verificador] = canonico.split('-');
        return { prefijo, anio: Number(anio), cuerpo, verificador };
    }

    esValido(entrada) {
        const analizado = this.analizar(entrada);
        if (analizado === null) {
            return false;
        }
        return this.digitoVerificador(analizado.cuerpo) === analizado.verificador;
    }
}