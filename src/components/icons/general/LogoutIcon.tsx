export default function LogoutIcon(props: { className?: string }) {
	return (
		<svg
			className={`share ${props.className ?? ""}`}
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
				<path d="M12 4h-8a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h8" />
				<polyline points="16 6 22 12 16 18" />
				<line x1="8" x2="20" y1="12" y2="12" />
		</svg>
	);
}
