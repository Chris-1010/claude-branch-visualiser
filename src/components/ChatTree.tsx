//#region Imports
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as go from "gojs";
import { useChatContext } from "../context/ChatContext";
import Help from "./Help";
//#endregion

// 10 branch colours that suit white text on dark backgrounds
const BRANCH_COLORS = [
	"#5c6bc0", // indigo
	"#26a69a", // teal
	"#ab47bc", // purple
	"#ef5350", // red
	"#29b6f6", // light blue
	"#66bb6a", // green
	"#ffa726", // amber
	"#ec407a", // pink
	"#8d6e63", // brown
	"#78909c", // blue-grey
];

function getBranchColor(branch: string, branchIndex: Map<string, number>): string {
	if (!branchIndex.has(branch)) {
		branchIndex.set(branch, branchIndex.size % BRANCH_COLORS.length);
	}
	return BRANCH_COLORS[branchIndex.get(branch)!];
}

interface ChatTreeRef {
	scrollToMessage: (messageUuid: string) => void;
}

const ChatTree = forwardRef<ChatTreeRef, {}>((_, ref) => {
	const { treeData, currentlySelectedMessage, setCurrentlySelectedMessage, heatmapEnabled, appMode } = useChatContext();
	const diagramInstanceRef = useRef<go.Diagram | null>(null);
	const diagramRef = useRef<HTMLDivElement>(null);
	const isProgrammaticSelectionRef = useRef(false);

	//#region GoJS Initialization
	useEffect(() => {
		if (!diagramRef.current) return;

		// Create the diagram
		const myDiagram = new go.Diagram(diagramRef.current, {
			"undoManager.isEnabled": true,
			layout: new go.TreeLayout({
				angle: 90,
				layerSpacing: 35,
				nodeSpacing: 10,
				arrangement: go.TreeLayout.ArrangementHorizontal,
			}),
			"toolManager.hoverDelay": 100,
			"animationManager.isEnabled": false,
			scrollsPageOnFocus: false,
			padding: new go.Margin(200, 500, 100, 320),
		});

		// Define node template
		myDiagram.nodeTemplate = new go.Node("Vertical", {
			movable: false,
			copyable: false,
			deletable: false,
		}).add(
			new go.TextBlock({
				font: "bold 11px sans-serif",
				stroke: "#ff9100",
				margin: new go.Margin(0, 0, 3, 0),
				maxSize: new go.Size(200, NaN),
				wrap: go.TextBlock.WrapFit,
				textAlign: "center",
				visible: false,
			})
				.bind("text", "sessionLabel")
				.bind("visible", "sessionLabel", (label) => !!label),
			new go.Panel("Auto").add(
				new go.Shape("RoundedRectangle", {
					name: "nodeShape",
					strokeWidth: 2,
					stroke: "#555",
					fill: "#333",
				})
					.bind("fill", "color")
					.bind("stroke", "borderColor"),
				new go.TextBlock({
					margin: 8,
					font: "12px sans-serif",
					stroke: "white",
					maxSize: new go.Size(200, NaN),
					wrap: go.TextBlock.WrapFit,
					textAlign: "center",
				}).bind("text")
			)
		);

		// Define link template
		myDiagram.linkTemplate = new go.Link({
			routing: go.Link.Orthogonal,
			corner: 5,
			selectable: false,
			reshapable: false,
			relinkableFrom: false,
			relinkableTo: false,
		}).add(new go.Shape({ strokeWidth: 2, stroke: "#666" }));

		// Handle selection changes without triggering scroll
		myDiagram.addDiagramListener("ChangedSelection", (_) => {
			if (isProgrammaticSelectionRef.current) return;
			const selectedNode = myDiagram.selection.first();
			if (selectedNode && selectedNode.data) {
				setCurrentlySelectedMessage(selectedNode.data.originalMessage);
			} else {
				setCurrentlySelectedMessage(null);
			}
		});

		// Handle clicks on empty space to deselect
		myDiagram.addDiagramListener("BackgroundSingleClicked", () => {
			setCurrentlySelectedMessage(null);
		});

		// Disable automatic scrolling when selecting
		myDiagram.commandHandler.scrollToPart = function () {
			// Override to do nothing - prevents automatic scrolling
		};

		diagramInstanceRef.current = myDiagram;

		return () => {
			if (diagramInstanceRef.current) {
				diagramInstanceRef.current.div = null;
			}
		};
	}, [setCurrentlySelectedMessage]);

	//#endregion

	//#region Heatmap
	const getTimestampRange = (treeData: any[]): { minTime: number; maxTime: number } => {
		let minTime = Infinity;
		let maxTime = -Infinity;

		const traverse = (node: any) => {
			if (node.created_at) {
				const time = new Date(node.created_at).getTime();
				if (!isNaN(time)) {
					if (time < minTime) minTime = time;
					if (time > maxTime) maxTime = time;
				}
			}
			node.children?.forEach(traverse);
		};

		treeData.forEach(traverse);
		return { minTime, maxTime };
	};

	const getHeatmapColor = (timestamp: string, minTime: number, maxTime: number): string => {
		const time = new Date(timestamp).getTime();
		if (isNaN(time) || maxTime === minTime) return "#8B2500";

		const t = (time - minTime) / (maxTime - minTime);

		const hue = t * 45;
		const saturation = 80 + t * 20;
		const lightness = 15 + t * 50;

		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	};

	const parseColor = (color: string): [number, number, number] => {
		const ctx = document.createElement("canvas").getContext("2d")!;
		ctx.fillStyle = color;
		const hex = ctx.fillStyle;
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return [r, g, b];
	};

	const lerpColor = (from: [number, number, number], to: [number, number, number], t: number): string => {
		const r = Math.round(from[0] + (to[0] - from[0]) * t);
		const g = Math.round(from[1] + (to[1] - from[1]) * t);
		const b = Math.round(from[2] + (to[2] - from[2]) * t);
		return `rgb(${r},${g},${b})`;
	};

	const getNodeTargetColor = useCallback((node: go.Node, enabled: boolean, timeRange: { minTime: number; maxTime: number } | null): string => {
		const msg = node.data?.originalMessage;
		if (!msg) return "#333";
		if (enabled && timeRange) {
			return getHeatmapColor(msg.created_at, timeRange.minTime, timeRange.maxTime);
		}
		return msg.sender === "human" ? "#444" : "#ff6f00";
	}, []);

	const animateHeatmapTransition = useCallback((diagram: go.Diagram, enabled: boolean, treeData: any[]) => {
		const timeRange = enabled ? getTimestampRange(treeData) : null;
		const duration = 500;
		const startTime = performance.now();

		// Capture starting colors and compute targets for each node
		const nodeColors: Map<string, { from: [number, number, number]; to: [number, number, number] }> = new Map();
		diagram.nodes.each((node) => {
			const shape = node.findObject("nodeShape") as go.Shape | null;
			const currentFill = (shape?.fill as string) || "#333";
			const targetColor = getNodeTargetColor(node, enabled, timeRange);
			nodeColors.set(node.key as string, {
				from: parseColor(currentFill),
				to: parseColor(targetColor),
			});
		});

		const animate = (now: number) => {
			const elapsed = now - startTime;
			const t = Math.min(elapsed / duration, 1);
			const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out

			diagram.commit(() => {
				diagram.nodes.each((node) => {
					const colors = nodeColors.get(node.key as string);
					if (!colors) return;
					const shape = node.findObject("nodeShape") as go.Shape;
					if (shape) {
						shape.fill = lerpColor(colors.from, colors.to, eased);
					}
				});
			}, "heatmap transition");

			if (t < 1) {
				requestAnimationFrame(animate);
			} else {
				// Ensure final data model values are in sync
				diagram.commit(() => {
					diagram.nodes.each((node) => {
						const targetColor = getNodeTargetColor(node, enabled, timeRange);
						diagram.model.setDataProperty(node.data, "color", targetColor);
					});
				}, "heatmap finalize");
			}
		};

		requestAnimationFrame(animate);
	}, [getNodeTargetColor]);
	//#endregion

	//#region Data Processing
	const getNodeText = (node: any): string => {
		if (node.content && node.content.length > 0) {
			const textContent = node.content.find((c: any) => c.type === "text")?.text;
			if (textContent) {
				// Truncate long messages for display
				return textContent.length > 100 ? textContent.substring(0, 100) + "..." : textContent;
			}
		}
		return node.text || "Empty message";
	};

	const convertTreeDataToGoJS = (treeData: any[]) => {
		const nodes: any[] = [];
		const links: any[] = [];
		const timeRange = heatmapEnabled ? getTimestampRange(treeData) : null;
		const isClaudeCodeMode = appMode === "claudecode";

		// Build branch colour index for Claude Code mode
		const branchColorIndex = new Map<string, number>();

		const processNode = (node: any, parentKey?: string) => {
			const color = heatmapEnabled && timeRange
				? getHeatmapColor(node.created_at, timeRange.minTime, timeRange.maxTime)
				: node.sender === "human" ? "#444" : "#ff6f00";

			// Border colour: branch colour in CC mode (when _gitBranch is set), else selection-only
			let borderColor = "#555";
			if (isClaudeCodeMode && node._gitBranch) {
				borderColor = getBranchColor(node._gitBranch, branchColorIndex);
			}

			// Session label: only on root nodes in CC mode
			const isRoot = !parentKey;
			const sessionLabel = (isClaudeCodeMode && isRoot && node._sessionName) ? node._sessionName : null;

			const nodeData = {
				key: node.uuid,
				text: getNodeText(node),
				color,
				borderColor,
				isSelected: currentlySelectedMessage?.uuid === node.uuid,
				customTitle: node.custom_title || null,
				sessionLabel,
				originalMessage: node,
			};
			nodes.push(nodeData);

			if (parentKey) {
				links.push({ from: parentKey, to: node.uuid });
			}

			if (node.children && node.children.length > 0) {
				node.children.forEach((child: any) => {
					processNode(child, node.uuid);
				});
			}
		};

		treeData.forEach((rootNode) => {
			processNode(rootNode);
		});

		return { nodes, links };
	};
	//#endregion

	//#region Update Diagram
	useEffect(() => {
		if (!diagramInstanceRef.current) return;
		else if (!treeData || !treeData.length) {
			diagramInstanceRef.current.model = new go.GraphLinksModel([], []);
			return;
		}

		const { nodes, links } = convertTreeDataToGoJS(treeData);

		diagramInstanceRef.current.model = new go.GraphLinksModel(nodes, links);

		diagramInstanceRef.current.nodes.each((node) => {
			if (node.data.originalMessage?.uuid === currentlySelectedMessage?.uuid) {
				diagramInstanceRef.current!.select(node);
			}
		});
	}, [treeData]);

	// Animate heatmap color transitions
	const heatmapInitialised = useRef(false);
	useEffect(() => {
		// Skip animation on initial render — colors are already correct from model build
		if (!heatmapInitialised.current) {
			heatmapInitialised.current = true;
			return;
		}
		if (!diagramInstanceRef.current || !treeData?.length) return;
		animateHeatmapTransition(diagramInstanceRef.current, heatmapEnabled, treeData);
	}, [heatmapEnabled]);
	//#endregion

	//#region Handle Selection Updates
	useEffect(() => {
		if (!diagramInstanceRef.current) return;

		const currentScrollPosition = diagramInstanceRef.current.position.copy();

		isProgrammaticSelectionRef.current = true;
		diagramInstanceRef.current.clearSelection();
		if (currentlySelectedMessage) {
			diagramInstanceRef.current.nodes.each((node) => {
				if (node.data.originalMessage?.uuid === currentlySelectedMessage.uuid) {
					diagramInstanceRef.current!.select(node);
				}
			});
		}
		isProgrammaticSelectionRef.current = false;

		// Restore scroll position immediately after selection change
		requestAnimationFrame(() => {
			if (diagramInstanceRef.current) {
				diagramInstanceRef.current.position = currentScrollPosition;
			}
		});
	}, [currentlySelectedMessage]);
	//#endregion

	//#region Expose Scroll Method
	useEffect(() => {
		// Expose scrollToMessage method on the diagram instance for external use
		if (diagramInstanceRef.current) {
			(diagramInstanceRef.current as any).scrollToMessage = (messageUuid: string) => {
				const node = diagramInstanceRef.current!.findNodeForKey(messageUuid);
				if (node) {
					diagramInstanceRef.current!.select(node);
					diagramInstanceRef.current!.centerRect(node.actualBounds);
				}
			};
		}
	}, []);

	useImperativeHandle(ref, () => ({
		scrollToMessage: (messageUuid: string) => {
			if (diagramInstanceRef.current) {
				const node = diagramInstanceRef.current.findNodeForKey(messageUuid);
				if (node) {
					diagramInstanceRef.current.select(node);
					diagramInstanceRef.current.centerRect(node.actualBounds);
				}
			}
		},
	}));
	//#endregion

	return (
		<>
			<div className="chat-tree-container">
				<div
					ref={diagramRef}
					style={{
						width: "100%",
						height: "100%",
						backgroundColor: `${appMode === "claudeai" ? "#1a1a1a" : "#000000"}`,
					}}
				/>
			</div>
			<Help />
		</>
	);
});

export default ChatTree;
export type { ChatTreeRef };
