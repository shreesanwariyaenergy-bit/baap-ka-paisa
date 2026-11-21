// The finalised BAAP KA PAISA logo (stacked BAAP / KA / PAISA), from the approved artwork in public/brand.
// One component for every placement. The image keeps its own proportions (747 x 760): pass a height and the width
// follows, so the space is reserved before the file arrives and the logo is never stretched or cropped.
//   ink   dark forest lettering, for the cream paper surfaces (the approved treatment)
//   cream the same lettering in cream, for dark surfaces such as The Seal
import Image from 'next/image';

const RATIO = 747 / 760;
const SOURCES = {
  ink: { sm: '/brand/baap-ka-paisa-logo-240.webp', lg: '/brand/baap-ka-paisa-logo-480.webp' },
  cream: { sm: '/brand/baap-ka-paisa-logo-cream-240.webp', lg: '/brand/baap-ka-paisa-logo-cream-480.webp' },
} as const;

export function BrandLogo({ height, variant = 'ink', className, priority = false, decorative = false }: {
  /** Rendered height in CSS pixels (a class may change it per breakpoint; the aspect ratio is kept). */
  height: number;
  variant?: keyof typeof SOURCES;
  className?: string;
  /** Load at once (the header logo on every page). */
  priority?: boolean;
  /** True where a parent already names the brand (for example a link labelled "BAAP KA PAISA home"). */
  decorative?: boolean;
}) {
  // The 240 px file covers up to 4x pixel density at header and footer sizes; larger placements use the 480 px file.
  const src = height > 60 ? SOURCES[variant].lg : SOURCES[variant].sm;
  return (
    <Image src={src} alt={decorative ? '' : 'BAAP KA PAISA'} width={Math.round(height * RATIO)} height={height}
      className={className ? `brand-logo ${className}` : 'brand-logo'} priority={priority} />
  );
}
