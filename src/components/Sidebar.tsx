//#region Imports
import React, { useRef, useState, useEffect } from "react";
import { Trash2, Upload, FileText, Clock, Eraser, CircleQuestionMark, RefreshCw, FolderOpen, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
import type { ClaudeCodeChatFile } from "../utils/indexedDB";
//#endregion

const Sidebar: React.FC = () => {
	//#region State and Refs
	const {
		chatFiles,
		claudeAiFiles,
		claudeCodeFiles,
		directoryList,
		currentChatFile,
		selectedDirectory,
		setCurrentChatFile,
		setSelectedDirectory,
		addOrUpdateChatFile,
		deleteChatFile,
		clearAllData,
		getStorageInfo,
		isLoading,
		sidebarOpen,
		showHelp,
		setShowHelp,
		fileserverPassword,
		setFileserverPassword,
		appMode,
	} = useChatContext();

	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const [storageInfo, setStorageInfo] = useState<{ count: number; sizeEstimate: string }>({ count: 0, sizeEstimate: "0MB" });
	const [isSyncing, setIsSyncing] = useState(false);
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
	//#endregion

	//#region Load Storage Info
	useEffect(() => {
		const loadStorageInfo = async () => {
			const info = await getStorageInfo();
			setStorageInfo(info);
		};

		if (!isLoading) {
			loadStorageInfo();
		}
	}, [chatFiles, isLoading, getStorageInfo]);
	//#endregion

	//#region Auto-sync on initial load
	const hasSyncedRef = useRef(false);
	useEffect(() => {
		if (!isLoading && fileserverPassword && !hasSyncedRef.current) {
			hasSyncedRef.current = true;
			console.log("[Sync] Auto-syncing on page load");
			syncFromFileserver();
		}
	}, [isLoading, fileserverPassword]);
	//#endregion

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const data = JSON.parse(e.target?.result as string);
					// Extract the chat_messages array from the conversation object
					await addOrUpdateChatFile(file.name, data.chat_messages || [], true, data.uuid);
				} catch (error) {
					console.error("Error parsing JSON:", error);
					alert("Failed to parse JSON file. Check console for details.");
				}
			};
			reader.readAsText(file);
		}
		// Reset the input so same file can be uploaded again
		event.target.value = "";
	};

	//#region File Upload Handler
	const handleFileUpdate = async (chatFileId: string, event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const data = JSON.parse(e.target?.result as string);
					const chatFile = chatFiles.find((cf) => cf.id === chatFileId);
					if (chatFile) {
						await addOrUpdateChatFile(chatFile.name, data.chat_messages || [], true, data.uuid);
					}
				} catch (error) {
					console.error("Error parsing JSON:", error);
				}
			};
			reader.readAsText(file);
		}
		// Reset input
		const inputRef = fileInputRefs.current[chatFileId];
		if (inputRef) {
			inputRef.value = "";
		}
	};
	//#endregion

	//#region Sync from Fileserver
	const syncFromFileserver = async () => {
		if (!fileserverPassword) {
			alert("Fileserver password not set. Open the help section to set it up.");
			return;
		}

		setIsSyncing(true);
		try {
			await syncDirectory("", fileserverPassword);
			await syncDirectory("claude-code/", fileserverPassword);
			console.log("[Sync] All syncs complete");
		} catch (error) {
			console.error("[Sync] Failed:", error);
			alert("Sync failed. Check console for details.");
		} finally {
			setIsSyncing(false);
		}
	};

	const syncDirectory = async (subDir: string, password: string) => {
		const baseUrl = `https://files.server-chris.com/projects/claude-branch-visualiser/${subDir}`;
		const isClaudeCode = subDir === "claude-code/";

		const response = await fetch(`${baseUrl}?ls&pw=${encodeURIComponent(password)}`);
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				alert("Invalid password. Please set the correct password in the help section.");
				await setFileserverPassword(null);
			}
			throw new Error(`Failed to fetch file list from ${subDir}: ${response.status}`);
		}

		const data = await response.json();
		const serverFiles = data.files || [];

		console.log(`[Sync] Found ${serverFiles.length} files in ${subDir || "root"}`);

		// Create a map of existing files by name for quick lookup
		const existingFilesMap = new Map(chatFiles.map((file) => [file.name, file]));

		let downloadedCount = 0;
		let updatedCount = 0;
		let skippedCount = 0;

		for (const serverFile of serverFiles) {
			const fileName = serverFile.href;
			const serverTimestamp = serverFile.tags[".up_at"];

			if (serverFile.ext !== "json") {
				console.log(`[Sync] Skipping non-JSON file: ${fileName}`);
				continue;
			}

			// For Claude Code files, store with the subdir prefix to avoid name collisions
			const storeKey = isClaudeCode ? `claude-code/${fileName}` : fileName;
			const existingFile = existingFilesMap.get(storeKey);

			let shouldDownload = false;
			if (!existingFile) {
				console.log(`[Sync] New file detected: ${storeKey}`);
				shouldDownload = true;
			} else {
				const existingTimestamp = new Date(existingFile.lastUpdated).getTime() / 1000;
				if (serverTimestamp > existingTimestamp) {
					console.log(`[Sync] File has updates: ${storeKey}`);
					shouldDownload = true;
				} else {
					skippedCount++;
				}
			}

			if (shouldDownload) {
				try {
					const fileUrl = `${baseUrl}${encodeURIComponent(fileName)}?pw=${encodeURIComponent(password)}&dl`;
					const fileResponse = await fetch(fileUrl);

					if (!fileResponse.ok) {
						console.error(`[Sync] Failed to download ${storeKey}: ${fileResponse.status}`);
						continue;
					}

					const fileData = await fileResponse.json();

					if (!fileData.chat_messages) {
						console.warn(`[Sync] File ${storeKey} missing chat_messages, skipping`);
						continue;
					}

					if (isClaudeCode) {
						const projectPath = fileData.project?.path || "unknown";
						const gitBranch = fileData.project?.git_branch || "HEAD";
						await addOrUpdateChatFile(storeKey, fileData.chat_messages, false, fileData.uuid, "CLAUDE_CODE", projectPath, gitBranch);
					} else {
						await addOrUpdateChatFile(storeKey, fileData.chat_messages, false, fileData.uuid);
					}

					if (existingFile) {
						updatedCount++;
						console.log(`[Sync] ✓ Updated: ${storeKey}`);
					} else {
						downloadedCount++;
						console.log(`[Sync] ✓ Downloaded: ${storeKey}`);
					}
				} catch (error) {
					console.error(`[Sync] Error processing ${storeKey}:`, error);
				}
			}
		}

		console.log(`[Sync] ${subDir || "root"} — Downloaded: ${downloadedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
	};
	//#endregion

	//#region Ref Assignment Helper
	const setInputRef = (chatFileId: string) => (el: HTMLInputElement | null) => {
		fileInputRefs.current[chatFileId] = el;
	};
	//#endregion

	//#region Data Management
	const handleClearAllData = async () => {
		if (confirm("This will delete ALL chat files and cannot be undone. Are you sure?")) {
			try {
				await clearAllData();
			} catch (error) {
				console.error("Failed to clear data:", error);
				alert("Failed to clear data. Check console for details.");
			}
		}
	};

	const handleDeleteChatFile = async (id: string, originalName: string, displayName: string, event: React.MouseEvent) => {
		const skipConfirm = event.shiftKey;

		if (!skipConfirm) {
			const message = fileserverPassword
				? `Delete "${displayName}"?\n\nThis will also delete it from the fileserver.\n\n(Tip: Hold Shift when clicking delete to skip this dialog)`
				: `Delete "${displayName}"?`;
			if (!confirm(message)) return;
		}

		try {
			if (fileserverPassword) {
				// Determine fileserver path: claude-code/ prefix files live in the subdirectory
				const isCC = originalName.startsWith("claude-code/");
				const serverFileName = isCC ? originalName.slice("claude-code/".length) : originalName;
				const subDir = isCC ? "claude-code/" : "";
				const deleteUrl = `https://files.server-chris.com/projects/claude-branch-visualiser/${subDir}${encodeURIComponent(
					serverFileName
				)}?delete&pw=${encodeURIComponent(fileserverPassword)}`;

				const response = await fetch(deleteUrl, { method: "POST" });

				if (!response.ok) {
					console.error(`[Delete] Fileserver delete failed for ${originalName}: ${response.status}`);
					if (response.status !== 400) {
						alert(`Failed to delete "${displayName}" from fileserver (${response.status}). File was not deleted locally.`);
						return;
					}
					console.log(`[Delete] Got 400 from fileserver (file likely already removed) — deleting locally anyway.`);
				}

				console.log(`[Delete] ✓ Deleted from fileserver: ${originalName}`);
			}

			await deleteChatFile(id);
		} catch (error) {
			console.error("Failed to delete file:", error);
			alert("Failed to delete file. Check console for details.");
		}
	};
	//#endregion

	//#region Utility Functions
	const formatTimestamp = (dateString: string) => {
		try {
			const date = new Date(dateString);

			if (isNaN(date.getTime())) {
				return "Invalid date";
			}

			const day = date.getDate().toString().padStart(2, "0");
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			const month = months[date.getMonth()];
			const year = date.getFullYear();

			let hours = date.getHours();
			const minutes = date.getMinutes().toString().padStart(2, "0");
			const ampm = hours >= 12 ? "pm" : "am";

			hours = hours % 12;
			hours = hours ? hours : 12;

			return `${day} ${month} ${year} ${hours}:${minutes}${ampm}`;
		} catch (error) {
			console.error("Error formatting timestamp:", error);
			return "Invalid date";
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

	const toggleDirExpanded = (dir: string) => {
		setExpandedDirs((prev) => {
			const next = new Set(prev);
			if (next.has(dir)) {
				next.delete(dir);
			} else {
				next.add(dir);
			}
			return next;
		});
	};
	//#endregion

	if (isLoading) {
		return (
			<div className="sidebar">
				<div className="sidebar-header">
					<h2>Loading...</h2>
				</div>
			</div>
		);
	}

	//#region Claude.ai mode render
	const renderClaudeAiMode = () => (
		<>
			<div className="file-upload">
				<input id="upload" type="file" accept=".json" onChange={handleFileUpload} />
				<label htmlFor="upload" className="upload-button">
					<Upload size={20} />
					Upload
				</label>
			</div>
			<div className="sidebar-content">
				{isSyncing && (
					<div className="sidebar-sync-overlay">
						<RefreshCw size={40} className="spinning" />
						<span>Syncing...</span>
					</div>
				)}
				{claudeAiFiles.length === 0 ? (
					<div className="sidebar-empty">
						<FileText size={48} />
						<p>No chat files loaded</p>
						<p className="sidebar-empty-hint">Upload a file or sync from fileserver to get started</p>
						<CircleQuestionMark className="help" size={30} onClick={() => setShowHelp(!showHelp)} />
					</div>
				) : (
					<>
						{[...claudeAiFiles].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()).map((chatFile) => (
							<div
								key={chatFile.id}
								className={`sidebar-item ${currentChatFile?.id === chatFile.id ? "active" : ""}`}
								onClick={() => setCurrentChatFile(chatFile)}
							>
								<div className="sidebar-item-header">
									<FileText size={16} />
									<span className="sidebar-item-name" title={chatFile.displayName || chatFile.name}>
										{chatFile.displayName || chatFile.name}
									</span>
								</div>

								<div className="sidebar-item-info">
									{chatFile.displayName && (
										<div className="sidebar-item-original-name" title={chatFile.name}>{chatFile.name}</div>
									)}
									<div className="sidebar-item-updated">
										<Clock size={12} />
										<span title={formatTimestamp(chatFile.lastUpdated)}>Updated {getRelativeTimeDescription(chatFile.lastUpdated)}</span>
									</div>
									<div className="sidebar-item-stats">{chatFile.messages.length} messages</div>
								</div>

								<div className="sidebar-item-actions">
									<input
										ref={setInputRef(chatFile.id)}
										type="file"
										accept=".json"
										onChange={(e) => handleFileUpdate(chatFile.id, e)}
										style={{ display: "none" }}
									/>
									{chatFile.uuid && (
										<a
											className="sidebar-action-btn open-link-btn"
											href={`https://claude.ai/chat/${chatFile.uuid}`}
											target="_blank"
											rel="noopener noreferrer"
											title="Open in Claude.ai"
											onClick={(e) => e.stopPropagation()}
										>
											<ExternalLink size={14} />
										</a>
									)}
									<button
										className="sidebar-action-btn update-btn"
										onClick={(e) => {
											e.stopPropagation();
											fileInputRefs.current[chatFile.id]?.click();
										}}
										title="Update chat file"
									>
										<Upload size={14} />
									</button>
									<button
										className="sidebar-action-btn delete-btn"
										onClick={(e) => {
											e.stopPropagation();
											handleDeleteChatFile(chatFile.id, chatFile.name, chatFile.displayName || chatFile.name, e);
										}}
										title="Delete chat file"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						))}

						<div className="sidebar-footer">
							<div className="sidebar-storage-info">
								Storage: {storageInfo.sizeEstimate} • {storageInfo.count} file{storageInfo.count !== 1 ? "s" : ""}
							</div>
							<CircleQuestionMark className="help" size={30} onClick={() => setShowHelp(!showHelp)} />
						</div>
					</>
				)}
			</div>
		</>
	);
	//#endregion

	//#region Claude Code mode render
	const renderClaudeCodeMode = () => {
		if (directoryList.length === 0) {
			return (
				<div className="sidebar-content">
					{isSyncing && (
						<div className="sidebar-sync-overlay">
							<RefreshCw size={40} className="spinning" />
							<span>Syncing...</span>
						</div>
					)}
					<div className="sidebar-empty">
						<FolderOpen size={48} />
						<p>No Claude Code sessions</p>
						<p className="sidebar-empty-hint">Sync from fileserver to load sessions</p>
						<CircleQuestionMark className="help" size={30} onClick={() => setShowHelp(!showHelp)} />
					</div>
				</div>
			);
		}

		return (
			<div className="sidebar-content">
				{isSyncing && (
					<div className="sidebar-sync-overlay">
						<RefreshCw size={40} className="spinning" />
						<span>Syncing...</span>
					</div>
				)}
				{directoryList.map((dir) => {
					const sessionsInDir = [...claudeCodeFiles]
						.filter((f) => f.projectPath === dir)
						.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
					const isExpanded = expandedDirs.has(dir);
					const isActive = selectedDirectory === dir;

					return (
						<div key={dir} className={`sidebar-dir${isActive ? " active" : ""}`}>
							<div
								className="sidebar-dir-header"
								onClick={() => {
									setSelectedDirectory(dir);
									if (!isExpanded) toggleDirExpanded(dir);
								}}
							>
								<button
									className="sidebar-dir-expand-btn"
									onClick={(e) => {
										e.stopPropagation();
										toggleDirExpanded(dir);
									}}
									title={isExpanded ? "Collapse" : "Expand"}
								>
									{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
								</button>
								<FolderOpen size={16} />
								<span className="sidebar-dir-path" title={dir}>{dir}</span>
								<span className="sidebar-dir-count">{sessionsInDir.length}</span>
							</div>

							{isExpanded && (
								<div className="sidebar-dir-sessions">
									{sessionsInDir.map((session: ClaudeCodeChatFile) => (
										<div key={session.id} className="sidebar-session-item">
											<div className="sidebar-session-info">
												<span className="sidebar-session-name" title={session.name}>{session.name}</span>
												<div className="sidebar-item-updated">
													<Clock size={10} />
													<span title={formatTimestamp(session.lastUpdated)}>
														{getRelativeTimeDescription(session.lastUpdated)}
													</span>
												</div>
												{session.gitBranch && session.gitBranch !== "HEAD" && (
													<span className="sidebar-session-branch" title={`Git branch: ${session.gitBranch}`}>
														{session.gitBranch}
													</span>
												)}
											</div>
											<button
												className="sidebar-action-btn delete-btn"
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteChatFile(session.id, session.name, session.name, e);
												}}
												title="Delete session"
											>
												<Trash2 size={12} />
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}

				<div className="sidebar-footer">
					<div className="sidebar-storage-info">
						Storage: {storageInfo.sizeEstimate} • {claudeCodeFiles.length} session{claudeCodeFiles.length !== 1 ? "s" : ""}
					</div>
					<CircleQuestionMark className="help" size={30} onClick={() => setShowHelp(!showHelp)} />
				</div>
			</div>
		);
	};
	//#endregion

	return (
		<div className={`sidebar${sidebarOpen ? " active" : ""}`}>
			<div className="sidebar-header">
				<h2>{appMode === "claudecode" ? "Directories" : "Chat Files"}</h2>
				<div className="sidebar-header-actions">
					{fileserverPassword && (
						<button className="sidebar-header-btn sync" onClick={syncFromFileserver} disabled={isSyncing} title="Sync from fileserver">
							<RefreshCw size={16} className={isSyncing ? "spinning" : ""} />
						</button>
					)}
					<button className="sidebar-header-btn erase" onClick={handleClearAllData} title="Clear all data">
						<Eraser size={16} />
					</button>
				</div>
			</div>
			{appMode === "claudecode" ? renderClaudeCodeMode() : renderClaudeAiMode()}
		</div>
	);
};

export default Sidebar;
