//#region Imports
import React, { useState, useEffect, useRef } from "react";
import { Search as SearchIcon, X, Loader } from "lucide-react";
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
	const [isSearching, setIsSearching] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const { allMessages, chatFiles, currentChatFile, setCurrentChatFile, setCurrentlySelectedMessage, setSidebarOpen } = useChatContext();
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const workerRef = useRef<Worker | null>(null);
	//#endregion

	//#region Worker Setup
	useEffect(() => {
		workerRef.current = new Worker(new URL("../workers/searchWorker.ts", import.meta.url), { type: "module" });

		workerRef.current.onmessage = (e: MessageEvent<SearchResult[]>) => {
			setSearchResults(e.data);
			setSelectedIndex(-1);
			setIsSearching(false);
		};

		return () => {
			workerRef.current?.terminate();
		};
	}, []);
	//#endregion

	//#region Search Logic
	const performSearch = (query: string) => {
		// No query (or too short), or no messages
		if (query.trim().length < 3 || !allMessages.length) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		if (searchMode === "current") {
			// Current chat search runs on main thread (fast, single file)
			const results: SearchResult[] = [];
			const searchTerm = query.toLowerCase();

			allMessages.forEach((message) => {
				const messageText = message.content?.find((c) => c.type === "text")?.text || message.text || "";
				const thinkingText = message.content?.find((c) => c.type === "thinking")?.thinking || "";
				const combinedText = messageText + " " + thinkingText;

				if (combinedText.toLowerCase().includes(searchTerm)) {
					// Prefer showing context from regular text, fall back to thinking
					let sourceText = messageText;
					let matchIndex = messageText.toLowerCase().indexOf(searchTerm);
					let isThinkingMatch = false;

					if (matchIndex === -1 && thinkingText) {
						sourceText = thinkingText;
						matchIndex = thinkingText.toLowerCase().indexOf(searchTerm);
						isThinkingMatch = true;
					}

					const contextStart = Math.max(0, matchIndex - 50);
					const contextEnd = Math.min(sourceText.length, matchIndex + searchTerm.length + 50);

					let context = sourceText.substring(contextStart, contextEnd);
					if (contextStart > 0) context = "..." + context;
					if (contextEnd < sourceText.length) context = context + "...";
					if (isThinkingMatch) context = "[Thinking] " + context;

					results.push({
						message,
						matchText: sourceText.substring(matchIndex, matchIndex + searchTerm.length),
						context,
					});
				}
			});

			// Sort results by date (newest first). Be defensive about created_at formats.
			const parseDate = (d: any) => {
				if (!d) return 0;
				const t = new Date(d).getTime();
				return isNaN(t) ? 0 : t;
			};

			results.sort((a, b) => parseDate((b.message as any).created_at) - parseDate((a.message as any).created_at));

			setSearchResults(results);
			setSelectedIndex(-1);
		} else {
			// "All Chats" search runs in Web Worker
			setIsSearching(true);

			// Send only the data the worker needs (name + messages)
			const workerData = chatFiles.map((cf) => ({
				name: cf.name,
				displayName: cf.displayName || cf.name,
				messages: cf.messages,
			}));

			workerRef.current?.postMessage({ chatFiles: workerData, query });
		}
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
		setIsSearching(false);
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

	//#region Highlight Helper
	const highlightMatch = (text: string, query: string) => {
		if (!query || query.length < 3) return text;
		const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
		const parts = text.split(regex);
		return parts.map((part, i) =>
			regex.test(part) ? (
				<span key={i} className="search-highlight">
					{part}
				</span>
			) : (
				part
			)
		);
	};
	//#endregion

	//#region Date Formatting Helpers
	const formatCreatedDate = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return "Invalid date";

			const day = date.getDate();
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			const month = months[date.getMonth()];

			return `${day} ${month}`;
		} catch (error) {
			console.error("Error formatting date:", error);
			return dateString;
		}
	};

	const getRelativeTimeDescription = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return dateString;

			const currentTime = Date.now();
			const targetTime = date.getTime();
			const timeDiff = currentTime - targetTime;

			const minutes = Math.floor(timeDiff / (1000 * 60));
			const hours = Math.floor(timeDiff / (1000 * 60 * 60));
			const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
			const weeks = Math.floor(days / 7);
			const months = Math.floor(days / 30);
			const years = Math.floor(days / 365);

			if (minutes < 60) {
				return minutes <= 1 ? "1 minute ago" : `${minutes} minutes ago`;
			} else if (hours < 24) {
				return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
			} else if (days < 7) {
				return days === 1 ? "1 day ago" : `${days} days ago`;
			} else if (weeks < 4) {
				return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
			} else if (months < 12) {
				return months === 1 ? "1 month ago" : `${months} months ago`;
			} else {
				return years === 1 ? "1 year ago" : `${years} years ago`;
			}
		} catch (error) {
			console.error("Error calculating relative time:", error);
			return dateString;
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

					{isSearching ? (
						<div className="search-loading">
							<Loader size={24} className="spinning" />
							<span>Searching all chat files...</span>
						</div>
					) : searchResults.length > 0 ? (
						<div className="search-results">
							{searchResults.map((result, index) => (
								<div
									key={`${result.message.uuid}-${index}`}
									className={`search-result ${index === selectedIndex ? "selected" : ""}`}
									onClick={() => handleResultClick(result)}
								>
									<div className="search-result-sender">
										<h3 className={result.message.sender.toLowerCase()}>{result.message.sender === "human" ? "You" : "Claude"}</h3>
										{searchMode === "all" && (result.message as any)._chatFileDisplayName && (
											<span className="search-result-file">{(result.message as any)._chatFileDisplayName}</span>
										)}
									</div>
									<div className="search-result-context">{highlightMatch(result.context, searchQuery)}</div>
									<div className="search-result-date">
										{formatCreatedDate(result.message.created_at)} ({getRelativeTimeDescription(result.message.created_at)})
									</div>
								</div>
							))}
						</div>
					) : searchQuery.length >= 3 ? (
						<div className="search-no-results">No messages found matching "{searchQuery}"</div>
					) : (
						<div className="search-invalid-query">Enter at least 3 characters to search</div>
					)}
				</div>
			</div>
		</>
	);
};

export default Search;
