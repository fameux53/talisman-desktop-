# Claude Code Prompt — Replace Emoji Logo with SVG Shield Logo

Copy-paste this into Claude Code:

---

```
Replace the shopping bag emoji (🛍️) logo throughout Talisman with the proper SVG shield logo. The logo files are in docs/logo/:

- talisman-icon.svg — shield icon only (for favicon, app icon, tray)
- talisman-full.svg — icon + "Talisman" wordmark + "BIZNIS ASISTAN" tagline (for sidebar, login)
- talisman-full-dark.svg — same but light text for dark backgrounds (dark mode, receipts)
- talisman-stacked.svg — icon on top, wordmark below (splash screen, about page)

## 1. COPY LOGO FILES TO FRONTEND

```bash
# Copy SVG files to the frontend public assets
mkdir -p frontend/public/logo
cp docs/logo/talisman-icon.svg frontend/public/logo/
cp docs/logo/talisman-full.svg frontend/public/logo/
cp docs/logo/talisman-full-dark.svg frontend/public/logo/
cp docs/logo/talisman-stacked.svg frontend/public/logo/

# Also copy to the frontend src for inline imports
mkdir -p frontend/src/assets/logo
cp docs/logo/talisman-icon.svg frontend/src/assets/logo/
cp docs/logo/talisman-full.svg frontend/src/assets/logo/
cp docs/logo/talisman-full-dark.svg frontend/src/assets/logo/
cp docs/logo/talisman-stacked.svg frontend/src/assets/logo/
```

## 2. CREATE A REUSABLE LOGO COMPONENT

Create src/components/TalismanLogo.tsx:

```tsx
import iconSvg from '../assets/logo/talisman-icon.svg';
import fullSvg from '../assets/logo/talisman-full.svg';
import fullDarkSvg from '../assets/logo/talisman-full-dark.svg';
import stackedSvg from '../assets/logo/talisman-stacked.svg';

interface TalismanLogoProps {
  variant: 'icon' | 'full' | 'full-dark' | 'stacked';
  size?: number;       // height in pixels
  className?: string;
}

export function TalismanLogo({ variant, size = 40, className = '' }: TalismanLogoProps) {
  const src = {
    'icon': iconSvg,
    'full': fullSvg,
    'full-dark': fullDarkSvg,
    'stacked': stackedSvg,
  }[variant];

  // Aspect ratios for each variant
  const aspectRatio = {
    'icon': 70 / 80,       // nearly square
    'full': 320 / 80,      // wide horizontal
    'full-dark': 320 / 80,
    'stacked': 200 / 260,  // tall vertical
  }[variant];

  const width = size * aspectRatio;

  return (
    <img
      src={src}
      alt="Talisman"
      width={width}
      height={size}
      className={className}
      style={{ width: `${width}px`, height: `${size}px` }}
    />
  );
}
```

## 3. REPLACE EVERY LOGO INSTANCE

Find and replace all emoji logos in the codebase:

```bash
# Find all instances of the shopping bag emoji or text "Talisman" used as a logo
grep -rn "🛍️\|🛒.*Talisman\|>Talisman<" src/ --include="*.tsx" | head -30
```

### Sidebar / SideNav:
Replace:
```tsx
<span className="text-xl">🛍️</span>
<span className="text-lg font-bold">Talisman</span>
```
With:
```tsx
<TalismanLogo variant="full" size={32} />
```

If the sidebar is collapsed (icon only mode on tablet):
```tsx
<TalismanLogo variant="icon" size={28} />
```

### Login Page:
Replace the emoji logo with the stacked version:
```tsx
{/* Login page hero/branding */}
<div className="flex flex-col items-center mb-8">
  <TalismanLogo variant="stacked" size={160} />
</div>
```

### Register Page:
Same stacked logo:
```tsx
<div className="flex flex-col items-center mb-6">
  <TalismanLogo variant="stacked" size={120} />
</div>
```

### Desktop Split Login (if applicable):
For the branding panel on the left side of the desktop login:
```tsx
<div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-[#1B4332] to-[#2D6A4F] p-12">
  <TalismanLogo variant="stacked" size={200} className="mb-8" />
  {/* ... tagline text ... */}
</div>
```
Use the stacked variant — it has light text built in, but the shield colors work on both light and dark backgrounds.

### Mobile Header / Top Bar:
```tsx
<TalismanLogo variant="icon" size={28} className="mr-2" />
```
Or for a slightly larger header on phone:
```tsx
<TalismanLogo variant="full" size={28} />
```

### Receipt/Invoice Header:
```tsx
{/* Receipt branding */}
<div className="text-center mb-4">
  <TalismanLogo variant="icon" size={40} className="mx-auto mb-2" />
  <p className="font-bold text-lg">Talisman</p>
  <p className="text-sm text-gray-500">Biznis Asistan pou Machann</p>
</div>
```

### Public Balance Page:
```tsx
<div className="flex items-center justify-center gap-2 mb-6">
  <TalismanLogo variant="icon" size={32} />
  <span className="text-xl font-bold text-primary">Talisman</span>
</div>
```

### PWA Splash Screen (if applicable):
Use the stacked variant centered on screen.

### About/Settings Page:
```tsx
<div className="flex flex-col items-center py-6">
  <TalismanLogo variant="stacked" size={140} className="mb-4" />
  <p className="text-sm text-secondary">v{appVersion}</p>
</div>
```

### Dashboard AI Assistant floating button:
Keep the 🧠 emoji for the AI button — it's not a logo, it's a feature icon.

### Dashboard/Calculator floating buttons:
Keep their respective emojis — these are feature icons, not logos.

## 4. FAVICON

Generate a favicon from the shield icon:

```bash
# The SVG icon works directly as a favicon in modern browsers
# Add to frontend/index.html:
```

Update frontend/index.html:
```html
<head>
  <!-- Replace any existing favicon -->
  <link rel="icon" type="image/svg+xml" href="/logo/talisman-icon.svg" />
  <link rel="apple-touch-icon" href="/logo/talisman-icon.svg" />
</head>
```

For maximum compatibility, also generate a PNG favicon:
```bash
# If sharp/canvas is available:
# Convert SVG to 32x32 PNG for older browsers
# For now, the SVG favicon works in all modern browsers
```

## 5. PWA MANIFEST ICONS

Update the PWA manifest to reference the logo:

```json
{
  "name": "Talisman",
  "short_name": "Talisman",
  "icons": [
    {
      "src": "/logo/talisman-icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

For better PWA support, generate PNG versions at multiple sizes (192x192, 512x512). The SVG works as a fallback.

## 6. ELECTRON / DESKTOP

Copy the logo to the desktop resources:

```bash
# SVG for the window title bar
cp docs/logo/talisman-icon.svg desktop/resources/
```

Update desktop/src/main.ts to reference the SVG:
```typescript
// If Electron supports SVG icons natively, use it
// Otherwise, generate a PNG from the SVG during the build step
icon: join(__dirname, '../resources/icon.png'), // Keep existing PNG for now
```

For the system tray, the existing PNG tray icon still works — but if you want to regenerate it from the shield design, use a tool like Inkscape or sharp to convert talisman-icon.svg to a 22x22 PNG.

## 7. DARK MODE HANDLING

The logo component should auto-switch between light and dark variants:

```tsx
export function TalismanLogo({ variant, size = 40, className = '' }: TalismanLogoProps) {
  const isDark = document.documentElement.classList.contains('dark');

  // Auto-switch to dark variant for 'full' in dark mode
  const resolvedVariant = variant === 'full' && isDark ? 'full-dark' : variant;

  const src = {
    'icon': iconSvg,          // Shield colors work on both light and dark
    'full': fullSvg,          // Dark text for light bg
    'full-dark': fullDarkSvg, // Light text for dark bg
    'stacked': stackedSvg,    // Dark text — use on light bg only
  }[resolvedVariant];

  // ...
}
```

## 8. VERIFY

After replacing all logos:

```bash
# No more shopping bag emoji used as logos:
grep -rn "🛍️" src/ --include="*.tsx" | grep -v "node_modules\|docs/"
# Should return ZERO results (or only in data/content, not as logos)

# TalismanLogo component used everywhere:
grep -rn "TalismanLogo" src/ --include="*.tsx"
# Should show usage in: SideNav, LoginPage, RegisterPage, Layout, ReceiptSheet, PublicBalancePage, SettingsPage
```

1. Login page → shield logo (stacked) visible, no emoji
2. Sidebar → shield + "Talisman" wordmark, no emoji
3. Browser tab → shield favicon, not default or emoji
4. Mobile home screen (PWA) → shield icon
5. Receipt → shield icon + "Talisman" text
6. Dark mode → wordmark switches to light text automatically
7. Public balance page → shield icon visible
8. Settings/About → stacked logo with version number
9. Desktop title bar → "Talisman" with icon (if supported)
10. System tray → icon visible (may still be PNG)
```

---
