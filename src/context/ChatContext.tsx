import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { dbManager, type ChatFile, type ClaudeCodeChatFile } from "../utils/indexedDB";

//#region Interfaces
interface ThinkingSummary {
	summary: string;
}

interface MessageContent {
	start_timestamp: string;
	stop_timestamp: string;
	type: string;
	text?: string;
	thinking?: string;
	summaries?: ThinkingSummary[];
	citations?: any[];
	cut_off?: boolean;
}

interface Message {
	uuid: string;
	text: string;
	content: MessageContent[];
	sender: string;
	created_at: string;
	updated_at: string;
	truncated: boolean;
	stop_reason: string;
	attachments: any[];
	files: any[];
	files_v2: any[];
	sync_sources: any[];
	parent_message_uuid: string;
	custom_title?: string | null;
	children: Message[] | null;
	branchPath?: Record<number, { position: number; hasSiblings: boolean }>;
	// Claude Code session metadata (attached during tree build for CC sessions)
	_sessionName?: string;
	_gitBranch?: string;
	_sessionId?: string;
}

type AppMode = "claudeai" | "claudecode";

interface ChatContextType {
	chatFiles: ChatFile[];
	currentChatFile: ChatFile | null;
	allMessages: Message[];
	treeData: Message[];
	currentlySelectedMessage: Message | null;
	sidebarOpen: boolean;
	isLoading: boolean;
	showHelp: boolean;
	heatmapEnabled: boolean;
	fileserverPassword: string | null;
	appMode: AppMode;
	selectedDirectory: string | null;
	claudeAiFiles: ChatFile[];
	claudeCodeFiles: ClaudeCodeChatFile[];
	directoryList: string[];
	toggleHeatmap: () => void;
	addOrUpdateChatFile: (fileName: string, messages: Message[], setAsCurrent?: boolean, uuid?: string, platform?: string, projectPath?: string, gitBranch?: string) => Promise<void>;
	setCurrentChatFile: (chatFile: ChatFile | null) => Promise<void>;
	setCurrentlySelectedMessage: (message: Message | null) => void;
	deleteChatFile: (id: string) => Promise<void>;
	clearAllData: () => Promise<void>;
	getStorageInfo: () => Promise<{ count: number; sizeEstimate: string }>;
	setSidebarOpen: (open: boolean) => void;
	toggleSidebar: () => void;
	setShowHelp: (shown: boolean) => void;
	setFileserverPassword: (password: string | null) => Promise<void>;
	renameChatFile: (id: string, newDisplayName: string) => Promise<void>;
	setAppMode: (mode: AppMode) => void;
	setSelectedDirectory: (dir: string | null) => void;
}
//#endregion

const SYSTEM_MESSAGE_PREFIXES = ["<local-command-caveat>", "<local-command-stdout>", "<command-name>"];

export const isSystemMessage = (msg: { content?: { type: string; text?: string }[]; text?: string }): boolean => {
	const text = msg.content?.find((c) => c.type === "text")?.text || msg.text || "";
	return SYSTEM_MESSAGE_PREFIXES.some((prefix) => text.trimStart().startsWith(prefix));
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
	const context = useContext(ChatContext);
	if (context === undefined) {
		throw new Error("useChatContext must be used within a ChatProvider");
	}
	return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	//#region State
	const [chatFiles, setChatFiles] = useState<ChatFile[]>([]);
	const [currentChatFile, setCurrentChatFileState] = useState<ChatFile | null>(null);
	const [currentlySelectedMessage, setCurrentlySelectedMessage] = useState<Message | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
	const [showHelp, setShowHelp] = useState<boolean>(false);
	const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(false);
	const [fileserverPassword, setFileserverPasswordState] = useState<string | null>(null);
	const [appMode, setAppModeState] = useState<AppMode>("claudeai");
	const [selectedDirectory, setSelectedDirectoryState] = useState<string | null>(null);
	//#endregion

	//#region Derived State
	const claudeAiFiles = chatFiles.filter((f) => f.platform !== "CLAUDE_CODE");
	const claudeCodeFiles = chatFiles.filter((f): f is ClaudeCodeChatFile => f.platform === "CLAUDE_CODE");
	const directoryList = [...new Set(claudeCodeFiles.map((f) => f.projectPath))].sort();
	//#endregion

	//#region Tree Building Logic
	const buildTree = (messages: Message[]): Message[] => {
		// Filter out system messages, but track their parent→child relationships
		// so we can reparent their children to skip over them
		const systemUuids = new Set<string>();
		const systemParentMap = new Map<string, string>(); // systemUuid → its parent_message_uuid

		messages.forEach((msg) => {
			if (isSystemMessage(msg)) {
				systemUuids.add(msg.uuid);
				systemParentMap.set(msg.uuid, msg.parent_message_uuid);
			}
		});

		// Resolve the effective parent of a message, skipping over any system messages
		const resolveParent = (parentUuid: string): string => {
			if (systemUuids.has(parentUuid)) {
				return resolveParent(systemParentMap.get(parentUuid)!);
			}
			return parentUuid;
		};

		const filteredMessages = messages.filter((msg) => !systemUuids.has(msg.uuid));

		const messageMap = new Map<string, Message>();
		const roots: Message[] = [];

		// First pass: populate messageMap with all non-system messages
		filteredMessages.forEach((msg) => {
			messageMap.set(msg.uuid, { ...msg, children: [] });
		});

		// Second pass: build parent-child relationships (now all parents are in the map)
		filteredMessages.forEach((msg) => {
			const effectiveParentUuid = systemUuids.has(msg.parent_message_uuid)
				? resolveParent(msg.parent_message_uuid)
				: msg.parent_message_uuid;

			if (effectiveParentUuid && messageMap.has(effectiveParentUuid)) {
				const parent = messageMap.get(effectiveParentUuid)!;
				const child = messageMap.get(msg.uuid)!;
				parent.children?.push(child);
			} else {
				roots.push(messageMap.get(msg.uuid)!);
			}
		});

		//#region Calculate Branch Paths
		// Recursive function to assign branch paths
		const assignBranchPaths = (node: Message, parentPath: Record<number, { position: number; hasSiblings: boolean }> = {}) => {
			// Determine this node's position among its siblings
			let position = 1;
			let hasSiblings = false;

			const parent = messageMap.get(node.parent_message_uuid);
			if (parent) {
				if (!parent.children) return;
				position = parent.children.findIndex((child) => child.uuid === node.uuid) + 1;
				hasSiblings = parent.children.length > 1;
			} else {
				// Root node, assign position based on rootCounter
				position = roots.findIndex((root) => root.uuid === node.uuid) + 1;
				hasSiblings = roots.length > 1;
			}

			const depth = Object.keys(parentPath).length;
			const branchPath = {
				...parentPath,
				[depth]: {
					position: position,
					hasSiblings: hasSiblings,
				},
			};

			(node as any).branchPath = branchPath;

			// Recursively assign to all children
			node.children?.forEach((child) => {
				assignBranchPaths(child, branchPath);
			});
		};

		// Start the recursive assignment from all roots
		roots.forEach((root) => assignBranchPaths(root));
		//#endregion

		return roots;
	};

	//#endregion

	//#region Claude Code Combined Tree
	// Build a combined tree for a selected directory (all sessions as separate root chains)
	const buildDirectoryTree = (directory: string): Message[] => {
		const sessionsInDir = claudeCodeFiles.filter((f) => f.projectPath === directory);

		// Determine if there are multiple distinct git branches in this directory
		const branchSet = new Set(sessionsInDir.map((f) => f.gitBranch));
		const hasMultipleBranches = branchSet.size > 1;

		const allRoots: Message[] = [];

		for (const session of sessionsInDir) {
			// Tag every message in the session with metadata before building
			const taggedMessages: Message[] = session.messages.map((msg) => ({
				...msg,
				_sessionName: session.displayName || session.name,
				_gitBranch: hasMultipleBranches ? session.gitBranch : undefined,
				_sessionId: session.id,
			}));

			const sessionRoots = buildTree(taggedMessages);
			allRoots.push(...sessionRoots);
		}

		return allRoots;
	};
	//#endregion

	//#region Load Initial Data
	useEffect(() => {
		const loadInitialData = async () => {
			try {
				setIsLoading(true);

				// Load all chat files
				const savedChatFiles = await dbManager.getAllChatFiles();

				// Use persisted tree data when available, only rebuild if missing
				const processedChatFiles = savedChatFiles.map((file) => ({
					...file,
					treeData: file.treeData?.length ? file.treeData : buildTree(file.messages),
				}));

				setChatFiles(processedChatFiles);

				// Load current chat file setting
				const currentChatId = await dbManager.getSetting("currentChatId");
				if (currentChatId && processedChatFiles.length > 0) {
					const currentFile = processedChatFiles.find((file) => file.id === currentChatId);
					console.log(`Current chat file ID: ${currentChatId}`);
					if (currentFile) setCurrentChatFileState(currentFile);
				} else setSidebarOpen(true);

				// Load fileserver password
				const savedPassword = await dbManager.getPassword();
				if (savedPassword) {
					setFileserverPasswordState(savedPassword);
					console.log("Fileserver password loaded from storage");
				}

				console.log(`Loaded ${processedChatFiles.length} chat files from IndexedDB`);
			} catch (error) {
				console.error("Failed to load initial data:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadInitialData();
	}, []);
	//#endregion

	//#region Active Tree Data
	// Stable key representing the sessions in the selected directory — rebuilds only when files change
	const dirSessionsKey = useMemo(() => {
		if (appMode !== "claudecode" || !selectedDirectory) return "";
		return claudeCodeFiles
			.filter((f) => f.projectPath === selectedDirectory)
			.map((f) => `${f.id}:${f.lastUpdated}`)
			.join("|");
	}, [appMode, selectedDirectory, claudeCodeFiles]);

	const activeTreeData = useMemo(() => {
		if (appMode === "claudecode") {
			if (!selectedDirectory) return [];
			return buildDirectoryTree(selectedDirectory);
		}
		return currentChatFile?.treeData || [];
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [appMode, selectedDirectory, dirSessionsKey, currentChatFile?.treeData]);
	//#endregion

	//#region Chat File Management
	const addOrUpdateChatFile = async (
		fileName: string,
		messages: Message[],
		setAsCurrent: boolean = true,
		uuid?: string,
		platform?: string,
		projectPath?: string,
		gitBranch?: string
	): Promise<void> => {
		try {
			const treeData = buildTree(messages);

			let chatFile!: ChatFile;

			setChatFiles((prev) => {
				const existingIndex = prev.findIndex((file) => file.name === fileName);
				const base: ChatFile = {
					id: existingIndex !== -1 ? prev[existingIndex].id : Date.now().toString(),
					name: fileName,
					displayName: existingIndex !== -1 ? prev[existingIndex].displayName : undefined,
					uuid: uuid ?? (existingIndex !== -1 ? prev[existingIndex].uuid : undefined),
					lastUpdated: new Date().toISOString(),
					messages,
					treeData,
					platform: platform ?? (existingIndex !== -1 ? prev[existingIndex].platform : undefined),
				};

				if (platform === "CLAUDE_CODE" && projectPath) {
					(base as ClaudeCodeChatFile).projectPath = projectPath;
					(base as ClaudeCodeChatFile).gitBranch = gitBranch || "HEAD";
				}

				chatFile = base;

				if (existingIndex !== -1) {
					const updated = [...prev];
					updated[existingIndex] = chatFile;
					return updated;
				}
				return [...prev, chatFile];
			});

			// Save to IndexedDB
			await dbManager.saveChatFile(chatFile);

			if (platform !== "CLAUDE_CODE" && setAsCurrent) {
				setCurrentChatFileState(chatFile);
				setCurrentlySelectedMessage(null);
			} else if (platform !== "CLAUDE_CODE" && currentChatFile && chatFile.id === currentChatFile.id) {
				// If we're silently updating the currently viewed file, refresh it in place
				setCurrentChatFileState(chatFile);
			}
		} catch (error) {
			console.error("Failed to add/update chat file:", error);
			throw error;
		}
	};

	const renameChatFile = async (id: string, newDisplayName: string): Promise<void> => {
		try {
			const fileIndex = chatFiles.findIndex((file) => file.id === id);
			if (fileIndex === -1) return;

			const updatedFile: ChatFile = {
				...chatFiles[fileIndex],
				displayName: newDisplayName.trim() || undefined,
			};

			await dbManager.saveChatFile(updatedFile);

			const updatedFiles = [...chatFiles];
			updatedFiles[fileIndex] = updatedFile;
			setChatFiles(updatedFiles);

			if (currentChatFile?.id === id) {
				setCurrentChatFileState(updatedFile);
			}
		} catch (error) {
			console.error("Failed to rename chat file:", error);
		}
	};

	const setCurrentChatFile = async (chatFile: ChatFile | null): Promise<void> => {
		try {
			setCurrentChatFileState(chatFile);
			await dbManager.saveSetting("currentChatId", chatFile?.id || null);
			setCurrentlySelectedMessage(null);
		} catch (error) {
			console.error("Failed to set current chat file:", error);
		}
	};

	const deleteChatFile = async (id: string): Promise<void> => {
		try {
			await dbManager.deleteChatFile(id);

			setChatFiles((prev) => prev.filter((file) => file.id !== id));

			if (currentChatFile?.id === id) {
				setCurrentChatFileState(null);
				await dbManager.saveSetting("currentChatId", null);
				setCurrentlySelectedMessage(null);
			}
		} catch (error) {
			console.error("Failed to delete chat file:", error);
			throw error;
		}
	};

	const clearAllData = async (): Promise<void> => {
		try {
			await dbManager.clearAllChatFiles();
			await dbManager.saveSetting("currentChatId", null);

			setChatFiles([]);
			setCurrentChatFileState(null);
			setCurrentlySelectedMessage(null);

			console.log("All data cleared from IndexedDB");
		} catch (error) {
			console.error("Failed to clear all data:", error);
			throw error;
		}
	};

	const getStorageInfo = async (): Promise<{ count: number; sizeEstimate: string }> => {
		try {
			return await dbManager.getStorageUsage();
		} catch (error) {
			console.error("Failed to get storage info:", error);
			return { count: 0, sizeEstimate: "0MB" };
		}
	};
	//#endregion

	//#region Password Management
	const setFileserverPassword = async (password: string | null): Promise<void> => {
		try {
			if (password) {
				await dbManager.savePassword(password);
				setFileserverPasswordState(password);
				console.log("Fileserver password saved");
			} else {
				await dbManager.clearPassword();
				setFileserverPasswordState(null);
				console.log("Fileserver password cleared");
			}
		} catch (error) {
			console.error("Failed to save/clear password:", error);
		}
	};
	//#endregion

	//#region Mode Management
	const setAppMode = (mode: AppMode) => {
		setAppModeState(mode);
		setCurrentlySelectedMessage(null);
	};

	const setSelectedDirectory = (dir: string | null) => {
		setSelectedDirectoryState(dir);
		setCurrentlySelectedMessage(null);
	};
	//#endregion

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev);
	};

	const toggleHeatmap = () => {
		setHeatmapEnabled((prev) => !prev);
	};

	return (
		<ChatContext.Provider
			value={{
				chatFiles,
				currentChatFile,
				allMessages: appMode === "claudeai"
				? (currentChatFile?.messages || []).filter((m) => !isSystemMessage(m))
				: (selectedDirectory ? claudeCodeFiles.filter((f) => f.projectPath === selectedDirectory).flatMap((f) => f.messages).filter((m) => !isSystemMessage(m)) : []),
				treeData: activeTreeData,
				currentlySelectedMessage,
				isLoading,
				sidebarOpen,
				showHelp,
				heatmapEnabled,
				fileserverPassword,
				appMode,
				selectedDirectory,
				claudeAiFiles,
				claudeCodeFiles,
				directoryList,
				toggleHeatmap,
				addOrUpdateChatFile,
				setCurrentChatFile,
				setCurrentlySelectedMessage,
				deleteChatFile,
				clearAllData,
				getStorageInfo,
				setSidebarOpen,
				toggleSidebar,
				setShowHelp,
				setFileserverPassword,
				renameChatFile,
				setAppMode,
				setSelectedDirectory,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
};
