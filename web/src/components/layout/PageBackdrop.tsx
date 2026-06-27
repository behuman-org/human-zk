import "./PageBackdrop.css";

export function PageBackdrop() {
  return (
    <div className="page-backdrop" aria-hidden="true">
      <div className="page-backdrop__halo page-backdrop__halo--a" />
      <div className="page-backdrop__halo page-backdrop__halo--b" />
      <div className="page-backdrop__halo page-backdrop__halo--c" />
    </div>
  );
}
