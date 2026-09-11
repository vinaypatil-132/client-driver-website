import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signActivationToken } from '@/lib/keys';
import { resolvePackageDefinition } from '@/lib/b2';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { license_key?: string; machine_id?: string; product_code?: string; platform?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const licenseKey = body.license_key?.trim();
    const machineId = body.machine_id?.trim();

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'License key is required for activation.' },
        { status: 400 }
      );
    }

    if (!machineId) {
      return NextResponse.json(
        { success: false, error: 'Machine ID is required for activation.' },
        { status: 400 }
      );
    }

    // Lookup license in PostgreSQL
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        product: true,
      },
    });

    if (!license || license.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          activated: false,
          error: 'License key is invalid, revoked, or expired.',
        },
        { status: 401 }
      );
    }

    const pkgDef = resolvePackageDefinition(license.product?.name || license.productId);
    const productCode = pkgDef.product;

    const nowSec = Math.floor(Date.now() / 1000);
    const oneYearSec = 365 * 24 * 3600;

    // CASE 1: FIRST ACTIVATION (No machine bound yet)
    if (!license.machineId) {
      const updatedLicense = await prisma.license.update({
        where: { id: license.id },
        data: {
          machineId: machineId,
          activationStatus: 'ACTIVE',
          activatedAt: new Date(),
        },
      });

      const token = signActivationToken({
        license_id: updatedLicense.id,
        license_key: updatedLicense.licenseKey,
        product_code: productCode,
        machine_id: machineId,
        status: 'ACTIVE',
        issued_at: nowSec,
        expires_at: nowSec + oneYearSec,
      });

      return NextResponse.json(
        {
          success: true,
          activated: true,
          token,
          license_id: updatedLicense.id,
          machine_id: machineId,
          product_code: productCode,
          product_name: license.product?.name || pkgDef.productName,
          status: 'ACTIVE',
          message: 'License activated successfully on this machine.',
        },
        { status: 200 }
      );
    }

    // CASE 2: SUBSEQUENT ACTIVATION ON SAME AUTHORIZED MACHINE
    if (license.machineId === machineId) {
      const token = signActivationToken({
        license_id: license.id,
        license_key: license.licenseKey,
        product_code: productCode,
        machine_id: machineId,
        status: 'ACTIVE',
        issued_at: nowSec,
        expires_at: nowSec + oneYearSec,
      });

      return NextResponse.json(
        {
          success: true,
          activated: true,
          token,
          license_id: license.id,
          machine_id: machineId,
          product_code: productCode,
          product_name: license.product?.name || pkgDef.productName,
          status: 'ACTIVE',
          message: 'Authorized machine recognized. Activation token re-issued.',
        },
        { status: 200 }
      );
    }

    // CASE 3: ATTEMPTED ACTIVATION ON DIFFERENT / UNAUTHORIZED MACHINE
    return NextResponse.json(
      {
        success: false,
        activated: false,
        error: 'Activation rejected: This license is already bound to another machine.',
        bound_machine_id: license.machineId,
        attempted_machine_id: machineId,
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('[ACTIVATION_API_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error processing machine activation.' },
      { status: 500 }
    );
  }
}
