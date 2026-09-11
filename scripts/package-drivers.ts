import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const SOURCE_BASE = 'C:\\Users\\vinay patil\\Desktop\\ForTesting-NavBrahmiDriver2026\\ForTesting-NavBrahmiDriver2026';
const DEST_DIR = path.resolve(process.cwd(), 'Requirements', 'windows-driver');

interface PackageConfig {
  id: string;
  name: string;
  sourceDir: string;
  zipFilename: string;
}

const packages: PackageConfig[] = [
  {
    id: 'brahmi-tamil-grantha-driver-package',
    name: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    sourceDir: path.join(SOURCE_BASE, 'Brahmi-Tamil-Grantha-2026'),
    zipFilename: 'brahmi-tamil-grantha-driver-package.zip',
  },
  {
    id: 'kharoshthi-driver-package',
    name: 'Nav Brahmi — Kharoshthi',
    sourceDir: path.join(SOURCE_BASE, 'Kharoshthi'),
    zipFilename: 'kharoshthi-driver-package.zip',
  },
];

function computeSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function main() {
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  const results: Record<string, { zipPath: string; size: number; sha256: string }> = {};

  for (const pkg of packages) {
    if (!fs.existsSync(pkg.sourceDir)) {
      throw new Error(`Source directory not found: ${pkg.sourceDir}`);
    }

    const targetZipPath = path.join(DEST_DIR, pkg.zipFilename);
    if (fs.existsSync(targetZipPath)) {
      fs.unlinkSync(targetZipPath);
    }

    console.log(`Packaging "${pkg.name}" from ${pkg.sourceDir}...`);

    // Using PowerShell Compress-Archive to preserve Windows folder structure accurately
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${pkg.sourceDir}\\*' -DestinationPath '${targetZipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });

    if (!fs.existsSync(targetZipPath)) {
      throw new Error(`Failed to create zip file: ${targetZipPath}`);
    }

    const stats = fs.statSync(targetZipPath);
    const sha256 = computeSha256(targetZipPath);

    results[pkg.id] = {
      zipPath: targetZipPath,
      size: stats.size,
      sha256,
    };

    console.log(`Created: ${pkg.zipFilename}`);
    console.log(`  Size:   ${stats.size} bytes`);
    console.log(`  SHA256: ${sha256}`);
  }

  console.log('\n--- Packaging Complete ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Packaging error:', err);
  process.exit(1);
});
