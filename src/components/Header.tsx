import React from "react";
import { Menu } from "lucide-react";
import { useChatContext } from "../context/ChatContext";

const Header: React.FC = () => {
	const { sidebarOpen, toggleSidebar } = useChatContext();

	return (
		<header>
			<Menu size={40} className={`sidebar-icon${sidebarOpen ? ' active' : ''}`} onClick={toggleSidebar} />
			<h1>Claude Branch Visualiser</h1>
		</header>
	);
};

export default Header;