import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import { GET, POST } from '../../api.js';
import { METODOS_DIGITALES, soles } from '../../lib/formatos.js';

export default function Presencial() {
    const navigate = useNavigate();

    const [config, setConfig] = useState({ tipos_documento: {}, metodos: {}, precio_matricula: null });
    const [data, setData] = useState({
        tipo_documento: '',
        numero_documento: '',
        nombres: '',
        apellidos: '',
        turno: '',
        celular: '',
        apoderado_tipo_documento: '',
        apoderado_numero_documento: '',
        apoderado_nombre: '',
        apoderado_direccion: '',
        apoderado_telefono: '',
        autoriza_datos: false,
        modalidad: '',
        metodo: '',
        descuento: '0',
        valor_recibido: '',
        referencia: '',
        observaciones: '',
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        GET('/api/caja/presencial')
            .then((datos) => {
                setConfig({
                    tipos_documento: datos.tiposDocumento || {},
                    metodos: datos.metodos || {},
                    precio_matricula: datos.precioMatricula ?? null,
                });
            })
            .catch(() => {});
    }, []);

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

    const precio = Number(config.precio_matricula) || 0;
    const esEfectivo = data.metodo === 'efectivo';
    const esDigital = METODOS_DIGITALES.includes(data.metodo);

    const descuento = Math.min(Math.max(Number(data.descuento) || 0, 0), precio);
    const total = Math.round((precio - descuento) * 100) / 100;
    const recibido = esEfectivo ? (Number(data.valor_recibido) || 0) : total;
    const vuelto = Math.max(0, Math.round((recibido - total) * 100) / 100);
    const falta = Math.max(0, Math.round((total - recibido) * 100) / 100);
    const faltaInvalida = esEfectivo && falta > 0;

    const enviar = async (e) => {
        e.preventDefault();
        if (processing) {
            return;
        }
        if (esEfectivo && (Number(data.valor_recibido) || 0) < total) {
            document.getElementById('valorRecibido')?.focus();
            return;
        }
        setProcessing(true);
        setErrors({});
        try {
            const datos = await POST('/api/caja/presencial', data);
            navigate(datos.redirect || '/caja', { state: { exito: datos.exito } });
        } catch (error) {
            if (error.datos?.errors) {
                setErrors(error.datos.errors);
            }
        } finally {
            setProcessing(false);
        }
    };

    const nav = [
        { label: 'Caja', href: '/caja' },
        { label: 'Presencial', href: '/caja/presencial', activo: true },
        { label: 'Pendientes', href: '/caja/matriculas/pendientes' },
        { label: 'Completadas', href: '/caja/matriculas/completadas' },
        { label: 'Reportes', href: '/caja/reportes' },
    ];

    return (
        <AppLayout titulo="Matrícula presencial" nav={nav} footer="Caja · Academia Galileo">
            <h1 className="mb-1 text-2xl font-bold text-slate-800">Matrícula presencial</h1>
            <p className="mb-6 text-sm text-slate-500">
                Complete los datos del aspirante y cobre en el mismo acto.
                Pago único: <strong>{soles(precio)}</strong> ·
                si aplica descuento, el sistema recalcula el total y el vuelto.
            </p>

            <form onSubmit={enviar}
                  className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:grid-cols-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-naranja-700 md:col-span-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-naranja-100 text-xs font-bold text-naranja-700">1</span>
                    Datos del aspirante
                </h2>

                <label className="text-sm">
                    <span className="label-text">Tipo de documento *</span>
                    <select value={data.tipo_documento} onChange={(e) => setDataCampo('tipo_documento', e.target.value)} required>
                        <option value="">— Seleccione —</option>
                        {Object.entries(config.tipos_documento).map(([valor, etiqueta]) => (
                            <option key={valor} value={valor}>{etiqueta}</option>
                        ))}
                    </select>
                    {errors.tipo_documento && <span className="mt-1 block text-xs text-red-600">{errors.tipo_documento}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Número de documento *</span>
                    <input type="text" value={data.numero_documento} onChange={(e) => setDataCampo('numero_documento', e.target.value)} required maxLength="30" />
                    {errors.numero_documento && <span className="mt-1 block text-xs text-red-600">{errors.numero_documento}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Nombres *</span>
                    <input type="text" value={data.nombres} onChange={(e) => setDataCampo('nombres', e.target.value)} required maxLength="120" />
                    {errors.nombres && <span className="mt-1 block text-xs text-red-600">{errors.nombres}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Apellidos *</span>
                    <input type="text" value={data.apellidos} onChange={(e) => setDataCampo('apellidos', e.target.value)} required maxLength="120" />
                    {errors.apellidos && <span className="mt-1 block text-xs text-red-600">{errors.apellidos}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Turno *</span>
                    <select value={data.turno} onChange={(e) => setDataCampo('turno', e.target.value)} required>
                        <option value="">— Seleccione —</option>
                        <option value="mañana">Mañana</option>
                        <option value="tarde">Tarde</option>
                        <option value="ambos">Ambos</option>
                    </select>
                    {errors.turno && <span className="mt-1 block text-xs text-red-600">{errors.turno}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Número de celular *</span>
                    <input type="tel" value={data.celular} onChange={(e) => setDataCampo('celular', e.target.value)} required maxLength="30" placeholder="Ej: 987654321" />
                    {errors.celular && <span className="mt-1 block text-xs text-red-600">{errors.celular}</span>}
                </label>

                <h2 className="mt-6 flex items-center gap-2 text-lg font-semibold text-naranja-700 md:col-span-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-naranja-100 text-xs font-bold text-naranja-700">2</span>
                    Datos del apoderado
                </h2>

                <label className="text-sm">
                    <span className="label-text">DNI del apoderado *</span>
                    <select value={data.apoderado_tipo_documento} onChange={(e) => setDataCampo('apoderado_tipo_documento', e.target.value)} required>
                        <option value="">— Seleccione —</option>
                        {Object.entries(config.tipos_documento).map(([valor, etiqueta]) => (
                            <option key={valor} value={valor}>{etiqueta}</option>
                        ))}
                    </select>
                    {errors.apoderado_tipo_documento && <span className="mt-1 block text-xs text-red-600">{errors.apoderado_tipo_documento}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">N.º de DNI del apoderado *</span>
                    <input type="text" value={data.apoderado_numero_documento} onChange={(e) => setDataCampo('apoderado_numero_documento', e.target.value)} required maxLength="30" />
                    {errors.apoderado_numero_documento && <span className="mt-1 block text-xs text-red-600">{errors.apoderado_numero_documento}</span>}
                </label>

                <label className="text-sm md:col-span-2">
                    <span className="label-text">Nombre del apoderado *</span>
                    <input type="text" value={data.apoderado_nombre} onChange={(e) => setDataCampo('apoderado_nombre', e.target.value)} required maxLength="120" />
                    {errors.apoderado_nombre && <span className="mt-1 block text-xs text-red-600">{errors.apoderado_nombre}</span>}
                </label>

                <label className="text-sm md:col-span-2">
                    <span className="label-text">Dirección del apoderado *</span>
                    <input type="text" value={data.apoderado_direccion} onChange={(e) => setDataCampo('apoderado_direccion', e.target.value)} required maxLength="180" />
                    {errors.apoderado_direccion && <span className="mt-1 block text-xs text-red-600">{errors.apoderado_direccion}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Teléfono del apoderado *</span>
                    <input type="tel" value={data.apoderado_telefono} onChange={(e) => setDataCampo('apoderado_telefono', e.target.value)} required maxLength="30" />
                    {errors.apoderado_telefono && <span className="mt-1 block text-xs text-red-600">{errors.apoderado_telefono}</span>}
                </label>

                <label className="mt-6 flex items-start gap-2 text-sm md:col-span-2">
                    <input type="checkbox" checked={data.autoriza_datos} onChange={(e) => setDataCampo('autoriza_datos', e.target.checked)} className="mt-0.5" />
                    <span>Autorizo el tratamiento de mis datos personales conforme a la política de la academia. *</span>
                </label>
                {errors.autoriza_datos && <span className="text-xs text-red-600 md:col-span-2">{errors.autoriza_datos}</span>}

                <label className="text-sm md:col-span-2">
                    <span className="label-text">Modalidad del estudiante</span>
                    <input type="text" value={data.modalidad} onChange={(e) => setDataCampo('modalidad', e.target.value)} maxLength="180" />
                    {errors.modalidad && <span className="mt-1 block text-xs text-red-600">{errors.modalidad}</span>}
                </label>

                <h2 className="flex items-center gap-2 text-lg font-semibold text-naranja-700 md:col-span-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-naranja-100 text-xs font-bold text-naranja-700">2</span>
                    Pago ({soles(precio)})
                </h2>

                <label className="text-sm">
                    <span className="label-text">Medio de pago *</span>
                    <select value={data.metodo} onChange={(e) => {
                        setDataCampo('metodo', e.target.value);
                        if (METODOS_DIGITALES.includes(e.target.value)) {
                            setDataCampo('valor_recibido', '');
                        } else {
                            setDataCampo('referencia', '');
                        }
                    }} required>
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
                    <span className="mt-1 block text-xs text-slate-500">Déjalo en 0 si no hay descuento.</span>
                    {errors.descuento && <span className="mt-1 block text-xs text-red-600">{errors.descuento}</span>}
                </label>

                <div className="rounded-xl border border-naranja-200 bg-naranja-50 p-4 md:col-span-2">
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between border-b border-naranja-100 pb-1">
                            <dt className="text-slate-600">Precio de matrícula</dt>
                            <dd className="font-semibold">{soles(precio)}</dd>
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
                            <dt className="text-slate-600">Monto recibido</dt>
                            <dd className="font-semibold">{soles(recibido)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-slate-600">Vuelto</dt>
                            <dd className="text-lg font-black text-emerald-700">{soles(vuelto)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-slate-600">Falta</dt>
                            <dd className="font-semibold text-red-600">{soles(falta)}</dd>
                        </div>
                    </dl>
                </div>

                {esEfectivo ? (
                    <div className="rounded-lg bg-slate-50 p-4 md:col-span-2">
                        <label className="text-sm">
                            <span className="label-text">Monto recibido en efectivo (S/)</span>
                            <input id="valorRecibido" type="number" value={data.valor_recibido} onChange={(e) => setDataCampo('valor_recibido', e.target.value)}
                                   min="0" step="0.01" inputMode="decimal" />
                            <span className="mt-1 block text-xs text-slate-500">
                                Escribe lo que entrega el aspirante (ej. 300.00) y el sistema calcula el vuelto.
                            </span>
                        </label>
                        <p className="mt-2 text-sm">
                            Vuelto a entregar: <span className="text-lg font-black text-emerald-700">{soles(vuelto)}</span>
                        </p>
                        {faltaInvalida ? (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                                El monto recibido es menor al total a pagar.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {esDigital ? (
                    <div className="rounded-lg bg-slate-50 p-4 md:col-span-2">
                        <label className="text-sm">
                            <span className="label-text">N.º de operación / referencia *</span>
                            <input type="text" value={data.referencia} onChange={(e) => setDataCampo('referencia', e.target.value)} maxLength="60"
                                   placeholder="Los dígitos que muestra la app o el banco" />
                            <span className="mt-1 block text-xs text-slate-500">
                                Yape/Plin: código de operación · Transferencia: n.º de operación · Tarjeta: últimos 4 dígitos
                            </span>
                            {errors.referencia && <span className="mt-1 block text-xs text-red-600">{errors.referencia}</span>}
                        </label>
                        <p className="mt-2 text-xs text-slate-600">
                            En medios digitales se cobra el total exacto: <strong>{soles(total)}</strong>.
                        </p>
                    </div>
                ) : null}

                <div className="md:col-span-2">
                    <button type="submit" disabled={processing} className="btn btn-success w-full">
                        {processing ? 'Guardando…' : 'Guardar matrícula, cobrar y generar recibo'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}