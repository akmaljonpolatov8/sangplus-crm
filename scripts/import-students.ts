#!/usr/bin/env node
/**
 * Direct import script for SangPlus CRM — imports student data into database
 *
 * Usage:
 *   npm run import:students
 *   npx tsx scripts/import-students.ts
 *
 * This script:
 * 1. Ensures teachers exist (creates if missing)
 * 2. Ensures groups exist (creates if missing)
 * 3. Ensures students exist (creates if missing)
 * 4. Links students to groups via StudentGroup records
 */

import "dotenv/config";
import { PrismaClient, StudentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { hashPassword } from "../lib/password";

const db = new PrismaClient();

// Define student data by group and teacher
const STUDENT_DATA = {
  Shoxsanam: {
    teacher: "Shoxsanam",
    group: "Shoxsanam Group",
    students: [
      { name: "Ganijonova Shohiza", phone: "998501251980" },
      { name: "Abdullayeva Nigora", phone: "998581266" },
      { name: "Ismoiliyeva Mohichehra", phone: "936778377" },
      { name: "Ismuhammedova Iqrorabonu", phone: "998002286" },
      { name: "Erkinova Hayotxon", phone: "998572082" },
      { name: "Rohataliyeva Zulfiya", phone: "950557085" },
      { name: "Bobirova Mohinbonu", phone: "995971762" },
      { name: "Baxtiyorova Yulduz", phone: "999007655" },
      { name: "Valijonova Shohida", phone: "939128257" },
      // Add remaining students as needed
    ],
  },
  // Additional groups can be added here
};

async function ensureTeacher(name: string, username: string): Promise<string> {
  const existing = await db.user.findFirst({
    where: {
      role: "TEACHER",
      OR: [{ fullName: name }, { username }],
    },
    select: { id: true },
  });

  if (existing) {
    console.log(`  ✓ Teacher already exists: ${name}`);
    return existing.id;
  }

  const teacher = await db.user.create({
    data: {
      username,
      fullName: name,
      role: "TEACHER",
      isActive: true,
      passwordHash: hashPassword("Teacher123"),
    },
    select: { id: true },
  });

  console.log(`  ✓ Created teacher: ${name}`);
  return teacher.id;
}

async function ensureGroup(name: string, teacherId: string): Promise<string> {
  const existing = await db.group.findFirst({
    where: { name },
    select: { id: true },
  });

  if (existing) {
    console.log(`  ✓ Group already exists: ${name}`);
    return existing.id;
  }

  const group = await db.group.create({
    data: {
      name,
      subject: "General",
      scheduleDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      monthlyFee: new Decimal("1600000"),
      isActive: true,
      teacherId,
    },
    select: { id: true },
  });

  console.log(`  ✓ Created group: ${name}`);
  return group.id;
}

async function ensureStudent(
  firstName: string,
  lastName: string,
  phone: string,
): Promise<string> {
  const existing = await db.student.findFirst({
    where: {
      OR: [{ phone }, { parentPhone: phone }],
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const student = await db.student.create({
    data: {
      firstName,
      lastName,
      phone: phone || null,
      parentPhone: phone,
      status: StudentStatus.ACTIVE,
    },
    select: { id: true },
  });

  console.log(`  ✓ Created student: ${firstName} ${lastName}`);
  return student.id;
}

async function linkStudentToGroup(
  studentId: string,
  groupId: string,
): Promise<void> {
  const existing = await db.groupStudent.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
    select: { id: true, leftAt: true },
  });

  if (existing) {
    if (existing.leftAt) {
      // Reactivate
      await db.groupStudent.update({
        where: { id: existing.id },
        data: { leftAt: null },
      });
    }
    return;
  }

  await db.groupStudent.create({
    data: {
      groupId,
      studentId,
    },
  });
}

async function main() {
  console.log("\n📚 SangPlus CRM — Student Import\n");

  const results = {
    teachersCreated: 0,
    groupsCreated: 0,
    studentsCreated: 0,
    linksCreated: 0,
    errors: [] as string[],
  };

  try {
    for (const [, groupData] of Object.entries(STUDENT_DATA)) {
      const { teacher: teacherName, group: groupName, students } = groupData;
      const usernameKey = teacherName.toLowerCase().replace(/\s+/g, "_");

      console.log(`👨‍🏫 Processing teacher: ${teacherName}`);
      const teacherId = await ensureTeacher(teacherName, `${usernameKey}_sp`);

      console.log(`📚 Processing group: ${groupName}`);
      const groupId = await ensureGroup(groupName, teacherId);

      console.log(`👥 Processing ${students.length} students...`);
      for (const studentData of students) {
        try {
          const nameParts = studentData.name.split(" ");
          const firstName =
            nameParts.length > 1 ? nameParts.slice(-1)[0] : "Unknown";
          const lastName = nameParts.slice(0, -1).join(" ");

          const studentId = await ensureStudent(
            firstName,
            lastName || studentData.name,
            studentData.phone,
          );

          await linkStudentToGroup(studentId, groupId);
          results.linksCreated += 1;
        } catch (error) {
          results.errors.push(
            `Error processing student ${studentData.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      console.log(
        `\n✅ Group ${groupName}: ${students.length} students processed\n`,
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("✨ Import Complete!");
    console.log(`   Students linked: ${results.linksCreated}`);
    if (results.errors.length > 0) {
      console.log(`   ⚠️  Errors: ${results.errors.length}`);
      results.errors.slice(0, 5).forEach((e) => console.log(`      ${e}`));
    }
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
