const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create a simple 1024x1024 PNG icon using Canvas
// This creates a blue gradient circle with "TMA" text

const iconDir = path.join(__dirname, '../resources/icons');

// Create iconset directory for macOS
const iconsetDir = path.join(iconDir, 'icon.iconset');
if (!fs.existsSync(iconsetDir)) {
  fs.mkdirSync(iconsetDir, { recursive: true });
}

// Generate PNG using built-in macOS tools
// First, let's create a simple icon using qlmanage or screencapture workaround
// Actually, let's use a data URL approach with a simple HTML file

const sizes = [16, 32, 64, 128, 256, 512, 1024];

// Create a simple colored square PNG as placeholder
// Using pure Node.js to create a minimal PNG

function createPNG(width, height, r, g, b) {
  // Minimal PNG creation - creates a solid color image
  const png = [];
  
  // PNG signature
  png.push(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  png.push(...ihdrChunk);
  
  // IDAT chunk - image data
  const zlib = require('zlib');
  const rawData = Buffer.alloc(height * (1 + width * 3));
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawData[rowStart] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      // Create a gradient effect
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
      const factor = 1 - (dist / maxDist) * 0.3;
      
      rawData[pixelStart] = Math.min(255, Math.floor(r * factor));
      rawData[pixelStart + 1] = Math.min(255, Math.floor(g * factor));
      rawData[pixelStart + 2] = Math.min(255, Math.floor(b * factor));
    }
  }
  
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  png.push(...idatChunk);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  png.push(...iendChunk);
  
  return Buffer.from(png);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return [...length, ...typeBuffer, ...data, ...crcBuffer];
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return crc ^ 0xFFFFFFFF;
}

// Create icons with a nice blue color (matching the app theme)
const r = 59, g = 130, b = 246; // Blue color

console.log('Creating app icons...');

for (const size of sizes) {
  const png = createPNG(size, size, r, g, b);
  
  // Standard icon
  const filename = size === 1024 ? 'icon_512x512@2x.png' : 
                   size === 512 ? 'icon_512x512.png' :
                   size === 256 ? 'icon_256x256.png' :
                   size === 128 ? 'icon_128x128.png' :
                   size === 64 ? 'icon_32x32@2x.png' :
                   size === 32 ? 'icon_32x32.png' :
                   'icon_16x16.png';
  
  fs.writeFileSync(path.join(iconsetDir, filename), png);
  console.log(`Created ${filename}`);
  
  // Also create @2x versions where needed
  if (size === 256) {
    fs.writeFileSync(path.join(iconsetDir, 'icon_128x128@2x.png'), png);
  }
  if (size === 512) {
    fs.writeFileSync(path.join(iconsetDir, 'icon_256x256@2x.png'), png);
  }
  if (size === 32) {
    fs.writeFileSync(path.join(iconsetDir, 'icon_16x16@2x.png'), png);
  }
}

// Create the main icon.png for electron-builder
fs.writeFileSync(path.join(iconDir, 'icon.png'), createPNG(512, 512, r, g, b));
console.log('Created icon.png');

// Try to create .icns using iconutil (macOS only)
try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(iconDir, 'icon.icns')}"`, { stdio: 'inherit' });
  console.log('Created icon.icns');
} catch (e) {
  console.log('Could not create .icns file:', e.message);
}

console.log('Done!');
