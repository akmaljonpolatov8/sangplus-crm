import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/rbac";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the first-of-month Date for a given year + month (0-based). */
function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

/**
 * Given a membership start date and a reference "as-of" date,
 * return the list of month-start Dates that should have been paid.
 *
 * A month is considered due if the 15th of that month is before asOf.
 */
function expectedMonths(joinedAt: Date, asOf: Date): Date[] {
  const months: Date[] = [];

  // Start from the joined month
  let year = joinedAt.getUTCFullYear();
  let month = joinedAt.getUTCMonth(); // 0-based

  while (true) {
    const dueDate = new Date(Date.UTC(year, month, 15)); // 15th of the month
    if (dueDate > asOf) break;

    months.push(monthStart(year, month));

    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }

  return months;
}

// ---------------------------------------------------------------------------
// GET /api/overdue
// Query param: asOf=YYYY-MM-DD (default: today)
//
// Returns students with unpaid months after the 15th due date.
// TEACHER has no access; OWNER/MANAGER only.
// Note: amountCents is omitted for MANAGER (same masking rule as payments).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  if (auth.user.role === "TEACHER") {
    return Response.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const asOfParam = searchParams.get("asOf");
  const asOf = asOfParam ? new Date(asOfParam) : new Date();

  // Fetch all active group memberships with their group's fee
  const memberships = await prisma.groupStudent.findMany({
    include: {
      group: { select: { id: true, name: true, monthlyFeeCents: true, status: true } },
      student: { select: { id: true, fullName: true, phone: true, status: true } },
    },
  });

  // Fetch all existing payments up to asOf
  const payments = await prisma.payment.findMany({
    where: { forMonth: { lte: asOf } },
    select: { studentId: true, groupId: true, forMonth: true, amountCents: true },
  });

  // Build a Set of paid (studentId, groupId, forMonth) tuples for O(1) lookup
  const paidSet = new Set(
    payments.map(
      (p) =>
        `${p.studentId}|${p.groupId}|${p.forMonth.toISOString().slice(0, 10)}`
    )
  );

  // Aggregate overdue by student
  const overdueMap = new Map<
    string,
    {
      studentId: string;
      fullName: string;
      phone: string | null;
      studentStatus: string;
      groups: {
        groupId: string;
        groupName: string;
        overdueMonths: string[];
        debtCents: number;
      }[];
      totalDebtCents: number;
    }
  >();

  for (const membership of memberships) {
    const { student, group } = membership;

    // Skip inactive students or groups if desired (still include for completeness)
    const expected = expectedMonths(membership.joinedAt, asOf);

    const overdueMonths: string[] = [];
    for (const m of expected) {
      const key = `${student.id}|${group.id}|${m.toISOString().slice(0, 10)}`;
      if (!paidSet.has(key)) {
        overdueMonths.push(m.toISOString().slice(0, 7)); // YYYY-MM
      }
    }

    if (overdueMonths.length === 0) continue;

    const debtCents = overdueMonths.length * group.monthlyFeeCents;

    if (!overdueMap.has(student.id)) {
      overdueMap.set(student.id, {
        studentId: student.id,
        fullName: student.fullName,
        phone: student.phone,
        studentStatus: student.status,
        groups: [],
        totalDebtCents: 0,
      });
    }

    const entry = overdueMap.get(student.id)!;
    entry.groups.push({
      groupId: group.id,
      groupName: group.name,
      overdueMonths,
      // Only OWNER sees debtCents per group
      debtCents: auth.user.role === "OWNER" ? debtCents : 0,
    });
    entry.totalDebtCents += debtCents;
  }

  // Convert map to array; mask totalDebtCents for MANAGER
  const data = Array.from(overdueMap.values()).map((entry) => ({
    ...entry,
    totalDebtCents: auth.user.role === "OWNER" ? entry.totalDebtCents : undefined,
    groups: entry.groups.map((g) => ({
      ...g,
      debtCents: auth.user.role === "OWNER" ? g.debtCents : undefined,
    })),
  }));

  return Response.json({ data });
}
