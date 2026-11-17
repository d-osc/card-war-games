import { PrismaClient } from '@prisma/client';
import { CARD_TEMPLATES } from '@cardwar/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log(`Seeding ${CARD_TEMPLATES.length} card templates...`);
  for (const t of CARD_TEMPLATES) {
    await prisma.cardTemplate.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        emoji: t.emoji,
        category: t.category,
        groupName: t.group,
        rarity: t.rarity,
        basePrice: t.basePrice,
        description: t.description,
        data: JSON.stringify(t),
      },
      create: {
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        category: t.category,
        groupName: t.group,
        rarity: t.rarity,
        basePrice: t.basePrice,
        description: t.description,
        data: JSON.stringify(t),
      },
    });
  }
  console.log('Seed complete ✔');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
