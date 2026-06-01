export default function ScreenTriple(props: { className?: string }) {
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
			<polyline points="1 4 7 4 7 20 1 20 1 4" />
			<polyline points="9 4 15 4 15 20 9 20 9 4" />
			<polyline points="17 4 23 4 23 20 17 20 17 4" />
		</svg>
	);
}
