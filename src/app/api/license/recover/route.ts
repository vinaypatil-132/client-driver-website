import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidEmail, createPurchaseAuthToken } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const email = body.email?.trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Lookup active licenses for this email
    const licenses = await prisma.license.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: 'ACTIVE',
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!licenses || licenses.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active licenses were found for this email address. Please verify your email or purchase a license.',
        },
        { status: 404 }
      );
    }

    const recoveredLicenses = licenses.map((lic) => {
      const token = createPurchaseAuthToken(lic.licenseKey, lic.id, lic.email);
      return {
        license_id: lic.id,
        license_key: lic.licenseKey,
        product_name: lic.product?.name || 'Nav Brahmi Driver Suite',
        product_id: lic.productId,
        activation_status: lic.activationStatus,
        created_at: lic.createdAt,
        download_url: `/api/download-installer?platform=windows&token=${encodeURIComponent(token)}`,
      };
    });

    return NextResponse.json(
      {
        success: true,
        email,
        count: recoveredLicenses.length,
        licenses: recoveredLicenses,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RECOVER_LICENSE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error processing license recovery.' },
      { status: 500 }
    );
  }
}
