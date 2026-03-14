#!/usr/bin/env node
/**
 * Release script for openclaw-insight
 * Handles packaging with proper shebang line in index.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = {
  version: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
  platforms: ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64'],
  srcDir: 'dist',
  outputDir: 'release'
};

console.log(`📦 Packaging v${config.version}...`);

// Clean existing release
if (fs.existsSync(config.outputDir)) {
  fs.rmSync(config.outputDir, { recursive: true });
}
fs.mkdirSync(config.outputDir, { recursive: true });

// Build if dist not exists
if (!fs.existsSync(config.srcDir)) {
  console.log('  → Building project...');
  execSync('npm run build', { stdio: 'inherit' });
}

config.platforms.forEach(platform => {
  console.log(`  → ${platform}`);
  
  const platformDir = path.join(config.outputDir, `openclaw-insight-${config.version}-${platform}`);
  const platformDistDir = path.join(platformDir, 'dist');
  
  // Create platform directory
  fs.mkdirSync(platformDir, { recursive: true });
  fs.mkdirSync(platformDistDir, { recursive: true });
  
  // Copy dist files
  const distFiles = fs.readdirSync(config.srcDir);
  distFiles.forEach(file => {
    const srcPath = path.join(config.srcDir, file);
    const destPath = path.join(platformDistDir, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
  
  // Ensure shebang exists in index.js
  const indexJsPath = path.join(platformDistDir, 'index.js');
  let content = fs.readFileSync(indexJsPath, 'utf8');
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content;
    fs.writeFileSync(indexJsPath, content);
  }
  
  // Copy other files
  fs.copyFileSync('package.json', path.join(platformDir, 'package.json'));
  fs.copyFileSync('README.md', path.join(platformDir, 'README.md'));
  
  // Install dependencies
  execSync(`cd ${platformDir} && npm install --omit=dev 2>/dev/null`, { stdio: 'pipe' });
  
  // Create tarball
  const tarballName = `openclaw-insight-${config.version}-${platform}.tar.gz`;
  const tarballPath = path.join(config.outputDir, tarballName);
  execSync(`cd ${config.outputDir} && tar czf ${tarballName} openclaw-insight-${config.version}-${platform}`, { 
    stdio: 'inherit' 
  });
  
  // Cleanup platform directory
  fs.rmSync(platformDir, { recursive: true });
});

// Generate checksums
console.log('  → Generating checksums...');
const releaseFiles = fs.readdirSync(config.outputDir);
const tarballs = releaseFiles.filter(f => f.endsWith('.tar.gz'));
const checksums = [];

tarballs.forEach(tarball => {
  const tarballPath = path.join(config.outputDir, tarball);
  let checksum;
  
  try {
    // Try sha256sum (Linux/macOS with coreutils)
    checksum = execSync(`cd ${config.outputDir} && sha256sum ${tarball}`, { 
      encoding: 'utf8' 
    }).split(' ')[0];
  } catch {
    try {
      // Try shasum (macOS default)
      checksum = execSync(`cd ${config.outputDir} && shasum -a 256 ${tarball}`, { 
        encoding: 'utf8' 
      }).split(' ')[0];
    } catch (error) {
      console.error(`❌ Failed to generate checksum for ${tarball}: ${error.message}`);
      process.exit(1);
    }
  }
  
  checksums.push(`${checksum}  ${tarball}`);
});

fs.writeFileSync(path.join(config.outputDir, 'checksums.txt'), checksums.join('\n') + '\n');

console.log(`✔ Release artifacts in ${config.outputDir}/`);
console.log('\n' + execSync(`ls -lh ${config.outputDir}`, { encoding: 'utf8' }).trim());