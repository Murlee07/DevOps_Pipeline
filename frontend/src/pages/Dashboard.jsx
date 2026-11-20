import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatDue } from '../components/TaskCard.jsx';
import { AlertIcon, ArrowIcon, CheckIcon, ClockIcon, ListIcon } from '../components/Icons.jsx';

const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

function formatUptime(s = 0) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { info } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.stats(), api.listTasks()])
      .then(([s, t]) => {
        setStats(s);
        setRecent(t.tasks.slice(0, 6));
      })
      .catch((e) => setError(e.message));
  }, []);

  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const cards = [
    { label: 'Total tasks', value: stats?.total, icon: ListIcon, tone: 'blue' },
    { label: 'In progress', value: stats?.inProgress, icon: ClockIcon, tone: 'amber' },
    { label: 'Completed', value: stats?.done, icon: CheckIcon, tone: 'green' },
    { label: 'Overdue', value: stats?.overdue, icon: AlertIcon, tone: 'red' },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>{user?.name?.split(' ')[0]}, here&apos;s your DevSecOps board</h1>
        </div>
        <Link to="/board" className="btn btn-primary">
          Open board <ArrowIcon size={16} />
        </Link>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="stat-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`stat-card tone-${tone}`}>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
            <div className="stat-value">{value ?? '–'}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Completion</h2>
            <span className="muted">{stats?.highPriority ?? 0} high-priority open</span>
          </div>
          <div className="ring-wrap">
            <div className="ring" style={{ '--pct': pct }}>
              <div className="ring-inner">
                <div className="ring-value">{pct}%</div>
                <div className="ring-label">done</div>
              </div>
            </div>
            <div className="bars">
              {['todo', 'inProgress', 'done'].map((k) => {
                const v = stats?.[k] ?? 0;
                const w = stats?.total ? (v / stats.total) * 100 : 0;
                return (
                  <div key={k} className="bar-row">
                    <span className="bar-label">{k === 'inProgress' ? 'In progress' : k === 'todo' ? 'To do' : 'Done'}</span>
                    <div className="bar">
                      <div className={`bar-fill fill-${k}`} style={{ width: `${w}%` }} />
                    </div>
                    <span className="bar-num mono">{v}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Deployment</h2>
            <span className={`pill ${info?.database?.status === 'up' ? 'pill-ok' : 'pill-bad'}`}>
              {info ? (info.database.status === 'up' ? 'Healthy' : 'Degraded') : 'Offline'}
            </span>
          </div>
          <dl className="kv">
            <dt>Version</dt>
            <dd className="mono">{info?.version ?? '—'}</dd>
            <dt>Build</dt>
            <dd className="mono">#{info?.buildNumber ?? '—'}</dd>
            <dt>Commit</dt>
            <dd className="mono">{info?.gitCommit ?? '—'}</dd>
            <dt>Environment</dt>
            <dd className="mono">{info?.environment ?? '—'}</dd>
            <dt>Database</dt>
            <dd className="mono">{info ? `${info.database.kind} · ${info.database.status}` : '—'}</dd>
            <dt>Uptime</dt>
            <dd className="mono">{info ? formatUptime(info.uptimeSeconds) : '—'}</dd>
          </dl>
          <Link to="/pipeline" className="link-more">
            View pipeline <ArrowIcon size={14} />
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent tasks</h2>
          <Link to="/board" className="link-more">
            All tasks <ArrowIcon size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            <p>No tasks yet. Create your first one on the board.</p>
          </div>
        ) : (
          <ul className="recent">
            {recent.map((t) => {
              const due = formatDue(t.dueDate);
              return (
                <li key={t.id}>
                  <span className={`status-dot s-${t.status}`} />
                  <span className="recent-title">{t.title}</span>
                  <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                  <span className="recent-status muted">{STATUS_LABEL[t.status]}</span>
                  <span className={`recent-due mono ${due?.overdue && t.status !== 'done' ? 'txt-red' : 'muted'}`}>
                    {due ? due.label : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
