export default function ArrowUpIcon(props: { className?: string }) {
	return (
		<svg
			className={`arrow-left-circle ${props.className ?? ""}`}
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
			<polyline points="8 12 12 8 16 12" />
			<line x1="12" x2="12" y1="8" y2="16" />
		</svg>
	);
}
