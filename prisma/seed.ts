import { PrismaClient, Prisma, Role, StudentStatus } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { calculatePaymentStatus, getPaymentDueDate, normalizeBillingMonth } from "../lib/payments";

const db = new PrismaClient();

async function main() {
  const currentMonth = normalizeBillingMonth(new Date());
  const previousMonth = normalizeBillingMonth(
    new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1)),
  );

  await db.attendance.deleteMany();
  await db.lessonSession.deleteMany();
  await db.payment.deleteMany();
  await db.groupStudent.deleteMany();
  await db.group.deleteMany();
  await db.student.deleteMany();
  await db.user.deleteMany();

  const owner = await db.user.create({
    data: {
      username: "owner_sangplus",
      fullName: "Akmaljon Rahimov",
      role: Role.OWNER,
      isActive: true,
      passwordHash: hashPassword("Owner123"),
    },
  });

  const manager = await db.user.create({
    data: {
      username: "manager_sangplus",
      fullName: "Nodira Karimova",
      role: Role.MANAGER,
      isActive: true,
      passwordHash: hashPassword("Manager123"),
    },
  });

  const teacher = await db.user.create({
    data: {
      username: "teacher_diyora",
      fullName: "Diyora Xasanova",
      role: Role.TEACHER,
      isActive: true,
      passwordHash: hashPassword("Teacher123"),
    },
  });

  const biologyGroup = await db.group.create({
    data: {
      name: "Bio-1",
      subject: "Biologiya",
      scheduleDays: ["Dushanba", "Chorshanba", "Juma"],
      startTime: "16:00",
      endTime: "18:00",
      monthlyFee: new Prisma.Decimal(450000),
      isActive: true,
      teacherId: teacher.id,
    },
  });

  const chemistryGroup = await db.group.create({
    data: {
      name: "Kimyo-1",
      subject: "Kimyo",
      scheduleDays: ["Seshanba", "Payshanba", "Shanba"],
      startTime: "15:30",
      endTime: "17:30",
      monthlyFee: new Prisma.Decimal(480000),
      isActive: true,
      teacherId: teacher.id,
    },
  });

  const intensiveGroup = await db.group.create({
    data: {
      name: "Med-Intensiv",
      subject: "Biologiya + Kimyo",
      scheduleDays: ["Dushanba", "Seshanba", "Payshanba", "Shanba"],
      startTime: "18:30",
      endTime: "20:00",
      monthlyFee: new Prisma.Decimal(650000),
      isActive: true,
      teacherId: teacher.id,
    },
  });

  const students = await Promise.all([
    db.student.create({
      data: {
        firstName: "Malika",
        lastName: "Tursunova",
        phone: "998901112233",
        parentPhone: "998901110001",
        parentName: "Dilfuza opa",
        status: StudentStatus.ACTIVE,
        notes: "Tibbiyot yo'nalishiga tayyorlanmoqda",
      },
    }),
    db.student.create({
      data: {
        firstName: "Javohir",
        lastName: "Rasulov",
        phone: "998901112244",
        parentPhone: "998901110002",
        parentName: "Rustam aka",
        status: StudentStatus.ACTIVE,
      },
    }),
    db.student.create({
      data: {
        firstName: "Shahzoda",
        lastName: "Nematova",
        phone: "998901112255",
        parentPhone: "998901110003",
        parentName: "Gulnora opa",
        status: StudentStatus.ACTIVE,
      },
    }),
    db.student.create({
      data: {
        firstName: "Bekzod",
        lastName: "Qodirov",
        phone: "998901112266",
        parentPhone: "998901110004",
        parentName: "Zarina opa",
        status: StudentStatus.ACTIVE,
      },
    }),
    db.student.create({
      data: {
        firstName: "Aziza",
        lastName: "To'xtayeva",
        phone: "998901112277",
        parentPhone: "998901110005",
        parentName: "Mavluda opa",
        status: StudentStatus.ACTIVE,
      },
    }),
    db.student.create({
      data: {
        firstName: "Sardor",
        lastName: "Yo'ldoshev",
        phone: "998901112288",
        parentPhone: "998901110006",
        parentName: "Anvar aka",
        status: StudentStatus.ACTIVE,
      },
    }),
  ]);

  await db.groupStudent.createMany({
    data: [
      { groupId: biologyGroup.id, studentId: students[0].id },
      { groupId: biologyGroup.id, studentId: students[1].id },
      { groupId: biologyGroup.id, studentId: students[2].id },
      { groupId: chemistryGroup.id, studentId: students[2].id },
      { groupId: chemistryGroup.id, studentId: students[3].id },
      { groupId: chemistryGroup.id, studentId: students[4].id },
      { groupId: intensiveGroup.id, studentId: students[0].id },
      { groupId: intensiveGroup.id, studentId: students[5].id },
    ],
  });

  const biologyLesson = await db.lessonSession.create({
    data: {
      groupId: biologyGroup.id,
      startedById: teacher.id,
      lessonDate: new Date(Date.UTC(2026, 2, 23)),
      notes: "Hujayra va genetika mavzusi",
    },
  });

  const chemistryLesson = await db.lessonSession.create({
    data: {
      groupId: chemistryGroup.id,
      startedById: teacher.id,
      lessonDate: new Date(Date.UTC(2026, 2, 22)),
      notes: "Organik kimyo kirish darsi",
    },
  });

  await db.attendance.createMany({
    data: [
      {
        lessonId: biologyLesson.id,
        studentId: students[0].id,
        markedById: teacher.id,
        status: "PRESENT",
      },
      {
        lessonId: biologyLesson.id,
        studentId: students[1].id,
        markedById: teacher.id,
        status: "LATE",
      },
      {
        lessonId: biologyLesson.id,
        studentId: students[2].id,
        markedById: teacher.id,
        status: "ABSENT",
      },
      {
        lessonId: chemistryLesson.id,
        studentId: students[2].id,
        markedById: teacher.id,
        status: "PRESENT",
      },
      {
        lessonId: chemistryLesson.id,
        studentId: students[3].id,
        markedById: teacher.id,
        status: "EXCUSED",
      },
      {
        lessonId: chemistryLesson.id,
        studentId: students[4].id,
        markedById: teacher.id,
        status: "PRESENT",
      },
    ],
  });

  await createPayment({
    studentId: students[0].id,
    groupId: biologyGroup.id,
    amount: 450000,
    paidAmount: 450000,
    billingMonth: currentMonth,
  });

  await createPayment({
    studentId: students[1].id,
    groupId: biologyGroup.id,
    amount: 450000,
    paidAmount: 200000,
    billingMonth: currentMonth,
  });

  await createPayment({
    studentId: students[2].id,
    groupId: biologyGroup.id,
    amount: 450000,
    paidAmount: 0,
    billingMonth: previousMonth,
  });

  await createPayment({
    studentId: students[3].id,
    groupId: chemistryGroup.id,
    amount: 480000,
    paidAmount: 480000,
    billingMonth: currentMonth,
  });

  await createPayment({
    studentId: students[4].id,
    groupId: chemistryGroup.id,
    amount: 480000,
    paidAmount: 0,
    billingMonth: currentMonth,
  });

  await createPayment({
    studentId: students[5].id,
    groupId: intensiveGroup.id,
    amount: 650000,
    paidAmount: 300000,
    billingMonth: previousMonth,
  });

  console.log("Seed completed");
  console.log("OWNER: owner_sangplus / Owner123");
  console.log("MANAGER: manager_sangplus / Manager123");
  console.log("TEACHER: teacher_diyora / Teacher123");
  console.log(`Users created by seed: ${owner.username}, ${manager.username}, ${teacher.username}`);
}

async function createPayment(input: {
  studentId: string;
  groupId: string;
  amount: number;
  paidAmount: number;
  billingMonth: Date;
}) {
  const dueDate = getPaymentDueDate(input.billingMonth);

  return db.payment.create({
    data: {
      studentId: input.studentId,
      groupId: input.groupId,
      billingMonth: input.billingMonth,
      dueDate,
      amount: new Prisma.Decimal(input.amount),
      paidAmount: new Prisma.Decimal(input.paidAmount),
      status: calculatePaymentStatus({
        amount: input.amount,
        paidAmount: input.paidAmount,
        dueDate,
      }),
      paidAt: input.paidAmount > 0 ? new Date() : null,
    },
  });
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
