import React, { useState, useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { useChatContext } from "../context/ChatContext";

const Header: React.FC = () => {
	const { currentChatFile, sidebarOpen, toggleSidebar, renameChatFile } = useChatContext();
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
			<h1>Branch Visualiser</h1>
			{currentChatFile && (
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
			)}
		</header>
	);
};

export default Header;
