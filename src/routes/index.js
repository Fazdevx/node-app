import { Router } from 'express';
import { routerMatricula } from './matricula.js';
import { routerCaja } from './caja.js';
import { routerCierres } from './cierres.js';
import { routerReportes } from './reportes.js';

export const routerApi = Router();

routerApi.use(routerMatricula);
routerApi.use('/caja', routerCaja);
routerApi.use('/cierres', routerCierres);
routerApi.use('/reportes', routerReportes);