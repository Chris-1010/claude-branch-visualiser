//#region Imports
import React, { useState, useEffect, useRef } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
//#endregion

interface SearchResult {
	message: any;
	matchText: string;
	context: string;
}

const Search: React.FC = () => {
	//#region State
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const { allMessages, setCurrentlySelectedMessage } = useChatContext();
	const inputRef = useRef<HTMLInputElement>(null);
	//#endregion

	//#region Search Logic
	const performSearch = (query: string) => {
		if (!query.trim() || !allMessages.length) {
			setSearchResults([]);
			return;
		}

		const results: SearchResult[] = [];
		const searchTerm = query.toLowerCase();

		allMessages.forEach((message) => {
			// Get the text content from the message
			const messageText = message.content?.find((c) => c.type === "text")?.text || message.text || "";

			if (messageText.toLowerCase().includes(searchTerm)) {
				// Find the position of the match for context
				const matchIndex = messageText.toLowerCase().indexOf(searchTerm);
				const contextStart = Math.max(0, matchIndex - 50);
				const contextEnd = Math.min(messageText.length, matchIndex + searchTerm.length + 50);

				let context = messageText.substring(contextStart, contextEnd);
				if (contextStart > 0) context = "..." + context;
				if (contextEnd < messageText.length) context = context + "...";

				results.push({
					message,
					matchText: messageText.substring(matchIndex, matchIndex + searchTerm.length),
					context,
				});
			}
		});

		setSearchResults(results);
		setSelectedIndex(-1);
	};

	useEffect(() => {
		const debounceTimer = setTimeout(() => {
			performSearch(searchQuery);
		}, 300);

		return () => clearTimeout(debounceTimer);
	}, [searchQuery, allMessages]);
	//#endregion

	//#region Event Handlers
	const handleSearchClick = () => {
		setIsOpen(true);
		setTimeout(() => inputRef.current?.focus(), 100);
	};

	const handleClose = () => {
		setIsOpen(false);
		setSearchQuery("");
		setSearchResults([]);
		setSelectedIndex(-1);
	};

	const handleResultClick = (result: SearchResult) => {
		// Find the message in the tree structure
		const findMessageInTree = (treeData: any[], targetUuid: string): any => {
			for (const node of treeData) {
				if (node.uuid === targetUuid) return node;
				if (node.children) {
					const found = findMessageInTree(node.children, targetUuid);
					if (found) return found;
				}
			}
			return null;
		};

		setCurrentlySelectedMessage(result.message);
		handleClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			handleClose();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) => Math.max(prev - 1, -1));
		} else if (e.key === "Enter" && selectedIndex >= 0) {
			handleResultClick(searchResults[selectedIndex]);
		}
	};
	//#endregion

	return (
		<>
			{allMessages.length > 0 && <SearchIcon className={`search-button${isOpen ? " active" : ""}`} size={60} onClick={handleSearchClick} />}
			<div className="search-container">
				<div className="search-dropdown">
					<div className="search-input-container">
						<input
							ref={inputRef}
							type="text"
							placeholder="Search messages..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							className="search-input"
						/>
						<button className="search-close" onClick={handleClose}>
							<X size={25} />
						</button>
					</div>

					{searchResults.length > 0 && (
						<div className="search-results">
							{searchResults.map((result, index) => (
								<div
									key={result.message.uuid}
									className={`search-result ${index === selectedIndex ? "selected" : ""}`}
									onClick={() => handleResultClick(result)}
								>
									<div className="search-result-sender">{result.message.sender === "human" ? "You" : "Claude"}</div>
									<div className="search-result-context">{result.context}</div>
									<div className="search-result-date">{new Date(result.message.created_at).toLocaleDateString()}</div>
								</div>
							))}
						</div>
					)}

					{searchQuery && searchResults.length === 0 && <div className="search-no-results">No messages found matching "{searchQuery}"</div>}
				</div>
			</div>
		</>
	);
};

export default Search;
