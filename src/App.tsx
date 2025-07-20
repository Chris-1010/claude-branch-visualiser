import { ChatProvider } from "./context/ChatContext";
import Header from "./components/Header";
import ChatTree from "./components/ChatTree";
import DetailsPane from "./components/DetailsPane";
import Search from "./components/Search";
import type { ChatTreeRef } from './components/ChatTree';
import { useRef } from "react";

function App() {
	const chatTreeRef = useRef<ChatTreeRef>(null);
	return (
		<ChatProvider>
			<Header />
			<Search chatTreeRef={chatTreeRef} />
			<div className="content">
				<ChatTree ref={chatTreeRef} />
				<DetailsPane />
			</div>
		</ChatProvider>
	);
}

export default App;
