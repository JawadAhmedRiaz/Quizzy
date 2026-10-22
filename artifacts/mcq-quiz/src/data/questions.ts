export interface Question {
  c: string;
  q: string;
  o: string[];
  a: number;
  e: string;
}

// Hardcoded questions have been migrated to the Supabase database.
// Questions are now loaded dynamically from the API: /api/quiz-questions/:quizId
export const ALL_Q: Question[] = [];
