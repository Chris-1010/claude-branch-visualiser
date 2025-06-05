import React, { useState } from "react"
import "../assets/styles/ChatTree.css"
import { useChatContext } from '../context/ChatContext'

const ChatTree = () => {
  const { treeData, currentlySelectedMessage, setCurrentlySelectedMessage } = useChatContext()

  const handleNodeClick = (node: any) => {
    setCurrentlySelectedMessage(node)
  }

  const getNodeText = (node: any): string => {
    if (node.content && node.content.length > 0) {
      return node.content.find((c: any) => c.type === "text")?.text || "No text content"
    }
    return node.text || "Empty message"
  }

  // Filter to show only human messages
  const filterHumanMessages = (nodes: any[]): any[] => {
    return nodes.filter(node => node.sender === 'human').map(node => ({
      ...node,
      children: node.children ? filterHumanMessages(node.children) : []
    }))
  }

  const TreeNode = ({ node, isLast = false }: { node: any; isLast?: boolean }) => {
    return (
      <li className={`tree-node ${isLast ? "last-child" : ""}`}>
        <div
          className="node-content"
          onClick={() => handleNodeClick(node)}
        >
          {getNodeText(node)}
        </div>
        {node.children && node.children.length > 0 && (
          <ul className="tree-children">
            {node.children.map((child: any, index: number) => (
              <TreeNode
                key={child.uuid}
                node={child}
                isLast={index === node.children.length - 1}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const humanOnlyTreeData = filterHumanMessages(treeData)

  return (
    <div className="chat-tree-container" onClick={() => currentlySelectedMessage ? setCurrentlySelectedMessage(null) : null}>
      <ul className="tree-root">
        {humanOnlyTreeData.map((rootNode, index) => (
          <TreeNode key={rootNode.uuid} node={rootNode} isLast={index === humanOnlyTreeData.length - 1} />
        ))}
      </ul>
    </div>
  )
}

export default ChatTree