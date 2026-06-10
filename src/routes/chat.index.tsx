import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-xs text-logic-blue">// idle</div>
        <p className="mt-2 font-mono text-sm text-protocol-slate">
          Select a thread or create new
        </p>
      </div>
    </div>
  );
}
