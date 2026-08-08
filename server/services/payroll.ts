/**
 * Payroll calculation — deliberately plain, deterministic business logic,
 * not an LLM call. Attendance records are already structured data by the
 * time they reach here (extracted + human-approved); summing hours and
 * multiplying by a wage rate is exact arithmetic a model has no business
 * being asked to do. Kept out of server/skills/ (reserved for the LLM-backed
 * agent capabilities) to keep that distinction honest in the codebase, not
 * just in prose.
 */

export interface AttendanceRecord {
  id: string;
  fields: {
    workerName?: string | null;
    date?: string | null;
    status?: string | null;
    hoursWorked?: number | null;
  };
}

export interface WorkerPayrollSummary {
  workerName: string;
  totalHours: number;
  daysPresent: number;
  wage: number;
}

export function calculatePayroll(records: AttendanceRecord[], wageRatePerHour: number): WorkerPayrollSummary[] {
  const byWorker = new Map<string, { totalHours: number; daysPresent: number }>();

  for (const record of records) {
    const name = record.fields.workerName?.trim();
    if (!name) continue;

    const hours = record.fields.hoursWorked ?? 0;
    const status = (record.fields.status ?? "").toLowerCase();
    const present = status.includes("present") || status.includes("half") || hours > 0;

    const existing = byWorker.get(name) ?? { totalHours: 0, daysPresent: 0 };
    existing.totalHours += hours;
    if (present) existing.daysPresent += 1;
    byWorker.set(name, existing);
  }

  return Array.from(byWorker.entries())
    .map(([workerName, { totalHours, daysPresent }]) => ({
      workerName,
      totalHours,
      daysPresent,
      wage: Math.round(totalHours * wageRatePerHour * 100) / 100,
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}
