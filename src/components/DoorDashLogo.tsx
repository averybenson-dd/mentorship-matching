/** DoorDash-style lockup for internal program surfaces (wordmark + simplified mark). */
export function DoorDashLogo() {
  return (
    <span className="dd-logo" aria-label="DoorDash">
      <svg
        className="dd-logo__mark"
        width="28"
        height="28"
        viewBox="0 0 32 32"
        aria-hidden
      >
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          fill="#ffffff"
          d="M10 9h7.2c3.3 0 5.8 2.4 5.8 5.6 0 3.1-2.4 5.5-5.6 5.6H14v4.8H10V9zm4 3.6v5.6h2.8c1.5 0 2.4-1 2.4-2.8 0-1.7-.9-2.8-2.5-2.8H14z"
        />
      </svg>
      <span className="dd-logo__word">DoorDash</span>
    </span>
  );
}
