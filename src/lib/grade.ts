/** Stored value for the single high-school option, above 8th grade. */
export const HIGH_SCHOOL = 9;

export const GRADE_LEVELS = [3, 4, 5, 6, 7, 8, HIGH_SCHOOL] as const;

export function isGradeLevel(grade: number): boolean {
  return (GRADE_LEVELS as readonly number[]).includes(grade);
}

function ordinal(grade: number): string {
  const mod100 = grade % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${grade}th`;
  switch (grade % 10) {
    case 1:
      return `${grade}st`;
    case 2:
      return `${grade}nd`;
    case 3:
      return `${grade}rd`;
    default:
      return `${grade}th`;
  }
}

export function gradeLabel(grade: number): string {
  if (grade === HIGH_SCHOOL) return "High School";
  if (grade >= 3 && grade <= 8) return `${ordinal(grade)} Grade`;
  return `Grade ${grade}`;
}

export function gradeShort(grade: number): string {
  if (grade === HIGH_SCHOOL) return "HS";
  return String(grade);
}

/** Target sentence length and vocabulary guidance for the sentence generator. */
export function gradeGuidance(grade: number): string {
  if (grade === HIGH_SCHOOL) {
    return "Use 16 to 28 words, mature vocabulary, and more complex sentence structure.";
  }
  if (grade <= 5) return "Use 8 to 14 words with grade-appropriate vocabulary.";
  return "Use 12 to 20 words with richer vocabulary.";
}
