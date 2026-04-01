import iconSvg from '../assets/logo/talisman-icon.svg';
import fullSvg from '../assets/logo/talisman-full.svg';
import fullDarkSvg from '../assets/logo/talisman-full-dark.svg';
import stackedSvg from '../assets/logo/talisman-stacked.svg';
import { useThemeStore } from '../stores/themeStore';

type LogoVariant = 'icon' | 'full' | 'full-dark' | 'stacked';

interface TalismanLogoProps {
  variant: LogoVariant;
  size?: number;
  className?: string;
}

const ASPECT_RATIOS: Record<LogoVariant, number> = {
  icon: 70 / 80,
  full: 320 / 80,
  'full-dark': 320 / 80,
  stacked: 200 / 260,
};

const SOURCES: Record<LogoVariant, string> = {
  icon: iconSvg,
  full: fullSvg,
  'full-dark': fullDarkSvg,
  stacked: stackedSvg,
};

export default function TalismanLogo({ variant, size = 40, className = '' }: TalismanLogoProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  // Auto-switch to dark variant for 'full' in dark mode
  const resolvedVariant: LogoVariant = variant === 'full' && isDark ? 'full-dark' : variant;

  const src = SOURCES[resolvedVariant];
  const aspectRatio = ASPECT_RATIOS[resolvedVariant];
  const width = Math.round(size * aspectRatio);

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
