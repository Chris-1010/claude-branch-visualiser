//#region Imports
import React, { useState, useEffect, useRef } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
import type { ChatTreeRef } from "./ChatTree";
//#endregion

interface SearchProps {
	chatTreeRef: React.RefObject<ChatTreeRef | null>;
}

interface SearchResult {
	message: any;
	matchText: string;
	context: string;
}

const Search: React.FC<SearchProps> = ({ chatTreeRef }) => {
	//#region State
	const [isOpen, setIsOpen] = useState(false);
	const [searchMode, setSearchMode] = useState<"current" | "all">("current");
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const { allMessages, chatFiles, currentChatFile, setCurrentChatFile, setCurrentlySelectedMessage, setSidebarOpen } = useChatContext();
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	//#endregion

	//#region Search Logic
	const performSearch = (query: string) => {
		// No query (or too short), or no messages
		if (query.trim().length < 3 || !allMessages.length) {
			setSearchResults([]);
			return;
		}

		const results: SearchResult[] = [];
		const searchTerm = query.toLowerCase();

		if (searchMode === "current") {
			// Default behaviour - search only current file
			if (!allMessages.length) return;

			allMessages.forEach((message) => {
				const messageText = message.content?.find((c) => c.type === "text")?.text || message.text || "";

				if (messageText.toLowerCase().includes(searchTerm)) {
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
		} else {
			// Search across all chat files - potentially expensive
			chatFiles.forEach((chatFile) => {
				chatFile.messages.forEach((message) => {
					const messageText = message.content?.find((c: any) => c.type === "text")?.text || message.text || "";

					if (messageText.toLowerCase().includes(searchTerm)) {
						const matchIndex = messageText.toLowerCase().indexOf(searchTerm);
						const contextStart = Math.max(0, matchIndex - 50);
						const contextEnd = Math.min(messageText.length, matchIndex + searchTerm.length + 50);

						let context = messageText.substring(contextStart, contextEnd);
						if (contextStart > 0) context = "..." + context;
						if (contextEnd < messageText.length) context = context + "...";

						results.push({
							message: { ...message, _chatFileName: chatFile.name }, // Add file name for display
							matchText: messageText.substring(matchIndex, matchIndex + searchTerm.length),
							context,
						});
					}
				});
			});
		}

		// Sort results by date (newest first). Be defensive about created_at formats.
		const parseDate = (d: any) => {
			if (!d) return 0;
			const t = new Date(d).getTime();
			return isNaN(t) ? 0 : t;
		};

		results.sort((a, b) => parseDate((b.message as any).created_at) - parseDate((a.message as any).created_at));

		setSearchResults(results);
		setSelectedIndex(-1);
	};

	useEffect(() => {
		performSearch(searchQuery);
		if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
	}, [searchMode]);

	useEffect(() => {
		const debounceTimer = setTimeout(() => {
			performSearch(searchQuery);
		}, 300);

		return () => clearTimeout(debounceTimer);
	}, [searchQuery, allMessages]);
	//#endregion

	//#region Keyboard Shortcut and Click Outside Handlers
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "s" || e.key === "S") {
				// Only trigger if not typing in an input/textarea
				if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
					e.preventDefault();
					if (!isOpen && allMessages.length > 0) {
						openSearch();
					}
				}
			}
		};

		const handleClickOutside = (e: MouseEvent) => {
			if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				handleClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, allMessages.length]);
	//#endregion

	//#region Event Handlers
	const handleSearchClick = () => {
		let newState = !isOpen;
		if (newState) {
			openSearch();
		} else {
			handleClose();
		}
	};

	const openSearch = () => {
		setTimeout(() => inputRef.current?.focus(), 100);
		setCurrentlySelectedMessage(null);
		setSidebarOpen(false);
		setIsOpen(true);
	};

	const handleClose = () => {
		setIsOpen(false);
		setSearchQuery("");
		setSearchResults([]);
		setSelectedIndex(-1);
		if (inputRef.current) {
			inputRef.current.blur();
		}
	};

	const handleResultClick = async (result: SearchResult) => {
		if (searchMode === "all") {
			// Switch to the correct chat file first
			const fileName = (result.message as any)._chatFileName;
			const targetChatFile = chatFiles.find((cf) => cf.name === fileName);

			if (targetChatFile && targetChatFile.id !== currentChatFile?.id) {
				await setCurrentChatFile(targetChatFile);
				// Small delay to let the tree render
				setTimeout(() => {
					setCurrentlySelectedMessage(result.message);
					if (chatTreeRef.current) {
						chatTreeRef.current.scrollToMessage(result.message.uuid);
					}
				}, 100);
			} else {
				setCurrentlySelectedMessage(result.message);
				if (chatTreeRef.current) {
					chatTreeRef.current.scrollToMessage(result.message.uuid);
				}
			}
		} else {
			// Original behaviour
			setCurrentlySelectedMessage(result.message);
			if (chatTreeRef.current) {
				chatTreeRef.current.scrollToMessage(result.message.uuid);
			}
		}

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
				<div className="search-dropdown" ref={dropdownRef}>
					<div className="search-tabs">
						<button className={`search-tab ${searchMode === "current" ? "active" : ""}`} onClick={() => setSearchMode("current")}>
							Current Chat
						</button>
						<button className={`search-tab ${searchMode === "all" ? "active" : ""}`} onClick={() => setSearchMode("all")}>
							All Chats
						</button>
					</div>

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
									<div className="search-result-sender">
										<h3 className={result.message.sender.toLowerCase()}>{result.message.sender === "human" ? "You" : "Claude"}</h3>
										{searchMode === "all" && (result.message as any)._chatFileName && (
											<span className="search-result-file">{(result.message as any)._chatFileName}</span>
										)}
									</div>
									<div className="search-result-context">{result.context}</div>
									<div className="search-result-date">{new Date(result.message.created_at).toLocaleDateString()}</div>
								</div>
							))}
						</div>
					)}

					{searchQuery.length >= 3 && searchResults.length === 0 ? (
						<div className="search-no-results">No messages found matching "{searchQuery}"</div>
					) : searchQuery.length < 3 ? (
						<div className="search-invalid-query">Enter at least 3 characters to search</div>
					) : null}
				</div>
			</div>
		</>
	);
};

export default Search;
