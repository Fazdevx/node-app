import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import { GET, POST } from '../../api.js';
import { soles } from '../../lib/formatos.js';

export default function Recibo() {
    const { pago } = useParams();

    const [recibo, setRecibo] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [numero, setNumero] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [estado, setEstado] = useState('');
    const [alternativas, setAlternativas] = useState(null);

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        setError('');
        GET(`/api/caja/recibo/${encodeURIComponent(pago)}`)
            .then((datos) => {
                if (!vigente) {
                    return;
                }
                setRecibo(datos.recibo || null);
                setNumero(datos.recibo?.aspirante?.telefono ?? '');
            })
            .catch((e) => {
                if (!vigente) {
                    return;
                }
                setError(e.datos?.message || e.message);
            })
            .finally(() => {
                if (vigente) {
                    setCargando(false);
                }
            });
        return () => {
            vigente = false;
        };
    }, [pago]);

    const prepararWhatsapp = async (e) => {
        e.preventDefault();
        if (ocupado || numero.trim() === '') {
            return;
        }

        setOcupado(true);
        setAlternativas(null);
        setEstado('Preparando el recibo…');
        const ventana = window.open('about:blank', '_blank');
        if (ventana) {
            ventana.opener = null;
        }

        try {
            const datos = await POST(recibo.whatsapp_url, { numero });

            const respuestaPdf = await fetch(datos.pdf_url, {
                headers: { Accept: 'application/pdf', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!respuestaPdf.ok || !respuestaPdf.headers.get('Content-Type')?.includes('application/pdf')) {
                throw new Error('No se pudo generar el PDF. Recarga el recibo e inténtalo de nuevo.');
            }
            const archivo = await respuestaPdf.blob();
            const objetoUrl = URL.createObjectURL(archivo);
            const enlace = document.createElement('a');
            enlace.href = objetoUrl;
            enlace.download = datos.nombre_archivo;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            setTimeout(() => URL.revokeObjectURL(objetoUrl), 60000);

            setAlternativas({ pdf: datos.pdf_url, whatsapp: datos.whatsapp_url });
            if (ventana && !ventana.closed) {
                ventana.location.replace(datos.whatsapp_url);
            }
            setEstado('PDF preparado. Adjunta el archivo descargado en WhatsApp y pulsa Enviar. Si el chat no se abrió, usa el enlace de abajo.');
        } catch (err) {
            if (ventana && !ventana.closed) {
                ventana.close();
            }
            setEstado(err.message || 'No se pudo conectar. Inténtalo de nuevo.');
        } finally {
            setOcupado(false);
        }
    };

    const nav = [
        { label: 'Caja', href: '/caja' },
        { label: 'Presencial', href: '/caja/presencial' },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes' },
        { label: 'Completadas', href: '/caja/matriculas/completadas' },
        { label: 'Reportes', href: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Recibo de matrícula" nav={nav} footer="Caja · Academia Galileo">
            {cargando ? (
                <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Cargando recibo…
                </div>
            ) : null}

            {error ? (
                <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-lg font-semibold text-red-600">No se pudo abrir el recibo</p>
                    <p className="mt-2 text-sm text-slate-500">{error}</p>
                    <Link to="/caja" className="btn mt-6">Volver a caja</Link>
                </div>
            ) : null}

            {!cargando && !error && recibo ? (
                <>
                    <style>{`
                        #recibo { border: 1px solid #000; border-radius: 0; background: #fff; padding: 28px; box-shadow: none; color: #000; font-family: Arial, sans-serif; }
                        #recibo * { color: #000; border-color: #000; }
                        #recibo .recibo-encabezado { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 16px; }
                        #recibo .recibo-logo { display: block; width: 280px; max-width: 100%; height: auto; margin: 0 auto 8px; }
                        #recibo h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
                        #recibo .recibo-encabezado p { margin-top: 4px; font-size: 12px; }
                        #recibo h2 { border-bottom: 1px dashed #000; padding-bottom: 6px; font-size: 12px; }
                        #recibo table { table-layout: fixed; margin-bottom: 16px; }
                        #recibo td { overflow-wrap: anywhere; vertical-align: top; font-size: 12px; }
                        #recibo td:first-child { width: 38%; padding-right: 10px; }
                        #recibo td span { background: #fff; border: 1px solid #000; border-radius: 0; display: inline-block; }
                        #recibo .recibo-total { border-top: 2px solid #000; border-bottom: 2px solid #000; }
                        #recibo .recibo-total td { padding-top: 10px; padding-bottom: 10px; font-size: 16px; font-weight: 700; }
                        @media print {
                            @page { margin: 12mm; }
                            header, footer, .print\\:hidden { display: none !important; }
                            body { background: white; }
                            #recibo { border: 1px solid #000; box-shadow: none; }
                            #recibo tr, #recibo .recibo-encabezado { break-inside: avoid; }
                            #recibo h2 { break-after: avoid; }
                        }
                    `}</style>

                    <div className="mx-auto max-w-xl">
                        <div id="recibo" className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                            <div className="recibo-encabezado">
                                <img className="recibo-logo" src="/logo-galileo-monocromo.png" alt="Academia Galileo" />
                                <h1>Recibo de pago</h1>
                                <p>Confirmación de matrícula · Academia Galileo</p>
                            </div>

                            <table className="mb-6 w-full text-sm">
                                <tbody>
                                    <tr className="py-1.5"><td className="w-40 font-medium text-slate-500">N.º de recibo</td><td className="font-mono font-bold">#{recibo.numero}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Fecha</td><td>{recibo.fecha}</td></tr>
                                    <tr><td className="font-medium text-slate-500">N.º de matrícula</td>
                                        <td className="font-mono font-bold text-emerald-700">{recibo.numero_matricula || '—'}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Estado</td>
                                        <td><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{recibo.estado_etiqueta}</span></td></tr>
                                </tbody>
                            </table>

                            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Aspirante</h2>
                            <table className="mb-6 w-full text-sm">
                                <tbody>
                                    <tr><td className="w-40 font-medium text-slate-500">Nombre</td><td>{recibo.aspirante.nombre}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Documento</td>
                                        <td className="font-mono">{recibo.aspirante.documento}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Teléfono</td><td>{recibo.aspirante.telefono}</td></tr>
                                </tbody>
                            </table>

                            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Datos del apoderado</h2>
                            <table className="mb-6 w-full text-sm">
                                <tbody>
                                    <tr><td className="w-40 font-medium text-slate-500">Nombre</td><td>{recibo.aspirante.acudiente_nombre || 'No registrado'}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Documento</td>
                                        <td className="font-mono">{recibo.aspirante.apoderado_documento || 'No registrado'}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Dirección</td><td>{recibo.aspirante.apoderado_direccion || 'No registrada'}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Teléfono</td><td>{recibo.aspirante.acudiente_telefono || 'No registrado'}</td></tr>
                                </tbody>
                            </table>

                            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Matrícula</h2>
                            <table className="mb-6 w-full text-sm">
                                <tbody>
                                    <tr><td className="w-40 font-medium text-slate-500">Concepto</td>
                                        <td>{recibo.concepto}</td></tr>
                                </tbody>
                            </table>

                            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Pago</h2>
                            <table className="mb-6 w-full text-sm">
                                <tbody>
                                    <tr><td className="w-40 font-medium text-slate-500">Medio</td><td>{recibo.pago.metodo_etiqueta}</td></tr>
                                    {recibo.pago.codigo ? (
                                        <tr><td className="font-medium text-slate-500">Código pagado</td>
                                            <td className="font-mono">{recibo.pago.codigo}</td></tr>
                                    ) : null}
                                    {recibo.pago.referencia ? (
                                        <tr><td className="font-medium text-slate-500">Referencia</td>
                                            <td className="font-mono">{recibo.pago.referencia}</td></tr>
                                    ) : null}
                                    <tr className="border-t border-slate-200"><td className="pt-2 font-medium text-slate-500">Precio</td>
                                        <td className="pt-2">{soles(recibo.pago.precio)}</td></tr>
                                    {Number(recibo.pago.descuento) > 0 ? (
                                        <tr><td className="font-medium text-slate-500">Descuento aplicado</td>
                                            <td className="font-semibold text-amber-700">- {soles(recibo.pago.descuento)}</td></tr>
                                    ) : null}
                                    <tr className="recibo-total"><td className="font-bold text-slate-700">Total pagado</td>
                                        <td className="text-base font-black text-naranja-700">{soles(recibo.pago.total)}</td></tr>
                                    <tr><td className="font-medium text-slate-500">Recibido</td>
                                        <td>{soles(recibo.pago.recibido)}</td></tr>
                                    {Number(recibo.pago.vuelto) > 0 ? (
                                        <tr><td className="font-medium text-slate-500">Vuelto</td>
                                            <td className="font-bold text-emerald-700">{soles(recibo.pago.vuelto)}</td></tr>
                                    ) : null}
                                </tbody>
                            </table>

                            {recibo.pago.registrado_por ? (
                                <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                                    Registrado por: {recibo.pago.registrado_por} · Conserva este recibo, es tu comprobante de matrícula.
                                </p>
                            ) : null}
                        </div>

                        <div className="mx-auto mt-6 flex max-w-xl gap-3 print:hidden">
                            <button onClick={() => { setNumero(recibo.aspirante.telefono ?? ''); setEstado(''); setAlternativas(null); setModalAbierto(true); }}
                                    className="flex-1 rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-emerald-800">
                                Enviar recibo por WhatsApp
                            </button>
                            <Link to="/caja"
                                  className="flex-1 rounded-lg border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition-all hover:bg-slate-50">
                                Nueva venta en caja
                            </Link>
                        </div>

                        <div className="mt-3 flex justify-center gap-4 text-sm print:hidden">
                            <a href={recibo.pdf_url} className="font-semibold text-naranja-700 underline">Descargar PDF</a>
                            <button onClick={() => window.print()} className="text-slate-600 underline">Imprimir</button>
                        </div>
                    </div>

                    {modalAbierto ? (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !ocupado && setModalAbierto(false)}>
                            <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-800 shadow-xl"
                                 onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-whatsapp">
                                <h2 id="titulo-whatsapp" className="text-lg font-bold">Enviar recibo por WhatsApp</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    Se descargará el PDF y se abrirá el chat con un mensaje listo. Adjunta el PDF descargado y pulsa Enviar en WhatsApp. No se envía automáticamente.
                                </p>
                                <form onSubmit={prepararWhatsapp} className="mt-4">
                                    <label htmlFor="numero-whatsapp" className="block text-sm font-semibold">Número de WhatsApp</label>
                                    <input id="numero-whatsapp" type="tel" inputMode="tel" autoComplete="tel" required maxLength="30"
                                           value={numero} onChange={(e) => { setNumero(e.target.value); setAlternativas(null); setEstado(''); }}
                                           autoFocus aria-describedby="formato-whatsapp"
                                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    <p id="formato-whatsapp" className="mt-1 text-xs text-slate-500">Perú: 987654321. Otro país: +34 612345678. Confirma el destinatario antes de continuar.</p>
                                    <p role="status" aria-live="polite" className="mt-3 text-sm">{estado}</p>
                                    {alternativas ? (
                                        <div className="mt-3 text-sm">
                                            <a href={alternativas.pdf} className="block text-naranja-700 underline">Descargar PDF de nuevo</a>
                                            <a href={alternativas.whatsapp} target="_blank" rel="noopener noreferrer" className="mt-2 block text-emerald-700 underline">Abrir WhatsApp</a>
                                        </div>
                                    ) : null}
                                    <div className="mt-5 flex gap-3">
                                        <button type="submit" disabled={ocupado} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                                            {ocupado ? 'Preparando…' : 'Descargar y abrir WhatsApp'}
                                        </button>
                                        <button type="button" onClick={() => !ocupado && setModalAbierto(false)} className="rounded-lg border border-slate-300 px-4 py-2">Cerrar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}
        </AppLayout>
    );
}