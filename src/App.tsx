import { ChatProvider, useChatContext } from "./context/ChatContext";
import Header from "./components/Header";
import ChatTree from "./components/ChatTree";
import DetailsPane from "./components/DetailsPane";
import Search from "./components/Search";
import type { ChatTreeRef } from "./components/ChatTree";
import { useRef } from "react";
import Sidebar from "./components/Sidebar";
import HeatmapToggle from "./components/HeatmapToggle";
import LandingPage from "./components/LandingPage";
import Help from "./components/Help";

// Renders the active View. Help is mounted once here so it is shared by both Views.
function AppContent() {
	const { view } = useChatContext();
	const chatTreeRef = useRef<ChatTreeRef>(null);

	return (
		<>
			{view === "home" ? (
				<LandingPage />
			) : (
				<>
					<Header />
					<Search chatTreeRef={chatTreeRef} />
					<HeatmapToggle />
					<div className="content">
						<Sidebar />
						<ChatTree ref={chatTreeRef} />
						<DetailsPane />
					</div>
				</>
			)}
			<Help />
		</>
	);
}

function App() {
	return (
		<ChatProvider>
			<AppContent />
		</ChatProvider>
	);
}

export default App;
