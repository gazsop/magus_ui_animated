export default function SparklesIcon(props: { className?: string }) {
  return (
    <svg
      className={`sparkles ${props.className ?? ""}`}
      fill="none"
      height="24"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
      <path d="M18.5 5.5L20 7l-1.5 1.5" />
      <path d="M5 14l1.5 1.5L5 17" />
      <path d="M17 16l1.5 1.5L17 19" />
    </svg>
  );
}
