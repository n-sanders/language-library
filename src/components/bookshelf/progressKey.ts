export type ShelfProgress = Record<
  string,
  { exercisesCompleted: number; recentAccuracy: number | null; mastered: boolean }
>;

export const progressKeyOf = (book: string, chapter: string) => `${book}/${chapter}`;
