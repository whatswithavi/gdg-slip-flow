/**
 * Register type definitions — the config-driven core of the "any paper-heavy
 * business" pitch. Adding a new paper form the extraction agent can handle
 * is a new entry here, not new agent/prompt code: this file is what makes
 * the extraction pattern reusable across companies/industries rather than
 * hardcoded to one factory's intake slip.
 */

export type FieldType = "string" | "number" | "date";

export interface RegisterField {
  key: string;
  label: string;
  type: FieldType;
}

export interface RegisterTypeConfig {
  id: string;
  label: string;
  /** Describes the paper document to the extraction model. */
  description: string;
  fields: RegisterField[];
}

export const REGISTER_TYPES: Record<string, RegisterTypeConfig> = {
  intake: {
    id: "intake",
    label: "Raw Material Intake",
    description: "a handwritten raw-material intake slip recording material received from a supplier",
    fields: [
      { key: "item", label: "Item / Material", type: "string" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit", label: "Unit", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "supplier", label: "Supplier", type: "string" },
    ],
  },
  production: {
    id: "production",
    label: "Production / Batch Log",
    description: "a handwritten production or batch log recording what was processed during a shift",
    fields: [
      { key: "batchId", label: "Batch ID", type: "string" },
      { key: "material", label: "Material", type: "string" },
      { key: "outputQuantity", label: "Output Quantity", type: "number" },
      { key: "wastageQuantity", label: "Wastage Quantity", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "shift", label: "Shift", type: "string" },
    ],
  },
  dispatch: {
    id: "dispatch",
    label: "Dispatch / Sales",
    description: "a handwritten dispatch or sales note recording goods sent out to a buyer",
    fields: [
      { key: "item", label: "Item", type: "string" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit", label: "Unit", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "buyer", label: "Buyer", type: "string" },
      { key: "vehicleNumber", label: "Vehicle Number", type: "string" },
    ],
  },
  attendance: {
    id: "attendance",
    label: "Worker Attendance",
    description: "a handwritten daily attendance register recording which workers were present",
    fields: [
      { key: "workerName", label: "Worker Name", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status (present/absent/half-day)", type: "string" },
      { key: "hoursWorked", label: "Hours Worked", type: "number" },
    ],
  },
  expense: {
    id: "expense",
    label: "Expense Voucher",
    description: "a handwritten expense voucher recording a business expense",
    fields: [
      { key: "description", label: "Description", type: "string" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
    ],
  },
};

export function getRegisterType(id: string): RegisterTypeConfig {
  const config = REGISTER_TYPES[id];
  if (!config) {
    throw new Error(`Unknown register type: ${id}`);
  }
  return config;
}

// Single default company for this demo — every record carries this field
// so the data model is genuinely multi-tenant-ready (add a company picker
// and auth later) without having built full tenant isolation/auth for the
// hackathon submission.
export const DEFAULT_COMPANY_ID = "demo-factory";
