"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useAppStore } from "@/app/store/useAppStore";

export default function TasksPage() {
const tasks = useAppStore((s) => s.tasks);
const toggleTask = useAppStore((s) => s.toggleTask);

const open = tasks.filter((task) => !task.completed);
const done = tasks.filter((task) => task.completed);

return (
<AppShell>
<PageHeader
title="Tasks"
subtitle="Daily execution layer. This is where follow-up, deal movement, callbacks, and internal work should feel fast and operationally sharp."
action={<button className="button primary">Add Task</button>}
/>

<div className="grid-2">
<SectionCard title="Open Tasks" subtitle="Immediate work queue">
<div className="list">
{open.map((task) => (
<div key={task.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{task.title}</div>
<div className="muted small" style={{ marginTop: 6 }}>
{task.dueAt ?? "No due date"}
</div>
</div>
<div className="row">
<StatusBadge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warn" : "info"}>
{task.priority}
</StatusBadge>
<button className="button" onClick={() => toggleTask(task.id)}>
Complete
</button>
</div>
</div>
))}
</div>
</SectionCard>

<SectionCard title="Completed" subtitle="Recently closed out">
<div className="list">
{done.map((task) => (
<div key={task.id} className="item row">
<div style={{ textDecoration: "line-through", opacity: 0.75 }}>{task.title}</div>
<button className="button" onClick={() => toggleTask(task.id)}>
Reopen
</button>
</div>
))}
</div>
</SectionCard>
</div>
</AppShell>
);
}
