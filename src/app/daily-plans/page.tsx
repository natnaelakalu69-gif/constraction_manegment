import ModuleManager, { type ModuleSection } from "@/components/module-manager";

const sections: ModuleSection[] = [
  {
    key: "daily-plans",
    title: "Daily plans",
    description: "Project manager creates daily plans with assigned supervisor and required resources.",
    endpoint: "/api/modules/daily-plans",
    fields: [
      { name: "planDate", label: "Plan date", type: "date", required: true },
      { name: "supervisorName", label: "Site supervisor", required: true },
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name" },
      { name: "requiredResources", label: "Required resources" },
      { name: "notes", label: "Notes" },
      { name: "status", label: "Status", type: "select", options: ["draft", "submitted", "approved", "rejected", "cancelled"] },
    ],
    columns: [
      { key: "planDate", label: "Date" }, { key: "supervisorName", label: "Supervisor" },
      { key: "projectId", label: "Project ID" }, { key: "requiredResources", label: "Resources" },
      { key: "status", label: "Status" }, { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "daily-plan-tasks",
    title: "Plan tasks",
    description: "Assign tasks, deadlines, site supervisors/assignees, and required resources for each plan.",
    endpoint: "/api/modules/daily-plan-tasks",
    fields: [
      { name: "planId", label: "Daily plan", type: "select", optionsFrom: "/api/modules/daily-plans", optionLabel: "planDate", required: true },
      { name: "task", label: "Task", required: true },
      { name: "deadline", label: "Deadline", type: "date" },
      { name: "assignee", label: "Assignee / site supervisor" },
      { name: "requiredResources", label: "Required resources" },
      { name: "status", label: "Status", type: "select", options: ["planned", "in_progress", "done", "blocked"] },
    ],
    columns: [
      { key: "planId", label: "Plan ID" }, { key: "task", label: "Task" },
      { key: "deadline", label: "Deadline" }, { key: "assignee", label: "Assignee" },
      { key: "requiredResources", label: "Resources" }, { key: "status", label: "Status" },
    ],
  },
];

export default function DailyPlansPage() {
  return (
    <ModuleManager
      title="Daily plans"
      subtitle="Create daily plans and assign tasks, deadlines, supervisors, and required resources."
      sections={sections}
    />
  );
}
