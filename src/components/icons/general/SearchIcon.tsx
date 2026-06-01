export default function SearchIcon(props: { className?: string }) {
	return (
		<svg
			className={`slash ${props.className ?? ""}`}
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
			<circle cx="10" cy="10" r="7" fill="" />
			<line x1="15" x2="19" y1="15" y2="19" />
		</svg>	);
}
