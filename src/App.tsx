import "./App.css"
import { ChatProvider } from './context/ChatContext'
import Header from './components/Header'
import ChatTree from "./components/ChatTree"
import DetailsPane from './components/DetailsPane'

function App() {
  return (
    <ChatProvider>
        <Header />
        <div className="content">
          <ChatTree />
          <DetailsPane />
        </div>
    </ChatProvider>
  )
}

export default App