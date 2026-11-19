import { CalendarIcon, EditIcon, TrashIcon } from './Icons.jsx';

const NEXT = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
const NEXT_LABEL = { todo: 'Start', in_progress: 'Complete', done: 'Reopen' };

export function formatDue(dueDate) {
  if (!dueDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(`${dueDate}T00:00:00`);
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue: dueDate < today, today: dueDate === today };
}

export default function TaskCard({ task, onMove, onEdit, onDelete }) {
  const due = formatDue(task.dueDate);
  const overdue = due?.overdue && task.status !== 'done';

  return (
    <article className={`task-card prio-${task.priority} ${task.status === 'done' ? 'is-done' : ''}`}>
      <header className="task-head">
        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
        <div className="task-tools">
          <button className="icon-btn sm" onClick={() => onEdit(task)} aria-label="Edit task" title="Edit">
            <EditIcon size={15} />
          </button>
          <button className="icon-btn sm danger" onClick={() => onDelete(task)} aria-label="Delete task" title="Delete">
            <TrashIcon size={15} />
          </button>
        </div>
      </header>
      <h3 className="task-title">{task.title}</h3>
      {task.description && <p className="task-desc">{task.description}</p>}
      <footer className="task-foot">
        {due ? (
          <span className={`due ${overdue ? 'due-overdue' : ''} ${due.today ? 'due-today' : ''}`}>
            <CalendarIcon size={14} />
            {overdue ? `Overdue · ${due.label}` : due.today ? 'Due today' : due.label}
          </span>
        ) : (
          <span className="due muted">No due date</span>
        )}
        <button className="chip-btn" onClick={() => onMove(task, NEXT[task.status])}>
          {NEXT_LABEL[task.status]} →
        </button>
      </footer>
    </article>
  );
}
