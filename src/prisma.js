import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const urlTurso = process.env.TURSO_DATABASE_URL?.trim();

function crearCliente() {
    if (urlTurso) {
        return new PrismaClient({
            adapter: new PrismaLibSQL({
                url: urlTurso,
                authToken: process.env.TURSO_AUTH_TOKEN,
            }),
        });
    }

    return new PrismaClient();
}

export const prisma = crearCliente();