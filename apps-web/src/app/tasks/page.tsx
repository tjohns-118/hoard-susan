'use client';

import { useAppStore } from '@/app/store/useAppStore';

export default function TasksPage() {
const tasks = useAppStore((s) => s.tasks);
const toggleTask = useAppStore((s) => s.toggleTask);

return (
<div style={{ padding: '24px' }}>
<h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
Tasks
</h1>

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
{tasks.map((task) => (
<div
key={task.id}
style={{
padding: '12px',
border: '1px solid #ccc',
borderRadius: '8px',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
}}
>
<span
style={{
textDecoration: task.completed ? 'line-through' : 'none',
}}
>
{task.title}
</span>

<button
onClick={() => toggleTask(task.id)}
style={{
padding: '6px 12px',
cursor: 'pointer',
}}
>
{task.completed ? 'Undo' : 'Complete'}
</button>
</div>
))}
</div>
</div>
);
}
