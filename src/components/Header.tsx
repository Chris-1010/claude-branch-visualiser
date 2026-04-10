import React, { useState, useEffect, useRef } from "react";
import { Menu, ExternalLink } from "lucide-react";
import { useChatContext } from "../context/ChatContext";

const Header: React.FC = () => {
	const { currentChatFile, sidebarOpen, toggleSidebar, renameChatFile, fileserverPassword, appMode, setAppMode, selectedDirectory } = useChatContext();
	const [editingName, setEditingName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (currentChatFile) {
			setEditingName(currentChatFile.displayName || currentChatFile.name);
		}
	}, [currentChatFile?.id, currentChatFile?.displayName]);

	const handleBlur = async () => {
		if (!currentChatFile) return;
		const trimmed = editingName.trim();
		const currentDisplay = currentChatFile.displayName || currentChatFile.name;
		if (trimmed !== currentDisplay) {
			if (trimmed === "" || trimmed === currentChatFile.name) {
				await renameChatFile(currentChatFile.id, "");
			} else {
				await renameChatFile(currentChatFile.id, trimmed);
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			inputRef.current?.blur();
		} else if (e.key === "Escape") {
			setEditingName(currentChatFile?.displayName || currentChatFile?.name || "");
			inputRef.current?.blur();
		}
	};

	return (
		<header>
			<Menu size={40} className={`sidebar-icon${sidebarOpen ? " active" : ""}`} onClick={toggleSidebar} />

			{fileserverPassword && (
				<div className="mode-toggle">
					<button
						className={`mode-toggle-btn${appMode === "claudeai" ? " claudeai active" : " claudecode"}`}
						onClick={() => setAppMode("claudeai")}
					>
						Claude.ai Chats
					</button>
					<button
						className={`mode-toggle-btn${appMode === "claudecode" ? " claudecode active" : " claudeai"}`}
						onClick={() => setAppMode("claudecode")}
					>
						Claude Code Sessions
					</button>
				</div>
			)}

			<h1>Branch Visualiser</h1>

			{appMode === "claudeai" && currentChatFile && (
				<>
					<div className="current-chat-file">
						<span>Current File</span>
						<input
							ref={inputRef}
							className="current-chat-file-input"
							type="text"
							value={editingName}
							onChange={(e) => setEditingName(e.target.value)}
							onBlur={handleBlur}
							onKeyDown={handleKeyDown}
							title={currentChatFile.displayName || currentChatFile.name}
						/>
					</div>
					{currentChatFile.uuid && (
						<a
							className="current-chat-file-link"
							href={`https://claude.ai/chat/${currentChatFile.uuid}`}
							target="_blank"
							rel="noopener noreferrer"
							title="Open in Claude.ai"
						>
							<ExternalLink size={25} />
						</a>
					)}
				</>
			)}

			{appMode === "claudecode" && selectedDirectory && (
				<div className="current-chat-file current-directory">
					<span>Directory</span>
					<span className="current-directory-path" title={selectedDirectory}>
						{selectedDirectory}
					</span>
				</div>
			)}
		</header>
	);
};

export default Header;
