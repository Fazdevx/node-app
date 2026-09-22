import ExcelJS from 'exceljs';

const Color = (hex) => ({ argb: `FF${hex}` });

const MONEDA = '"S/ "#,##0.00;[Red]-"S/ "#,##0.00';

function estilosBase(ws) {
    ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Exporta el cierre a Excel (.xlsx) con hoja de resumen y hoja de detalle,
 * replicando los colores y el formato del exportador Laravel original.
 */
export async function generarExcelCierre(cierre) {
    const resumen = cierre.resumen || { cantidad: 0, total: 0, efectivo: 0, metodos: [] };
    const detalle = cierre.detalle || [];
    const resultado = cierre.diferenciaCentimos > 0 ? 'Sobrante' : cierre.diferenciaCentimos < 0 ? 'Faltante' : 'Cuadrado';

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Academia Galileo';

    // ── Hoja resumen ─────────────────────────────────────────────────────
    const res = libro.addWorksheet('Resumen de caja');
    estilosBase(res);
    res.columns = [{ width: 26 }, { width: 22 }, { width: 16 }];

    const agregar = (fila, valor, estilo) => {
        const r = res.addRow([fila, valor]);
        r.getCell(1).font = { bold: true, color: { argb: 'FF17365D' } };
        r.getCell(2).alignment = { horizontal: 'right' };
        if (estilo) {
            r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: Color(estilo) };
            r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: Color(estilo) };
        }
        return r;
    };

    const fechaCorta = new Date(cierre.fecha);
    const pad = (n) => String(n).padStart(2, '0');
    const fechaTexto = `${fechaCorta.getFullYear()}-${pad(fechaCorta.getMonth() + 1)}-${pad(fechaCorta.getDate())}`;

    res.mergeCells('A1:C1');
    const titulo = res.getCell('A1');
    titulo.value = `Cierre de caja ${fechaTexto} — Academia Galileo`;
    titulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: Color('17365D') };
    titulo.alignment = { horizontal: 'center' };
    res.getRow(1).height = 24;

    agregar('Cierre N.º', `#${cierre.id}`, '305A80');
    agregar('Pagado con', `${resumen.cantidad ?? 0} pagos`, '305A80');
    agregar('Total recaudado', `S/ ${((resumen.total ?? 0) / 100).toFixed(2)}`, '305A80');
    res.getRow(res.lastRow.number).getCell(2).numFmt = MONEDA;
    res.getRow(res.lastRow.number).getCell(2).value = (resumen.total ?? 0) / 100;

    for (const m of resumen.metodos ?? []) {
        const r = res.addRow([`Total en ${m.etiqueta}`, m.total / 100]);
        r.getCell(2).numFmt = MONEDA;
        r.getCell(2).alignment = { horizontal: 'right' };
        r.getCell(1).font = { color: { argb: 'FF305A80' } };
    }

    agregar('Efectivo neto', (resumen.efectivo ?? 0) / 100, 'F0F4F8');
    res.getRow(res.lastRow.number).getCell(2).numFmt = MONEDA;
    res.getRow(res.lastRow.number).getCell(2).value = (resumen.efectivo ?? 0) / 100;

    agregar('Fondo inicial', cierre.fondoCentimos / 100, 'F0F4F8');
    res.getRow(res.lastRow.number).getCell(2).numFmt = MONEDA;
    res.getRow(res.lastRow.number).getCell(2).value = cierre.fondoCentimos / 100;

    agregar('Esperado (fondo + efectivo)', cierre.esperadoCentimos / 100, 'DCE8F3');
    res.getRow(res.lastRow.number).getCell(2).numFmt = MONEDA;
    res.getRow(res.lastRow.number).getCell(2).value = cierre.esperadoCentimos / 100;

    agregar('Efectivo contado', cierre.contadoCentimos / 100, 'DCE8F3');
    res.getRow(res.lastRow.number).getCell(2).numFmt = MONEDA;
    res.getRow(res.lastRow.number).getCell(2).value = cierre.contadoCentimos / 100;

    const colorDiferencia = resultado === 'Cuadrado' ? '176044' : resultado === 'Faltante' ? '9C2020' : '805600';
    const relleno = resultado === 'Cuadrado' ? 'E2F0D9' : resultado === 'Faltante' ? 'FCE4D6' : 'FFF2CC';

    const rDiff = agregar(`Diferencia (${resultado})`, cierre.diferenciaCentimos / 100, relleno);
    rDiff.getCell(2).numFmt = MONEDA;
    rDiff.getCell(2).value = cierre.diferenciaCentimos / 100;
    rDiff.getCell(1).font = { bold: true, color: { argb: `FF${colorDiferencia}` } };
    rDiff.getCell(2).font = { bold: true, color: { argb: `FF${colorDiferencia}` } };

    // ── Hoja detalle ─────────────────────────────────────────────────────
    const det = libro.addWorksheet('Detalle de pagos');
    det.columns = [
        { header: 'Recibo', key: 'recibo', width: 12 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Aspirante', key: 'aspirante', width: 30 },
        { header: 'Documento', key: 'documento', width: 16 },
        { header: 'Método', key: 'metodo', width: 22 },
        { header: 'Total', key: 'total', width: 14 },
        { header: 'Recibido', key: 'recibido', width: 14 },
        { header: 'Vuelto', key: 'vuelto', width: 14 },
        { header: 'Referencia', key: 'referencia', width: 16 },
    ];
    det.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    det.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: Color('305A80') };

    for (const p of detalle) {
        const fila = det.addRow({
            recibo: String(p.recibo).padStart(6, '0'),
            fecha: p.fecha,
            aspirante: p.aspirante,
            documento: p.documento,
            metodo: p.metodo,
            total: Number(p.total),
            recibido: Number(p.recibido),
            vuelto: Number(p.vuelto),
            referencia: p.referencia ?? '',
        });
        fila.getCell('total').numFmt = MONEDA;
        fila.getCell('recibido').numFmt = MONEDA;
        fila.getCell('vuelto').numFmt = MONEDA;
        if (fila.number % 2 === 0) {
            fila.eachCell((celda) => {
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: Color('F0F4F8') };
            });
        }
    }

    if (cierre.observaciones) {
        const filaObs = det.addRow({
            aspirante: 'Observaciones',
            fecha: cierre.observaciones,
        });
        filaObs.getCell('aspirante').font = { bold: true };
        filaObs.getCell('fecha').alignment = { wrapText: true };
    }

    const buffer = await libro.xlsx.writeBuffer();
    return buffer;
}