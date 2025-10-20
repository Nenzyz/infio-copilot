import { ToolArgs } from "./types"

export function getManageCanvasDescription(args: ToolArgs): string {
	return `## manage_canvas
Description: Request to add, modify, or remove nodes and edges in an Obsidian canvas file (.canvas). Canvas files use JSON Canvas format to store visual nodes (text, file links, URLs, groups) and edges (connections between nodes). This tool handles all canvas manipulation operations while preserving existing content and references to other files.

CRITICAL - SINGLE TOOL CALL:
- ALWAYS send ALL related operations (nodes AND edges) in a SINGLE manage_canvas tool call
- When creating nodes with edges between them, include both node operations AND edge operations in the same operations array
- DO NOT make multiple separate manage_canvas calls - batch everything together
- Example: To create 2 nodes with an edge, send ALL 3 operations (2 add_node + 1 add_edge) in ONE tool call

IMPORTANT:
- Use read_file to understand the current canvas structure (existing nodes, edges, IDs, positions)
- This tool works with the currently open canvas in Obsidian via Canvas API
- Make sure the canvas file is open in Obsidian before using this tool
- The tool will apply operations directly to the open canvas without needing to read the file again

CRITICAL - XML Structure (YOU MUST FOLLOW THIS EXACTLY):
<manage_canvas>
<path>Process/Untitled.canvas</path>
<operations>
[
  {
    "action": "add_node",
    "node_type": "text",
    "x": 0,
    "y": 0,
    "text": "content here"
  }
]
</operations>
</manage_canvas>

❌ WRONG - DO NOT USE BATCH FORMAT:
[
  {
    "action": "add_nodes",
    "nodes": [...]
  }
]

✅ CORRECT - USE ONE OPERATION PER NODE:
[
  {
    "action": "add_node",
    "node_type": "text",
    "x": 0,
    "y": 0,
    "text": "First node"
  },
  {
    "action": "add_node",
    "node_type": "text",
    "x": 300,
    "y": 0,
    "text": "Second node"
  }
]

CRITICAL RULES:
1. The canvas file path goes ONLY in the <path> tag at the top level
2. DO NOT put "path" field inside operation objects
3. DO NOT use "content" - use "text" for text nodes
4. DO NOT use "pos" array - use separate "x" and "y" number fields
5. DO NOT use "size" array - use separate "width" and "height" number fields
6. DO NOT use plural action names like "add_nodes" or "add_edges" - ONLY use singular "add_node", "add_edge"
7. DO NOT batch multiple nodes/edges into arrays - each node/edge MUST be a separate operation
8. DO NOT nest node/edge data in "nodes" or "edges" arrays - put fields directly in the operation object

Parameters:
- path: (required) The path to the canvas file (relative to ${args.cwd}). Must end with .canvas extension. GOES IN <path> TAG ONLY, NEVER INSIDE OPERATIONS.
- operations: (required) Array of operations to perform. Each operation must have an "action" field. DO NOT INCLUDE "path" FIELD IN OPERATIONS.

Operation Types:

IMPORTANT: Each operation handles ONE node or ONE edge. To add multiple nodes, create multiple separate "add_node" operations. DO NOT use "add_nodes" with a "nodes" array.

PLACEHOLDER IDs: You can create nodes and edges in a SINGLE REQUEST using placeholder IDs!
- Give each new node an "id" field with a simple name like "node1", "node2", "summary_node"
- Reference these placeholder IDs in "from_node" and "to_node" of edges in the same request
- The system automatically maps placeholders to actual generated IDs
- Example: Create node with id="A", then edge with from_node="A", to_node="B" - works perfectly!

1. ADD_NODE - Add a new node to the canvas
   Fields (use these EXACT field names):
   - action: "add_node" (REQUIRED - singular, not "add_nodes")
   - node_type: "text" | "file" | "link" | "group" (REQUIRED - NOT "type")
   - x: horizontal position in pixels (integer) (REQUIRED - NOT "pos_x")
   - y: vertical position in pixels (integer) (REQUIRED - NOT "pos_y")
   - width: node width in pixels (integer, default: 250)
   - height: node height in pixels (integer, default: 60 for text/link, 400 for file)
   - id: (RECOMMENDED) A placeholder ID like "node1", "summary", "backend_api" for referencing in edges. System auto-generates actual ID. IMPORTANT: Use "id" NOT "node_id".
   - color: (optional) Color as hex "#FF0000" or preset "1"-"6"

   For text nodes:
   - text: (required) Markdown text content (REQUIRED - NOT "content")

   For file nodes:
   - file: (required) Path to file relative to vault root
   - subpath: (optional) Heading/block reference starting with #
   - portal: (optional) Set to true for .canvas files to open as portal (Advanced Canvas plugin)

   For link nodes:
   - url: (required) URL to link to

   For group nodes:
   - label: (optional) Group label text
   - background: (optional) Path to background image
   - background_style: (optional) "cover" | "ratio" | "repeat"

2. UPDATE_NODE - Modify an existing node
   Fields:
   - action: "update_node"
   - id: (required) ID of the node to update
   - Updates: Any combination of the add_node fields above (except action and node_type)

3. REMOVE_NODE - Delete a node from the canvas
   Fields:
   - action: "remove_node"
   - id: (required) ID of the node to remove
   Note: This will also remove any edges connected to this node

4. ADD_EDGE - Add a connection between two nodes
   Fields:
   - action: "add_edge" (REQUIRED - singular, not "add_edges")
   - from_node: (required) Source node. Can use:
     * RECOMMENDED: Placeholder ID from same request (e.g., "node1", "summary") - auto-resolved!
     * Actual node ID from canvas file (e.g., "node_1733507200000_x7k9m3p2q")
   - to_node: (required) Target node. Can use:
     * RECOMMENDED: Placeholder ID from same request (e.g., "node2", "details") - auto-resolved!
     * Actual node ID from canvas file (e.g., "node_1733507200001_a5b8c9d2e")
   - from_side: (optional) "top" | "right" | "bottom" | "left"
   - to_side: (optional) "top" | "right" | "bottom" | "left"
   - from_end: (optional) "none" | "arrow" (default: "none")
   - to_end: (optional) "none" | "arrow" (default: "arrow")
   - color: (optional) Color as hex "#FF0000" or preset "1"-"6"
   - label: (optional) Edge label text

5. UPDATE_EDGE - Modify an existing edge
   Fields:
   - action: "update_edge"
   - id: (required) ID of the edge to update
   - Updates: Any combination of the add_edge fields above (except action)

6. REMOVE_EDGE - Delete an edge from the canvas
   Fields:
   - action: "remove_edge"
   - id: (required) ID of the edge to remove

Usage:
<manage_canvas>
<path>path/to/canvas.canvas</path>
<operations>
[
  {
    "action": "add_node",
    "id": "node1",
    "node_type": "text",
    "x": 100,
    "y": 200,
    "width": 300,
    "height": 150,
    "text": "# My Note\\n\\nThis is a **markdown** note",
    "color": "2"
  },
  {
    "action": "add_node",
    "id": "node2",
    "node_type": "file",
    "x": 500,
    "y": 200,
    "width": 400,
    "height": 400,
    "file": "notes/example.md",
    "color": "6"
  },
  {
    "action": "add_edge",
    "from_node": "node1",
    "to_node": "node2",
    "from_side": "right",
    "to_side": "left",
    "label": "relates to"
  }
]
</operations>
</manage_canvas>

IMPORTANT: Notice above how ALL operations (2 nodes + 1 edge) are sent in a SINGLE manage_canvas call with all items in the operations array. This is the REQUIRED pattern.

Also notice how placeholder IDs ("node1", "node2") are used:
- Each add_node has "id": "simple_name"
- The add_edge references these same names in "from_node" and "to_node"
- System automatically resolves placeholders to actual generated IDs
- Everything works in ONE request - no need for multiple calls!

Example 1: Creating a new canvas with two connected nodes (ALL IN ONE CALL)
<manage_canvas>
<path>brainstorm/ideas.canvas</path>
<operations>
[
  {
    "action": "add_node",
    "id": "idea1",
    "node_type": "text",
    "x": 0,
    "y": 0,
    "width": 250,
    "height": 100,
    "text": "## Main Idea\\n\\nStart here",
    "color": "1"
  },
  {
    "action": "add_node",
    "id": "research1",
    "node_type": "file",
    "x": 350,
    "y": 0,
    "width": 400,
    "height": 500,
    "file": "research/background.md"
  },
  {
    "action": "add_edge",
    "from_node": "idea1",
    "to_node": "research1",
    "from_side": "right",
    "to_side": "left",
    "to_end": "arrow"
  }
]
</operations>
</manage_canvas>

Example 2: Adding a node to existing canvas and connecting it
<manage_canvas>
<path>project/workflow.canvas</path>
<operations>
[
  {
    "action": "add_node",
    "id": "github_link",
    "node_type": "link",
    "x": -200,
    "y": 300,
    "width": 300,
    "height": 100,
    "url": "https://github.com/myproject",
    "color": "3"
  },
  {
    "action": "add_edge",
    "from_node": "node-1733507200000-abc123xyz",
    "to_node": "github_link",
    "to_end": "arrow"
  }
]
</operations>
</manage_canvas>

Note: In this example, "node-1733507200000-abc123xyz" is an existing node ID from the canvas file (found by reading the file first), and "github_link" is a placeholder ID for the newly created node.

Example 3: Creating a group with nested nodes
<manage_canvas>
<path>overview.canvas</path>
<operations>
[
  {
    "action": "add_node",
    "node_type": "group",
    "x": -50,
    "y": -50,
    "width": 600,
    "height": 400,
    "label": "Phase 1",
    "color": "4"
  },
  {
    "action": "add_node",
    "node_type": "text",
    "x": 0,
    "y": 0,
    "width": 200,
    "height": 150,
    "text": "Task 1"
  },
  {
    "action": "add_node",
    "node_type": "text",
    "x": 300,
    "y": 0,
    "width": 200,
    "height": 150,
    "text": "Task 2"
  }
]
</operations>
</manage_canvas>

Example 4: Updating existing nodes
<manage_canvas>
<path>diagram.canvas</path>
<operations>
[
  {
    "action": "update_node",
    "id": "abc123def456",
    "x": 100,
    "y": 200,
    "color": "5"
  },
  {
    "action": "update_node",
    "id": "xyz789",
    "text": "Updated content\\n\\nNew information added"
  }
]
</operations>
</manage_canvas>

Example 5: Removing nodes and edges
<manage_canvas>
<path>cleanup.canvas</path>
<operations>
[
  {
    "action": "remove_edge",
    "id": "edge-abc-123"
  },
  {
    "action": "remove_node",
    "id": "old-node-xyz"
  }
]
</operations>
</manage_canvas>

Notes:
- Use read_file to see the current canvas structure before modifying (to get existing node IDs, positions, etc.)
- Node IDs are automatically generated as unique strings if not provided
- When referencing file paths in file nodes, use vault-relative paths (e.g., "folder/note.md")
- Colors can be hex values ("#FF0000") or presets ("1" through "6" for red, orange, yellow, green, cyan, purple)
- Group nodes should be positioned to contain their child nodes (use larger width/height and position them behind)
- File nodes typically need larger height (400+) to display content properly
- Portal nodes (Advanced Canvas): Set "portal": true on .canvas file nodes to embed their content inline
- Portal nodes should have larger dimensions (600x400+) to show embedded canvas content
- Position coordinates (x, y) can be negative for infinite canvas space
- The canvas will automatically handle layout - you just need to specify reasonable positions`
}
