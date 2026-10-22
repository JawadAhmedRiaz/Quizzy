import { db, semestersTable, subjectsTable, questionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ALL_Q } from "../../artifacts/mcq-quiz/src/data/questions";
import { ENTREPRENEURSHIP_Q } from "../../artifacts/mcq-quiz/src/data/entrepreneurship";
import { FUNCTIONAL_ENGLISH_MID_Q } from "../../artifacts/mcq-quiz/src/data/functional-english";

async function migrate() {
  console.log("🚀 Starting Curriculum & Questions Migration to Supabase...");

  // 1. Seed Semesters 1 to 8
  const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  for (let num = 1; num <= 8; num++) {
    const label = `${ORDINALS[num - 1]} Semester`;
    await db
      .insert(semestersTable)
      .values({
        num,
        label,
        isActive: true,
        sortOrder: num,
      })
      .onConflictDoUpdate({
        target: semestersTable.num,
        set: { label, isActive: true },
      });
  }
  console.log("✅ Semesters 1 through 8 ensured.");

  // 2. Seed Subjects for Semester 1
  const subjectsToSeed = [
    {
      sem: 1,
      name: "ICT",
      icon: "💻",
      color: "#3b82f6",
      gradient: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
    {
      sem: 1,
      name: "Entrepreneurship",
      icon: "💡",
      color: "#f59e0b",
      gradient: "linear-gradient(135deg, #b45309, #f59e0b)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
    {
      sem: 1,
      name: "Functional English",
      icon: "📝",
      color: "#06b6d4",
      gradient: "linear-gradient(135deg, #0e7490, #06b6d4)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
    {
      sem: 1,
      name: "Quantitative Reasoning",
      icon: "📊",
      color: "#10b981",
      gradient: "linear-gradient(135deg, #047857, #10b981)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
    {
      sem: 1,
      name: "Civics & Community",
      icon: "🏛️",
      color: "#8b5cf6",
      gradient: "linear-gradient(135deg, #6d28d9, #8b5cf6)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
    {
      sem: 1,
      name: "Ideology & Constitution",
      icon: "⚖️",
      color: "#ef4444",
      gradient: "linear-gradient(135deg, #b91c1c, #ef4444)",
      examTypes: JSON.stringify(["Midterm", "Final"]),
    },
  ];

  for (const s of subjectsToSeed) {
    const [existing] = await db
      .select()
      .from(subjectsTable)
      .where(and(eq(subjectsTable.sem, s.sem), eq(subjectsTable.name, s.name)));

    if (!existing) {
      await db.insert(subjectsTable).values(s);
      console.log(`  + Created subject: ${s.name}`);
    } else {
      await db
        .update(subjectsTable)
        .set({
          icon: s.icon,
          color: s.color,
          gradient: s.gradient,
          examTypes: s.examTypes,
          isActive: true,
        })
        .where(eq(subjectsTable.id, existing.id));
      console.log(`  ~ Updated subject: ${s.name}`);
    }
  }
  console.log("✅ All Semester 1 subjects seeded into Supabase.");

  // Helper for inserting questions in batches
  const BATCH_SIZE = 50;
  async function insertQuestions(
    subjectName: string,
    examType: string,
    rawList: Array<{ c: string; q: string; o: string[]; a: number; e?: string }>
  ) {
    // Check existing
    const existing = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.sem, 1),
          eq(questionsTable.subject, subjectName),
          eq(questionsTable.examType, examType)
        )
      );

    if (existing.length > 10) {
      console.log(`ℹ️  ${subjectName} ${examType} already has ${existing.length} questions in DB. Skipping.`);
      return;
    }

    // Delete any incomplete/test questions
    if (existing.length > 0) {
      await db
        .delete(questionsTable)
        .where(
          and(
            eq(questionsTable.sem, 1),
            eq(questionsTable.subject, subjectName),
            eq(questionsTable.examType, examType)
          )
        );
      console.log(`🧹 Cleaned ${existing.length} old/test questions for ${subjectName} ${examType}`);
    }

    const letters = ["A", "B", "C", "D"];
    const rows = rawList.map((q) => ({
      sem: 1,
      subject: subjectName,
      examType: examType,
      topic: q.c || subjectName,
      question: q.q,
      optionA: q.o[0] ?? "",
      optionB: q.o[1] ?? "",
      optionC: q.o[2] ?? "",
      optionD: q.o[3] ?? "",
      correctAnswer: letters[q.a] ?? "A",
      briefing: q.e || `Correct answer: ${letters[q.a] ?? "A"}`,
    }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db.insert(questionsTable).values(rows.slice(i, i + BATCH_SIZE));
    }
    console.log(`✅ Inserted ${rows.length} questions for ${subjectName} ${examType}`);
  }

  // 3. Insert Questions
  console.log("📥 Migrating MCQs into Supabase...");
  await insertQuestions("ICT", "Midterm", ALL_Q);
  await insertQuestions("Entrepreneurship", "Midterm", ENTREPRENEURSHIP_Q);
  await insertQuestions("Functional English", "Midterm", FUNCTIONAL_ENGLISH_MID_Q);

  console.log("\n🎉 ALL MIGRATION TASKS COMPLETED SUCCESSFULLY!");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
