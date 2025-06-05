import React, { createContext, useContext, useState, ReactNode } from 'react'

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
  allMessages: Message[]
  treeData: MessageWithChildren[]
  currentlySelectedMessage: MessageWithChildren | null
  setAllMessages: (messages: Message[]) => void
  setCurrentlySelectedMessage: (message: MessageWithChildren | null) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const useChatContext = () => {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [treeData, setTreeData] = useState<MessageWithChildren[]>([])
  const [currentlySelectedMessage, setCurrentlySelectedMessage] = useState<MessageWithChildren | null>(null)

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

  const handleSetAllMessages = (messages: Message[]) => {
    setAllMessages(messages)
    if (messages && messages.length > 0) {
      const tree = buildTree(messages)
      setTreeData(tree)
    }
  }

  return (
    <ChatContext.Provider
      value={{
        allMessages,
        treeData,
        currentlySelectedMessage,
        setAllMessages: handleSetAllMessages,
        setCurrentlySelectedMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}