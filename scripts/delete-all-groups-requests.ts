import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Supprime toutes les demandes de rejoindre
  await prisma.joinRequest.deleteMany({});
  // Supprime tous les groupes
  await prisma.group.deleteMany({});
  console.log('Tous les groupes et toutes les demandes de rejoindre ont été supprimés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
