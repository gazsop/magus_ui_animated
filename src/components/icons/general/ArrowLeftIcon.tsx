export default function ArrowLeftIcon(props: { className?: string }) {
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
			<polyline points="12 4 4 12 12 20" />
			<line x1="20" x2="4" y1="12" y2="12" />
		</svg>
	);
}
