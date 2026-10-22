import pg from "../../lib/db/node_modules/pg/lib/index.js";
const { Client } = pg;
import { ALL_Q } from "../../artifacts/mcq-quiz/src/data/questions.ts";
import { ENTREPRENEURSHIP_Q } from "../../artifacts/mcq-quiz/src/data/entrepreneurship.ts";
import { FUNCTIONAL_ENGLISH_MID_Q } from "../../artifacts/mcq-quiz/src/data/functional-english.ts";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log(" Connected to Supabase PostgreSQL.");

  try {
    // 1. Seed Semesters 1 to 8
    const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
    for (let num = 1; num <= 8; num++) {
      const label = `${ORDINALS[num - 1]} Semester`;
      await client.query(
        `INSERT INTO semesters (num, label, is_active, sort_order)
         VALUES ($1, $2, true, $1)
         ON CONFLICT (num) DO UPDATE
         SET label = EXCLUDED.label, is_active = true`,
        [num, label]
      );
    }
    console.log("✅ Semesters 1 through 8 inserted / verified.");

    // 2. Seed Subjects for Semester 1
    const subjects = [
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

    for (const s of subjects) {
      await client.query(
        `INSERT INTO subjects (sem, name, icon, color, gradient, is_active, exam_types)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (sem, name) DO UPDATE
         SET icon = EXCLUDED.icon,
             color = EXCLUDED.color,
             gradient = EXCLUDED.gradient,
             is_active = true,
             exam_types = EXCLUDED.exam_types`,
        [s.sem, s.name, s.icon, s.color, s.gradient, s.examTypes]
      );
      console.log(`  + Seeded subject: ${s.name} (Semester ${s.sem})`);
    }

    // 3. Batch insert questions helper
    const letters = ["A", "B", "C", "D"];
    async function seedQuestions(subjectName, examType, list) {
      // Clear any prior test questions for this subject & examType
      await client.query(
        `DELETE FROM questions WHERE sem = 1 AND subject = $1 AND exam_type = $2`,
        [subjectName, examType]
      );

      console.log(`📥 Inserting ${list.length} questions for ${subjectName} ${examType}...`);

      const batchSize = 50;
      for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        const valuePlaceholders = [];
        const params = [];
        let pIdx = 1;

        for (const q of batch) {
          const optA = q.o?.[0] || "";
          const optB = q.o?.[1] || "";
          const optC = q.o?.[2] || "";
          const optD = q.o?.[3] || "";
          const ans = letters[q.a] || "A";
          const briefing = q.e || `Correct answer: ${ans}`;
          const topic = q.c || subjectName;

          valuePlaceholders.push(
            `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
          );
          params.push(1, subjectName, examType, topic, q.q, optA, optB, optC, optD, ans);
        }

        const sql = `
          INSERT INTO questions (sem, subject, exam_type, topic, question, option_a, option_b, option_c, option_d, correct_answer)
          VALUES ${valuePlaceholders.join(", ")}
        `;
        await client.query(sql, params);
      }
      console.log(`  ✅ Successfully inserted ${list.length} questions for ${subjectName} (${examType})`);
    }

    // Insert ICT Midterm
    await seedQuestions("ICT", "Midterm", ALL_Q);

    // Insert Entrepreneurship Midterm
    await seedQuestions("Entrepreneurship", "Midterm", ENTREPRENEURSHIP_Q);

    // Insert Functional English Midterm
    await seedQuestions("Functional English", "Midterm", FUNCTIONAL_ENGLISH_MID_Q);

    // Summarize DB content
    const subRes = await client.query("SELECT id, sem, name, icon, exam_types FROM subjects ORDER BY sem, id");
    console.log("\n📋 Current Subjects in Supabase:");
    console.table(subRes.rows);

    const qSummary = await client.query(
      "SELECT subject, exam_type, count(*) as count FROM questions GROUP BY subject, exam_type ORDER BY subject, exam_type"
    );
    console.log("\n📊 Current Questions in Supabase:");
    console.table(qSummary.rows);

    console.log("\n🎉 ALL SUBJECTS AND QUESTIONS SUCCESSFULLY MIGRATED TO SUPABASE!");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
