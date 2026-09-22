import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import Paginacion from '../../components/Paginacion.jsx';
import { GET, POST } from '../../api.js';
import { soles } from '../../lib/formatos.js';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Cierres() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const fecha = searchParams.get('fecha') || hoy();
    const [fechaForm, setFechaForm] = useState(fecha);
    const [preparacion, setPreparacion] = useState(null);
    const [cierres, setCierres] = useState(null);
    const [data, setData] = useState({ fondo: '0.00', contado: '', observaciones: '', huella: null });
    const [processing, setProcessing] = useState(false);
    const [exito, setExito] = useState('');
    const [errores, setErrores] = useState({});

    useEffect(() => {
        setFechaForm(fecha);
        const params = new URLSearchParams();
        params.set('fecha', fecha);
        const pagina = searchParams.get('page');
        if (pagina) {
            params.set('page', pagina);
        }
        const qs = params.toString();

        const preparacionP = GET(`/api/cierres/preparar${qs ? `?${qs}` : ''}`);
        const listaP = GET(`/api/cierres/lista${qs ? `?${qs}` : ''}`);

        let vigente = true;
        Promise.all([preparacionP, listaP])
            .then(([p, l]) => {
                if (!vigente) {
                    return;
                }
                setPreparacion(p);
                setCierres(l.cierres || l);
                setErrores({});
                setData((anterior) => ({ ...anterior, huella: p.huella }));
            })
            .catch(() => {
                if (vigente) {
                    setCierres({ data: [] });
                }
            });
        return () => {
            vigente = false;
        };
    }, [fecha, searchParams]);

    const cambiarFecha = (e) => {
        e.preventDefault();
        if (!fechaForm) {
            return;
        }
        navigate(`/caja/reportes/cierres?fecha=${fechaForm}`);
    };

    const resumen = preparacion?.resumen || { cantidad: 0, total: 0, efectivo: 0, metodos: [] };

    const fondoCentimos = Math.round((Number(data.fondo) || 0) * 100);
    const contadoCentimos = Math.round((Number(data.contado) || 0) * 100);
    const esperadoCentimos = fondoCentimos + (Number(resumen.efectivo) || 0);
    const diferenciaCentimos = contadoCentimos - esperadoCentimos;

    let reconteo = 'Ingresa importes válidos para ver la diferencia.';
    if (data.contado !== '') {
        const resultado = diferenciaCentimos === 0
            ? 'Cuadrado'
            : (diferenciaCentimos > 0 ? 'Sobrante' : 'Faltante');
        reconteo = `Esperado: S/ ${(esperadoCentimos / 100).toFixed(2)} · ${resultado}: S/ ${(Math.abs(diferenciaCentimos) / 100).toFixed(2)}`;
    }

    const guardar = async (e) => {
        e.preventDefault();
        if (processing) {
            return;
        }
        if (!window.confirm('¿Guardar este reconteo? El cierre conservará los importes y no podrá editarse desde el sistema.')) {
            return;
        }
        setProcessing(true);
        setErrores({});
        setExito('');
        try {
            const datos = await POST('/api/cierres/guardar', {
                fecha,
                huella: data.huella,
                fondo: data.fondo,
                contado: data.contado,
                observaciones: data.observaciones,
            });
            setExito(datos.exito || 'Cierre de caja guardado. Puedes exportarlo a Excel.');
            setData((anterior) => ({ ...anterior, contado: '', observaciones: '' }));
            const params = new URLSearchParams();
            params.set('fecha', fecha);
            const pagina = searchParams.get('page');
            if (pagina) {
                params.set('page', pagina);
            }
            const qs = params.toString();
            const [p, l] = await Promise.all([
                GET(`/api/cierres/preparar${qs ? `?${qs}` : ''}`),
                GET(`/api/cierres/lista${qs ? `?${qs}` : ''}`),
            ]);
            setPreparacion(p);
            setCierres(l.cierres || l);
            setData((anterior) => ({ ...anterior, huella: p.huella }));
        } catch (err) {
            if (err.datos?.errors) {
                setErrores(err.datos.errors);
            } else {
                setErrores({ general: err.message });
            }
        } finally {
            setProcessing(false);
        }
    };

    const nav = [
        { label: 'Volver a Reportes', href: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Cierre de caja - Academia Galileo" nav={nav} footer="Caja · Academia Galileo">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Cierre de caja</h1>
                <p className="mt-2 text-sm text-slate-600">Cada cierre guarda solo los pagos pendientes de la fecha elegida. Puedes seguir cobrando después.</p>
            </div>

            {exito ? (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
                    {exito}
                </div>
            ) : null}
            {errores.general ? (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                    {errores.general}
                </div>
            ) : null}

            <form onSubmit={cambiarFecha} className="card-form mb-6 flex flex-wrap items-end gap-4">
                <div>
                    <label htmlFor="fechaPagos" className="text-sm font-semibold">Fecha de los pagos</label>
                    <input id="fechaPagos" name="fecha" type="date" value={fechaForm} onChange={(e) => setFechaForm(e.target.value)} max={hoy()} required />
                </div>
                <button type="submit" className="btn btn-primary">Actualizar resumen</button>
            </form>

            {!preparacion ? (
                <div className="card-form mb-6 text-center text-sm text-slate-500">Cargando…</div>
            ) : (
                <>
                    <section className="card-form mb-6" aria-labelledby="pendientes-titulo">
                        <h2 id="pendientes-titulo" className="text-lg font-bold">Pendientes de cierre · {fecha}</h2>
                        <p className="my-3">{resumen.cantidad} pagos · Total recaudado: <strong>{soles(resumen.total / 100)}</strong></p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr><th className="text-left">Medio</th><th>Cantidad</th><th className="text-right">Total</th></tr></thead>
                                <tbody>
                                    {resumen.metodos.map((metodo) => (
                                        <tr key={metodo.etiqueta} className="border-t border-slate-200">
                                            <td className="py-2">{metodo.etiqueta}</td>
                                            <td className="text-center">{metodo.cantidad}</td>
                                            <td className="text-right">{soles(metodo.total / 100)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 font-semibold">Efectivo neto (recibido menos vuelto): {soles(resumen.efectivo / 100)}</p>
                    </section>

                    <form onSubmit={guardar} className="card-form mb-8">
                        <h2 className="mb-3 text-lg font-bold">Reconteo de efectivo</h2>
                        <p className="mb-4 text-sm text-slate-600">El fondo inicial es el dinero del cajón antes de estos pagos. Incluye lo retenido del cierre anterior si no retiraste ese dinero. No sumes Yape, Plin ni otros medios al efectivo contado. Si hubo retiros o gastos, no están descontados automáticamente: explica cualquier diferencia en observaciones.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="fondo" className="text-sm font-semibold">Fondo inicial (S/)</label>
                                <input id="fondo" name="fondo" type="number" min="0" max="999999999.99" step="0.01" value={data.fondo} onChange={(e) => setData((a) => ({ ...a, fondo: e.target.value }))} required />
                            </div>
                            <div>
                                <label htmlFor="contado" className="text-sm font-semibold">Efectivo contado (S/)</label>
                                <input id="contado" name="contado" type="number" min="0" max="999999999.99" step="0.01" value={data.contado} onChange={(e) => setData((a) => ({ ...a, contado: e.target.value }))} required />
                            </div>
                        </div>
                        <p className="my-4 font-semibold" aria-live="polite">{reconteo}</p>
                        <label htmlFor="observaciones" className="text-sm font-semibold">Observaciones (opcional)</label>
                        <textarea id="observaciones" name="observaciones" rows="3" maxLength="2000" value={data.observaciones} onChange={(e) => setData((a) => ({ ...a, observaciones: e.target.value }))} />
                        <button type="submit" className="btn btn-primary mt-4" disabled={processing || Number(resumen.cantidad) === 0}>
                            {processing ? 'Guardando…' : 'Guardar cierre de caja'}
                        </button>
                        {Number(resumen.cantidad) === 0 ? (
                            <p className="mt-2 text-sm text-slate-600">No hay pagos pendientes en esta fecha.</p>
                        ) : null}
                    </form>
                </>
            )}

            <section aria-labelledby="historial-titulo">
                <h2 id="historial-titulo" className="mb-4 text-xl font-bold">Cierres guardados de {fecha}</h2>
                <p className="mb-4 text-sm text-slate-600">La exportación se abre en Excel con formato formal: hoja de resumen y hoja de detalle. Cada archivo conserva los totales y el detalle tal como estaban al cerrar.</p>
                {!cierres ? (
                    <p className="card-form">Cargando…</p>
                ) : cierres.data.length === 0 ? (
                    <p className="card-form">Todavía no hay cierres para esta fecha.</p>
                ) : cierres.data.map((cierre) => (
                    <article key={cierre.id} className="card-form mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-bold">Cierre #{cierre.id} · {cierre.created_at}</h3>
                            <a href={cierre.exportar_url || '#'} className="btn btn-outline">Exportar a Excel (.xlsx)</a>
                        </div>
                        <p className="mt-3">{cierre.cantidad} pagos · Recaudado: {soles(cierre.total / 100)}</p>
                        <p>Fondo: {soles(cierre.fondo / 100)} · Esperado: {soles(cierre.esperado / 100)} · Contado: {soles(cierre.contado / 100)}</p>
                        <p className="mt-2 font-bold">{cierre.resultado} · Diferencia: {soles(cierre.diferencia / 100)}</p>
                        {cierre.observaciones ? (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{cierre.observaciones}</p>
                        ) : null}
                    </article>
                ))}
                {cierres ? (
                    <Paginacion datos={cierres} ruta="/caja/reportes/cierres" />
                ) : null}
            </section>
        </AppLayout>
    );
}