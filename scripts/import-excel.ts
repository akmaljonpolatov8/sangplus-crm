import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

type RawRow = {
  Teacher?: string;
  Group?: string;
  "Full Name"?: string;
  "Parent/Info"?: string;
  Phone?: string | number;
};

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

const DEFAULT_TEACHER_PASSWORD = "Teacher123";
const DEFAULT_GROUP_SUBJECT = "General";
const DEFAULT_GROUP_SCHEDULE_DAYS = "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday";
const DEFAULT_GROUP_START_TIME = "08:00";
const DEFAULT_GROUP_END_TIME = "19:00";
const DEFAULT_GROUP_MONTHLY_FEE = "1600000";

const teacherAliases: Record<string, string> = {
  Kamron: "Nodirjon",
  Kamron2: "Kamron",
};

const groupAliases: Record<string, string> = {
  Kamron: "Nodirjon",
  Kamron2: "Kamron 2",
};

function main() {
  const inputPath = process.argv[2];
  const outputDir = process.argv[3] ?? path.join(process.cwd(), "docs", "generated-import");

  if (!inputPath) {
    console.error("Usage: npm run import:excel -- <xlsx-path> [output-dir]");
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath, {
    cellDates: false,
  });
  const sheet = workbook.Sheets["All Students"];

  if (!sheet) {
    console.error('Sheet "All Students" not found');
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false,
  });

  const teachersMap = new Map<string, TeacherRow>();
  const groupsMap = new Map<string, GroupRow>();
  const studentsMap = new Map<string, StudentRow>();
  const linksMap = new Map<string, StudentGroupLinkRow>();
  const warnings = new Set<string>();

  for (const row of rows) {
    const rawTeacher = cleanValue(row.Teacher);
    const rawGroup = cleanValue(row.Group);
    const fullName = cleanValue(row["Full Name"]);
    const parentInfo = cleanValue(row["Parent/Info"]);
    const phone = normalizePhone(row.Phone);

    if (!rawTeacher || !rawGroup || !fullName || !phone) {
      warnings.add(`Skipped row with missing required values: ${JSON.stringify(row)}`);
      continue;
    }

    const teacherName = normalizeAlias(rawTeacher, teacherAliases);
    const groupName = normalizeAlias(rawGroup, groupAliases);
    const teacherUsername = `${toUsername(teacherName)}_sp`;
    const splitName = splitStudentName(fullName);

    teachersMap.set(teacherUsername, {
      username: teacherUsername,
      password: DEFAULT_TEACHER_PASSWORD,
      full_name: teacherName,
      is_active: "true",
    });

    groupsMap.set(groupName, {
      name: `${groupName} Group`,
      subject: DEFAULT_GROUP_SUBJECT,
      schedule_days: DEFAULT_GROUP_SCHEDULE_DAYS,
      start_time: DEFAULT_GROUP_START_TIME,
      end_time: DEFAULT_GROUP_END_TIME,
      monthly_fee: DEFAULT_GROUP_MONTHLY_FEE,
      teacher_username: teacherUsername,
      is_active: "true",
    });

    studentsMap.set(phone, {
      first_name: splitName.firstName,
      last_name: splitName.lastName,
      phone,
      parent_phone: phone,
      parent_name: parentInfo,
      notes: "",
      status: "ACTIVE",
    });

    linksMap.set(`${phone}:${groupName}`, {
      student_phone_or_parent_phone: phone,
      group_name: `${groupName} Group`,
      joined_at: "",
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });

  writeCsv(
    path.join(outputDir, "teachers.csv"),
    ["username", "password", "full_name", "is_active"],
    [...teachersMap.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
  );
  writeCsv(
    path.join(outputDir, "groups.csv"),
    [
      "name",
      "subject",
      "schedule_days",
      "start_time",
      "end_time",
      "monthly_fee",
      "teacher_username",
      "is_active",
    ],
    [...groupsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  writeCsv(
    path.join(outputDir, "students.csv"),
    ["first_name", "last_name", "phone", "parent_phone", "parent_name", "notes", "status"],
    [...studentsMap.values()].sort((a, b) => {
      const byLast = a.last_name.localeCompare(b.last_name);
      return byLast !== 0 ? byLast : a.first_name.localeCompare(b.first_name);
    }),
  );
  writeCsv(
    path.join(outputDir, "student_group_links.csv"),
    ["student_phone_or_parent_phone", "group_name", "joined_at"],
    [...linksMap.values()].sort((a, b) =>
      a.student_phone_or_parent_phone.localeCompare(b.student_phone_or_parent_phone),
    ),
  );

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        sourceFile: inputPath,
        counts: {
          teachers: teachersMap.size,
          groups: groupsMap.size,
          students: studentsMap.size,
          studentGroupLinks: linksMap.size,
        },
        warnings: [...warnings].sort(),
      },
      null,
      2,
    ),
  );

  console.log(`Import preview generated in ${outputDir}`);
  console.log(`Teachers: ${teachersMap.size}`);
  console.log(`Groups: ${groupsMap.size}`);
  console.log(`Students: ${studentsMap.size}`);
  console.log(`Student-group links: ${linksMap.size}`);
}

function cleanValue(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAlias(value: string, aliases: Record<string, string>) {
  return aliases[value] ?? value;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 9) {
    return `998${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("998")) {
    return digits;
  }

  return digits;
}

function toUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitStudentName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(" "),
  };
}

function writeCsv(filePath: string, headers: string[], rows: Array<Record<string, string>>) {
  const content = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(",")),
  ].join("\n");

  fs.writeFileSync(filePath, `${content}\n`);
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

main();
