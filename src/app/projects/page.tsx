import ModuleManager, { type ModuleSection } from "@/components/module-manager";

const sections: ModuleSection[] = [
  {
    key: "projects",
    title: "Projects",
    description: "Track project codes, statuses, dates and budgets.",
    endpoint: "/api/modules/projects",
    fields: [
      { name: "code", label: "Project code", required: true },
      { name: "name", label: "Project name", required: true },
      { name: "clientName", label: "Client" },
      { name: "location", label: "Location" },
      { name: "status", label: "Status", type: "select", options: ["planning", "active", "suspended", "completed", "cancelled"] },
      { name: "budget", label: "Budget", type: "number" },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "plannedEndDate", label: "Planned end", type: "date" },
    ],
    columns: [
      { key: "code", label: "Code" }, { key: "name", label: "Project" },
      { key: "clientName", label: "Client" }, { key: "status", label: "Status" },
      { key: "budget", label: "Budget" }, { key: "plannedEndDate", label: "Planned end" },
    ],
  },
  {
    key: "work-packages",
    title: "Work packages",
    description: "Break projects into measurable packages of work.",
    endpoint: "/api/modules/work-packages",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "code", label: "Package code", required: true },
      { name: "name", label: "Package name", required: true },
      { name: "unit", label: "Unit", required: true, placeholder: "m3, hrs, pcs" },
      { name: "plannedQuantity", label: "Planned quantity", type: "number" },
      { name: "plannedStart", label: "Planned start", type: "date" },
      { name: "plannedEnd", label: "Planned end", type: "date" },
    ],
    columns: [
      { key: "projectId", label: "Project ID" }, { key: "code", label: "Code" },
      { key: "name", label: "Work package" }, { key: "plannedQuantity", label: "Planned qty" },
      { key: "unit", label: "Unit" }, { key: "plannedEnd", label: "Planned end" },
    ],
  },
  {
    key: "progress-records",
    title: "Progress records",
    description: "Record quantities completed against each work package.",
    endpoint: "/api/modules/progress-records",
    fields: [
      { name: "workPackageId", label: "Work package", type: "select", optionsFrom: "/api/modules/work-packages", optionLabel: "name", required: true },
      { name: "recordedOn", label: "Recorded on", type: "date", required: true },
      { name: "quantityCompleted", label: "Quantity completed", type: "number", required: true },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "workPackageId", label: "Package ID" }, { key: "recordedOn", label: "Recorded on" },
      { key: "quantityCompleted", label: "Completed" }, { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "budgets",
    title: "Project budgets",
    description: "Maintain cost-code budgets for each project.",
    endpoint: "/api/modules/budgets",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "costCode", label: "Cost code", required: true },
      { name: "description", label: "Description", required: true },
      { name: "plannedAmount", label: "Planned amount", type: "number", required: true },
    ],
    columns: [
      { key: "projectId", label: "Project ID" }, { key: "costCode", label: "Cost code" },
      { key: "description", label: "Description" }, { key: "plannedAmount", label: "Planned amount" },
    ],
  },
  {
    key: "project-costs",
    title: "Project costs",
    description: "Log actual costs incurred on projects.",
    endpoint: "/api/modules/project-costs",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "category", label: "Category", required: true },
      { name: "description", label: "Description" },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "incurredOn", label: "Incurred on", type: "date", required: true },
      { name: "reference", label: "Reference" },
    ],
    columns: [
      { key: "projectId", label: "Project ID" }, { key: "category", label: "Category" },
      { key: "description", label: "Description" }, { key: "amount", label: "Amount" },
      { key: "incurredOn", label: "Incurred on" },
    ],
  },
];

export default function ProjectsPage() {
  return (
    <ModuleManager
      title="Project controls"
      subtitle="Projects, work packages, progress, budgets and costs in one workspace."
      sections={sections}
    />
  );
}
