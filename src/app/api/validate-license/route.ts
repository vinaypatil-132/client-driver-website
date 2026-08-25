import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePresignedPackageUrls } from '@/lib/b2';

export async function POST(req: NextRequest) {
  try {
    let body: { license_key?: string; platform?: 'LINUX' | 'WINDOWS' };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { valid: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const licenseKey = body.license_key?.trim();
    const targetPlatform: 'LINUX' | 'WINDOWS' =
      body.platform?.toUpperCase() === 'WINDOWS' ? 'WINDOWS' : 'LINUX';

    if (!licenseKey) {
      return NextResponse.json(
        { valid: false, error: 'License key is required.' },
        { status: 400 }
      );
    }

    // Lookup license in PostgreSQL database
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

    // Generate short-lived presigned URLs for packages based on requested platform
    const packageUrls = await generatePresignedPackageUrls(900, targetPlatform); // 15-minute expiration

    // Return authoritative information directly from database and B2 presigner
    return NextResponse.json(
      {
        valid: true,
        license_id: license.id,
        email: license.email,
        platform: targetPlatform,
        package_status: packageUrls.package_status,
        message: packageUrls.message,
        download_urls: packageUrls.download_urls,
        checksums: packageUrls.checksums,
        packages: packageUrls.packages,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[VALIDATE_LICENSE_ERROR]', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error validating license.' },
      { status: 500 }
    );
  }
}
