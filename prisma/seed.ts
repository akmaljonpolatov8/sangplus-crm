import { Prisma, PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/password";

const db = new PrismaClient();

async function main() {
  await db.attendance.deleteMany();
  await db.lessonSession.deleteMany();
  await db.payment.deleteMany();
  await db.groupStudent.deleteMany();
  await db.group.deleteMany();
  await db.student.deleteMany();
  await db.user.deleteMany();

  const users = await createUsers();
  const groups = await createGroups(users);

  console.log("Seed completed");
  console.log(`Owner: ${users.owner.username} / Owner_0808`);
  console.log(`Manager: ${users.manager.username} / MA_SP0909`);
  console.log("Teachers:");
  console.log("  - Shoxsanam_SP / Shoxsanam_sang0484");
  console.log("  - Nodirjon_SP / Nodirjon_SP0484");
  console.log("  - Temur_SP / Temur_SP0101");
  console.log("  - Umidjon_SP / Umidjon_1919SP");
  console.log("  - Kamron_SP / SP_Kamron1111");
  console.log(`Groups created: ${groups.map((group) => group.name).join(", ")}`);
}

async function createUsers() {
  const owner = await db.user.create({
    data: buildUser("Owner_SP", "Owner", Role.OWNER, "Owner_0808"),
  });

  const manager = await db.user.create({
    data: buildUser("Manager_SP", "Manager", Role.MANAGER, "MA_SP0909"),
  });

  const shoxsanam = await db.user.create({
    data: buildUser("Shoxsanam_SP", "Shoxsanam", Role.TEACHER, "Shoxsanam_sang0484"),
  });

  const nodirjon = await db.user.create({
    data: buildUser("Nodirjon_SP", "Nodirjon", Role.TEACHER, "Nodirjon_SP0484"),
  });

  const temur = await db.user.create({
    data: buildUser("Temur_SP", "Temur", Role.TEACHER, "Temur_SP0101"),
  });

  const umidjon = await db.user.create({
    data: buildUser("Umidjon_SP", "Umidjon", Role.TEACHER, "Umidjon_1919SP"),
  });

  const kamron = await db.user.create({
    data: buildUser("Kamron_SP", "Kamron", Role.TEACHER, "SP_Kamron1111"),
  });

  return {
    owner,
    manager,
    shoxsanam,
    nodirjon,
    temur,
    umidjon,
    kamron,
  };
}

async function createGroups(users: Awaited<ReturnType<typeof createUsers>>) {
  const groupInputs = [
    {
      name: "Shoxsanam Group",
      teacherId: users.shoxsanam.id,
      subject: "General English",
      scheduleDays: ["Monday", "Wednesday", "Friday"],
      startTime: "09:00",
      endTime: "10:30",
      monthlyFee: 500000,
    },
    {
      name: "Umidjon Group",
      teacherId: users.umidjon.id,
      subject: "Mathematics",
      scheduleDays: ["Tuesday", "Thursday", "Saturday"],
      startTime: "10:00",
      endTime: "11:30",
      monthlyFee: 500000,
    },
    {
      name: "Temur Group",
      teacherId: users.temur.id,
      subject: "Physics",
      scheduleDays: ["Monday", "Wednesday", "Saturday"],
      startTime: "14:00",
      endTime: "15:30",
      monthlyFee: 550000,
    },
    {
      name: "Kamron Group",
      teacherId: users.kamron.id,
      subject: "IELTS",
      scheduleDays: ["Tuesday", "Thursday"],
      startTime: "16:00",
      endTime: "17:30",
      monthlyFee: 600000,
    },
    {
      name: "Kamron2 Group",
      teacherId: users.kamron.id,
      subject: "IELTS",
      scheduleDays: ["Friday", "Sunday"],
      startTime: "18:00",
      endTime: "19:30",
      monthlyFee: 600000,
    },
  ];

  return Promise.all(
    groupInputs.map((group) =>
      db.group.create({
        data: {
          ...group,
          isActive: true,
          monthlyFee: new Prisma.Decimal(group.monthlyFee),
        },
      }),
    ),
  );
}

function buildUser(username: string, fullName: string, role: Role, password: string) {
  return {
    username,
    fullName,
    role,
    isActive: true,
    passwordHash: hashPassword(password),
  };
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
