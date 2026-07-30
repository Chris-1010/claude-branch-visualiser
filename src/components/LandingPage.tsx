import React from "react";
import { CircleQuestionMark } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
import Search from "./Search";
import type { ChatTreeRef } from "./ChatTree";

interface LandingPageProps {
	// Shared with the Visualiser so a search result can be centred once the tree mounts
	chatTreeRef: React.RefObject<ChatTreeRef | null>;
}

const LandingPage: React.FC<LandingPageProps> = ({ chatTreeRef }) => {
	const { fileserverPassword, isLoading, showHelp, setShowHelp, enterVisualiser } = useChatContext();

	return (
		<div className="landing">
			<CircleQuestionMark className="landing-help" size={34} onClick={() => setShowHelp(!showHelp)} />

			<div className="landing-hero">
				{/* BASE_URL (trailing slash) keeps this correct under the /branches/ prod base */}
				<img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="landing-icon" />
				<h1 className="landing-title">Branch Visualiser</h1>
			</div>

			{/* Cards render only after loading completes so the Claude Code card doesn't pop in once the password loads */}
			{!isLoading && (
				<div className="landing-cards">
					<button className="landing-card landing-card-1" onClick={() => enterVisualiser("claudeai")}>
						Browse Claude.ai Chats
					</button>
					{fileserverPassword && (
						<button className="landing-card landing-card-2" onClick={() => enterVisualiser("claudecode")}>
							Browse Claude Code Sessions
						</button>
					)}
				</div>
			)}

			{!isLoading && <Search chatTreeRef={chatTreeRef} landing />}
		</div>
	);
};

export default LandingPage;
