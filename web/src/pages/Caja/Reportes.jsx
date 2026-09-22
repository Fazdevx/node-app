import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import Paginacion from '../../components/Paginacion.jsx';
import { GET } from '../../api.js';
import { soles, fechaCorta, ESTADO_MATRICULA } from '../../lib/formatos.js';

export default function Reportes() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [datos, setDatos] = useState(null);
    const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') || '');
    const [filtroDesde, setFiltroDesde] = useState(searchParams.get('fecha_inicio') || '');
    const [filtroHasta, setFiltroHasta] = useState(searchParams.get('fecha_fin') || '');

    useEffect(() => {
        let vigente = true;
        const params = new URLSearchParams();
        for (const [clave, valor] of [['estado', searchParams.get('estado')], ['fecha_inicio', searchParams.get('fecha_inicio')], ['fecha_fin', searchParams.get('fecha_fin')], ['page', searchParams.get('page')]]) {
            if (valor) {
                params.set(clave, valor);
            }
        }
        const query = params.toString();
        GET(`/api/reportes${query ? `?${query}` : ''}`)
            .then((d) => {
                if (vigente) {
                    setDatos(d);
                }
            })
            .catch(() => {
                if (vigente) {
                    setDatos(null);
                }
            });
        return () => {
            vigente = false;
        };
    }, [searchParams]);

    const aplicarFiltro = (e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (filtroEstado) {
            params.set('estado', filtroEstado);
        }
        if (filtroDesde) {
            params.set('fecha_inicio', filtroDesde);
        }
        if (filtroHasta) {
            params.set('fecha_fin', filtroHasta);
        }
        const qs = params.toString();
        navigate(`/caja/reportes${qs ? `?${qs}` : ''}`);
    };

    const nav = [
        { label: 'Caja', href: '/caja' },
        { label: 'Presencial', href: '/caja/presencial' },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes' },
        { label: 'Completadas', href: '/caja/matriculas/completadas' },
        { label: 'Reportes', href: '/caja/reportes', activo: true },
    ];

    const estadosCompletados = ['pagada', 'matriculada'];
    const estadosPendientes = ['pendiente_pago', 'borrador'];

    return (
        <AppLayout titulo="Reportes - Academia Galileo" nav={nav} footer="Academia Galileo · Sistema de Matrículas · Caja">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-naranja-700">Control de caja</p>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reportes de matrículas</h1>
                    <p className="mt-2 text-sm text-slate-500">Consulta el estado de las matrículas y la recaudación de la academia.</p>
                </div>
                <Link to="/caja" className="btn btn-outline self-start sm:self-auto">← Volver a caja</Link>
            </div>

            <section className="card-form mb-8" aria-labelledby="cierre-titulo">
                <h2 id="cierre-titulo" className="text-lg font-semibold">Cierre de caja</h2>
                <p className="my-3 text-sm text-slate-600">Revisa los pagos del día, registra el efectivo contado y guarda el resultado. Los nuevos cobros quedan pendientes del siguiente cierre.</p>
                <Link to="/caja/reportes/cierres" className="btn btn-primary inline-flex">Cerrar caja y exportar para Excel</Link>
            </section>

            {!datos ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">Cargando…</div>
            ) : (
                <>
                    <section className="mb-8" aria-labelledby="resumen-titulo">
                        <div className="mb-4">
                            <h2 id="resumen-titulo" className="text-lg font-semibold text-slate-800">Resumen general</h2>
                            <p className="text-sm text-slate-500">Totales de todo el sistema. Los filtros se aplican únicamente al listado.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="card-sm border-t-4 border-naranja-500">
                                <p className="text-sm font-medium text-slate-500">Total matrículas</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{datos.resumen.total_matriculas}</p>
                                <p className="mt-1 text-xs text-slate-500">Registros en el sistema</p>
                            </div>
                            <div className="card-sm border-t-4 border-amber-400">
                                <p className="text-sm font-medium text-slate-500">Pendientes</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">{datos.resumen.pendientes}</p>
                                <p className="mt-1 text-xs text-slate-500">Borradores y pendientes de pago</p>
                            </div>
                            <div className="card-sm border-t-4 border-emerald-500">
                                <p className="text-sm font-medium text-slate-500">Completadas</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">{datos.resumen.completadas}</p>
                                <p className="mt-1 text-xs text-slate-500">Pagadas y matriculadas</p>
                            </div>
                            <div className="card-sm border-t-4 border-slate-400">
                                <p className="text-sm font-medium text-slate-500">Canceladas</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-600">{datos.resumen.canceladas}</p>
                                <p className="mt-1 text-xs text-slate-500">Matrículas canceladas</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-linear-to-r from-naranja-700 to-amber-800 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-orange-100">Total recaudado</p>
                                <p className="mt-1 break-words text-3xl font-bold tabular-nums sm:text-4xl">{soles(datos.resumen.monto_total)}</p>
                            </div>
                            <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3">
                                <p className="text-2xl font-bold tabular-nums">{datos.resumen.total_pagos}</p>
                                <p className="text-sm text-orange-100">Pagos registrados</p>
                            </div>
                        </div>
                    </section>

                    <form onSubmit={aplicarFiltro} className="card-form mb-4">
                        <div className="grid gap-4 sm:grid-cols-4">
                            <div>
                                <label className="text-sm font-medium">Estado</label>
                                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                                    <option value="">Todos</option>
                                    {Object.entries(datos.estados || {}).map(([valor, etiqueta]) => (
                                        <option key={valor} value={valor}>{etiqueta}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Fecha inicio</label>
                                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Fecha fin</label>
                                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700">
                                    Filtrar
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="card-tabla">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th>#</th>
                                    <th>Aspirante</th>
                                    <th>Documento</th>
                                    <th className="text-right">Descuento</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-center">Estado</th>
                                    <th className="text-center">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {datos.matriculas.data.length === 0 ? (
                                    <tr><td colSpan="7" className="py-4 text-center text-slate-500">No se encontraron matrículas.</td></tr>
                                ) : datos.matriculas.data.map((m) => {
                                    let badge = 'badge-neutral';
                                    if (estadosCompletados.includes(m.estado)) badge = 'badge-completado bg-emerald-100 text-emerald-800';
                                    if (estadosPendientes.includes(m.estado)) badge = 'badge-pendiente bg-amber-100 text-amber-800';

                                    return (
                                        <tr key={m.id}>
                                            <td>{m.id}</td>
                                            <td>{m.aspirante}</td>
                                            <td>{m.documento}</td>
                                            <td className="text-right">
                                                {Number(m.descuento) > 0 ? (
                                                    <span className="text-amber-700">- {soles(m.descuento)}</span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="text-right">{soles(m.valor_total)}</td>
                                            <td className="text-center">
                                                <span className={`badge ${badge}`}>{ESTADO_MATRICULA[m.estado] ?? m.estado_etiqueta}</span>
                                            </td>
                                            <td className="text-center">{fechaCorta(m.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Paginacion datos={datos.matriculas} ruta="/caja/reportes" />
                </>
            )}
        </AppLayout>
    );
}