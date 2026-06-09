import { Tag } from 'antd';
import type { CSSProperties } from 'react';
import { VEHICLE_STATUS_CONFIG, type VehicleStatus } from '@volunteerfleet/shared';

const DELETED_COLOR = '#ff4d4f';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Soft "Finances-style" tag: colored text + border, light translucent background. */
export function softColorStyle(hex: string): CSSProperties {
  const rgb = hexToRgb(hex);
  if (!rgb) return { color: hex, borderColor: hex };
  const { r, g, b } = rgb;
  return {
    color: hex,
    background: `rgba(${r}, ${g}, ${b}, 0.1)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.32)`,
  };
}

/** Solid filled style — used for the active state of toggle chips. */
export function solidColorStyle(hex: string): CSSProperties {
  const rgb = hexToRgb(hex);
  return {
    color: '#fff',
    background: hex,
    borderColor: hex,
    boxShadow: rgb ? `0 2px 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)` : undefined,
  };
}

export function VehicleStatusTag({
  status,
  deleted = false,
  style,
}: {
  status: VehicleStatus;
  deleted?: boolean;
  style?: CSSProperties;
}) {
  const cfg = VEHICLE_STATUS_CONFIG[status];
  const base = softColorStyle(deleted ? DELETED_COLOR : cfg.color);
  return <Tag style={{ ...base, fontWeight: 500, ...style }}>{cfg.label}</Tag>;
}
