// Normalize a security-question answer before hashing/comparing, so that
// "Fluffy ", "fluffy", and "  Fluffy" all match the stored hash.
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}
