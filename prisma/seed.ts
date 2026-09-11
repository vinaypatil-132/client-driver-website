import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_PRODUCTS = [
  {
    name: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    description:
      'Authentic Nav Brahmi Keyboard Layout Driver and Noto Sans Grantha unicode fonts for Windows 11 (AMD64/x86/IA64/WOW64). Enables native Brahmi, Tamil, and Grantha script typing with full system layout integration.',
    price: 39.0,
  },
  {
    name: 'Nav Brahmi — Kharoshthi',
    description:
      'Authentic Nav Brahmi Keyboard Layout Driver and Noto Sans Kharoshthi unicode fonts for Windows 11 (AMD64/x86/IA64/WOW64). Enables native Kharoshthi script typing with full system layout integration.',
    price: 39.0,
  },
];

async function main() {
  console.log('[SEED] Seeding real Nav Brahmi products into Supabase PostgreSQL...');

  const createdProducts = [];
  for (const prodData of SEED_PRODUCTS) {
    let product = await prisma.product.findFirst({
      where: { name: prodData.name },
    });

    if (product) {
      console.log(`[SEED] Product already exists: ${product.name} (ID: ${product.id})`);
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          description: prodData.description,
          price: prodData.price,
        },
      });
    } else {
      product = await prisma.product.create({
        data: prodData,
      });
      console.log(`[SEED] Created product: ${product.name} (ID: ${product.id}, Price: $${product.price})`);
    }
    createdProducts.push(product);
  }

  // Check if old demo product exists and log it
  const oldDemo = await prisma.product.findFirst({
    where: { name: 'Indian Language Keyboard Driver — DEMO' },
  });
  if (oldDemo) {
    console.log(`[SEED] Found old demo product (ID: ${oldDemo.id}). Retaining existing purchases/licenses if any.`);
  }

  console.log('[SEED] Database seeding completed successfully.');
  return createdProducts;
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
