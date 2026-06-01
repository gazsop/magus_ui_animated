import { ComponentChildren } from "preact";

export default function AppModal({
  id,
  label,
  children,
  actions,
  widthClass = "w-[min(400px,95vw)]",
  topClass = "top-1/2",
}: {
  id: string;
  label: string;
  children: ComponentChildren;
  actions?: ComponentChildren;
  widthClass?: string;
  topClass?: string;
}) {
  return (
    <div
      id={id}
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
    >
      <div
        className={`flex flex-col fixed ${topClass} left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 rounded-md shadow-md ${widthClass} max-w-[95vw] max-h-[90vh] min-h-[120px] fancy-container justify-stretch items-stretch gap-1 select-none overflow-auto`}
        style={{ backgroundColor: "rgba(120, 64, 0, 0.9)" }}
      >
        <label className="text-xl font-bold mb-2">{label}</label>
        <hr className="fancy" />
        {children}
        {actions ? <div className="flex gap-2 justify-end flex-wrap">{actions}</div> : null}
      </div>
    </div>
  );
}
