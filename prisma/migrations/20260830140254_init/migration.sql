-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HolidaySource" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('weekday', 'saturday', 'sunday', 'public_holiday');

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "commission_threshold" DECIMAL(10,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "source" "HolidaySource" NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "eftpos_amount" DECIMAL(10,2) NOT NULL,
    "cash_amount" DECIMAL(10,2) NOT NULL,
    "clock_in" TIME(0) NOT NULL,
    "clock_out" TIME(0) NOT NULL,
    "base_hourly_wage" DECIMAL(10,2) NOT NULL,
    "day_type" "DayType" NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "extra_commission" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transport_reason_used" BOOLEAN NOT NULL DEFAULT false,
    "public_holiday" BOOLEAN NOT NULL DEFAULT false,
    "transport_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_wage" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_key" ON "public_holidays"("date");

-- CreateIndex
CREATE INDEX "submissions_employee_id_idx" ON "submissions"("employee_id");

-- CreateIndex
CREATE INDEX "submissions_store_id_idx" ON "submissions"("store_id");

-- CreateIndex
CREATE INDEX "submissions_date_idx" ON "submissions"("date");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

