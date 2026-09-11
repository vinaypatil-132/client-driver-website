import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPurchaseAuthToken } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authorization token is required.' },
        { status: 400 }
      );
    }

    const verification = verifyPurchaseAuthToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid or expired authorization token.' },
        { status: 401 }
      );
    }

    const { license_id, license_key } = verification.payload;

    // Verify license still exists and is ACTIVE in Supabase PostgreSQL
    const license = await prisma.license.findUnique({
      where: { id: license_id },
      include: { product: true },
    });

    if (!license || license.status !== 'ACTIVE' || license.licenseKey !== license_key) {
      return NextResponse.json(
        { success: false, error: 'License associated with this token is invalid or inactive.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        license_id: license.id,
        license_key: license.licenseKey,
        email: license.email,
        product_name: license.product?.name,
        product_id: license.productId,
        activation_status: license.activationStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RESOLVE_TOKEN_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error resolving authorization token.' },
      { status: 500 }
    );
  }
}
