import React from 'react'
import { useChatContext } from '../context/ChatContext'
import MessageContentRenderer from '../utils/MessageContentRenderer'

const DetailsPane: React.FC = () => {
  const { currentlySelectedMessage } = useChatContext()

  if (!currentlySelectedMessage) {
    return (
      <div className="details-pane">
      </div>
    )
  }

  const messageText = currentlySelectedMessage.content?.find(c => c.type === 'text')?.text || 
                     currentlySelectedMessage.text || 
                     'No text content';

  return (
    <div className="details-pane active">
      <h3>Message Details</h3>
      <p><strong>Created:</strong> {new Date(currentlySelectedMessage.created_at).toLocaleString()}</p>
      <p><strong>Index:</strong> {currentlySelectedMessage.index}</p>
      <div>
        <strong>Content:</strong>
        <div className="message-content">
          <MessageContentRenderer content={messageText} />
        </div>
      </div>
    </div>
  )
}

export default DetailsPane