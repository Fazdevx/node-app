import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../Layout.jsx';
import { GET, POST } from '../../api.js';

export default function Formato() {
    const navigate = useNavigate();

    const [config, setConfig] = useState({ tipos_documento: {}, precio_matricula: null });
    const [data, setData] = useState({
        tipo_documento: '',
        numero_documento: '',
        nombres: '',
        apellidos: '',
        fecha_nacimiento: '',
        telefono: '',
        email: '',
        turno: '',
        direccion: '',
        ciudad: '',
        acudiente_nombre: '',
        acudiente_telefono: '',
        autoriza_datos: false,
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        GET('/api/matricular')
            .then((datos) => {
                setConfig({
                    tipos_documento: datos.tiposDocumento || {},
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

    const esMenor = (() => {
        if (!data.fecha_nacimiento) {
            return null;
        }
        const nacimiento = new Date(`${data.fecha_nacimiento}T00:00:00`);
        if (Number.isNaN(nacimiento.getTime())) {
            return null;
        }
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mesCumple = hoy.getMonth() - nacimiento.getMonth();
        if (mesCumple < 0 || (mesCumple === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad -= 1;
        }
        return edad < 18;
    })();

    const enviar = async (e) => {
        e.preventDefault();
        if (processing) {
            return;
        }
        setProcessing(true);
        setErrors({});
        try {
            const datos = await POST('/api/matricular', data);
            navigate(datos.redirect || '/caja', { state: { exito: datos.exito } });
        } catch (error) {
            if (error.datos?.errors) {
                setErrors(error.datos.errors);
            } else if (error.datos?.message) {
                setErrors({ autoriza_datos: error.datos.message });
            }
        } finally {
            setProcessing(false);
        }
    };

    const nav = [
        { label: 'Matricularme', href: '/matricular', activo: true },
        { label: 'Mis pagos', href: '/mis-pagos' },
    ];

    return (
        <AppLayout titulo="Formulario de matrícula" nav={nav}>
            <h1 className="mb-1 text-2xl font-bold text-slate-800">Formulario de matrícula</h1>
            <p className="mb-6 text-sm text-slate-500">
                Al enviar, recibes tu <strong>código de pago</strong>. Preséntalo en caja para finalizar.
            </p>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-naranja-200 bg-gradient-to-r from-naranja-50 to-amber-50 px-6 py-5 shadow-sm">
                <div>
                    <p className="text-sm font-semibold text-naranja-900">Pago único de matrícula</p>
                    <p className="text-xs text-naranja-700">Un solo pago · No hay programa ni grupo que elegir</p>
                </div>
                <p className="text-3xl font-black text-naranja-700">S/ {(Number(config.precio_matricula) || 0).toFixed(2)}</p>
            </div>

            <form onSubmit={enviar} className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:grid-cols-2">
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
                    <span className="label-text">Fecha de nacimiento *</span>
                    <input type="date" value={data.fecha_nacimiento} onChange={(e) => setDataCampo('fecha_nacimiento', e.target.value)} required max={new Date().toISOString().slice(0, 10)} />
                    {errors.fecha_nacimiento && <span className="mt-1 block text-xs text-red-600">{errors.fecha_nacimiento}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Número de celular *</span>
                    <input type="tel" value={data.telefono} onChange={(e) => setDataCampo('telefono', e.target.value)} required maxLength="30" placeholder="Ej: 987654321" />
                    {errors.telefono && <span className="mt-1 block text-xs text-red-600">{errors.telefono}</span>}
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
                    <span className="label-text">Correo electrónico</span>
                    <input type="email" value={data.email} onChange={(e) => setDataCampo('email', e.target.value)} maxLength="180" />
                    {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}
                </label>

                {esMenor !== null && esMenor ? (
                    <>
                        <label className="text-sm">
                            <span className="label-text">Nombre del apoderado *</span>
                            <input type="text" value={data.acudiente_nombre} onChange={(e) => setDataCampo('acudiente_nombre', e.target.value)} maxLength="120" />
                            {errors.acudiente_nombre && <span className="mt-1 block text-xs text-red-600">{errors.acudiente_nombre}</span>}
                        </label>

                        <label className="text-sm">
                            <span className="label-text">Teléfono del apoderado *</span>
                            <input type="tel" value={data.acudiente_telefono} onChange={(e) => setDataCampo('acudiente_telefono', e.target.value)} maxLength="30" />
                            {errors.acudiente_telefono && <span className="mt-1 block text-xs text-red-600">{errors.acudiente_telefono}</span>}
                        </label>
                    </>
                ) : null}

                <label className="text-sm md:col-span-2">
                    <span className="label-text">Dirección</span>
                    <input type="text" value={data.direccion} onChange={(e) => setDataCampo('direccion', e.target.value)} maxLength="180" />
                    {errors.direccion && <span className="mt-1 block text-xs text-red-600">{errors.direccion}</span>}
                </label>

                <label className="text-sm">
                    <span className="label-text">Ciudad</span>
                    <input type="text" value={data.ciudad} onChange={(e) => setDataCampo('ciudad', e.target.value)} maxLength="80" />
                    {errors.ciudad && <span className="mt-1 block text-xs text-red-600">{errors.ciudad}</span>}
                </label>

                <label className="flex items-start gap-2 text-sm md:col-span-2">
                    <input type="checkbox" checked={data.autoriza_datos} onChange={(e) => setDataCampo('autoriza_datos', e.target.checked)} className="mt-0.5" />
                    <span>Autorizo el tratamiento de mis datos personales conforme a la política de la academia. *</span>
                </label>

                {errors.autoriza_datos && <span className="text-xs text-red-600 md:col-span-2">{errors.autoriza_datos}</span>}

                <div className="md:col-span-2">
                    <button type="submit" disabled={processing} className="btn w-full">
                        {processing ? 'Generando…' : 'Generar mi código de pago'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}