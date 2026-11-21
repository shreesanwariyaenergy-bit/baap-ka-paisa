# BAAP KA PAISA — brand assets

The finalised logo is the stacked **BAAP / KA / PAISA** in custom angular lettering. The supplied artwork is the
single source of truth; nothing here redraws, recolours the lettering geometry, crops or stretches it.

## Colour system (unchanged)

The website keeps its existing tokens: ink `#0C251F`, lime `#CCFF00`, orange `#FF4500`, paper `#F1EFE6`.
The logo's own forest-green lettering is kept exactly as supplied.

## Asset inventory

| File | What it is |
|---|---|
| `public/brand/baap-ka-paisa-master.webp` | The supplied artwork, byte for byte (1376 × 768, cream background). Never edited. |
| `public/brand/baap-ka-paisa-logo-balanced.png` | The same lettering on the artwork's own cream (#F3F1E0), centred with equal 96 px padding on all four sides (909 × 922). Corrects the supplied file's uneven margins (306 / 353 / 36 / 4 px). |
| `public/brand/baap-ka-paisa-logo-balanced-transparent.png` | As above, transparent background. |
| `public/brand/baap-ka-paisa-logo.png` | Transparent cut-out at full resolution (747 × 760, equal 15 px margins). |
| `public/brand/baap-ka-paisa-logo-{240,480}.webp`, `-480.png` | Web sizes of the cut-out (header, footer, Bill, share images). |
| `public/brand/baap-ka-paisa-logo-cream*.{png,webp}` | Cream lettering, same alpha (same geometry), for dark surfaces such as The Seal. |
| `public/brand/icon-{192,512}.png`, `icon-maskable-512.png` | App / PWA icons: complete logo on paper; the maskable icon keeps it inside the 80% safe area. |
| `app/favicon.ico` (16, 32, 48), `app/icon.png` (192), `app/apple-icon.png` (180) | Browser and home-screen icons. |
| `assets/brand/baap-ka-paisa-logo-480.png` | Copy of the 480 px cut-out read by the share-image routes (bundled with server functions, like `assets/fonts`). |

### How the cut-out was made

The supplied file has no transparency. The background was measured (a near-uniform cream with a slight vignette),
estimated locally under the lettering, and each pixel's opacity taken from how much darker it is than that
background; colour was then un-mixed from the background. Recomposited on its own background it matches the
original (mean difference 0.17 of 255 on the lettering). Two faint sparkle marks outside the lettering in the
supplied file fall to zero opacity and do not appear in any derivative.

## Usage

- Use `components/BrandLogo.tsx` on pages (variants `ink` for cream surfaces, `cream` for dark surfaces). Pass a
  height; width follows the 747 : 760 ratio.
- Use `lib/brand-image.ts` (`shareLogo(height)`) inside `ImageResponse` share images.
- The Crown is a separate product signature for the current #01 and is never combined with the logo.
- The name is always written **BAAP KA PAISA**.

## Future design tasks

1. **Vector master.** The approved artwork exists only as a raster (about 750 px square for the lettering). It is
   sufficient for the website; print, signage and very large displays need a professionally drawn vector master
   (SVG/PDF) of the exact approved lettering. No automatic tracing has been done, to avoid altering the letters.
2. **Simplified small-size mark.** At 16 px the full three-line logo reduces to texture. The 16 px favicon keeps the
   full logo as the fallback until a dedicated simplified mark is designed and approved. No monogram, crown or
   substitute icon is to be invented in the meantime. An SVG favicon depends on task 1.
