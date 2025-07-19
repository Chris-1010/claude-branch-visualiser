import React from "react";
import { useChatContext } from "../context/ChatContext";
import Search from "./Search";

const Header: React.FC = () => {
	const { allMessages, setAllMessages } = useChatContext();

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const data = JSON.parse(e.target?.result as string);
					// Extract the chat_messages array from the conversation object
					setAllMessages(data.chat_messages || []);
				} catch (error) {
					console.error("Error parsing JSON:", error);
				}
			};
			reader.readAsText(file);
		}
	};

	return (
		<header>
			<h1>Claude Branch Visualiser</h1>

			{allMessages.length > 0 && <Search />}

			<input className="file-input" type="file" accept=".json" onChange={handleFileUpload} />
		</header>
	);
};

export default Header;
