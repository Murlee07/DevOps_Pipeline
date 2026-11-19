import { useOutletContext } from 'react-router-dom';

const STAGES = [
  { n: '01', name: 'Checkout', tool: 'Git · Jenkins', desc: 'Pulls the exact commit, tags the build as <build>-<sha>.', gate: false },
  { n: '02', name: 'Test & Lint', tool: 'Jest · ESLint · Vite', desc: 'Backend unit/API tests with coverage, frontend lint and production build, in parallel.', gate: true },
  { n: '03', name: 'Static Analysis', tool: 'SonarQube', desc: 'Bugs, code smells, security hotspots and coverage are analysed and pushed to SonarQube.', gate: false },
  { n: '04', name: 'Quality Gate', tool: 'SonarQube webhook', desc: 'Pipeline pauses until SonarQube reports the gate; a failing gate aborts the release.', gate: true },
  { n: '05', name: 'Dependency & IaC Scan', tool: 'Trivy fs', desc: 'Scans npm lockfiles for CVEs and the repo for leaked secrets (blocking); Dockerfile, Kubernetes and Terraform misconfigurations are reported.', gate: true },
  { n: '06', name: 'Build Images', tool: 'Docker', desc: 'Multi-stage, non-root images with OCI labels; npm stripped from the runtime layer.', gate: false },
  { n: '07', name: 'Image Scan', tool: 'Trivy image', desc: 'Each image is scanned before it can leave the build machine. CRITICAL findings block the release.', gate: true },
  { n: '08', name: 'Push', tool: 'Docker Hub · Amazon ECR', desc: 'Immutable, versioned tags pushed to the registry (ECR scan-on-push enabled).', gate: false },
  { n: '09', name: 'Deploy', tool: 'Compose · Kubernetes · EKS', desc: 'Rolling update with readiness probes; rollout status is verified before the build goes green.', gate: false },
];

const INFRA = [
  { t: 'Terraform', d: 'VPC (2 AZs, public/private subnets, NAT), EKS with managed node group, ECR repositories with lifecycle policies.' },
  { t: 'Kubernetes', d: 'Kustomize base + overlays, non-root pods, read-only root FS, dropped capabilities, NetworkPolicies, HPA, PDB.' },
  { t: 'Docker', d: 'Compose stack for local dev; Jenkins + SonarQube run as containers on Docker Desktop.' },
];

export default function Pipeline() {
  const { info } = useOutletContext();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">How this app got here</p>
          <h1>Secure delivery pipeline</h1>
        </div>
        {info && (
          <div className="build-badge mono">
            <span className="dot dot-ok" /> build #{info.buildNumber} · {info.gitCommit} · {info.environment}
          </div>
        )}
      </header>

      <ol className="pipeline">
        {STAGES.map((s) => (
          <li key={s.n} className="stage">
            <div className="stage-rail">
              <span className="stage-n mono">{s.n}</span>
            </div>
            <div className="stage-card">
              <div className="stage-top">
                <h3>{s.name}</h3>
                {s.gate && <span className="pill pill-gate">blocking gate</span>}
              </div>
              <div className="stage-tool mono">{s.tool}</div>
              <p>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="infra-grid">
        {INFRA.map((i) => (
          <div key={i.t} className="panel">
            <h2>{i.t}</h2>
            <p className="muted">{i.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
