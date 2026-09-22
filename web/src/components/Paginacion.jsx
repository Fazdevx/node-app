import { useLocation, useNavigate } from 'react-router-dom';

export default function Paginacion({ datos, ruta }) {
    const location = useLocation();
    const navigate = useNavigate();

    if (!datos || (datos.total || 0) <= (datos.per_page || 1)) {
        return null;
    }

    const ir = (pagina) => () => {
        const params = new URLSearchParams(location.search);
        if (pagina <= 1) {
            params.delete('page');
        } else {
            params.set('page', String(pagina));
        }
        const busqueda = params.toString();
        navigate(`${ruta}${busqueda ? `?${busqueda}` : ''}`);
    };

    const paginaActual = Number(datos.current_page) || 1;
    const totalPaginas = Number(datos.last_page) || 1;

    const paginas = [];
    for (let p = 1; p <= totalPaginas; p += 1) {
        paginas.push(p);
    }

    const claseBoton = 'rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';
    const clasePagina = 'rounded-md px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-naranja-50';
    const claseActual = 'rounded-md bg-naranja-600 px-3 py-1 text-sm font-semibold text-white';

    return (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Paginación">
            <p className="text-slate-500">
                Mostrando {datos.from ? datos.from.toString() : '0'}–{datos.to ? datos.to.toString() : '0'} de {datos.total.toString()}
            </p>
            <div className="flex flex-wrap items-center gap-1">
                <button onClick={ir(paginaActual - 1)} disabled={!datos.prev_page_url} className={claseBoton}>Anterior</button>
                {paginas.map((p) =>
                    p === paginaActual ? (
                        <span key={p} className={claseActual}>{p}</span>
                    ) : (
                        <button key={p} onClick={ir(p)} className={clasePagina}>{p}</button>
                    ),
                )}
                <button onClick={ir(paginaActual + 1)} disabled={!datos.next_page_url} className={claseBoton}>Siguiente</button>
            </div>
        </nav>
    );
}