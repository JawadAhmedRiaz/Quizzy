import type { Question } from "./questions";

export interface ExamSlot {
  id: string;
  label: string;
  available: boolean;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  exams: ExamSlot[];
}

export interface Semester {
  sem: number;
  subjects: Subject[];
}

export interface DbSubjectCacheItem {
  id: number;
  sem: number;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  isActive: boolean;
  examTypes: string[];
}

let _dbSubjectsCache: DbSubjectCacheItem[] = [];

// Initialize from localStorage if running in browser
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("quizzy_db_subjects");
    if (raw) _dbSubjectsCache = JSON.parse(raw);
  } catch {}
}

export function setDbSubjectsCache(subjects: DbSubjectCacheItem[]) {
  _dbSubjectsCache = subjects;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("quizzy_db_subjects", JSON.stringify(subjects));
    } catch {}
  }
}

export function getDbSubjectsCache(): DbSubjectCacheItem[] {
  return _dbSubjectsCache;
}

// Static curriculum is now empty — all subjects and semesters are loaded from the database
export const CURRICULUM: Semester[] = [];

export function getQuizQuestions(_quizId: string): Question[] {
  return [];
}

export interface QuizMeta {
  quizId: string;
  sem: number;
  subject: string;
  examType: string;
  subjectName: string;
  examLabel: string;
  icon: string;
}

export function getQuizMeta(quizId: string): QuizMeta | null {
  if (!quizId) return null;

  if (quizId.startsWith("db-")) {
    const withoutPrefix = quizId.slice(3);
    const dashIdx = withoutPrefix.indexOf("-");
    if (dashIdx !== -1) {
      const subjectId = parseInt(withoutPrefix.substring(0, dashIdx));
      const examTypeRaw = withoutPrefix.substring(dashIdx + 1);
      const subj = _dbSubjectsCache.find((s) => s.id === subjectId);
      const examLabel = examTypeRaw.charAt(0).toUpperCase() + examTypeRaw.slice(1) + " Exam";

      if (subj) {
        return {
          quizId,
          sem: subj.sem,
          subject: subj.name,
          examType: examTypeRaw.toLowerCase(),
          subjectName: subj.name,
          examLabel,
          icon: subj.icon || "📚",
        };
      }

      return {
        quizId,
        sem: 1,
        subject: "Quiz",
        examType: examTypeRaw.toLowerCase(),
        subjectName: "Quiz",
        examLabel,
        icon: "📚",
      };
    }
  }

  return null;
}
