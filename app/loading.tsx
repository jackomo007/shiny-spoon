export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-emerald-100">
      <div className="page-loading-bar absolute top-0 h-full rounded-r-full bg-emerald-600 shadow-[0_0_12px_rgba(5,150,105,0.55)]" />
    </div>
  );
}
