import React from "react";
import { Menu } from "lucide-react";
import { useChatContext } from "../context/ChatContext";

const Header: React.FC = () => {
	const { currentChatFile, sidebarOpen, toggleSidebar } = useChatContext();

	return (
		<header>
			<Menu size={40} className={`sidebar-icon${sidebarOpen ? " active" : ""}`} onClick={toggleSidebar} />
			<h1>Branch Visualiser</h1>
			{currentChatFile && (
				<div className="current-chat-file">
					<span>Current File</span>
					<h2 title={currentChatFile.name}>{currentChatFile.name}</h2>
				</div>
			)}
		</header>
	);
};

export default Header;
