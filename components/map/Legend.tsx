'use client';

import { ZONE_COLORS } from '@/lib/colors';

export default function Legend() {
  return (
    <div>
      <span style={{ color: ZONE_COLORS.red }}>Red</span>
      <span style={{ color: ZONE_COLORS.yellow }}>Yellow</span>
      <span style={{ color: ZONE_COLORS.green }}>Green</span>
    </div>
  );
}