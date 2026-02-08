interface SearchMessage {
	chatFiles: { name: string; messages: any[] }[];
	query: string;
}

interface SearchResult {
	message: any;
	matchText: string;
	context: string;
}

const MAX_RESULTS = 100;

self.onmessage = (e: MessageEvent<SearchMessage>) => {
	const { chatFiles, query } = e.data;
	const searchTerm = query.toLowerCase();
	const results: SearchResult[] = [];

	for (const chatFile of chatFiles) {
		if (results.length >= MAX_RESULTS) break;

		for (const message of chatFile.messages) {
			if (results.length >= MAX_RESULTS) break;

			const messageText = message.content?.find((c: any) => c.type === "text")?.text || message.text || "";
			const thinkingText = message.content?.find((c: any) => c.type === "thinking")?.thinking || "";
			const combinedText = messageText + " " + thinkingText;

			if (combinedText.toLowerCase().includes(searchTerm)) {
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
					message: { ...message, _chatFileName: chatFile.name },
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
