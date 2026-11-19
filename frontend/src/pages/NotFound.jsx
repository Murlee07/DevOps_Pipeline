import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="splash">
      <div className="notfound">
        <div className="mono big-code">404</div>
        <p className="muted">This route didn&apos;t pass the quality gate.</p>
        <Link to="/" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
