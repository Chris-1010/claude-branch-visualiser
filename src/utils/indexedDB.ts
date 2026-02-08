//#region Database Configuration
const DB_NAME = "claude_branch_visualizer";
const DB_VERSION = 1;
const CHAT_FILES_STORE = "chat_files";
const SETTINGS_STORE = "settings";
//#endregion

//#region Database Interface
interface ChatFile {
	id: string;
	name: string;
	displayName?: string;
	lastUpdated: string;
	messages: any[];
	treeData?: any[];
}
//#endregion

class IndexedDBManager {
	private db: IDBDatabase | null = null;

	//#region Database Initialization
	async initDB(): Promise<IDBDatabase> {
		if (this.db) return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				console.error("Failed to open IndexedDB:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.db = request.result;
				console.log("IndexedDB opened successfully");
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create chat files store
				if (!db.objectStoreNames.contains(CHAT_FILES_STORE)) {
					const chatStore = db.createObjectStore(CHAT_FILES_STORE, { keyPath: "id" });
					chatStore.createIndex("name", "name", { unique: false });
					chatStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
					console.log("Created chat_files object store");
				}

				// Create settings store
				if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
					db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
					console.log("Created settings object store");
				}
			};
		});
	}
	//#endregion

	//#region Chat Files Operations
	async saveChatFile(chatFile: ChatFile): Promise<void> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([CHAT_FILES_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_FILES_STORE);

			const request = store.put(chatFile);

			request.onsuccess = () => {
				console.log("Chat file saved:", chatFile.name);
				resolve();
			};

			request.onerror = () => {
				console.error("Failed to save chat file:", request.error);
				reject(request.error);
			};
		});
	}

	async getChatFile(id: string): Promise<ChatFile | null> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([CHAT_FILES_STORE], "readonly");
			const store = transaction.objectStore(CHAT_FILES_STORE);

			const request = store.get(id);

			request.onsuccess = () => {
				resolve(request.result || null);
			};

			request.onerror = () => {
				console.error("Failed to get chat file:", request.error);
				reject(request.error);
			};
		});
	}

	async getAllChatFiles(): Promise<ChatFile[]> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([CHAT_FILES_STORE], "readonly");
			const store = transaction.objectStore(CHAT_FILES_STORE);

			const request = store.getAll();

			request.onsuccess = () => {
				console.log("Loaded chat files from IndexedDB:", request.result.length);
				resolve(request.result);
			};

			request.onerror = () => {
				console.error("Failed to get all chat files:", request.error);
				reject(request.error);
			};
		});
	}

	async deleteChatFile(id: string): Promise<void> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([CHAT_FILES_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_FILES_STORE);

			const request = store.delete(id);

			request.onsuccess = () => {
				console.log("Chat file deleted:", id);
				resolve();
			};

			request.onerror = () => {
				console.error("Failed to delete chat file:", request.error);
				reject(request.error);
			};
		});
	}

	async clearAllChatFiles(): Promise<void> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([CHAT_FILES_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_FILES_STORE);

			const request = store.clear();

			request.onsuccess = () => {
				console.log("All chat files cleared");
				resolve();
			};

			request.onerror = () => {
				console.error("Failed to clear chat files:", request.error);
				reject(request.error);
			};
		});
	}
	//#endregion

	//#region Password Operations
	async savePassword(password: string): Promise<void> {
		await this.saveSetting("fileserver_password", password);
	}

	async getPassword(): Promise<string | null> {
		return await this.getSetting("fileserver_password");
	}

	async clearPassword(): Promise<void> {
		await this.saveSetting("fileserver_password", null);
	}
	//#endregion

	//#region Settings Operations
	async saveSetting(key: string, value: any): Promise<void> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SETTINGS_STORE], "readwrite");
			const store = transaction.objectStore(SETTINGS_STORE);

			const request = store.put({ key, value });

			request.onsuccess = () => {
				console.log("Setting saved:", key, value);
				resolve();
			};

			request.onerror = () => {
				console.error("Failed to save setting:", request.error);
				reject(request.error);
			};
		});
	}

	async getSetting(key: string): Promise<any> {
		const db = await this.initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SETTINGS_STORE], "readonly");
			const store = transaction.objectStore(SETTINGS_STORE);

			const request = store.get(key);

			request.onsuccess = () => {
				resolve(request.result?.value || null);
			};

			request.onerror = () => {
				console.error("Failed to get setting:", request.error);
				reject(request.error);
			};
		});
	}
	//#endregion

	//#region Database Statistics
	async getStorageUsage(): Promise<{ count: number; sizeEstimate: string }> {
		try {
			const db = await this.initDB();

			// Get count without loading all data
			const count = await new Promise<number>((resolve, reject) => {
				const transaction = db.transaction([CHAT_FILES_STORE], "readonly");
				const store = transaction.objectStore(CHAT_FILES_STORE);
				const request = store.count();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			// Use Storage API for size estimate instead of loading + serializing everything
			let sizeEstimate = "N/A";
			if (navigator.storage?.estimate) {
				const estimate = await navigator.storage.estimate();
				const usageBytes = estimate.usage || 0;
				sizeEstimate = `${(usageBytes / 1024 / 1024).toFixed(2)}MB`;
			}

			return { count, sizeEstimate };
		} catch (error) {
			console.error("Failed to get storage usage:", error);
			return { count: 0, sizeEstimate: "0MB" };
		}
	}
	//#endregion
}

// Export singleton instance
export const dbManager = new IndexedDBManager();
export type { ChatFile };
