import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const employeeNames = ["Alex Nguyen", "Jordan Smith", "Priya Patel"];
  for (const name of employeeNames) {
    const existing = await prisma.employee.findFirst({ where: { name } });
    if (!existing) {
      await prisma.employee.create({ data: { name } });
    }
  }

  const stores = [
    { name: "Westfield Store", commissionThreshold: 500, commissionRate: 0.05 },
    { name: "City Store", commissionThreshold: 800, commissionRate: 0.07 },
  ];
  for (const store of stores) {
    const existing = await prisma.store.findFirst({ where: { name: store.name } });
    if (!existing) {
      await prisma.store.create({ data: store });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
