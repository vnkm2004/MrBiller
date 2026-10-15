export const DEFAULT_ACCENT_COLOR = '#e85d04';

function parseHexColor(value: string | undefined): [number, number, number] | null {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

export function hexToRgb(value?: string): [number, number, number] {
  return parseHexColor(value) ?? parseHexColor(DEFAULT_ACCENT_COLOR)!;
}

function mixWith(color: [number, number, number], target: number, amount: number) {
  return color.map((channel) => Math.round(channel + (target - channel) * amount));
}

function rgbChannels(color: number[]) {
  return color.join(' ');
}

function relativeLuminance(color: [number, number, number]) {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyAccentColor(value?: string) {
  const color = hexToRgb(value);
  const luminance = relativeLuminance(color);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  const root = document.documentElement;

  root.style.setProperty('--accent-color', rgbChannels(color));
  root.style.setProperty('--accent-color-light', rgbChannels(mixWith(color, 255, 0.25)));
  root.style.setProperty('--accent-color-dark', rgbChannels(mixWith(color, 0, 0.18)));
  root.style.setProperty('--accent-foreground', whiteContrast >= blackContrast ? '#ffffff' : '#111111');
}
