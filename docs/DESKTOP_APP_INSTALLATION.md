# Grace Dashboard - Desktop App Installation Guide

## 🖥️ Installing as a Desktop App on macOS

The Grace Dashboard is now a **Progressive Web App (PWA)**, which means you can install it as a standalone desktop application on your Mac. When installed, it will:

- Appear in your **Applications folder**
- Show in your **Dock**
- Open in its own window (no browser chrome)
- Work offline for cached pages
- Have its own app icon

---

## 📱 Method 1: Chrome (Recommended)

### Steps:
1. Open **Google Chrome**
2. Navigate to `http://localhost:3000` (or your dashboard URL)
3. Click the **install icon** in the address bar (looks like a monitor with a down arrow)
   - OR click the **three dots menu** (⋮) → **"Install Grace AI Dashboard..."**
4. Click **"Install"** in the popup
5. The app will be added to your **Applications folder** and **Dock**

### To find the installed app:
- Look in `/Users/YOUR_USERNAME/Applications/Chrome Apps/`
- Or search "Grace" in Spotlight (⌘ + Space)

---

## 🧭 Method 2: Safari (macOS Sonoma 14+)

### Steps:
1. Open **Safari**
2. Navigate to `http://localhost:3000`
3. Click **File** → **"Add to Dock..."**
4. Customize the name if desired
5. Click **"Add"**

### Note:
Safari PWA support requires macOS Sonoma (14.0) or later.

---

## 🦊 Method 3: Firefox

Firefox doesn't natively support PWA installation, but you can use the **PWA for Firefox** extension:

1. Install the [PWA for Firefox](https://addons.mozilla.org/en-US/firefox/addon/pwas-for-firefox/) extension
2. Navigate to `http://localhost:3000`
3. Click the extension icon → **"Install current site"**

---

## 🔧 Method 4: Arc Browser

1. Open **Arc Browser**
2. Navigate to `http://localhost:3000`
3. Click **File** → **"Add to Desktop"**
4. The app will be added to your Applications

---

## 🎯 Method 5: Create a Native App Wrapper (Advanced)

For a more native experience, you can create a standalone app using **Nativefier** or **Fluid**:

### Using Nativefier (Free):
```bash
# Install nativefier
npm install -g nativefier

# Create the app
nativefier --name "Grace Dashboard" \
  --icon /path/to/icon.png \
  --platform darwin \
  --arch arm64 \
  "http://localhost:3000"
```

### Using Fluid (Free/Paid):
1. Download [Fluid](https://fluidapp.com/)
2. Enter URL: `http://localhost:3000`
3. Enter Name: `Grace Dashboard`
4. Choose an icon
5. Click **"Create"**

---

## ✅ Verifying Installation

After installation, you should see:

1. **App Icon** - A purple/blue diamond shape with a face
2. **Standalone Window** - No browser address bar or tabs
3. **Dock Icon** - Right-click to "Keep in Dock"

---

## 🔄 Keeping the App Updated

The PWA automatically updates when you refresh. If you make changes to the dashboard:

1. The service worker will detect changes
2. New content will be cached
3. Refresh the app to see updates

---

## 🚀 Running the Dashboard

Before using the desktop app, make sure the services are running:

```bash
# Terminal 1: Start the agent service
cd /path/to/bluebubbles-ai-agent/agent-service
npm run dev

# Terminal 2: Start the dashboard
cd /path/to/bluebubbles-ai-agent/dashboard
npm run dev
```

Or use the combined start script if available.

---

## 🎨 Customizing the App Icon

The app uses these icon files:
- `dashboard/public/icons/icon-192x192.png`
- `dashboard/public/icons/icon-512x512.png`

To change the icon:
1. Replace these files with your custom icons
2. Keep the same dimensions (192x192 and 512x512)
3. Reinstall the PWA to see the new icon

---

## 🐛 Troubleshooting

### App won't install?
- Make sure you're using Chrome, Safari 17+, or Edge
- Check that the manifest is loading: visit `http://localhost:3000/manifest.webmanifest`
- Clear browser cache and try again

### Icon not showing?
- Check that icon files exist in `public/icons/`
- Verify icons are accessible: `http://localhost:3000/icons/icon-192x192.png`

### App shows "offline" content?
- The service worker caches pages for offline use
- Refresh to get the latest content
- Clear the cache in DevTools → Application → Storage → Clear site data

---

## 📋 Technical Details

### PWA Components:
- **Manifest**: `app/manifest.ts` - App metadata, icons, display mode
- **Service Worker**: `public/sw.js` - Caching, offline support
- **Install Prompt**: `components/PWAInstallPrompt.tsx` - Custom install UI

### Manifest Configuration:
```json
{
  "name": "Grace AI Dashboard",
  "short_name": "Grace",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b"
}
```

---

## 🎉 Enjoy Your Desktop App!

Once installed, you can:
- Launch from Spotlight (⌘ + Space → "Grace")
- Keep in Dock for quick access
- Use keyboard shortcuts like any native app
- Get a clean, focused interface without browser distractions
