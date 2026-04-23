import { Link } from "react-router-dom";

export default function BackendRequired({ title }: { title: string }) {
  return (
    <div className="card">
      <h1>{title}</h1>
      <div className="notice">
        This deployment is missing Supabase environment variables, so applications cannot be saved to a
        shared database yet.
      </div>
      <p className="lead">
        Follow <code>README.md</code> for Supabase (SQL migration, <code>mentor-backend</code> Edge Function,{" "}
        <code>ADMIN_PASSWORD</code> secret). For GitHub Pages, add{" "}
        <strong>repository</strong> Actions secrets named <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_ANON_KEY</code> (under <strong>Settings → Secrets and variables → Actions</strong>, not
        only under the <code>github-pages</code> environment), then re-run the latest workflow or push an empty
        commit so the site rebuilds with those values baked in.
      </p>
      <Link className="btn secondary" to="/">
        Home
      </Link>
    </div>
  );
}
