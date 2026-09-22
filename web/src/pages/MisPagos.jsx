import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../Layout.jsx';
import { GET } from '../api.js';
import { soles, fechaCorta, fechaHora, METODO_PAGO, ESTADO_MATRICULA } from '../lib/formatos.js';

export default function MisPagos() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [tiposDocumento, setTiposDocumento] = useState({});
    const [tipoDocumento, setTipoDocumento] = useState(searchParams.get('tipo_documento') || '');
    const [numeroDocumento, setNumeroDocumento] = useState(searchParams.get('numero_documento') || '');
    const [consultado, setConsultado] = useState(false);
    const [aspirante, setAspirante] = useState(null);
    const [matriculas, setMatriculas] = useState([]);
    const [cargando, setCargando] = useState(Boolean(searchParams.get('numero_documento')));

    useEffect(() => {
        let vigente = true;
        const tipo = searchParams.get('tipo_documento');
        const numero = searchParams.get('numero_documento');
        const conBusqueda = Boolean(tipo && numero);
        if (conBusqueda) {
            setCargando(true);
        }
        const params = new URLSearchParams();
        if (tipo) {
            params.set('tipo_documento', tipo);
        }
        if (numero) {
            params.set('numero_documento', numero);
        }
        const qs = params.toString();
        GET(`/api/mis-pagos${qs ? `?${qs}` : ''}`)
            .then((datos) => {
                if (!vigente) {
                    return;
                }
                setTiposDocumento(datos.tiposDocumento || {});
                setConsultado(conBusqueda);
                if (conBusqueda) {
                    setAspirante(datos.aspirante || null);
                    setMatriculas(datos.matriculas || []);
                } else {
                    setAspirante(null);
                    setMatriculas([]);
                }
            })
            .catch(() => {
                if (!vigente) {
                    return;
                }
                if (conBusqueda) {
                    setConsultado(true);
                    setAspirante(null);
                    setMatriculas([]);
                }
            })
            .finally(() => {
                if (vigente) {
                    setCargando(false);
                }
            });
        return () => {
            vigente = false;
        };
    }, [searchParams]);

    const nav = [
        { label: 'Matricularme', href: '/matricular' },
        { label: 'Mis pagos', href: '/mis-pagos', activo: true },
    ];

    return (
        <AppLayout titulo="Mis pagos" nav={nav}>
            <h1 className="mb-1 text-2xl font-bold text-slate-800">Mis matrículas y pagos</h1>
            <p className="mb-6 text-sm text-slate-500">
                Ingresa tu número de documento para ver el estado de tus matrículas.
            </p>

            <form method="get" action="/mis-pagos"
                  onSubmit={(e) => { e.preventDefault(); }} className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <label className="mt-1 block text-sm font-medium text-slate-700">Tipo de documento *</label>
                        <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} required className="w-full rounded-lg border-slate-300 focus:border-naranja-500 focus:ring-naranja-500">
                            <option value="">— Seleccione —</option>
                            {Object.entries(tiposDocumento).map(([valor, etiqueta]) => (
                                <option key={valor} value={valor}>{etiqueta}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mt-1 block text-sm font-medium text-slate-700">Número de documento *</label>
                        <input type="text" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} required maxLength="30"
                               className="w-full rounded-lg border-slate-300 focus:border-naranja-500 focus:ring-naranja-500" />
                    </div>
                    <div className="flex items-end">
                        <button type="submit" onClick={() => { const params = new URLSearchParams(); if (tipoDocumento) { params.set('tipo_documento', tipoDocumento); } if (numeroDocumento) { params.set('numero_documento', numeroDocumento); } const qs = params.toString(); navigate(`/mis-pagos${qs ? `?${qs}` : ''}`); }}
                                className="w-full rounded-lg bg-naranja-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-naranja-700">
                            Buscar
                        </button>
                    </div>
                </div>
            </form>

            {cargando ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Consultando…
                </div>
            ) : null}

            {consultado && !cargando && !aspirante ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    No se encontró ningún aspirante con esos datos.
                </div>
            ) : null}

            {aspirante && !cargando && matriculas.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    No tienes matrículas registradas.
                </div>
            ) : null}

            {aspirante && !cargando && matriculas.length > 0 ? (
                <div className="space-y-4">
                    {matriculas.map((matricula) => (
                        <div key={matricula.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                            <div className="mb-2 flex items-start justify-between">
                                <h3 className="font-bold text-slate-800">Matrícula pre-universitaria</h3>
                                <span className="text-xs text-slate-400">{fechaCorta(matricula.created_at)}</span>
                            </div>

                            <div className="grid gap-2 text-sm sm:grid-cols-2">
                                <div><strong className="text-slate-500">Estado:</strong> {ESTADO_MATRICULA[matricula.estado] ?? matricula.estado}</div>
                                {matricula.numero_matricula ? (
                                    <div><strong className="text-slate-500">N.º de matrícula:</strong> <span className="font-mono">{matricula.numero_matricula}</span></div>
                                ) : null}
                                {Number(matricula.descuento) > 0 ? (
                                    <div><strong className="text-slate-500">Descuento aplicado:</strong> {soles(matricula.descuento)}</div>
                                ) : null}
                                <div><strong className="text-slate-500">Monto:</strong> {soles(matricula.valor_total)}</div>
                            </div>

                            {matricula.codigo_vigente ? (
                                <div className="mt-3 rounded-lg bg-naranja-50 px-3 py-2 text-sm text-naranja-900">
                                    <strong>Código de pago:</strong>
                                    <span className="font-mono font-bold">{matricula.codigo_vigente.codigo}</span>
                                    {' · '}vence {matricula.codigo_vigente.expira_at}
                                </div>
                            ) : null}

                            {matricula.pagos.length > 0 ? (
                                <div className="mt-3 border-t border-slate-100 pt-3">
                                    <strong className="block text-xs uppercase tracking-wide text-slate-400">Pagos</strong>
                                    <ul className="mt-1 space-y-1">
                                        {matricula.pagos.map((pago, i) => (
                                            <li key={i}>
                                                <span className="flex justify-between text-sm">
                                                    <span>{METODO_PAGO[pago.metodo] ?? pago.metodo} — {fechaHora(pago.pagado_at)}</span>
                                                    <span className="font-medium">{soles(pago.valor_total)}</span>
                                                </span>
                                                {Number(pago.vuelto) > 0 ? (
                                                    <span className="flex justify-between text-xs text-slate-400">
                                                        <span>Recibido {soles(pago.valor_recibido)}</span>
                                                        <span>Vuelto {soles(pago.vuelto)}</span>
                                                    </span>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </AppLayout>
    );
}