import React, { createContext, useContext, useState, useEffect } from 'react'
import { dbManager, type ChatFile } from '../utils/indexedDB'


//#region Interfaces
interface MessageContent {
  start_timestamp: string
  stop_timestamp: string
  type: string
  text: string
  citations: any[]
}

interface Message {
  uuid: string
  text: string
  content: MessageContent[]
  sender: string
  index: number
  created_at: string
  updated_at: string
  truncated: boolean
  stop_reason: string
  attachments: any[]
  files: any[]
  files_v2: any[]
  sync_sources: any[]
  parent_message_uuid?: string
  children?: Message[]
}

interface MessageWithChildren extends Message {
  children: Message[]
}

interface ChatContextType {
  chatFiles: ChatFile[]
  currentChatFile: ChatFile | null
  allMessages: Message[]
  treeData: MessageWithChildren[]
  currentlySelectedMessage: MessageWithChildren | null
  isLoading: boolean
  addOrUpdateChatFile: (fileName: string, messages: Message[]) => Promise<void>
  setCurrentChatFile: (chatFile: ChatFile | null) => Promise<void>
  setCurrentlySelectedMessage: (message: MessageWithChildren | null) => void
  deleteChatFile: (id: string) => Promise<void>
  clearAllData: () => Promise<void>
  getStorageInfo: () => Promise<{ count: number; sizeEstimate: string }>
}
//#endregion

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const useChatContext = () => {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  //#region State
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [currentChatFile, setCurrentChatFileState] = useState<ChatFile | null>(null)
  const [currentlySelectedMessage, setCurrentlySelectedMessage] = useState<MessageWithChildren | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  //#endregion

  //#region Tree Building Logic
  const buildTree = (messages: Message[]): MessageWithChildren[] => {
    const messageMap = new Map<string, MessageWithChildren>()
    const roots: MessageWithChildren[] = []

    // Create lookup map with children array
    messages.forEach((msg) => {
      messageMap.set(msg.uuid, { ...msg, children: [] })
    })

    // Build parent-child relationships
    messages.forEach((msg) => {
      if (msg.parent_message_uuid && messageMap.has(msg.parent_message_uuid)) {
        const parent = messageMap.get(msg.parent_message_uuid)!
        const child = messageMap.get(msg.uuid)!
        parent.children.push(child)
      } else {
        const root = messageMap.get(msg.uuid)!
        roots.push(root)
      }
    })

    return roots
  }
  //#endregion

  //#region Load Initial Data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        
        // Load all chat files
        const savedChatFiles = await dbManager.getAllChatFiles()
        
        // Rebuild tree data for all files
        const processedChatFiles = savedChatFiles.map(file => ({
          ...file,
          treeData: buildTree(file.messages)
        }))
        
        setChatFiles(processedChatFiles)
        
        // Load current chat file setting
        const currentChatId = await dbManager.getSetting('currentChatId')
        if (currentChatId && processedChatFiles.length > 0) {
          const currentFile = processedChatFiles.find(file => file.id === currentChatId)
          if (currentFile) {
            setCurrentChatFileState(currentFile)
          }
        }
        
        console.log(`Loaded ${processedChatFiles.length} chat files from IndexedDB`)
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])
  //#endregion

  //#region Chat File Management
  const addOrUpdateChatFile = async (fileName: string, messages: Message[]): Promise<void> => {
    try {
      const existingFileIndex = chatFiles.findIndex(file => file.name === fileName)
      const treeData = buildTree(messages)
      
      const chatFile: ChatFile = {
        id: existingFileIndex !== -1 ? chatFiles[existingFileIndex].id : Date.now().toString(),
        name: fileName,
        lastUpdated: new Date().toISOString(),
        messages,
        treeData
      }

      // Save to IndexedDB
      await dbManager.saveChatFile(chatFile)

      // Update local state
      if (existingFileIndex !== -1) {
        const updatedFiles = [...chatFiles]
        updatedFiles[existingFileIndex] = chatFile
        setChatFiles(updatedFiles)
      } else {
        setChatFiles(prev => [...prev, chatFile])
      }

      setCurrentChatFileState(chatFile)
      setCurrentlySelectedMessage(null)
    } catch (error) {
      console.error('Failed to add/update chat file:', error)
      throw error
    }
  }

  const setCurrentChatFile = async (chatFile: ChatFile | null): Promise<void> => {
    try {
      setCurrentChatFileState(chatFile)
      await dbManager.saveSetting('currentChatId', chatFile?.id || null)
      setCurrentlySelectedMessage(null)
    } catch (error) {
      console.error('Failed to set current chat file:', error)
    }
  }

  const deleteChatFile = async (id: string): Promise<void> => {
    try {
      await dbManager.deleteChatFile(id)
      
      setChatFiles(prev => prev.filter(file => file.id !== id))
      
      if (currentChatFile?.id === id) {
        setCurrentChatFileState(null)
        await dbManager.saveSetting('currentChatId', null)
        setCurrentlySelectedMessage(null)
      }
    } catch (error) {
      console.error('Failed to delete chat file:', error)
      throw error
    }
  }

  const clearAllData = async (): Promise<void> => {
    try {
      await dbManager.clearAllChatFiles()
      await dbManager.saveSetting('currentChatId', null)
      
      setChatFiles([])
      setCurrentChatFileState(null)
      setCurrentlySelectedMessage(null)
      
      console.log('All data cleared from IndexedDB')
    } catch (error) {
      console.error('Failed to clear all data:', error)
      throw error
    }
  }

  const getStorageInfo = async (): Promise<{ count: number; sizeEstimate: string }> => {
    try {
      return await dbManager.getStorageUsage()
    } catch (error) {
      console.error('Failed to get storage info:', error)
      return { count: 0, sizeEstimate: '0MB' }
    }
  }
  //#endregion

  return (
    <ChatContext.Provider
      value={{
        chatFiles,
        currentChatFile,
        allMessages: currentChatFile?.messages || [],
        treeData: currentChatFile?.treeData || [],
        currentlySelectedMessage,
        isLoading,
        addOrUpdateChatFile,
        setCurrentChatFile,
        setCurrentlySelectedMessage,
        deleteChatFile,
        clearAllData,
        getStorageInfo,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}