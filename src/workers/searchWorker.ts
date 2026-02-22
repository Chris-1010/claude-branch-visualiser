interface SearchMessage {
	chatFiles: { name: string; displayName: string; messages: any[] }[];
	query: string;
}

interface SearchResult {
	message: any;
	matchText: string;
	context: string;
	isTitleMatch?: boolean;
}

const MAX_RESULTS = 100;

self.onmessage = (e: MessageEvent<SearchMessage>) => {
	const { chatFiles, query } = e.data;
	const searchTerm = query.toLowerCase();
	const results: SearchResult[] = [];

	for (const chatFile of chatFiles) {
		if (results.length >= MAX_RESULTS) break;
		const seenTitles = new Set<string>();

		for (const message of chatFile.messages) {
			if (results.length >= MAX_RESULTS) break;

			const titleText = message.custom_title || "";
			const messageText = message.content?.find((c: any) => c.type === "text")?.text || message.text || "";
			const thinkingText = message.content?.find((c: any) => c.type === "thinking")?.thinking || "";

			const titleMatch = titleText && titleText.toLowerCase().includes(searchTerm) && !seenTitles.has(titleText);
			const contentMatch = (messageText + " " + thinkingText).toLowerCase().includes(searchTerm);

			if (!titleMatch && !contentMatch) continue;

			if (titleMatch) {
				seenTitles.add(titleText);
				const matchIndex = titleText.toLowerCase().indexOf(searchTerm);
				results.push({
					message: { ...message, _chatFileName: chatFile.name, _chatFileDisplayName: chatFile.displayName },
					matchText: titleText.substring(matchIndex, matchIndex + searchTerm.length),
					context: titleText,
					isTitleMatch: true,
				});
			} else {
				let sourceText = messageText;
				let matchIndex = messageText.toLowerCase().indexOf(searchTerm);
				let isThinkingMatch = false;

				if (matchIndex === -1 && thinkingText) {
					sourceText = thinkingText;
					matchIndex = thinkingText.toLowerCase().indexOf(searchTerm);
					isThinkingMatch = true;
				}

				const contextStart = Math.max(0, matchIndex - 50);
				const contextEnd = Math.min(sourceText.length, matchIndex + searchTerm.length + 50);

				let context = sourceText.substring(contextStart, contextEnd);
				if (contextStart > 0) context = "..." + context;
				if (contextEnd < sourceText.length) context = context + "...";
				if (isThinkingMatch) context = "[Thinking] " + context;

				results.push({
					message: { ...message, _chatFileName: chatFile.name, _chatFileDisplayName: chatFile.displayName },
					matchText: sourceText.substring(matchIndex, matchIndex + searchTerm.length),
					context,
				});
			}
		}
	}

	// Sort results by date (newest first)
	const parseDate = (d: any) => {
		if (!d) return 0;
		const t = new Date(d).getTime();
		return isNaN(t) ? 0 : t;
	};

	results.sort((a, b) => parseDate(b.message.created_at) - parseDate(a.message.created_at));

	self.postMessage(results);
};