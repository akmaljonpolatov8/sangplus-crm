import "dotenv/config";
import { Prisma, PrismaClient, Role, StudentStatus } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../lib/password";

type TeacherRow = {
  username: string;
  password: string;
  full_name: string;
  is_active: string;
};

type GroupRow = {
  name: string;
  subject: string;
  schedule_days: string;
  start_time: string;
  end_time: string;
  monthly_fee: string;
  teacher_username: string;
  is_active: string;
};

type StudentRow = {
  first_name: string;
  last_name: string;
  phone: string;
  parent_phone: string;
  parent_name: string;
  notes: string;
  status: string;
};

type StudentGroupLinkRow = {
  student_phone_or_parent_phone: string;
  group_name: string;
  joined_at: string;
};

type ImportedTeacher = {
  id: string;
  username: string;
  fullName: string;
};

const db = new PrismaClient();

async function main() {
  const inputDir = process.argv[2] ?? path.join(process.cwd(), "docs", "generated-import");

  const teachers = readCsv<TeacherRow>(path.join(inputDir, "teachers.csv"));
  const groups = readCsv<GroupRow>(path.join(inputDir, "groups.csv"));
  const students = readCsv<StudentRow>(path.join(inputDir, "students.csv"));
  const links = readCsv<StudentGroupLinkRow>(path.join(inputDir, "student_group_links.csv"));

  const summary = {
    teachersCreated: 0,
    teachersUpdated: 0,
    groupsCreated: 0,
    groupsUpdated: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    linksCreated: 0,
    linksReactivated: 0,
    warnings: [] as string[],
  };

  const teacherMap = new Map<string, ImportedTeacher>();
  const groupMap = new Map<string, { id: string; name: string }>();
  const studentMap = new Map<string, { id: string }>();

  for (const teacher of teachers) {
    const username = teacher.username.trim();
    const fullName = teacher.full_name.trim();

    if (!username || !fullName) {
      summary.warnings.push(`Skipped teacher with missing username/full_name: ${JSON.stringify(teacher)}`);
      continue;
    }

    const existingTeacher = await db.user.findFirst({
      where: {
        role: Role.TEACHER,
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { fullName: { equals: fullName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    if (existingTeacher) {
      const updatedTeacher = await db.user.update({
        where: { id: existingTeacher.id },
        data: {
          isActive: parseBoolean(teacher.is_active, true),
        },
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      });

      teacherMap.set(normalizeKey(username), updatedTeacher);
      teacherMap.set(normalizeKey(fullName), updatedTeacher);
      summary.teachersUpdated += 1;
      continue;
    }

    const createdTeacher = await db.user.create({
      data: {
        username,
        fullName,
        role: Role.TEACHER,
        isActive: parseBoolean(teacher.is_active, true),
        passwordHash: hashPassword(teacher.password.trim() || "Teacher123"),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    teacherMap.set(normalizeKey(username), createdTeacher);
    teacherMap.set(normalizeKey(fullName), createdTeacher);
    summary.teachersCreated += 1;
  }

  for (const group of groups) {
    const groupName = group.name.trim();

    if (!groupName) {
      summary.warnings.push(`Skipped group with missing name: ${JSON.stringify(group)}`);
      continue;
    }

    const teacher = teacherMap.get(normalizeKey(group.teacher_username.trim()));

    if (!teacher) {
      summary.warnings.push(`Teacher not found for group "${groupName}": ${group.teacher_username}`);
      continue;
    }

    const existingGroup = await db.group.findFirst({
      where: {
        OR: [{ name: groupName }, { name: normalizeGroupName(groupName) }],
      },
      select: {
        id: true,
        name: true,
      },
    });

    const groupData = {
      name: groupName,
      subject: emptyToNull(group.subject),
      scheduleDays: parseScheduleDays(group.schedule_days),
      startTime: emptyToNull(group.start_time),
      endTime: emptyToNull(group.end_time),
      monthlyFee: new Prisma.Decimal(parseDecimal(group.monthly_fee, 1600000)),
      teacherId: teacher.id,
      isActive: parseBoolean(group.is_active, true),
    };

    if (existingGroup) {
      const updatedGroup = await db.group.update({
        where: { id: existingGroup.id },
        data: groupData,
        select: {
          id: true,
          name: true,
        },
      });

      groupMap.set(normalizeKey(groupName), updatedGroup);
      groupMap.set(normalizeKey(updatedGroup.name), updatedGroup);
      summary.groupsUpdated += 1;
      continue;
    }

    const createdGroup = await db.group.create({
      data: groupData,
      select: {
        id: true,
        name: true,
      },
    });

    groupMap.set(normalizeKey(groupName), createdGroup);
    summary.groupsCreated += 1;
  }

  for (const student of students) {
    const phone = normalizePhone(student.phone);
    const parentPhone = normalizePhone(student.parent_phone);

    if (!student.first_name.trim() || !student.last_name.trim() || !parentPhone) {
      summary.warnings.push(`Skipped student with missing required fields: ${JSON.stringify(student)}`);
      continue;
    }

    const existingStudent = await db.student.findFirst({
      where: {
        OR: [
          { parentPhone },
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    const studentData = {
      firstName: student.first_name.trim(),
      lastName: student.last_name.trim(),
      phone: emptyToNull(phone),
      parentPhone,
      parentName: emptyToNull(student.parent_name),
      notes: emptyToNull(student.notes),
      status: parseStudentStatus(student.status),
    };

    if (existingStudent) {
      const updatedStudent = await db.student.update({
        where: { id: existingStudent.id },
        data: studentData,
        select: {
          id: true,
        },
      });

      studentMap.set(parentPhone, updatedStudent);
      if (phone) {
        studentMap.set(phone, updatedStudent);
      }
      summary.studentsUpdated += 1;
      continue;
    }

    const createdStudent = await db.student.create({
      data: studentData,
      select: {
        id: true,
      },
    });

    studentMap.set(parentPhone, createdStudent);
    if (phone) {
      studentMap.set(phone, createdStudent);
    }
    summary.studentsCreated += 1;
  }

  for (const link of links) {
    const studentKey = normalizePhone(link.student_phone_or_parent_phone);
    const group = groupMap.get(normalizeKey(link.group_name.trim()));
    const student = studentMap.get(studentKey);

    if (!group) {
      summary.warnings.push(`Group not found for link: ${JSON.stringify(link)}`);
      continue;
    }

    if (!student) {
      summary.warnings.push(`Student not found for link: ${JSON.stringify(link)}`);
      continue;
    }

    const existingLink = await db.groupStudent.findUnique({
      where: {
        groupId_studentId: {
          groupId: group.id,
          studentId: student.id,
        },
      },
      select: {
        id: true,
        leftAt: true,
      },
    });

    if (existingLink) {
      if (existingLink.leftAt) {
        await db.groupStudent.update({
          where: { id: existingLink.id },
          data: {
            leftAt: null,
            joinedAt: parseJoinedAt(link.joined_at),
          },
        });
        summary.linksReactivated += 1;
      }

      continue;
    }

    await db.groupStudent.create({
      data: {
        groupId: group.id,
        studentId: student.id,
        joinedAt: parseJoinedAt(link.joined_at),
      },
    });

    summary.linksCreated += 1;
  }

  console.log("Generated CSV import completed");
  console.log(`Input directory: ${inputDir}`);
  console.log(`Teachers created: ${summary.teachersCreated}`);
  console.log(`Teachers matched/updated: ${summary.teachersUpdated}`);
  console.log(`Groups created: ${summary.groupsCreated}`);
  console.log(`Groups updated: ${summary.groupsUpdated}`);
  console.log(`Students created: ${summary.studentsCreated}`);
  console.log(`Students updated: ${summary.studentsUpdated}`);
  console.log(`Group links created: ${summary.linksCreated}`);
  console.log(`Group links reactivated: ${summary.linksReactivated}`);

  if (summary.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

function readCsv<T extends Record<string, string>>(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(content);

  if (rows.length === 0) {
    return [] as T[];
  }

  const [headers, ...dataRows] = rows;

  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};

      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });

      return record as T;
    });
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseBoolean(value: string, fallback: boolean) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return fallback;
}

function parseDecimal(value: string, fallback: number) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseScheduleDays(value: string) {
  return value
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
}

function parseStudentStatus(value: string) {
  const normalizedValue = value.trim().toUpperCase();

  if (
    normalizedValue === StudentStatus.ACTIVE ||
    normalizedValue === StudentStatus.INACTIVE ||
    normalizedValue === StudentStatus.GRADUATED
  ) {
    return normalizedValue;
  }

  return StudentStatus.ACTIVE;
}

function parseJoinedAt(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return new Date();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeKey(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeGroupName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

main()
  .catch((error) => {
    console.error("Generated CSV import failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
