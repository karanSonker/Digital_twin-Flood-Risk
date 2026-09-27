export function addSyntheticNoise(value: number) {
  const n = (Math.random() - 0.5) * 10;
  return Math.max(0, value + n);
}
