import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import Paginacion from '../../components/Paginacion.jsx';
import { GET } from '../../api.js';
import { soles, ESTADO_MATRICULA } from '../../lib/formatos.js';

export default function Pendientes() {
    const [searchParams] = useSearchParams();
    const [matriculas, setMatriculas] = useState(null);

    useEffect(() => {
        let vigente = true;
        const pagina = searchParams.get('page') || '';
        const query = pagina ? `?page=${pagina}` : '';
        GET(`/api/caja/matriculas/pendientes${query}`)
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

    const nav = [
        { label: 'Caja', href: '/caja' },
        { label: 'Presencial', href: '/caja/presencial' },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes', activo: true },
        { label: 'Completadas', href: '/caja/matriculas/completadas' },
        { label: 'Reportes', href: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Matrículas pendientes de pago" nav={nav} footer="Caja · Academia Galileo">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Matrículas pendientes</h1>
                    <p className="text-sm text-slate-500">Aspirantes que aún no han completado su pago.</p>
                </div>
                <Link to="/caja" className="text-sm font-medium text-naranja-600 hover:text-naranja-800 hover:underline">← Volver a caja</Link>
            </div>

            {!matriculas ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">Cargando…</div>
            ) : matriculas.data.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    No hay matrículas pendientes.
                </div>
            ) : (
                <>
                    <div className="card-tabla">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-naranja-50">
                                <tr>
                                    <th>Aspirante</th>
                                    <th>Documento</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-center">Estado</th>
                                    <th className="text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {matriculas.data.map((m) => (
                                    <tr key={m.id} className="transition-colors hover:bg-naranja-50/50">
                                        <td className="font-medium text-slate-800">{m.aspirante}</td>
                                        <td className="text-slate-600">{m.documento}</td>
                                        <td className="text-right font-medium">{soles(m.valor_total)}</td>
                                        <td className="text-center">
                                            <span className="badge badge-pendiente bg-amber-100 text-amber-800">
                                                {ESTADO_MATRICULA[m.estado] ?? m.estado_etiqueta}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            {m.codigo_vigente ? (
                                                <Link to="/caja" className="font-medium text-naranja-600 hover:text-naranja-800">Cobrar</Link>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion datos={matriculas} ruta="/caja/matriculas/pendientes" />
                </>
            )}
        </AppLayout>
    );
}