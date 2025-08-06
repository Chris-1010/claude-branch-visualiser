//#region Imports
import React, { useRef } from 'react'
import { Trash2, Upload, FileText, Clock } from 'lucide-react'
import { useChatContext } from '../context/ChatContext'
//#endregion

const Sidebar: React.FC = () => {
  //#region State and Refs
  const { chatFiles, currentChatFile, setCurrentChatFile, addOrUpdateChatFile, deleteChatFile } = useChatContext()
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  //#endregion

  //#region File Upload Handler
  const handleFileUpdate = (chatFileId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          const chatFile = chatFiles.find(cf => cf.id === chatFileId)
          if (chatFile) {
            addOrUpdateChatFile(chatFile.name, data.chat_messages || [])
          }
        } catch (error) {
          console.error('Error parsing JSON:', error)
        }
      }
      reader.readAsText(file)
    }
    // Reset input
    if (fileInputRefs.current[chatFileId]) {
      fileInputRefs.current[chatFileId]!.value = ''
    }
  }
  //#endregion

  //#region Utility Functions
  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }
  //#endregion

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chat Files</h2>
      </div>
      
      <div className="sidebar-content">
        {chatFiles.length === 0 ? (
          <div className="sidebar-empty">
            <FileText size={48} />
            <p>No chat files loaded</p>
            <p className="sidebar-empty-hint">Upload a file using the header to get started</p>
          </div>
        ) : (
          chatFiles.map((chatFile) => (
            <div 
              key={chatFile.id} 
              className={`sidebar-item ${currentChatFile?.id === chatFile.id ? 'active' : ''}`}
              onClick={() => setCurrentChatFile(chatFile)}
            >
              <div className="sidebar-item-header">
                <FileText size={16} />
                <span className="sidebar-item-name">{chatFile.name}</span>
              </div>
              
              <div className="sidebar-item-info">
                <div className="sidebar-item-updated">
                  <Clock size={12} />
                  <span>Updated {formatLastUpdated(chatFile.lastUpdated)}</span>
                </div>
                <div className="sidebar-item-stats">
                  {chatFile.messages.length} messages
                </div>
              </div>
              
              <div className="sidebar-item-actions">
                <input
                  ref={el => fileInputRefs.current[chatFile.id] = el}
                  type="file"
                  accept=".json"
                  onChange={(e) => handleFileUpdate(chatFile.id, e)}
                  style={{ display: 'none' }}
                />
                <button
                  className="sidebar-action-btn update-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRefs.current[chatFile.id]?.click()
                  }}
                  title="Update chat file"
                >
                  <Upload size={14} />
                </button>
                <button
                  className="sidebar-action-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${chatFile.name}"?`)) {
                      deleteChatFile(chatFile.id)
                    }
                  }}
                  title="Delete chat file"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Sidebar