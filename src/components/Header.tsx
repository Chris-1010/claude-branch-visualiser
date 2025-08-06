//#region Imports
import React from "react";
import { useChatContext } from "../context/ChatContext";
//#endregion

const Header: React.FC = () => {
	const { addOrUpdateChatFile } = useChatContext();

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const data = JSON.parse(e.target?.result as string);
					// Extract the chat_messages array from the conversation object
					await addOrUpdateChatFile(file.name, data.chat_messages || []);
				} catch (error) {
					console.error("Error parsing JSON:", error);
					alert('Failed to parse JSON file. Check console for details.');
				}
			};
			reader.readAsText(file);
		}
		// Reset the input so same file can be uploaded again
		event.target.value = '';
	};

	return (
		<header>
			<h1>Claude Branch Visualiser</h1>
			<input 
				className="file-input" 
				type="file" 
				accept=".json" 
				onChange={handleFileUpload} 
			/>
		</header>
	);
};

export default Header;