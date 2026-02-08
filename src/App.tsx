import { ChatProvider } from "./context/ChatContext";
import Header from "./components/Header";
import ChatTree from "./components/ChatTree";
import DetailsPane from "./components/DetailsPane";
import Search from "./components/Search";
import type { ChatTreeRef } from "./components/ChatTree";
import { useRef } from "react";
import Sidebar from "./components/Sidebar";
import HeatmapToggle from "./components/HeatmapToggle";

function App() {
	const chatTreeRef = useRef<ChatTreeRef>(null);
	return (
		<ChatProvider>
			<Header />
			<Search chatTreeRef={chatTreeRef} />
			<HeatmapToggle />
			<div className="content">
				<Sidebar />
				<ChatTree ref={chatTreeRef} />
				<DetailsPane />
			</div>
		</ChatProvider>
	);
}

export default App;
