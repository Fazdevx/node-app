import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import { GET, POST } from '../../api.js';
import { METODOS_DIGITALES, soles } from '../../lib/formatos.js';

export default function Index() {
    const navigate = useNavigate();

    const [config, setConfig] = useState({ metodos: {}, precio_matricula: null });
    const [valorCodigo, setValorCodigo] = useState(null);
    const [data, setData] = useState({
        codigo: '',
        metodo: '',
        valor_recibido: '',
        referencia: '',
        descuento: '0',
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        GET('/api/caja')
            .then((datos) => {
                setConfig({ metodos: datos.metodos || {}, precio_matricula: datos.precioMatricula ?? null });
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const codigo = data.codigo.trim();
        if (!codigo) {
            setValorCodigo(null);
            return undefined;
        }
        let vigente = true;
        const timer = setTimeout(() => {
            GET(`/api/caja?codigo=${encodeURIComponent(codigo)}`)
                .then((datos) => {
                    if (vigente) {
                        setValorCodigo(datos.valorCodigo ?? null);
                    }
                })
                .catch(() => {
                    if (vigente) {
                        setValorCodigo(null);
                    }
                });
        }, 350);
        return () => {
            vigente = false;
            clearTimeout(timer);
        };
    }, [data.codigo]);

    const setDataCampo = (campo, valor) => {
        setData((anterior) => ({ ...anterior, [campo]: valor }));
        setErrors((anterior) => {
            if (!(campo in anterior)) {
                return anterior;
            }
            const { [campo]: _omitido, ...resto } = anterior;
            return resto;
        });
    };

    const baseEnCentimos = (valorCodigo !== null && valorCodigo !== undefined ? Number(valorCodigo) : Number(config.precio_matricula) || 0) * 100;
    const descuentoCentimos = Math.max(0, Math.round((Number(data.descuento) || 0) * 100));
    const totalCentimos = Math.max(0, baseEnCentimos - descuentoCentimos);
    const base = Math.round((baseEnCentimos / 100) * 100) / 100;
    const descuento = Math.round((descuentoCentimos / 100) * 100) / 100;
    const total = Math.round((totalCentimos / 100) * 100) / 100;

    const esEfectivo = data.metodo === 'efectivo';
    const esDigital = METODOS_DIGITALES.includes(data.metodo);
    const recibido = esEfectivo && data.valor_recibido !== ''
        ? Math.max(0, Number(data.valor_recibido) || 0)
        : total;
    const vuelto = Math.max(0, Math.round((recibido - total) * 100) / 100);
    const falta = Math.max(0, Math.round((total - recibido) * 100) / 100);

    const enviar = async (e) => {
        e.preventDefault();
        if (processing) {
            return;
        }
        setProcessing(true);
        setErrors({});
        try {
            const datos = await POST('/api/caja/cobrar', {
                codigo: data.codigo,
                metodo: data.metodo,
                valor_recibido: data.valor_recibido,
                referencia: data.referencia,
                descuento: data.descuento,
            });
            navigate(datos.redirect || '/caja', { state: { exito: datos.exito } });
        } catch (error) {
            if (error.datos?.errors) {
                setErrors(error.datos.errors);
            }
            if (error.datos && 'valorCodigo' in error.datos) {
                setValorCodigo(error.datos.valorCodigo);
            }
        } finally {
            setProcessing(false);
        }
    };

    const nav = [
        { label: 'Caja', href: '/caja', activo: true },
        { label: 'Presencial', href: '/caja/presencial' },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes' },
        { label: 'Completadas', href: '/caja/matriculas/completadas' },
        { label: 'Reportes', href: '/caja/reportes' },
    ];

    const pasos = [
        { etiqueta: '1. Cobrar código', ruta: '/caja', activo: true },
        { etiqueta: '2. Matrícula presencial →', ruta: '/caja/presencial' },
        { etiqueta: '3. Pendientes', ruta: '/caja/matriculas/pendientes' },
        { etiqueta: '4. Completadas', ruta: '/caja/matriculas/completadas' },
        { etiqueta: '5. Reportes', ruta: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Caja — Cobrar código de pago" nav={nav} footer="Caja · Academia Galileo">
            <h1 className="mb-1 text-2xl font-bold text-slate-800">Cobro por código de pago</h1>
            <p className="mb-6 text-sm text-slate-500">
                Digita o escanea el código que trae el aspirante, elige el medio de pago y registra.
                Si aplicas un descuento, el sistema muestra el total con descuento y el vuelto.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
                {pasos.map((paso) => (
                    <div key={paso.etiqueta}
                         className={`rounded-full px-3 py-1 text-sm font-medium ${
                             paso.activo
                                 ? 'bg-naranja-100 text-naranja-800'
                                 : 'border border-slate-300 bg-white text-slate-600'
                         }`}>
                        {paso.activo ? paso.etiqueta : (
                            <Link to={paso.ruta} className="transition-colors hover:bg-slate-50">{paso.etiqueta}</Link>
                        )}
                    </div>
                ))}
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-naranja-200 bg-gradient-to-r from-naranja-50 to-amber-50 px-6 py-5 shadow-sm">
                <div>
                    <p className="text-sm font-semibold text-naranja-900">Pago único de matrícula</p>
                    <p className="text-xs text-naranja-700">Un solo pago · No hay programa ni grupo que elegir</p>
                </div>
                <p className="text-3xl font-black text-naranja-700">{soles(config.precio_matricula)}</p>
            </div>

            <form onSubmit={enviar}
                  className="grid max-w-xl gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <label className="text-sm">
                    <span className="label-text">Código de pago *</span>
                    <input type="text" value={data.codigo} onChange={(e) => setDataCampo('codigo', e.target.value)} required maxLength="40"
                           placeholder="GAL-2026-XXXXXX" autoComplete="off" autoFocus className="mono" />
                    {errors.codigo && <span className="mt-1 block text-xs text-red-600">{errors.codigo}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Medio de pago *</span>
                    <select value={data.metodo} onChange={(e) => { setDataCampo('metodo', e.target.value); setDataCampo('valor_recibido', ''); setDataCampo('referencia', ''); }} required>
                        <option value="">— Elige —</option>
                        {Object.entries(config.metodos).map(([valor, etiqueta]) => (
                            <option key={valor} value={valor}>{etiqueta}</option>
                        ))}
                    </select>
                    {errors.metodo && <span className="mt-1 block text-xs text-red-600">{errors.metodo}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Descuento (S/)</span>
                    <input type="number" value={data.descuento} onChange={(e) => setDataCampo('descuento', e.target.value)}
                           min="0" step="0.01" inputMode="decimal" />
                    {errors.descuento && <span className="mt-1 block text-xs text-red-600">{errors.descuento}</span>}
                </label>

                <div className="rounded-xl border border-naranja-200 bg-naranja-50 p-4">
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between border-b border-naranja-100 pb-1">
                            <dt className="text-slate-600">Valor del código</dt>
                            <dd className="font-semibold">{soles(base)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-naranja-100 pb-1">
                            <dt className="text-slate-600">Descuento aplicado</dt>
                            <dd className="font-semibold text-amber-700">- {soles(descuento)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-naranja-100 pb-1">
                            <dt className="text-slate-600">Total a pagar</dt>
                            <dd className="text-lg font-black text-naranja-700">{soles(total)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-naranja-100 pb-1">
                            <dt className="text-slate-600">Vuelto</dt>
                            <dd className="text-lg font-black text-emerald-700">{soles(vuelto)}</dd>
                        </div>
                    </dl>
                    {valorCodigo === null ? (
                        <p className="mt-2 text-xs text-slate-500">
                            El sistema consulta el valor del código al registrarlo: con el código ya escrito
                            verás aquí el descuento, el total y el vuelto antes de confirmar.
                        </p>
                    ) : null}
                </div>

                {esEfectivo ? (
                    <div className="rounded-lg bg-slate-50 p-4">
                        <label className="text-sm">
                            <span className="label-text">Monto recibido en efectivo (S/)</span>
                            <input type="number" value={data.valor_recibido} onChange={(e) => setDataCampo('valor_recibido', e.target.value)}
                                   step="0.01" min="0" inputMode="decimal" />
                            <span className="mt-1 block text-xs text-slate-500">
                                Escribe lo que entrega el aspirante (ej. 300.00).
                            </span>
                        </label>
                        <p className="mt-2 text-sm">
                            Vuelto a entregar: <span className="text-lg font-black text-emerald-700">{soles(vuelto)}</span>
                        </p>
                        {falta > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                                El monto recibido es menor al total a pagar.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {esDigital ? (
                    <div className="rounded-lg bg-slate-50 p-4">
                        <label className="text-sm">
                            <span className="label-text">N.º de operación / referencia *</span>
                            <input type="text" value={data.referencia} onChange={(e) => setDataCampo('referencia', e.target.value)} maxLength="60"
                                   placeholder="Los dígitos que muestra la app o el banco" />
                            <span className="mt-1 block text-xs text-slate-500">
                                Yape/Plin: código de operación · Transferencia: n.º de operación · Tarjeta: últimos 4 dígitos
                            </span>
                        </label>
                        {errors.referencia && <span className="mt-1 block text-xs text-red-600">{errors.referencia}</span>}
                    </div>
                ) : null}

                <button type="submit" disabled={processing} className="btn btn-success w-full">
                    {processing ? 'Registrando…' : '✓ Registrar pago y matricular'}
                </button>
            </form>
        </AppLayout>
    );
}