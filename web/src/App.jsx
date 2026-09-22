import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Formato from './pages/Matricula/Formato.jsx';
import CodigoPago from './pages/Matricula/CodigoPago.jsx';
import MisPagos from './pages/MisPagos.jsx';
import CajaIndex from './pages/Caja/Index.jsx';
import Presencial from './pages/Caja/Presencial.jsx';
import Pendientes from './pages/Caja/Pendientes.jsx';
import Completadas from './pages/Caja/Completadas.jsx';
import Recibo from './pages/Caja/Recibo.jsx';
import Reportes from './pages/Caja/Reportes.jsx';
import Cierres from './pages/Caja/Cierres.jsx';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/caja" replace />} />
                <Route path="/matricular" element={<Formato />} />
                <Route path="/codigo-pago/:codigo" element={<CodigoPago />} />
                <Route path="/mis-pagos" element={<MisPagos />} />
                <Route path="/caja" element={<CajaIndex />} />
                <Route path="/caja/presencial" element={<Presencial />} />
                <Route path="/caja/matriculas/pendientes" element={<Pendientes />} />
                <Route path="/caja/matriculas/completadas" element={<Completadas />} />
                <Route path="/caja/recibo/:pago" element={<Recibo />} />
                <Route path="/caja/reportes" element={<Reportes />} />
                <Route path="/caja/reportes/cierres" element={<Cierres />} />
                <Route path="/caja/cierres" element={<Navigate to="/caja/reportes/cierres" replace />} />
                <Route path="*" element={<Navigate to="/caja" replace />} />
            </Routes>
        </BrowserRouter>
    );
}