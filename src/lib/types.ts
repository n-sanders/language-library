export type Token = {
  text: string;
  /** Punctuation tokens are shown but can't be tagged. */
  isWord: boolean;
};

/** Label id -> token indices that carry that label. */
export type AnswerKey = Record<string, number[]>;

export type StudentAnswer = Record<string, number[]>;

export type LabelResult = {
  labelId: string;
  correct: number[];
  extra: number[];
  missedCount: number;
  perfect: boolean;
};

export type GradeResult = {
  labels: LabelResult[];
  score: number;
  total: number;
  perfect: boolean;
};
