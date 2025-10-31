//#region Imports
import React, { useRef, useState, useEffect } from "react";
import { Trash2, Upload, FileText, Clock, Eraser, CircleQuestionMark, RefreshCw } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
//#endregion

const Sidebar: React.FC = () => {
	//#region State and Refs
	const {
		chatFiles,
		currentChatFile,
		setCurrentChatFile,
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
	} = useChatContext();

	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const [storageInfo, setStorageInfo] = useState<{ count: number; sizeEstimate: string }>({ count: 0, sizeEstimate: "0MB" });
	const [isSyncing, setIsSyncing] = useState(false);
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
						await addOrUpdateChatFile(chatFile.name, data.chat_messages || []);
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
			// Fetch file list from fileserver
			const response = await fetch(
				`https://files.server-chris.com/projects/claude-branch-visualiser?ls&pw=${encodeURIComponent(fileserverPassword)}`
			);
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					alert("Invalid password. Please set the correct password in the help section.");
					await setFileserverPassword(null);
				}
				throw new Error(`Failed to fetch file list: ${response.status}`);
			}

			const data = await response.json();
			const serverFiles = data.files || [];

			console.log(`[Sync] Found ${serverFiles.length} files on fileserver`);

			// Create a map of existing files by name for quick lookup
			const existingFilesMap = new Map(chatFiles.map((file) => [file.name, file]));

			let downloadedCount = 0;
			let updatedCount = 0;
			let skippedCount = 0;

			// Process each file from the server
			for (const serverFile of serverFiles) {
				const fileName = serverFile.href;
				const serverTimestamp = serverFile.tags[".up_at"];

				// Check if file extension is json
				if (serverFile.ext !== "json") {
					console.log(`[Sync] Skipping non-JSON file: ${fileName}`);
					continue;
				}

				const existingFile = existingFilesMap.get(fileName);

				// Determine if need to download
				let shouldDownload = false;
				if (!existingFile) {
					console.log(`[Sync] New file detected: ${fileName}`);
					shouldDownload = true;
				} else {
					// Compare timestamps
					const existingTimestamp = new Date(existingFile.lastUpdated).getTime() / 1000;
					if (serverTimestamp > existingTimestamp) {
						console.log(`[Sync] File has updates: ${fileName} (server: ${serverTimestamp}, local: ${existingTimestamp})`);
						shouldDownload = true;
					} else {
						console.log(`[Sync] File up to date: ${fileName}`);
						skippedCount++;
					}
				}

				if (shouldDownload) {
					try {
						// Download the file
						const fileUrl = `https://files.server-chris.com/projects/claude-branch-visualiser/${encodeURIComponent(
							fileName
						)}?pw=${encodeURIComponent(fileserverPassword)}&dl`;

						const fileResponse = await fetch(fileUrl);

						if (!fileResponse.ok) {
							console.error(`[Sync] Failed to download ${fileName}: ${fileResponse.status}`);
							continue;
						}

						const fileData = await fileResponse.json();

						// Validate it has chat_messages
						if (!fileData.chat_messages) {
							console.warn(`[Sync] File ${fileName} missing chat_messages, skipping`);
							continue;
						}

						// Add or update in local storage
						await addOrUpdateChatFile(fileName, fileData.chat_messages);

						if (existingFile) {
							updatedCount++;
							console.log(`[Sync] ✓ Updated: ${fileName}`);
						} else {
							downloadedCount++;
							console.log(`[Sync] ✓ Downloaded: ${fileName}`);
						}
					} catch (error) {
						console.error(`[Sync] Error processing ${fileName}:`, error);
					}
				}
			}

			console.log(`[Sync] Complete - Downloaded: ${downloadedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

			// Show summary notification
			if (downloadedCount > 0 || updatedCount > 0) {
				alert(`Sync complete!\nNew: ${downloadedCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}`);
			} else {
				alert(`All files are up to date (${skippedCount} files checked)`);
			}
		} catch (error) {
			console.error("[Sync] Failed:", error);
			alert("Sync failed. Check console for details.");
		} finally {
			setIsSyncing(false);
		}
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

	const handleDeleteChatFile = async (id: string, fileName: string) => {
		if (confirm(`Delete "${fileName}"?`)) {
			try {
				await deleteChatFile(id);
			} catch (error) {
				console.error("Failed to delete file:", error);
				alert("Failed to delete file. Check console for details.");
			}
		}
	};
	//#endregion

	//#region Utility Functions
	const formatTimestamp = (dateString: string) => {
		try {
			const date = new Date(dateString);

			// Check if date is valid
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
			hours = hours ? hours : 12; // 0 should be 12

			return `${day} ${month} ${year} ${hours}:${minutes}${ampm}`;
		} catch (error) {
			console.error("Error formatting timestamp:", error);
			return "Invalid date";
		}
	};

	const formatLastUpdatedTimeAgo = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
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

	return (
		<div className={`sidebar${sidebarOpen ? " active" : ""}`}>
			<div className="sidebar-header">
				<h2>Chat Files</h2>
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
			<div className="file-upload">
				<input id="upload" type="file" accept=".json" onChange={handleFileUpload} />
				<label htmlFor="upload" className="upload-button">
					<Upload size={20} />
					Upload
				</label>
			</div>
			<div className="sidebar-content">
				{chatFiles.length === 0 ? (
					<div className="sidebar-empty">
						<FileText size={48} />
						<p>No chat files loaded</p>
						<p className="sidebar-empty-hint">Upload a file or sync from fileserver to get started</p>
						<CircleQuestionMark className="help" size={30} onClick={() => setShowHelp(!showHelp)} />
					</div>
				) : (
					<>
						{chatFiles.map((chatFile) => (
							<div
								key={chatFile.id}
								className={`sidebar-item ${currentChatFile?.id === chatFile.id ? "active" : ""}`}
								onClick={() => setCurrentChatFile(chatFile)}
							>
								<div className="sidebar-item-header">
									<FileText size={16} />
									<span className="sidebar-item-name" title={chatFile.name}>
										{chatFile.name}
									</span>
								</div>

								<div className="sidebar-item-info">
									<div className="sidebar-item-updated">
										<Clock size={12} />
										<span title={formatTimestamp(chatFile.lastUpdated)}>Updated {formatLastUpdatedTimeAgo(chatFile.lastUpdated)}</span>
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
											handleDeleteChatFile(chatFile.id, chatFile.name);
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
		</div>
	);
};

export default Sidebar;
