import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import Paginacion from '../../components/Paginacion.jsx';
import { GET, POST } from '../../api.js';
import { soles, ESTADO_MATRICULA } from '../../lib/formatos.js';

function descargar(url, nombre) {
    if (url.startsWith('data:')) {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        return;
    }

    return fetch(url, { headers: { Accept: 'application/pdf' } }).then((respuesta) => {
        if (!respuesta.ok) {
            throw new Error('No se pudo generar el PDF. Recarga la página e inténtalo de nuevo.');
        }
        return respuesta.blob();
    }).then((archivo) => {
        const objetoUrl = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = objetoUrl;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(objetoUrl), 60000);
    });
}

export default function Completadas() {
    const [searchParams] = useSearchParams();
    const [matriculas, setMatriculas] = useState(null);

    const [objetivo, setObjetivo] = useState(null);
    const [promotor, setPromotor] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [descargando, setDescargando] = useState(null);
    const [aviso, setAviso] = useState('');

    useEffect(() => {
        let vigente = true;
        const pagina = searchParams.get('page') || '';
        const query = pagina ? `?page=${pagina}` : '';
        GET(`/api/caja/matriculas/completadas${query}`)
            .then((datos) => {
                if (vigente) {
                    setMatriculas(datos.matriculas);
                }
            })
            .catch(() => {
                if (vigente) {
                    setMatriculas({ data: [] });
                }
            });
        return () => {
            vigente = false;
        };
    }, [searchParams]);

    const filas = matriculas?.data ?? [];
    const resumen = useMemo(() => {
        const firmados = filas.filter((m) => m.consentimiento?.firmado).length;
        return { firmados, pendientes: filas.length - firmados, total: filas.length };
    }, [filas]);

    const actualizarFila = (id, consentimiento) => {
        setMatriculas((actual) => (actual
            ? { ...actual, data: actual.data.map((m) => (m.id === id ? { ...m, consentimiento } : m)) }
            : actual));
    };

    const marcar = async (m, firmado, nombrePromotor = '') => {
        setOcupado(true);
        setAviso('');
        try {
            const datos = await POST(`/api/caja/matriculas/${m.id}/consentimiento`, {
                firmado,
                promotor: firmado ? nombrePromotor : null,
            });
            actualizarFila(m.id, datos.consentimiento);
            setObjetivo(null);
            setPromotor('');
            setAviso(datos.exito ?? '');
        } catch (e) {
            setAviso(e.datos?.message || e.message || 'No se pudo guardar el consentimiento.');
        } finally {
            setOcupado(false);
        }
    };

    const alternar = (m) => {
        if (m.consentimiento?.firmado) {
            marcar(m, false);
            return;
        }
        setPromotor(m.consentimiento?.promotor ?? '');
        setAviso('');
        setObjetivo(m);
    };

    const descargarConsentimiento = async (m) => {
        setDescargando(m.id);
        setAviso('');
        try {
            const datos = await GET(`/api/caja/matriculas/${m.id}/consentimiento`);
            const c = datos.consentimiento;
            await descargar(c.pdf_url, c.nombre_archivo);
            actualizarFila(m.id, c);
        } catch (e) {
            setAviso(e.datos?.message || e.message || 'No se pudo generar el documento.');
        } finally {
            setDescargando(null);
        }
    };

    const nav = [
        { label: 'Caja', href: '/caja' },
        { label: 'Presencial', href: '/caja/presencial' },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes' },
        { label: 'Completadas', href: '/caja/matriculas/completadas', activo: true },
        { label: 'Reportes', href: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Matrículas completadas" nav={nav} footer="Caja · Academia Galileo">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Matrículas completadas</h1>
                    <p className="text-sm text-slate-500">Historial de matrículas pagadas y confirmadas.</p>
                </div>
                <Link to="/caja" className="text-sm font-medium text-naranja-600 hover:text-naranja-800 hover:underline">← Volver a caja</Link>
            </div>

            {!matriculas ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">Cargando…</div>
            ) : filas.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    No hay matrículas completadas.
                </div>
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                            Consentimientos: <span className="font-bold text-emerald-700">{resumen.firmados}</span> firmados ·{' '}
                            <span className="font-bold text-amber-700">{resumen.pendientes}</span> pendientes
                        </span>
                        <span className="text-xs text-slate-500">
                            Marca el check cuando el apoderado y promotoría ya firmaron el documento.
                        </span>
                    </div>

                    {aviso ? (
                        <p role="status" aria-live="polite" className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                            {aviso}
                        </p>
                    ) : null}

                    <div className="card-tabla">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th>Aspirante</th>
                                    <th>Documento</th>
                                    <th className="text-right">Total pagado</th>
                                    <th className="text-center">Fecha pago</th>
                                    <th className="text-center">Estado</th>
                                    <th className="text-center">Consentimiento</th>
                                    <th className="text-center">Recibo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filas.map((m) => {
                                    const firmado = Boolean(m.consentimiento?.firmado);
                                    return (
                                        <tr key={m.id} className="transition-colors hover:bg-emerald-50/50">
                                            <td className="font-medium text-slate-800">{m.aspirante}</td>
                                            <td className="text-slate-600">{m.documento}</td>
                                            <td className="text-right font-medium">{soles(m.total_pagado)}</td>
                                            <td className="text-center text-slate-600">{m.pagado_at ?? '-'}</td>
                                            <td className="text-center">
                                                <span className="badge badge-completado bg-emerald-100 text-emerald-800">
                                                    {ESTADO_MATRICULA[m.estado] ?? m.estado_etiqueta}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <label className="inline-flex cursor-pointer items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={firmado}
                                                        disabled={ocupado}
                                                        onChange={() => alternar(m)}
                                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className={`text-xs font-semibold ${firmado ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                        {firmado ? 'Firmado' : 'Pendiente'}
                                                    </span>
                                                </label>
                                                <div className="mt-1 text-[11px] leading-tight text-slate-500">
                                                    {firmado && m.consentimiento?.promotor
                                                        ? m.consentimiento.promotor
                                                        : (m.consentimiento?.firmado_at ?? '')}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => descargarConsentimiento(m)}
                                                    disabled={descargando === m.id}
                                                    className="mt-1 text-xs font-medium text-naranja-600 underline hover:text-naranja-800 disabled:opacity-50"
                                                >
                                                    {descargando === m.id ? 'Generando…' : 'Ver / descargar'}
                                                </button>
                                            </td>
                                            <td className="text-center">
                                                {m.ultimo_pago_id ? (
                                                    <Link to={`/caja/recibo/${m.ultimo_pago_id}`} className="font-medium text-naranja-600 hover:text-naranja-800">Ver</Link>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion datos={matriculas} ruta="/caja/matriculas/completadas" />
                </>
            )}

            {objetivo ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                     onClick={() => !ocupado && setObjetivo(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-800 shadow-xl"
                         onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-consentimiento">
                        <h2 id="titulo-consentimiento" className="text-lg font-bold">Consentimiento firmado</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Se registre el documento de consentimiento de uso de imagen de{' '}
                            <span className="font-semibold">{objetivo.aspirante}</span>. Descárgalo, imprímelo y
                            hazlo firmar por el apoderado y por promotoría antes de marcarlo.
                        </p>
                        <div className="mt-4">
                            <label htmlFor="promotor" className="block text-sm font-semibold">Promotor(a) que firma</label>
                            <input
                                id="promotor"
                                type="text"
                                maxLength={120}
                                value={promotor}
                                onChange={(e) => setPromotor(e.target.value)}
                                placeholder="Nombre y apellido (opcional)"
                                autoFocus
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Se imprime bajo la línea de firma de promotoría. Puedes dejarlo vacío.
                            </p>
                        </div>
                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => marcar(objetivo, true, promotor)}
                                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                            >
                                {ocupado ? 'Guardando…' : 'Confirmar firmado'}
                            </button>
                            <button type="button" onClick={() => !ocupado && setObjetivo(null)}
                                    className="rounded-lg border border-slate-300 px-4 py-2">Cancelar</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </AppLayout>
    );
}
