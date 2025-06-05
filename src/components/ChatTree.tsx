import React, { useState, useEffect } from "react"
import "../assets/styles/ChatTree.css"

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

const ChatTree = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [treeData, setTreeData] = useState<MessageWithChildren[]>([])
  const [hoveredNode, setHoveredNode] = useState<MessageWithChildren | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
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

    if (messages && messages.length > 0) {
      const tree = buildTree(messages)
      setTreeData(tree)
    }
  }, [messages])

  const handleMouseEnter = (node: MessageWithChildren, event: React.MouseEvent) => {
    setHoveredNode(node)
    setMousePosition({ x: event.clientX, y: event.clientY })
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (hoveredNode) {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
  }

  const handleMouseLeave = () => {
    setHoveredNode(null)
  }

  const getNodeText = (node: MessageWithChildren): string => {
    if (node.content && node.content.length > 0) {
      return node.content.find((c) => c.type === "text")?.text || "No text content"
    }
    return node.text || "Empty message"
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const TreeNode = ({ node, isLast = false }: { node: MessageWithChildren; isLast?: boolean }) => {
    return (
      <li className={`tree-node ${isLast ? "last-child" : ""}`}>
        <div
          className="node-content"
          // onMouseEnter={(e) => handleMouseEnter(node, e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {getNodeText(node)}
        </div>
        {node.children && node.children.length > 0 && (
          <ul className="tree-children">
            {node.children.map((child, index) => (
              <TreeNode
                key={child.uuid}
                node={child as MessageWithChildren}
                isLast={index === node.children.length - 1}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <>
      <input
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              try {
                const data = JSON.parse(event.target?.result as string)
                // Extract the chat_messages array from the conversation object
                setMessages(data.chat_messages || [])
              } catch (error) {
                console.error("Error parsing JSON:", error)
              }
            }
            reader.readAsText(file)
          }
        }}
      />
      <div className="chat-tree-container">
        <ul className="tree-root">
          {treeData.map((rootNode, index) => (
            <TreeNode key={rootNode.uuid} node={rootNode} isLast={index === treeData.length - 1} />
          ))}
        </ul>

        {hoveredNode && (
          <div
            className="tooltip"
            style={{
              position: "fixed",
              left: mousePosition.x + 10,
              top: mousePosition.y - 10,
              zIndex: 1000,
            }}
          >
            <strong>Created:</strong> {formatDate(hoveredNode.created_at)}
            <br />
            <strong>Sender:</strong> {hoveredNode.sender}
            <br />
            <strong>Index:</strong> {hoveredNode.index}
          </div>
        )}
      </div>
    </>
  )
}

export default ChatTree
