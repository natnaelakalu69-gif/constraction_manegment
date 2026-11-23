"use client";

import { useCallback, useEffect, useState } from "react";
import ModuleManager, { type ModuleSection } from "@/components/module-manager";
import { PaginationControls, usePagination } from "@/components/pagination";
import { fetchJson } from "@/lib/client-api";
import {
  ASSIGNEE_TYPES, TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus,
} from "@/lib/domain";

const sections: ModuleSection[] = [
  {
    key: "teams",
    title: "Teams",
    description: "Group field workers and name the supervisor responsible for the team.",
    endpoint: "/api/modules/teams",
    fields: [
      { name: "code", label: "Team code", required: true },
      { name: "name", label: "Team name", required: true },
      { name: "supervisorName", label: "Supervisor" },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "code", label: "Code" }, { key: "name", label: "Team" },
      { key: "supervisorName", label: "Supervisor" },
    ],
  },
  {
    key: "team-members",
    title: "Team members",
    description: "Assign enterprise workers to a team. Add workers under Payroll → Worker rates.",
    endpoint: "/api/modules/team-members",
    fields: [
      { name: "teamId", label: "Team", type: "select", optionsFrom: "/api/modules/teams", optionLabel: "displayLabel", required: true },
      { name: "workerId", label: "Worker", type: "select", optionsFrom: "/api/modules/workforce", optionLabel: "displayLabel", required: true },
    ],
    columns: [
      { key: "teamName", label: "Team" }, { key: "workerName", label: "Worker" },
    ],
  },
  {
    key: "work-tasks",
    title: "Work tasks",
    description: "Assign tasks to a worker or a team, set a deadline and track the status.",
    endpoint: "/api/modules/work-tasks",
    fields: [
      { name: "title", label: "Task", required: true },
      { name: "description", label: "Description" },
      { name: "assigneeType", label: "Assign to", type: "select", options: ASSIGNEE_TYPES, required: true },
      { name: "workerId", label: "Worker (if assigned to worker)", type: "select", optionsFrom: "/api/modules/workforce", optionLabel: "displayLabel" },
      { name: "teamId", label: "Team (if assigned to team)", type: "select", optionsFrom: "/api/modules/teams", optionLabel: "displayLabel" },
      { name: "supervisorName", label: "Supervisor", required: true },
      { name: "priority", label: "Priority", type: "select", options: TASK_PRIORITIES },
      { name: "status", label: "Status", type: "select", options: TASK_STATUSES },
      { name: "deadline", label: "Deadline", type: "date" },
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name" },
    ],
    columns: [
      { key: "title", label: "Task" }, { key: "assigneeName", label: "Assigned to" },
      { key: "supervisorName", label: "Supervisor" }, { key: "deadline", label: "Deadline" },
      { key: "statusLabel", label: "Status" }, { key: "priority", label: "Priority" },
    ],
  },
];

type Task = {
  id: number;
  title: string;
  description: string | null;
  assigneeName: string | null;
  supervisorName: string;
  deadline: string | null;
  status: TaskStatus;
  statusLabel: string;
  priority: string;
};

function isOverdue(task: Task): boolean {
  return task.status !== "completed" && !!task.deadline && task.deadline < new Date().toISOString().slice(0, 10);
}

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const pagination = usePagination(tasks.length);
  const visibleTasks = pagination.pageSlice(tasks);

  const load = useCallback(async () => {
    try {
      setTasks(await fetchJson<Task[]>("/api/modules/work-tasks"));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tasks could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    const onChange = () => { void load(); };
    window.addEventListener("module-change", onChange);
    return () => window.removeEventListener("module-change", onChange);
  }, [load]);

  async function changeStatus(task: Task, status: TaskStatus) {
    if (status === task.status) return;
    setBusyId(task.id);
    setError(null);
    try {
      await fetchJson(`/api/modules/work-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The task status could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="management-card">
      <div className="management-card-heading">
        <div>
          <h2>Task board</h2>
          <p>Move tasks between Pending, In Progress and Completed.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void load()}>Refresh board</button>
      </div>
      {error && <div className="management-message error-message" role="alert">{error}</div>}
      <div className="task-board">
        {TASK_STATUSES.map((status) => {
          const items = visibleTasks.filter((task) => task.status === status);
          return (
            <div className="task-column" key={status}>
              <div className="task-column-head">
                <strong>{TASK_STATUS_LABELS[status]}</strong>
                <span>{items.length}</span>
              </div>
              {items.map((task) => (
                <article className="task-card" key={task.id}>
                  <strong>{task.title}</strong>
                  <p>{task.assigneeName ?? "Unassigned"}</p>
                  <div className="task-meta">
                    <span>{task.supervisorName}</span>
                    <span className={isOverdue(task) ? "task-overdue" : undefined}>
                      {task.deadline ? `Due ${task.deadline}` : "No deadline"}
                    </span>
                  </div>
                  <select
                    className="task-status-select"
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={busyId === task.id}
                    onChange={(event) => void changeStatus(task, event.target.value as TaskStatus)}
                  >
                    {TASK_STATUSES.map((option) => (
                      <option value={option} key={option}>{TASK_STATUS_LABELS[option]}</option>
                    ))}
                  </select>
                </article>
              ))}
              {items.length === 0 && <p className="task-empty">No tasks in this stage.</p>}
            </div>
          );
        })}
      </div>
      <PaginationControls pagination={pagination} />
    </section>
  );
}

export default function TasksPage() {
  return (
    <>
      <ModuleManager
        title="Tasks & teams"
        subtitle="Assign work to workers or teams, supervise deadlines and move tasks through completion."
        sections={sections}
      />
      <div className="management-main" style={{ paddingTop: 0 }}>
        <TaskBoard />
      </div>
    </>
  );
}
