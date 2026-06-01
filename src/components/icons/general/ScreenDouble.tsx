export default function ScreenDouble(props: { className?: string }) {
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
			<polyline points="2 4 10 4 10 20 2 20 2 4" />
			<polyline points="14 4 22 4 22 20 14 20 14 4" />
		</svg>
	);
}
