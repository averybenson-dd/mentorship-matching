/** Official DoorDash wordmark (asset in `public/doordash-logo.svg`). */
export function DoorDashLogo() {
  const base = import.meta.env.BASE_URL;
  const src = `${base}doordash-logo.svg`;
  return (
    <img
      className="dd-logo__img"
      src={src}
      alt="DoorDash"
      width={118}
      height={14}
      decoding="async"
    />
  );
}
