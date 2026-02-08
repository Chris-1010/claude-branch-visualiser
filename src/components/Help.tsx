import { useChatContext } from "../context/ChatContext";
import { XSquareIcon } from "lucide-react";

const Help = () => {
	const { showHelp, setShowHelp, setFileserverPassword } = useChatContext();

	//#region Password Input Handler
	const handlePasswordSetup = async () => {
		const password = prompt("Enter fileserver password:");

		if (password) {
			await setFileserverPassword(password);
			alert("Password saved! You can now use the sync button.");
			setShowHelp(false);
		}
	};
	//#endregion

	return (
		<section className={`help${showHelp ? " active" : ""}`}>
			<XSquareIcon className="close" color="red" size={60} onClick={() => setShowHelp(false)} />
			<div>
				<h2>
					How to <strong>Download Your Conversation Data</strong> from{" "}
					<i onClick={() => window.open("http://claude.ai", "_blank")}>Claude.ai</i>
				</h2>
				<ol>
					<li>
						Open <strong>browser developer tools</strong>
					</li>
					<li>
						Switch to <strong>network tab</strong>
					</li>
					<li>
						<strong>Reload</strong> page if needed
					</li>
					<li>
						Type 'tree' in the <strong>filter</strong> input field
					</li>
					<li>
						Click on the single <strong>matching file</strong>
					</li>
					<li>
						In this file's details pane, go to the <strong>Response tab</strong>
					</li>
					<li>
						<b>Ctrl + A, Ctrl + C</b> on the file's contents to <strong>copy all</strong>
					</li>
					<li>
						<strong>Paste</strong> this copied text into a file and name it (<b>.json</b> extension appended ideally)
					</li>
					<li>
						<strong>Upload</strong> this newly created file to this page
					</li>
					<li>
						<strong>View your chats</strong> in a neat diagram display
					</li>
					<li>
						<strong>Click any message</strong> to see the full chat in the details pane
					</li>
					<li>
						<strong>Search</strong>{" "}
						<small>
							(Keyboard Shortcut <b>S</b>)
						</small>{" "}
						for text within chat messages using the search icon at the bottom left of the screen
					</li>
					<li>
						<strong>Heatmap</strong>{" "}
						<small>
							(Keyboard Shortcut <b>H</b>)
						</small>{" "}
						toggle to color the tree by message timestamp using the flame icon at the bottom right of the screen
					</li>
				</ol>
				<a
					href="#"
					onClick={(e) => {
						e.preventDefault();
						handlePasswordSetup();
					}}
				>
					Know the password for the fileserver?
				</a>
			</div>
		</section>
	);
};

export default Help;
