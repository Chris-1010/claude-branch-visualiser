import React, { createContext, useContext, useState, ReactNode } from 'react'

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

interface ChatFile {
  id: string
  name: string
  lastUpdated: string
  messages: Message[]
  treeData: MessageWithChildren[]
}

interface ChatContextType {
  chatFiles: ChatFile[]
  currentChatFile: ChatFile | null
  allMessages: Message[]
  treeData: MessageWithChildren[]
  currentlySelectedMessage: MessageWithChildren | null
  addOrUpdateChatFile: (fileName: string, messages: Message[]) => void
  setCurrentChatFile: (chatFile: ChatFile | null) => void
  setCurrentlySelectedMessage: (message: MessageWithChildren | null) => void
  deleteChatFile: (id: string) => void
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

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  //#region State
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [currentChatFile, setCurrentChatFile] = useState<ChatFile | null>(null)
  const [currentlySelectedMessage, setCurrentlySelectedMessage] = useState<MessageWithChildren | null>(null)
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

  //#region Chat File Management
  const addOrUpdateChatFile = (fileName: string, messages: Message[]) => {
    const existingFileIndex = chatFiles.findIndex(file => file.name === fileName)
    const treeData = buildTree(messages)
    
    const chatFile: ChatFile = {
      id: existingFileIndex !== -1 ? chatFiles[existingFileIndex].id : Date.now().toString(),
      name: fileName,
      lastUpdated: new Date().toISOString(),
      messages,
      treeData
    }

    if (existingFileIndex !== -1) {
      // Update existing file
      const updatedFiles = [...chatFiles]
      updatedFiles[existingFileIndex] = chatFile
      setChatFiles(updatedFiles)
    } else {
      // Add new file
      setChatFiles(prev => [...prev, chatFile])
    }

    setCurrentChatFile(chatFile)
    setCurrentlySelectedMessage(null)
  }

  const deleteChatFile = (id: string) => {
    setChatFiles(prev => prev.filter(file => file.id !== id))
    if (currentChatFile?.id === id) {
      setCurrentChatFile(null)
      setCurrentlySelectedMessage(null)
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
        addOrUpdateChatFile,
        setCurrentChatFile,
        setCurrentlySelectedMessage,
        deleteChatFile,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}