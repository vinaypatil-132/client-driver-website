import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const productName = 'Indian Language Keyboard Driver — DEMO';
  const productDescription =
    'High-performance, low-latency multilingual keyboard driver and input method engine for Indian languages on Ubuntu Linux. Includes complete support for phonetic typing, transliteration, Inscript layouts, and custom keyboard shortcuts.';

  const existingProduct = await prisma.product.findFirst({
    where: { name: productName },
  });

  if (existingProduct) {
    console.log(`[SEED] Product already exists: ${existingProduct.name} (ID: ${existingProduct.id})`);
    return existingProduct;
  }

  const product = await prisma.product.create({
    data: {
      name: productName,
      description: productDescription,
      price: 29.0,
    },
  });

  console.log(`[SEED] Created demo product: ${product.name} (ID: ${product.id}, Price: $${product.price})`);
  return product;
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
