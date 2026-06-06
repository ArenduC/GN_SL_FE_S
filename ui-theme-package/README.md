# @graphynovus/saas-ui-theme

Minimalist, high-performance SaaS design token systems, thematic contextual layers, and layout component primitives crafted in modern React and styled with Tailwind CSS utility classes.

---

## 🎨 Creative Architecture

Our package delivers fully structured style layers separating interface foundations from theme presets:
- **Design Tokens**: Standardized, high-contrast, beautiful color slots.
- **Contextual Theming**: Easily switchable templates (`slate`, `emerald`, `amethyst`, `ocean`, `crimson`).
- **Interactive Component Primitives**: Responsive elements with built-in accessibility focus metrics.

---

## 🚀 How to Publish to npm

When you are ready to release this codebase package to the public registry, follow these standard steps:

1. **Modify standard information**:
   Open `package.json` to configure the `@scope/package-name` with your choice, versioning numbers (`v1.0.0`), and authorship fields.

2. **Compile the library**:
   Ensure you've installed packages in this directory, and compile via the custom TypeScript compiler script:
   ```bash
   cd ui-theme-package
   npm install
   npm run build
   ```

3. **Log in to the Registry**:
   ```bash
   npm login
   ```

4. **Publish the Package**:
   ```bash
   npm publish --access public
   ```

---

## 📦 Integration Guide

Once published, install the package into your visual workspaces:

```bash
npm install @graphynovus/saas-ui-theme
```

### 1. Initialize the Theme Context

Wrap your application tree in our optimized `<ThemeProvider />`:

```tsx
import React from 'react';
import { ThemeProvider } from '@graphynovus/saas-ui-theme';
import AppLayout from './AppLayout';

export default function Root() {
  return (
    <ThemeProvider defaultTheme="slate">
      <AppLayout />
    </ThemeProvider>
  );
}
```

### 2. Implement Pristine Layout Components

```tsx
import React from 'react';
import { useTheme, ThemeCard, ThemeButton, ThemeInput, ThemeBadge } from '@graphynovus/saas-ui-theme';

export default function AppLayout() {
  const { theme, setTheme, palette } = useTheme();

  return (
    <div className={`min-h-screen ${palette.bgPage} p-8 flex flex-col justify-center items-center`}>
      <ThemeCard hoverEffect glow className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-bold tracking-widest uppercase">Workspace Matrix</h2>
          <ThemeBadge variant="success" pulse>Connected</ThemeBadge>
        </div>
        
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          Active theme palette preset identifier: <span className="font-mono text-white">@{theme}</span>
        </p>

        <ThemeInput label="Resource URL Token" placeholder="https://endpoint-cluster.io" className="mb-6" />

        <div className="flex gap-2.5">
          <ThemeButton variant="primary" size="sm" onClick={() => setTheme('emerald')}>
            Activate Emerald
          </ThemeButton>
          <ThemeButton variant="outline" size="sm" onClick={() => setTheme('slate')}>
            Reset Default
          </ThemeButton>
        </div>
      </ThemeCard>
    </div>
  );
}
```

---

## 🛠️ Package Component API

### `ThemeButton`
* Props:
  - `variant`: `'primary' | 'muted' | 'outline' | 'ghost'`
  - `size`: `'sm' | 'md' | 'lg'`
  - Standard HTML button values.

### `ThemeCard`
* Props:
  - `padded`: `boolean` (Default: `true`)
  - `hoverEffect`: `boolean` (Default: `false`)
  - `glow`: `boolean` (Default: `false`)

### `ThemeInput`
* Props:
  - `label`: `string`
  - `error`: `string`
  - Standard HTML input values.

### `ThemeBadge`
* Props:
  - `variant`: `'primary' | 'muted' | 'success' | 'alert'`
  - `pulse`: `boolean`

---

## 🏛️ License

MIT License. Crafted with premium design token guidelines by Google AI Studio.
