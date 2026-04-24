import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { DoorDashLogo } from "./components/DoorDashLogo";
import ApplyPage from "./pages/ApplyPage";
import AdminPage from "./pages/AdminPage";
import ResultsPage from "./pages/ResultsPage";
import HomePage from "./pages/HomePage";

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const hideNav = loc.pathname.startsWith("/admin");

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__brand">
            <DoorDashLogo />
            <span className="app-header__divider" aria-hidden />
            <span className="app-header__program">
              <span className="app-header__program-name">S&amp;O Mentorship</span>
              <span className="app-header__program-meta">DxLx</span>
            </span>
          </Link>
          {!hideNav && (
            <nav className="nav" aria-label="Primary">
              <Link className={loc.pathname === "/" ? "nav-link is-active" : "nav-link"} to="/">
                Home
              </Link>
              <Link className={loc.pathname === "/apply" ? "nav-link is-active" : "nav-link"} to="/apply">
                Apply
              </Link>
              <Link
                className={loc.pathname === "/results" ? "nav-link is-active" : "nav-link"}
                to="/results"
              >
                My match
              </Link>
              <Link className={loc.pathname === "/admin" ? "nav-link is-active" : "nav-link"} to="/admin">
                Admin
              </Link>
            </nav>
          )}
        </div>
      </header>

      <div className="shell">{children}</div>

      <footer className="app-footer">
        <p className="app-footer__line">DoorDash · DxLx Strategy &amp; Operations</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
