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
        Follow <code>README.md</code> to create a Supabase project, run the SQL migration, deploy the{" "}
        <code>mentor-backend</code> Edge Function, set <code>ADMIN_PASSWORD</code> in Supabase secrets, then
        add GitHub repository secrets <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{" "}
        and rebuild Pages.
      </p>
      <Link className="btn secondary" to="/">
        Home
      </Link>
    </div>
  );
}
