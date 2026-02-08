import React, { createContext, useContext, useState, useEffect } from "react";
import { dbManager, type ChatFile } from "../utils/indexedDB";

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
	children: Message[] | null;
	branchPath?: Record<number, { position: number; hasSiblings: boolean }>;
}

interface ChatContextType {
	chatFiles: ChatFile[];
	currentChatFile: ChatFile | null;
	allMessages: Message[];
	treeData: Message[];
	currentlySelectedMessage: Message | null;
	sidebarOpen: boolean;
	isLoading: boolean;
	showHelp: boolean;
	fileserverPassword: string | null;
	addOrUpdateChatFile: (fileName: string, messages: Message[]) => Promise<void>;
	setCurrentChatFile: (chatFile: ChatFile | null) => Promise<void>;
	setCurrentlySelectedMessage: (message: Message | null) => void;
	deleteChatFile: (id: string) => Promise<void>;
	clearAllData: () => Promise<void>;
	getStorageInfo: () => Promise<{ count: number; sizeEstimate: string }>;
	setSidebarOpen: (open: boolean) => void;
	toggleSidebar: () => void;
	setShowHelp: (shown: boolean) => void;
	setFileserverPassword: (password: string | null) => Promise<void>;
}
//#endregion

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
	const [fileserverPassword, setFileserverPasswordState] = useState<string | null>(null);
	//#endregion

	//#region Tree Building Logic
	const buildTree = (messages: Message[]): Message[] => {
		const messageMap = new Map<string, Message>();
		const roots: Message[] = []; // Root messages

		// Build parent-child relationships
		messages.forEach((msg) => {
			// Create lookup map with children array - parent to child mapping
			messageMap.set(msg.uuid, { ...msg, children: [] });

			if (msg.parent_message_uuid && messageMap.has(msg.parent_message_uuid)) {
				const parent = messageMap.get(msg.parent_message_uuid)!;
				const child = messageMap.get(msg.uuid)!;
				parent.children?.push(child);
			} else {
				const root = messageMap.get(msg.uuid)!;
				roots.push(root);
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

	//#region Chat File Management
	const addOrUpdateChatFile = async (fileName: string, messages: Message[]): Promise<void> => {
		try {
			const existingFileIndex = chatFiles.findIndex((file) => file.name === fileName);
			const treeData = buildTree(messages);

			const chatFile: ChatFile = {
				id: existingFileIndex !== -1 ? chatFiles[existingFileIndex].id : Date.now().toString(),
				name: fileName,
				lastUpdated: new Date().toISOString(),
				messages,
				treeData,
			};

			// Save to IndexedDB
			await dbManager.saveChatFile(chatFile);

			// Update local state
			if (existingFileIndex !== -1) {
				const updatedFiles = [...chatFiles];
				updatedFiles[existingFileIndex] = chatFile;
				setChatFiles(updatedFiles);
			} else {
				setChatFiles((prev) => [...prev, chatFile]);
			}

			setCurrentChatFileState(chatFile);
			setCurrentlySelectedMessage(null);
		} catch (error) {
			console.error("Failed to add/update chat file:", error);
			throw error;
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

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev);
	};

	return (
		<ChatContext.Provider
			value={{
				chatFiles,
				currentChatFile,
				allMessages: currentChatFile?.messages || [],
				treeData: currentChatFile?.treeData || [],
				currentlySelectedMessage,
				isLoading,
				sidebarOpen,
				showHelp,
				fileserverPassword,
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
			}}
		>
			{children}
		</ChatContext.Provider>
	);
};
