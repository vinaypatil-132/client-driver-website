import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { createPurchaseAuthToken, verifyPurchaseAuthToken } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file')?.toLowerCase();
    const tokenParam = searchParams.get('token')?.trim();
    const licenseKeyParam = searchParams.get('licenseKey')?.trim();

    // Default to Setup.exe Windows bootstrapper executable
    let filename = 'Setup.exe';
    let contentType = 'application/vnd.microsoft.portable-executable';

    if (fileParam === 'ps1' || fileParam === 'setup.ps1') {
      filename = 'setup.ps1';
      contentType = 'text/plain; charset=utf-8';
    } else if (fileParam === 'bat' || fileParam === 'setup.bat') {
      filename = 'setup.bat';
      contentType = 'text/plain; charset=utf-8';
    }

    const filePath = path.resolve(process.cwd(), 'Requirements', 'windows-driver', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Installer file (${filename}) not found on server.` },
        { status: 404 }
      );
    }

    let fileBuffer = fs.readFileSync(filePath);

    // If downloading Setup.exe with an authorized token or licenseKey, attach a signed authorization payload block
    if (filename === 'Setup.exe') {
      let activeToken = tokenParam;
      let activeLicenseKey = licenseKeyParam;

      if (!activeToken && activeLicenseKey) {
        // Generate purchase auth token from database license
        const lic = await prisma.license.findUnique({
          where: { licenseKey: activeLicenseKey },
        });
        if (lic && lic.status === 'ACTIVE') {
          activeToken = createPurchaseAuthToken(lic.licenseKey, lic.id, lic.email);
        }
      } else if (activeToken && !activeLicenseKey) {
        const verified = verifyPurchaseAuthToken(activeToken);
        if (verified.valid && verified.payload) {
          activeLicenseKey = verified.payload.license_key;
        }
      }

      if (activeToken && activeLicenseKey) {
        const payloadObj = {
          token: activeToken,
          licenseKey: activeLicenseKey,
          generatedAt: Date.now(),
        };
        const payloadStr = JSON.stringify(payloadObj);
        const payloadBlock = Buffer.from(
          `\r\n---NAV_BRAHMI_AUTH_START---\r\n${payloadStr}\r\n---NAV_BRAHMI_AUTH_END---\r\n`,
          'utf-8'
        );
        fileBuffer = Buffer.concat([fileBuffer, payloadBlock]);
      }
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[DOWNLOAD_INSTALLER_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve installer executable.' },
      { status: 500 }
    );
  }
}
