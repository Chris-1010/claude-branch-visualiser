//#region Imports
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as go from "gojs";
import { useChatContext } from "../context/ChatContext";
//#endregion

interface ChatTreeRef {
	scrollToMessage: (messageUuid: string) => void;
}

const ChatTree = forwardRef<ChatTreeRef, {}>((_, ref) => {
	const { treeData, currentlySelectedMessage, setCurrentlySelectedMessage } = useChatContext();
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

		const processNode = (node: any, parentKey?: string) => {
			const nodeData = {
				key: node.uuid,
				text: getNodeText(node),
				color: node.sender === "human" ? "#444" : "#ff6f00",
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
	);
});

export default ChatTree;
export type { ChatTreeRef };
