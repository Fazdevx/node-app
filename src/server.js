import { crearApp } from './app.js';
import { config } from './config.js';
import { prisma } from './prisma.js';

const app = crearApp();

const servidor = app.listen(config.puerto, () => {
    console.log(`Academia Galileo (Node) escuchando en ${config.baseUrl}`);
});

async function cierreSeguro() {
    servidor.close();
    await prisma.$disconnect();
    process.exit(0);
}

process.on('SIGINT', cierreSeguro);
process.on('SIGTERM', cierreSeguro);