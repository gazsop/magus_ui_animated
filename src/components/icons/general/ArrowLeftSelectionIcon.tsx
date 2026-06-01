export default function ArrowLeftSelectionIcon(props: { className?: string }) {
  return (
    <svg
      className={`arrow-left-circle ${props.className ?? ""}`}
      height="22"
      width="10"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 6 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline points="5 19 1 10 5 1" />
    </svg>
  );
}
