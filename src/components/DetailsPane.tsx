import React from "react";
import { useChatContext } from "../context/ChatContext";
import MessageContentRenderer from "../utils/MessageContentRenderer";

const DetailsPane: React.FC = () => {
	const { currentlySelectedMessage } = useChatContext();

	if (!currentlySelectedMessage) {
		return <div className="details-pane"></div>;
	}

	const messageText =
		currentlySelectedMessage.content?.find((c) => c.type === "text")?.text || currentlySelectedMessage.text || "No text content";

	const branchPath = (currentlySelectedMessage as any).branchPath || {};
	const pathKeys = Object.keys(branchPath);

	return (
		<div className="details-pane active">
			<h3>Message Details</h3>

			{pathKeys.length > 0 && (
				<div className="branch-path">
					<strong title="Open Claude.ai" onClick={() => window.open("http://claude.ai", "_blank")}>
						Branch
					</strong>
					<div>
						{pathKeys.map((key) => {
							const { position, hasSiblings } = branchPath[key];
							return (
								<span key={key} className={hasSiblings ? "branch-number branched" : "branch-number"}>
									{position}
								</span>
							);
						})}
					</div>
				</div>
			)}

			<p>
				<strong>Created:</strong> {new Date(currentlySelectedMessage.created_at).toLocaleString()}
			</p>
			<div>
				<strong>Content:</strong>
				<div className="message-content">
					<MessageContentRenderer content={messageText} />
				</div>
			</div>
		</div>
	);
};

export default DetailsPane;
