# App Icons

## Required Files

For electron-builder to package the macOS app correctly, you need:

- `icon.icns` - macOS app icon (required for DMG)
- `icon.png` - 1024x1024 PNG fallback

## Generating Icons

### Option 1: Using the SVG (Recommended)

1. Open `icon.svg` in a design tool (Figma, Sketch, Illustrator)
2. Export as 1024x1024 PNG
3. Use `iconutil` to create icns:

```bash
# Create iconset folder structure
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Generate icns
iconutil -c icns icon.iconset
```

### Option 2: Online Tools

- [CloudConvert](https://cloudconvert.com/png-to-icns)
- [iConvert Icons](https://iconverticons.com/online/)

## Tray Icon

The tray icon should be a template image (monochrome with transparency):
- `trayTemplate.png` - 16x16 or 22x22
- `trayTemplate@2x.png` - 32x32 or 44x44

Template images use only black and transparent pixels. macOS will automatically
adjust the color based on the menu bar appearance (light/dark mode).
