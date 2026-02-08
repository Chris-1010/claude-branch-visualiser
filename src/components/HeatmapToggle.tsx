//#region Imports
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
//#endregion

const HeatmapToggle: React.FC = () => {
	const { currentChatFile, heatmapEnabled, toggleHeatmap } = useChatContext();

	//#region Keyboard Shortcut
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "h" || e.key === "H") {
				if (
					document.activeElement?.tagName !== "INPUT" &&
					document.activeElement?.tagName !== "TEXTAREA"
				) {
					e.preventDefault();
					if (currentChatFile) {
						toggleHeatmap();
					}
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [currentChatFile, toggleHeatmap]);
	//#endregion

	if (!currentChatFile) return null;

	return (
		<Flame
			className={`heatmap-button${heatmapEnabled ? " active" : ""}`}
			size={60}
			onClick={toggleHeatmap}
		/>
	);
};

export default HeatmapToggle;
