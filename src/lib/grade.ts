export const GRADE_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export function gradeLabel(grade: number): string {
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

export function gradeShort(grade: number): string {
  return grade === 0 ? "K" : String(grade);
}

/** Target sentence length and vocabulary guidance for the sentence generator. */
export function gradeGuidance(grade: number): string {
  if (grade <= 2) return "Use 5 to 9 words, simple everyday words, and short sounds-out-able vocabulary.";
  if (grade <= 5) return "Use 8 to 14 words with grade-appropriate vocabulary.";
  return "Use 12 to 20 words with richer vocabulary.";
}
