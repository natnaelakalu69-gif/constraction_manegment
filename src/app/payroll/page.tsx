"use client";

import { useCallback, useEffect, useState } from "react";
import ModuleManager, { type ModuleSection } from "@/components/module-manager";
import { fetchJson } from "@/lib/client-api";
import type { WagePaymentStatus } from "@/lib/domain";

const sections: ModuleSection[] = [
  {
    key: "workforce",
    title: "Worker rates",
    description: "Enterprise workers and their default daily rates for wage calculation.",
    endpoint: "/api/modules/workforce",
    fields: [
      { name: "workerCode", label: "Worker code", required: true, format: "businessCode" },
      { name: "fullName", label: "Full name", required: true },
      { name: "phone", label: "Phone", format: "phone" },
      { name: "employmentType", label: "Employment type", type: "select", options: ["employee", "day_labor", "contractor"] },
      { name: "dailyRate", label: "Daily rate", type: "number" },
    ],
    columns: [
      { key: "workerCode", label: "Code" }, { key: "fullName", label: "Worker" },
      { key: "employmentType", label: "Type" }, { key: "dailyRate", label: "Daily rate" },
    ],
  },
  {
    key: "day-labor-wages",
    title: "Daily labor wages",
    description: "Salary is calculated as days × rate + overtime − deductions. Net pay is stored as the total.",
    endpoint: "/api/modules/day-labor-wages",
    fields: [
      { name: "workerId", label: "Worker", type: "select", optionsFrom: "/api/modules/workforce", optionLabel: "displayLabel", required: true },
      { name: "periodStart", label: "Period start", type: "date", required: true },
      { name: "periodEnd", label: "Period end", type: "date", required: true },
      { name: "workingDays", label: "Working days", type: "number", required: true },
      { name: "dailyRate", label: "Daily rate", type: "number", required: true },
      { name: "overtimeHours", label: "Overtime hours", type: "number" },
      { name: "overtimeRate", label: "Overtime rate", type: "number", placeholder: "Blank = 1.5× hourly rate" },
      { name: "approvedOvertime", label: "Approved overtime amount", type: "number", placeholder: "Used when hours are not entered" },
      { name: "approvedDeductions", label: "Deductions", type: "number" },
      { name: "status", label: "Approval", type: "select", options: ["draft", "submitted", "approved", "rejected", "cancelled"] },
    ],
    columns: [
      { key: "displayLabel", label: "Worker / period" }, { key: "workingDays", label: "Days" },
      { key: "overtimeHours", label: "OT hours" }, { key: "grossPay", label: "Gross" },
      { key: "deductions", label: "Deductions" }, { key: "netPay", label: "Net pay" },
      { key: "paymentStatusLabel", label: "Payment" },
    ],
  },
  {
    key: "wage-payments",
    title: "Payment history",
    description: "Record payments against a wage period. Paid amount and status update automatically.",
    endpoint: "/api/modules/wage-payments",
    fields: [
      { name: "wageId", label: "Wage period", type: "select", optionsFrom: "/api/modules/day-labor-wages", optionLabel: "displayLabel", required: true },
      { name: "amount", label: "Amount paid", type: "number", required: true },
      { name: "paymentDate", label: "Payment date", type: "date", required: true },
      { name: "method", label: "Method", type: "select", options: ["cash", "bank_transfer", "cheque", "mobile_money"] },
      { name: "reference", label: "Reference" },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "paymentDate", label: "Date" }, { key: "wageLabel", label: "Wage period" },
      { key: "amount", label: "Amount" }, { key: "method", label: "Method" },
      { key: "reference", label: "Reference" },
    ],
  },
];

type Wage = {
  id: number;
  displayLabel: string;
  workingDays: string;
  overtimeHours: string;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  paidAmount: string;
  paymentStatus: WagePaymentStatus;
  paymentStatusLabel: string;
};

type Payment = {
  id: number;
  wageLabel: string;
  amount: string;
  paymentDate: string;
  method: string;
  reference: string | null;
  notes: string | null;
};

function money(value: string | number | null | undefined): string {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PayrollSummary() {
  const [wages, setWages] = useState<Wage[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [wageRows, paymentRows] = await Promise.all([
        fetchJson<Wage[]>("/api/modules/day-labor-wages"),
        fetchJson<Payment[]>("/api/modules/wage-payments"),
      ]);
      setWages(wageRows);
      setPayments(paymentRows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payroll could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    const onChange = () => { void load(); };
    window.addEventListener("module-change", onChange);
    return () => window.removeEventListener("module-change", onChange);
  }, [load]);

  const netTotal = wages.reduce((sum, wage) => sum + wage.netPay, 0);
  const paidTotal = wages.reduce((sum, wage) => sum + Number(wage.paidAmount || 0), 0);
  const outstanding = Math.max(0, netTotal - paidTotal);
  const unpaidWorkers = wages.filter((wage) => wage.paymentStatus !== "paid").length;

  return (
    <section className="management-card">
      <div className="management-card-heading">
        <div>
          <h2>Payroll summary</h2>
          <p>Calculated net pay, amounts paid and outstanding balances by wage period.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void load()}>Refresh summary</button>
      </div>
      {error && <div className="management-message error-message" role="alert">{error}</div>}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="metric-card">
          <div className="metric-caption">TOTAL NET PAY</div>
          <div className="metric-value">{money(netTotal)}</div>
          <div className="metric-footnote">{wages.length} wage periods</div>
        </div>
        <div className="metric-card">
          <div className="metric-caption">PAID</div>
          <div className="metric-value">{money(paidTotal)}</div>
          <div className="metric-footnote">{payments.length} payments recorded</div>
        </div>
        <div className="metric-card metric-card-alert">
          <div className="metric-caption">OUTSTANDING</div>
          <div className="metric-value">{money(outstanding)}</div>
          <div className="metric-footnote">Net pay minus recorded payments</div>
        </div>
        <div className="metric-card">
          <div className="metric-caption">PAYMENT STATUS</div>
          <div className="metric-value">{unpaidWorkers}</div>
          <div className="metric-footnote">Wage periods unpaid or part paid</div>
        </div>
      </div>

      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th scope="col">Worker / period</th><th scope="col">Days</th><th scope="col">OT hours</th>
              <th scope="col">Gross</th><th scope="col">Deductions</th><th scope="col">Net pay</th>
              <th scope="col">Paid</th><th scope="col">Balance</th><th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {wages.map((wage) => {
              const balance = Math.max(0, wage.netPay - Number(wage.paidAmount || 0));
              return (
                <tr key={wage.id}>
                  <td>{wage.displayLabel}</td><td>{wage.workingDays}</td><td>{wage.overtimeHours}</td>
                  <td>{money(wage.grossPay)}</td><td>{money(wage.deductions)}</td>
                  <td><strong>{money(wage.netPay)}</strong></td><td>{money(wage.paidAmount)}</td>
                  <td>{money(balance)}</td>
                  <td><span className={`status-pill status-${wage.paymentStatus}`}>{wage.paymentStatusLabel}</span></td>
                </tr>
              );
            })}
            {wages.length === 0 && <tr><td className="management-empty" colSpan={9}>No wage periods yet. Add workers and daily wages above.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="summary-subheading">Payment history</div>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Wage period</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Reference</th></tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.paymentDate}</td><td>{payment.wageLabel}</td>
                <td><strong>{money(payment.amount)}</strong></td><td>{payment.method}</td>
                <td>{payment.reference ?? "—"}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td className="management-empty" colSpan={5}>No payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PayrollPage() {
  return (
    <>
      <ModuleManager
        title="Payroll & wages"
        subtitle="Daily labor wages, overtime, salary calculation, paid/unpaid status and payment history."
        sections={sections}
      />
      <div className="management-main" style={{ paddingTop: 0 }}>
        <PayrollSummary />
      </div>
    </>
  );
}
