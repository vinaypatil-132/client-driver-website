import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform')?.toLowerCase();

    const isExplicitLinux = platform === 'linux' || platform === 'ubuntu' || platform === 'sh';
    const isWindows = !isExplicitLinux;

    const scriptPath = isWindows
      ? path.resolve(process.cwd(), 'Requirements', 'windows-driver', 'setup.ps1')
      : path.resolve(process.cwd(), 'Requirements', 'setup.sh');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Installer script (${isWindows ? 'setup.ps1' : 'setup.sh'}) not found on server.` },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(scriptPath, 'utf-8');

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': isWindows
          ? 'text/plain; charset=utf-8'
          : 'text/x-shellscript; charset=utf-8',
        'Content-Disposition': `attachment; filename="${isWindows ? 'setup.ps1' : 'setup.sh'}"`,
      },
    });
  } catch (error) {
    console.error('[DOWNLOAD_INSTALLER_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve installer script.' },
      { status: 500 }
    );
  }
}
