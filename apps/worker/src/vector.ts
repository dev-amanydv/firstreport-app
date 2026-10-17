export function normalize(vector: number[]) {
  const length = Math.hypot(...vector);
  return length === 0 ? vector : vector.map((value) => value / length);
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot / (Math.hypot(...a) * Math.hypot(...b));
}
