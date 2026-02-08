//#region Imports
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as go from "gojs";
import { useChatContext } from "../context/ChatContext";
import Help from "./Help";
//#endregion

interface ChatTreeRef {
	scrollToMessage: (messageUuid: string) => void;
}

const ChatTree = forwardRef<ChatTreeRef, {}>((_, ref) => {
	const { treeData, currentlySelectedMessage, setCurrentlySelectedMessage, heatmapEnabled } = useChatContext();
	const diagramInstanceRef = useRef<go.Diagram | null>(null);
	const diagramRef = useRef<HTMLDivElement>(null);

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
		myDiagram.nodeTemplate = new go.Node("Auto", {
			movable: false,
			copyable: false,
			deletable: false,
		}).add(
			new go.Shape("RoundedRectangle", {
				strokeWidth: 1,
				stroke: "#555",
				fill: "#333",
			})
				.bind("fill", "color")
				.bind("stroke", "isSelected", (sel) => (sel ? "#ff6f00" : "#555")),
			new go.TextBlock({
				margin: 8,
				font: "12px sans-serif",
				stroke: "white",
				maxSize: new go.Size(200, NaN),
				wrap: go.TextBlock.WrapFit,
				textAlign: "center",
			}).bind("text")
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
			const selectedNode = myDiagram.selection.first();
			if (selectedNode && selectedNode.data) {
				setCurrentlySelectedMessage(selectedNode.data.originalMessage);
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
			const shape = node.findObject("") as go.Shape | null;
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
					const shape = node.findMainElement() as go.Shape;
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

		const processNode = (node: any, parentKey?: string) => {
			const color = heatmapEnabled && timeRange
				? getHeatmapColor(node.created_at, timeRange.minTime, timeRange.maxTime)
				: node.sender === "human" ? "#444" : "#ff6f00";

			const nodeData = {
				key: node.uuid,
				text: getNodeText(node),
				color,
				isSelected: currentlySelectedMessage?.uuid === node.uuid,
				originalMessage: node,
			};
			nodes.push(nodeData);

			// Link to parent if exists
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
		if (!diagramInstanceRef.current || !treeData?.length) return;
		// Skip animation on initial render — colors are already correct from model build
		if (!heatmapInitialised.current) {
			heatmapInitialised.current = true;
			return;
		}
		animateHeatmapTransition(diagramInstanceRef.current, heatmapEnabled, treeData);
	}, [heatmapEnabled]);
	//#endregion

	//#region Handle Selection Updates
	useEffect(() => {
		if (!diagramInstanceRef.current) return;

		const currentScrollPosition = diagramInstanceRef.current.position.copy();

		diagramInstanceRef.current.clearSelection();
		if (currentlySelectedMessage) {
			diagramInstanceRef.current.nodes.each((node) => {
				if (node.data.originalMessage?.uuid === currentlySelectedMessage.uuid) {
					diagramInstanceRef.current!.select(node);
				}
			});
		}

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
						backgroundColor: "#1a1a1a",
					}}
				/>
			</div>
			<Help />
		</>
	);
});

export default ChatTree;
export type { ChatTreeRef };
