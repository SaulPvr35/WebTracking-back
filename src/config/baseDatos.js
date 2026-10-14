import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function cerrarBaseDatos() {
  await prisma.$disconnect();
}

export default prisma;
