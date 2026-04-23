import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import ApplyPage from "./pages/ApplyPage";
import AdminPage from "./pages/AdminPage";
import ResultsPage from "./pages/ResultsPage";
import HomePage from "./pages/HomePage";

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const hideNav = loc.pathname.startsWith("/admin");
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">DxLx S&amp;O Mentorship</div>
        {!hideNav && (
          <nav className="nav">
            <Link to="/">Home</Link>
            <Link to="/apply">Apply</Link>
            <Link to="/results">My match</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        )}
      </header>
      {children}
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
