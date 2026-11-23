import CompanySettingsForm from "@/components/company-settings-form";
import ModuleManager, { type ModuleSection } from "@/components/module-manager";

const sections: ModuleSection[] = [
  {
    key: "projects",
    title: "Projects",
    description: "Project codes, names and statuses available across the workspace.",
    endpoint: "/api/modules/projects",
    fields: [
      { name: "code", label: "Project code", required: true, format: "businessCode" },
      { name: "name", label: "Project name", required: true },
      { name: "clientName", label: "Client" },
      { name: "status", label: "Status", type: "select", options: ["planning", "active", "suspended", "completed", "cancelled"] },
      { name: "budget", label: "Budget", type: "number" },
    ],
    columns: [
      { key: "code", label: "Code" }, { key: "name", label: "Project" },
      { key: "clientName", label: "Client" }, { key: "status", label: "Status" },
    ],
  },
  {
    key: "sites",
    title: "Projects / sites",
    description: "Register the sites where each project's work takes place.",
    endpoint: "/api/modules/sites",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "code", label: "Site code", required: true },
      { name: "name", label: "Site name", required: true },
      { name: "location", label: "Location" },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive", "archived"] },
    ],
    columns: [
      { key: "projectName", label: "Project" }, { key: "code", label: "Code" },
      { key: "name", label: "Site" }, { key: "location", label: "Location" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "departments",
    title: "Departments",
    description: "Organisational departments used to group the workforce.",
    endpoint: "/api/modules/departments",
    fields: [
      { name: "code", label: "Department code", required: true },
      { name: "name", label: "Department name", required: true },
    ],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Department" }],
  },
  {
    key: "shifts",
    title: "Work shifts",
    description: "Start, end and break times for each working shift.",
    endpoint: "/api/modules/shifts",
    fields: [
      { name: "name", label: "Shift name", required: true, placeholder: "Day shift" },
      { name: "startsAt", label: "Starts at", required: true, placeholder: "08:00" },
      { name: "endsAt", label: "Ends at", required: true, placeholder: "17:00" },
      { name: "breakMinutes", label: "Break (minutes)", type: "number" },
    ],
    columns: [
      { key: "name", label: "Shift" }, { key: "startsAt", label: "Starts" },
      { key: "endsAt", label: "Ends" }, { key: "breakMinutes", label: "Break" },
    ],
  },
  {
    key: "attendance-rules",
    title: "Attendance rules",
    description: "Lateness, early leave, overtime and absence thresholds.",
    endpoint: "/api/modules/attendance-rules",
    fields: [
      { name: "name", label: "Rule name", required: true },
      { name: "shiftId", label: "Shift", type: "select", optionsFrom: "/api/modules/shifts", optionLabel: "name" },
      { name: "lateAfterMinutes", label: "Late after (minutes)", type: "number" },
      { name: "earlyLeaveAfterMinutes", label: "Early leave after (minutes)", type: "number" },
      { name: "overtimeStartsAfterMinutes", label: "Overtime after (minutes)", type: "number" },
      { name: "standardHoursPerDay", label: "Standard hours / day", type: "number" },
      { name: "markAbsentAfterMinutes", label: "Mark absent after (minutes)", type: "number" },
      { name: "isActive", label: "Active", type: "select", options: ["true", "false"] },
    ],
    columns: [
      { key: "name", label: "Rule" }, { key: "shiftId", label: "Shift ID" },
      { key: "lateAfterMinutes", label: "Late after" },
      { key: "standardHoursPerDay", label: "Hours / day" },
      { key: "isActive", label: "Active" },
    ],
  },
  {
    key: "wage-settings",
    title: "Wage settings",
    description: "The active configuration drives overtime rates in payroll calculations.",
    endpoint: "/api/modules/wage-settings",
    fields: [
      { name: "name", label: "Configuration name", required: true },
      { name: "currency", label: "Currency", placeholder: "ETB" },
      { name: "regularHoursPerDay", label: "Regular hours / day", type: "number" },
      { name: "overtimeMultiplier", label: "Overtime multiplier", type: "number" },
      { name: "paymentFrequency", label: "Payment frequency", type: "select", options: ["daily", "weekly", "biweekly", "monthly"] },
      { name: "defaultDailyRate", label: "Default daily rate", type: "number" },
      { name: "isActive", label: "Active", type: "select", options: ["true", "false"] },
    ],
    columns: [
      { key: "name", label: "Configuration" }, { key: "currency", label: "Currency" },
      { key: "regularHoursPerDay", label: "Hours / day" },
      { key: "overtimeMultiplier", label: "OT multiplier" },
      { key: "paymentFrequency", label: "Frequency" },
      { key: "isActive", label: "Active" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <ModuleManager
      title="Settings"
      subtitle="Company profile, projects and sites, departments, shifts, attendance rules and wage configuration."
      sections={sections}
    >
      <CompanySettingsForm />
    </ModuleManager>
  );
}
