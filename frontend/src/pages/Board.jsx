import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import { PlusIcon, SearchIcon } from '../components/Icons.jsx';

const COLUMNS = [
  { key: 'todo', title: 'To do' },
  { key: 'in_progress', title: 'In progress' },
  { key: 'done', title: 'Done' },
];

export default function Board() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [modal, setModal] = useState(null); // null | {} (new) | task (edit)
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(() => {
    api
      .listTasks()
      .then((d) => setTasks(d.tasks))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (priority === 'all' || t.priority === priority) &&
        (!q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [tasks, search, priority]);

  const move = async (task, status) => {
    if (task.status === status) return;
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api.updateTask(task.id, { status });
    } catch (e) {
      setTasks(prev);
      setError(e.message);
    }
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.deleteTask(task.id);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const save = async (data) => {
    if (modal?.id) {
      const { task } = await api.updateTask(modal.id, data);
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    } else {
      const { task } = await api.createTask(data);
      setTasks((ts) => [task, ...ts]);
    }
    setModal(null);
  };

  const closeModal = useCallback(() => setModal(null), []);

  const onDrop = (status) => (e) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find((t) => t.id === id);
    if (task) move(task, status);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Sprint board</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <PlusIcon size={16} /> New task
        </button>
      </header>

      <div className="toolbar">
        <label className="search">
          <SearchIcon size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
        </label>
        <div className="seg" role="group" aria-label="Filter by priority">
          {['all', 'high', 'medium', 'low'].map((p) => (
            <button key={p} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <div className="columns">
        {COLUMNS.map((col) => {
          const items = visible.filter((t) => t.status === col.key);
          return (
            <section
              key={col.key}
              className={`column col-${col.key} ${dragOver === col.key ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={onDrop(col.key)}
            >
              <header className="column-head">
                <span className={`status-dot s-${col.key}`} />
                <h2>{col.title}</h2>
                <span className="count">{items.length}</span>
              </header>
              <div className="column-body">
                {loading && <div className="skeleton" />}
                {!loading && items.length === 0 && <div className="column-empty">Drop tasks here</div>}
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    className="drag-wrap"
                  >
                    <TaskCard task={t} onMove={move} onEdit={setModal} onDelete={remove} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {modal && <TaskModal initial={modal} onSave={save} onClose={closeModal} />}
    </div>
  );
}
