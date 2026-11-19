import { useEffect, useRef, useState } from 'react';

const EMPTY = { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '' };

export default function TaskModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, dueDate: initial?.dueDate || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: 'Give the task a title.' });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
      });
    } catch (err) {
      setErrors(err.details || { form: err.message });
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <h2 id="task-modal-title">{isEdit ? 'Edit task' : 'New task'}</h2>

        <label className="field">
          <span>Title</span>
          <input ref={titleRef} value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Rotate SonarQube token" />
          {errors.title && <small className="err">{errors.title}</small>}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea value={form.description} onChange={set('description')} rows={4} maxLength={2000} placeholder="Optional details…" />
          {errors.description && <small className="err">{errors.description}</small>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={set('status')}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="field">
            <span>Due date</span>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} />
            {errors.dueDate && <small className="err">{errors.dueDate}</small>}
          </label>
        </div>

        {errors.form && <div className="alert">{errors.form}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );
}
