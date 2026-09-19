import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePresignedPackageUrls } from '@/lib/b2';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { license_key?: string; platform?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { valid: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const licenseKey = body.license_key?.trim();

    if (!licenseKey) {
      return NextResponse.json(
        { valid: false, error: 'License key is required.' },
        { status: 400 }
      );
    }

    // Lookup license in Supabase PostgreSQL database
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        product: true,
      },
    });

    if (!license || license.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          valid: false,
          error: 'License key is invalid, revoked, or expired.',
        },
        { status: 401 }
      );
    }

    // Update activatedAt timestamp if this is the first activation
    if (!license.activatedAt) {
      await prisma.license.update({
        where: { id: license.id },
        data: { activatedAt: new Date() },
      });
    }

    // Generate short-lived presigned URLs for the product's authorized package
    const packageUrls = await generatePresignedPackageUrls(
      900,
      'WINDOWS',
      license.product?.name || license.productId
    );

    return NextResponse.json(
      {
        valid: true,
        license_id: license.id,
        email: license.email,
        platform: 'WINDOWS',
        product_id: license.productId,
        product_name: license.product?.name,
        product_code: packageUrls.product,
        package_status: packageUrls.package_status,
        message: packageUrls.message,
        download_urls: packageUrls.download_urls,
        checksums: packageUrls.checksums,
        packages: packageUrls.packages,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[VALIDATE_LICENSE_ERROR]', error);
    return NextResponse.json(
      { valid: false, error: error?.message || 'Internal server error validating license.' },
      { status: 500 }
    );
  }
}
