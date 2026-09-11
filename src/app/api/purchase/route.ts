import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidEmail, generateSecureLicenseKey } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { email?: string; productId?: string; productName?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const email = body.email?.trim().toLowerCase();
    const requestedProductId = body.productId?.trim();
    const requestedProductName = body.productName?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Customer email address is required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    // Find the requested product
    let product;
    if (requestedProductId) {
      product = await prisma.product.findUnique({
        where: { id: requestedProductId },
      });
    }

    if (!product && requestedProductName) {
      product = await prisma.product.findFirst({
        where: { name: { contains: requestedProductName, mode: 'insensitive' } },
      });
    }

    if (!product) {
      // Default to Brahmi Tamil Grantha
      product = await prisma.product.findFirst({
        where: { name: { contains: 'Brahmi' } },
      });
    }

    if (!product) {
      product = await prisma.product.findFirst();
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'No active products found in database.' },
        { status: 404 }
      );
    }

    // Generate cryptographically secure license key
    const licenseKey = generateSecureLicenseKey();

    // Create Purchase and License records within a transaction
    const [purchase, license] = await prisma.$transaction([
      prisma.purchase.create({
        data: {
          email,
          productId: product.id,
          status: 'COMPLETED',
        },
      }),
      prisma.license.create({
        data: {
          email,
          productId: product.id,
          licenseKey,
          status: 'ACTIVE',
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        purchaseId: purchase.id,
        licenseId: license.id,
        licenseKey: license.licenseKey,
        email: license.email,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
        },
        createdAt: license.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[PURCHASE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred processing the purchase.' },
      { status: 500 }
    );
  }
}
