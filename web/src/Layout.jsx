import { Link, useLocation } from 'react-router-dom';

const assetLogo = (path) => `/${path.replace(/ /g, '%20')}`;

export default function AppLayout({ titulo = null, nav = [], footer = 'Sistema de Matrículas', children }) {
    const location = useLocation();
    const exito = location.state?.exito || null;

    if (titulo) {
        document.title = `${titulo} — Academia Galileo`;
    }

    return (
        <div className="min-h-screen bg-orange-50 text-slate-800 antialiased">
            <header className="bg-gradient-to-r from-orange-600 via-orange-700 to-amber-800 text-white shadow-lg print:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link to="/caja" className="flex items-center gap-3 text-lg font-bold tracking-tight hover:opacity-90 transition-opacity">
                        <img src={assetLogo('ACADEMIA Y COLEGIO NARANJA.png')} alt="Logo" className="h-10 w-auto" />
                        <span className="hidden sm:inline">Academia Galileo</span>
                    </Link>
                    {nav.length > 0 ? (
                        <nav aria-label="Navegación de caja" className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium">
                            {nav.map((enlace) =>
                                enlace.activo ? (
                                    <span key={enlace.label} aria-current="page" className="rounded-md bg-white/20 px-2 py-1 text-white">
                                        {enlace.label}
                                    </span>
                                ) : (
                                    <Link key={enlace.label} to={enlace.href} className="rounded-md px-2 py-1 transition-colors hover:bg-white/10">
                                        {enlace.label}
                                    </Link>
                                ),
                            )}
                        </nav>
                    ) : null}
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8">
                {exito ? (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 text-sm text-orange-900 shadow-sm">
                        <svg className="h-5 w-5 shrink-0 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{exito}</span>
                    </div>
                ) : null}

                {children}
            </main>

            <footer className="mt-16 border-t border-orange-100 bg-white py-8 text-center print:hidden">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex items-center gap-2 text-orange-600">
                            <img src={assetLogo('ACADEMIA Y COLEGIO NARANJA.png')} alt="Logo" className="h-6 w-auto" />
                            <span className="font-semibold">Academia Galileo</span>
                        </div>
                        <p className="text-xs text-slate-400">{footer}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}