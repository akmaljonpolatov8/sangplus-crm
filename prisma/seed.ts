/**
 * Minimal seed script for SangPlus CRM.
 * Creates an OWNER user so you can log in immediately after migration.
 *
 * Usage:
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("owner123", 12);

  const owner = await prisma.user.upsert({
    where: { username: "owner" },
    update: {},
    create: {
      username: "owner",
      passwordHash,
      role: "OWNER",
    },
  });

  console.log(`✅ Seed complete. Owner user: ${owner.username} (password: owner123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
