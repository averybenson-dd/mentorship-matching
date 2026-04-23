import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div>
      <div className="card">
        <h1>DxLx S&amp;O Mentorship</h1>
        <p className="lead">
          The program runs for six months with bi-weekly check-ins. Mentors and mentees are paired
          based on development goals and mentor strengths. Applications are saved to a shared database
          so you can use any device. Use the same work email on the form and on{" "}
          <strong>My match</strong> after results are published.
        </p>
        <div className="row">
          <Link className="btn primary" to="/apply">
            Start application
          </Link>
          <Link className="btn secondary" to="/results">
            View my match
          </Link>
        </div>
      </div>
      <div className="card">
        <h2>How it works</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li>Submit the mentor or mentee application.</li>
          <li>Program administrators review responses and run matching.</li>
          <li>When published, look up your pairing with your work email and read the personalized rationale.</li>
        </ol>
      </div>
    </div>
  );
}
