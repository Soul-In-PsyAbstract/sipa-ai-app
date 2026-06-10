import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="w-7 h-7 bg-logic-blue rounded-sm flex items-center justify-center text-white font-mono font-bold text-sm">
        S
      </div>
      <span className="font-mono text-white text-sm tracking-tight">SIPA OS</span>
    </Link>
  );
}
