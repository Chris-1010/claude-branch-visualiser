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
			<h3>Message Details</h3>

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

			<div className="message-created-at">
				<strong>Created:</strong>
				<span>
					{formatCreatedDate(currentlySelectedMessage.created_at)}
					<small>{getRelativeTimeDescription(currentlySelectedMessage.created_at)}</small>
				</span>
			</div>
			<div className="message-content">
				<strong>Content:</strong>
				<MessageContentRenderer content={messageText} />
			</div>
		</div>
	);
};

export default DetailsPane;
