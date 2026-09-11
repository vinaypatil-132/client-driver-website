import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CSC_PATH = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const SRC_DIR = path.resolve(process.cwd(), 'Requirements/windows-driver/bootstrapper');
const OUT_DIR = path.resolve(process.cwd(), 'Requirements/windows-driver');
const OUT_EXE = path.join(OUT_DIR, 'Setup.exe');

async function main() {
  console.log('====================================================');
  console.log(' Building Nav Brahmi Setup.exe Windows Bootstrapper');
  console.log('====================================================');

  if (!fs.existsSync(CSC_PATH)) {
    throw new Error(`C# Compiler not found at: ${CSC_PATH}`);
  }

  const programCs = path.join(SRC_DIR, 'Program.cs');
  const assemblyInfoCs = path.join(SRC_DIR, 'AssemblyInfo.cs');
  const manifest = path.join(SRC_DIR, 'app.manifest');

  if (!fs.existsSync(programCs) || !fs.existsSync(manifest) || !fs.existsSync(assemblyInfoCs)) {
    throw new Error('Bootstrapper source, AssemblyInfo, or manifest file is missing.');
  }

  const refs = [
    'System.dll',
    'System.Core.dll',
    'System.Drawing.dll',
    'System.Windows.Forms.dll',
    'System.Management.dll',
    'System.IO.Compression.dll',
    'System.IO.Compression.FileSystem.dll',
  ];

  const refArgs = refs.map((r) => `/r:"${r}"`).join(' ');

  const compileCmd = `"${CSC_PATH}" /nologo /target:winexe /platform:anycpu /optimize+ /win32manifest:"${manifest}" ${refArgs} /out:"${OUT_EXE}" "${programCs}" "${assemblyInfoCs}"`;

  console.log('Compiling C# bootstrapper with AssemblyInfo metadata and UAC manifest...');
  execSync(compileCmd, { stdio: 'inherit' });

  if (!fs.existsSync(OUT_EXE)) {
    throw new Error(`Failed to generate: ${OUT_EXE}`);
  }

  const stats = fs.statSync(OUT_EXE);
  console.log(`\n✓ Successfully compiled: Setup.exe`);
  console.log(`  Path: ${OUT_EXE}`);
  console.log(`  Size: ${stats.size} bytes\n`);

  // Sign with Authenticode
  console.log('Applying Authenticode signature...');
  const signScript = path.resolve(process.cwd(), 'scripts/sign-exe.ps1');
  const psSignCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${signScript}" -ExePath "${OUT_EXE}"`;
  execSync(psSignCmd, { stdio: 'inherit' });
}

main().catch((err) => {
  console.error('[BUILD BOOTSTRAPPER ERROR]', err);
  process.exit(1);
});
