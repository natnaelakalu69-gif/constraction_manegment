import ModuleManager, { type ModuleSection } from "@/components/module-manager";

const sections: ModuleSection[] = [
  {
    key: "safety-inspections",
    title: "Safety inspections",
    description: "Record hazards, incidents observed, and corrective actions from site inspections.",
    endpoint: "/api/modules/safety-inspections",
    fields: [
      { name: "inspectionDate", label: "Inspection date", type: "date", required: true },
      { name: "inspectorName", label: "Inspector", required: true },
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name" },
      { name: "hazards", label: "Hazards identified" },
      { name: "incidentsObserved", label: "Incidents observed" },
      { name: "correctiveActions", label: "Corrective actions" },
      { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "rejected", "cancelled"] },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "inspectionDate", label: "Date" }, { key: "inspectorName", label: "Inspector" },
      { key: "hazards", label: "Hazards" }, { key: "incidentsObserved", label: "Incidents observed" },
      { key: "correctiveActions", label: "Corrective actions" }, { key: "status", label: "Status" },
    ],
  },
  {
    key: "safety-incidents",
    title: "Safety incidents",
    description: "Record and review incidents with severity and status.",
    endpoint: "/api/modules/safety-incidents",
    fields: [
      { name: "incidentNumber", label: "Incident number", required: true },
      { name: "incidentType", label: "Incident type", required: true },
      { name: "occurredAt", label: "Occurred at", type: "datetime-local", required: true },
      { name: "severity", label: "Severity", type: "select", options: ["low", "medium", "high", "critical"] },
      { name: "description", label: "Description", required: true },
      { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "rejected", "cancelled"] },
    ],
    columns: [
      { key: "incidentNumber", label: "Number" }, { key: "incidentType", label: "Type" },
      { key: "occurredAt", label: "Occurred at" }, { key: "severity", label: "Severity" },
      { key: "status", label: "Status" }, { key: "description", label: "Description" },
    ],
  },
  {
    key: "quality-inspections",
    title: "Quality inspections",
    description: "Schedule and record inspection results by project.",
    endpoint: "/api/modules/quality-inspections",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "inspectionDate", label: "Inspection date", type: "date", required: true },
      { name: "result", label: "Result", type: "select", options: ["pass", "fail", "conditional"], required: true },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "projectId", label: "Project ID" }, { key: "inspectionDate", label: "Date" },
      { key: "result", label: "Result" }, { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "quality-defects",
    title: "Quality defects",
    description: "Track defects raised during inspections through to closure.",
    endpoint: "/api/modules/quality-defects",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "inspectionId", label: "Inspection", type: "select", optionsFrom: "/api/modules/quality-inspections", optionLabel: "inspectionDate" },
      { name: "title", label: "Defect title", required: true },
      { name: "description", label: "Description" },
      { name: "severity", label: "Severity", type: "select", options: ["low", "medium", "high", "critical"] },
      { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "rejected", "cancelled"] },
      { name: "dueDate", label: "Due date", type: "date" },
    ],
    columns: [
      { key: "projectId", label: "Project ID" }, { key: "title", label: "Defect" },
      { key: "severity", label: "Severity" }, { key: "status", label: "Status" },
      { key: "dueDate", label: "Due date" },
    ],
  },
];

export default function SafetyPage() {
  return (
    <ModuleManager
      title="Safety & quality"
      subtitle="Record safety inspections, hazards, incidents, corrective actions and quality checks."
      sections={sections}
    />
  );
}
