import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div>
      <div className="card">
        <h1>2026 DxLx Mentorship Program</h1>
        <p className="lead">
          Welcome to the 2026 DxLx Mentorship Program! Mentors and mentees are paired using AI based on
          development goals and mentor strengths. The program runs for six months, and participants are
          encouraged to meet with their match(es) on a biweekly basis. You will be notified once your
          matches are available to view. Please reach out to Avery Benson if you have any questions or
          concerns.
        </p>
        <div className="row">
          <Link className="btn primary" to="/apply">
            Start application
          </Link>
          <Link className="btn secondary" to="/results">
            View My Match
          </Link>
        </div>
      </div>
      <div className="card">
        <h2>How it works</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li>Submit a mentor or mentee application.</li>
          <li>
            Once the application period ends, all submissions will be processed through the Gemini API
            for matching. The results will then be returned to this website.
          </li>
          <li>
            {`AI-generated matches will be reviewed by the EngageMe Pod, who will publish the final results on this website. You can access your match by clicking "View My Match" and signing in with the same email you used to apply.`}
          </li>
        </ol>
      </div>
    </div>
  );
}
