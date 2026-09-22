import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import { GET } from '../../api.js';

export default function CodigoPago() {
    const { codigo } = useParams();

    const [estado, setEstado] = useState('cargando');
    const [error, setError] = useState('');
    const [codigoPago, setCodigoPago] = useState(null);

    useEffect(() => {
        let vigente = true;
        setEstado('cargando');
        setError('');
        GET(`/api/codigo-pago/${encodeURIComponent(codigo)}`)
            .then((datos) => {
                if (!vigente) {
                    return;
                }
                setCodigoPago(datos.codigoPago || null);
                setEstado('ok');
            })
            .catch((e) => {
                if (!vigente) {
                    return;
                }
                setError(e.datos?.message || e.message);
                setEstado('error');
            });
        return () => {
            vigente = false;
        };
    }, [codigo]);

    const nav = [
        { label: 'Matricularme', href: '/matricular' },
        { label: 'Mis pagos', href: '/mis-pagos' },
    ];

    return (
        <AppLayout titulo="Código de pago — Academia Galileo" nav={nav}>
            <div className="mx-auto max-w-lg">
                {estado === 'cargando' ? (
                    <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                        Consultando código…
                    </div>
                ) : null}

                {estado === 'error' ? (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                        <p className="text-lg font-semibold text-red-600">Código no válido</p>
                        <p className="mt-2 text-sm text-slate-500">{error}</p>
                        <a href="/matricular" className="btn mt-6">Volver al formulario</a>
                    </div>
                ) : null}

                {estado === 'ok' && codigoPago ? (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                        <p className="text-sm font-medium text-slate-500">Este es tu código de pago</p>
                        <p className="my-4 text-3xl font-black tracking-wider text-naranja-700 md:text-4xl">
                            {codigoPago.codigo}
                        </p>

                        <div className="mb-6 inline-block rounded-xl border border-slate-200 bg-white p-4">
                            <div dangerouslySetInnerHTML={{ __html: codigoPago.qr }} />
                            <p className="mt-2 text-xs text-slate-500">Preséntalo escaneando este QR en caja</p>
                        </div>

                        <dl className="mx-auto mb-6 max-w-sm space-y-2 text-left text-sm">
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <dt className="text-slate-500">Aspirante</dt>
                                <dd className="font-semibold">{codigoPago.aspirante}</dd>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <dt className="text-slate-500">Concepto</dt>
                                <dd className="font-semibold">Matrícula pre-universitaria (pago único)</dd>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <dt className="text-slate-500">Monto a pagar</dt>
                                <dd className="text-lg font-black text-naranja-700">{codigoPago.valor}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-slate-500">Vence</dt>
                                <dd className="font-semibold">{codigoPago.expira_at}</dd>
                            </div>
                        </dl>

                        <div className="rounded-lg bg-naranja-50 px-4 py-3 text-left text-sm text-naranja-900">
                            <p className="font-semibold">Instrucciones:</p>
                            <ol className="mt-1 list-inside list-decimal space-y-0.5">
                                <li>Acércate a la academia antes de la fecha de vencimiento.</li>
                                <li>Presenta este código (en pantalla, impreso o el QR).</li>
                                <li>Paga en efectivo, Yape, Plin o transferencia y listo: quedas matriculado.</li>
                            </ol>
                        </div>

                        <button onClick={() => window.print()}
                                className="mt-6 rounded-lg bg-naranja-600 px-6 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-naranja-700 hover:shadow-md print:hidden">
                            🖨️ Imprimir / Guardar PDF
                        </button>
                    </div>
                ) : null}
            </div>
        </AppLayout>
    );
}