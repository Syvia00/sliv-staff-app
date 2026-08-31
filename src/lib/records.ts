import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseUTCDateOnly } from "@/lib/date-utils";

export type RecordsFilter = {
  dateFrom?: string; // "YYYY-MM-DD"
  dateTo?: string; // "YYYY-MM-DD", inclusive
  employeeId?: number;
  storeId?: number;
};

function buildSubmissionWhere(filter: RecordsFilter): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {};
  const date: Prisma.DateTimeFilter = {};
  if (filter.dateFrom) date.gte = parseUTCDateOnly(filter.dateFrom);
  if (filter.dateTo) {
    const end = parseUTCDateOnly(filter.dateTo);
    end.setUTCDate(end.getUTCDate() + 1); // inclusive end-of-day
    date.lt = end;
  }
  if (date.gte || date.lt) where.date = date;
  if (filter.employeeId) where.employeeId = filter.employeeId;
  if (filter.storeId) where.storeId = filter.storeId;
  return where;
}

export async function fetchFilteredSubmissions(filter: RecordsFilter) {
  return prisma.submission.findMany({
    where: buildSubmissionWhere(filter),
    include: { employee: true, store: true },
    orderBy: { date: "desc" },
  });
}
