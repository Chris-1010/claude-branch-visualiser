import React, { useState } from "react";
import { useChatContext } from "../context/ChatContext";
import MessageContentRenderer from "../utils/MessageContentRenderer";
import { ChevronDown, ChevronRight, Copy, GitBranch } from "lucide-react";

const DetailsPane: React.FC = () => {
	const { currentlySelectedMessage, appMode, selectedDirectory, allMessages } = useChatContext();
	const [thinkingExpanded, setThinkingExpanded] = useState(false);
	const [copyFeedback, setCopyFeedback] = useState(false);

	if (!currentlySelectedMessage) {
		return <div className="details-pane"></div>;
	}

	const messageText =
		currentlySelectedMessage.content?.find((c) => c.type === "text")?.text || currentlySelectedMessage.text || "No text content";

	// Get thinking content if present
	const thinkingContent = currentlySelectedMessage.content?.find((c) => c.type === "thinking");
	const thinkingText = thinkingContent?.thinking;
	const thinkingSummary = thinkingContent?.summaries?.[0]?.summary;

	const branchPath = (currentlySelectedMessage as any).branchPath || {};
	const pathKeys = Object.keys(branchPath);

	// Claude Code git branch: only show if directory has multiple distinct branches
	const gitBranch = (currentlySelectedMessage as any)._gitBranch as string | undefined;
	const showGitBranch = appMode === "claudecode" && !!gitBranch && !!selectedDirectory;
	const showCopyConversation = appMode === "claudecode";

	//#region Copy Conversation
	const copyConversation = () => {
		const messageMap = new Map(allMessages.map((m) => [m.uuid, m]));

		// Walk from current message up to root, collecting the ancestor chain
		const chain: typeof allMessages = [];
		let current: (typeof allMessages)[0] | undefined = currentlySelectedMessage ?? undefined;
		while (current) {
			chain.unshift(current);
			current = current.parent_message_uuid ? messageMap.get(current.parent_message_uuid) : undefined;
		}

		const lines: string[] = [];
		for (const msg of chain) {
			const label = msg.sender === "human" ? "Human" : "Assistant";
			const text = msg.content?.find((c) => c.type === "text")?.text || msg.text || "";
			lines.push(`[${label}]\n${text}`);
		}

		navigator.clipboard.writeText(lines.join("\n\n")).then(() => {
			setCopyFeedback(true);
			setTimeout(() => setCopyFeedback(false), 2000);
		});
	};
	//#endregion

	//#region Date Formatting Helpers
	const formatCreatedDate = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return "Invalid date";

			const day = date.getDate();
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			const month = months[date.getMonth()];

			const hours = date.getHours().toString().padStart(2, "0");
			const minutes = date.getMinutes().toString().padStart(2, "0");

			return `${day} ${month} ${hours}:${minutes}`;
		} catch (error) {
			console.error("Error formatting date:", error);
			return dateString;
		}
	};

	const getRelativeTimeDescription = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return dateString;

			const currentTime = Date.now();
			const targetTime = date.getTime();
			const timeDiff = currentTime - targetTime;

			const minutes = Math.floor(timeDiff / (1000 * 60));
			const hours = Math.floor(timeDiff / (1000 * 60 * 60));
			const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
			const weeks = Math.floor(days / 7);
			const months = Math.floor(days / 30);
			const years = Math.floor(days / 365);

			if (minutes < 60) {
				return minutes <= 1 ? "1 minute ago" : `${minutes} minutes ago`;
			} else if (hours < 24) {
				return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
			} else if (days < 7) {
				return days === 1 ? "1 day ago" : `${days} days ago`;
			} else if (weeks < 4) {
				return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
			} else if (months < 12) {
				return months === 1 ? "1 month ago" : `${months} months ago`;
			} else {
				return years === 1 ? "1 year ago" : `${years} years ago`;
			}
		} catch (error) {
			console.error("Error calculating relative time:", error);
			return dateString;
		}
	};
	//#endregion

	return (
		<div className="details-pane active">
			<div className="details-pane-header">
				<h3>Message Details</h3>
				{showCopyConversation && (
					<button className={`copy-conversation-btn${copyFeedback ? " copied" : ""}`} onClick={copyConversation} title="Copy conversation branch to clipboard">
						<Copy size={14} />
						{copyFeedback ? "Copied!" : "Copy conversation"}
					</button>
				)}
			</div>

			{pathKeys.length > 0 && (
				<div className="message-branch-path">
					<strong title="Open Claude.ai" onClick={() => window.open("http://claude.ai", "_blank")}>
						Branch
					</strong>
					<div className="branches">
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

			{showGitBranch && (
				<div className="message-git-branch">
					<GitBranch size={14} />
					<span>{gitBranch}</span>
				</div>
			)}

			<div className="message-created-at">
				<strong>Created:</strong>
				<span>
					{formatCreatedDate(currentlySelectedMessage.created_at)}
					<small>{getRelativeTimeDescription(currentlySelectedMessage.created_at)}</small>
				</span>
			</div>

			{thinkingText && (
				<div className="message-thinking">
					<div className="thinking-header" onClick={() => setThinkingExpanded(!thinkingExpanded)}>
						{thinkingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
						<strong>Thinking</strong>
						{thinkingSummary && !thinkingExpanded && (
							<span className="thinking-summary">{thinkingSummary}</span>
						)}
					</div>
					{thinkingExpanded && (
						<div className="thinking-content">
							<MessageContentRenderer content={thinkingText} />
						</div>
					)}
				</div>
			)}

			<div className="message-content">
				<strong>Content:</strong>
				<MessageContentRenderer content={messageText} />
			</div>
		</div>
	);
};

export default DetailsPane;
