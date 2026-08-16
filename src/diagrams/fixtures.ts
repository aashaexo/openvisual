import type { DiagramSpec, DiagramType } from "@/diagrams/schema";

/**
 * Hand-written specs, one per diagram type.
 *
 * They are the reference input for the visual engine: the layouts, themes,
 * converter and export path are all developed and tested against these before
 * any model output is involved.
 */

const flowchart: DiagramSpec = {
  version: 1,
  title: "How an AI agent completes a task",
  summary: "The loop an agent repeats until the goal is met.",
  type: "flowchart",
  direction: "vertical",
  nodes: [
    {
      id: "goal",
      label: "Receive the goal",
      description: "The user states what they want to achieve.",
      emphasis: "primary",
      shape: "rounded",
    },
    {
      id: "plan",
      label: "Plan the next step",
      description: "The agent decides what to do first.",
      emphasis: "secondary",
      shape: "rectangle",
    },
    {
      id: "tool",
      label: "Call a tool",
      description: "It searches, reads or writes using available tools.",
      emphasis: "secondary",
      shape: "rectangle",
    },
    {
      id: "observe",
      label: "Read the result",
      description: "The output of the tool becomes new context.",
      emphasis: "neutral",
      shape: "rectangle",
    },
    {
      id: "check",
      label: "Goal reached?",
      emphasis: "secondary",
      shape: "diamond",
    },
    {
      id: "answer",
      label: "Return the answer",
      description: "The agent reports what it did and found.",
      emphasis: "primary",
      shape: "rounded",
    },
  ],
  edges: [
    { id: "e1", source: "goal", target: "plan", directed: true, style: "solid" },
    { id: "e2", source: "plan", target: "tool", directed: true, style: "solid" },
    { id: "e3", source: "tool", target: "observe", directed: true, style: "solid" },
    { id: "e4", source: "observe", target: "check", directed: true, style: "solid" },
    {
      id: "e5",
      source: "check",
      target: "plan",
      label: "not yet",
      directed: true,
      style: "dashed",
    },
    { id: "e6", source: "check", target: "answer", label: "yes", directed: true, style: "solid" },
  ],
};

const timeline: DiagramSpec = {
  version: 1,
  title: "From draft to published post",
  summary: "The stages a piece of writing moves through.",
  type: "timeline",
  direction: "horizontal",
  nodes: [
    {
      id: "idea",
      label: "Idea captured",
      description: "A rough thought is written down.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "draft",
      label: "First draft",
      description: "The argument is written end to end.",
      emphasis: "primary",
      shape: "rounded",
    },
    {
      id: "edit",
      label: "Edit and cut",
      description: "Weak sections are removed or rewritten.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "review",
      label: "Outside review",
      description: "A reader flags what is unclear.",
      emphasis: "neutral",
      shape: "rounded",
    },
    {
      id: "publish",
      label: "Published",
      description: "The finished post goes out.",
      emphasis: "primary",
      shape: "rounded",
    },
  ],
  edges: [
    { id: "t1", source: "idea", target: "draft", directed: true, style: "solid" },
    { id: "t2", source: "draft", target: "edit", directed: true, style: "solid" },
    { id: "t3", source: "edit", target: "review", directed: true, style: "solid" },
    { id: "t4", source: "review", target: "publish", directed: true, style: "solid" },
  ],
};

const hierarchy: DiagramSpec = {
  version: 1,
  title: "Parts of a retrieval system",
  summary: "How a retrieval stack breaks down.",
  type: "hierarchy",
  direction: "vertical",
  nodes: [
    {
      id: "system",
      label: "Retrieval system",
      emphasis: "primary",
      shape: "rounded",
    },
    {
      id: "ingest",
      label: "Ingestion",
      description: "Turns source documents into searchable pieces.",
      emphasis: "secondary",
      shape: "rectangle",
    },
    {
      id: "search",
      label: "Search",
      description: "Finds the pieces that match a question.",
      emphasis: "secondary",
      shape: "rectangle",
    },
    { id: "chunk", label: "Chunking", emphasis: "neutral", shape: "rectangle" },
    { id: "embed", label: "Embedding", emphasis: "neutral", shape: "rectangle" },
    { id: "rank", label: "Ranking", emphasis: "neutral", shape: "rectangle" },
    { id: "filter", label: "Filtering", emphasis: "neutral", shape: "rectangle" },
  ],
  edges: [
    { id: "h1", source: "system", target: "ingest", directed: false, style: "solid" },
    { id: "h2", source: "system", target: "search", directed: false, style: "solid" },
    { id: "h3", source: "ingest", target: "chunk", directed: false, style: "solid" },
    { id: "h4", source: "ingest", target: "embed", directed: false, style: "solid" },
    { id: "h5", source: "search", target: "rank", directed: false, style: "solid" },
    { id: "h6", source: "search", target: "filter", directed: false, style: "solid" },
  ],
};

const comparison: DiagramSpec = {
  version: 1,
  title: "Traditional software versus agents",
  summary: "Two ways of getting work done by a computer.",
  type: "comparison",
  direction: "horizontal",
  nodes: [
    {
      id: "c1",
      label: "Fixed instructions",
      description: "Every step is written by a developer in advance.",
      category: "Traditional software",
      emphasis: "primary",
      shape: "rectangle",
    },
    {
      id: "c2",
      label: "Same input, same output",
      description: "Behaviour is repeatable and easy to test.",
      category: "Traditional software",
      emphasis: "neutral",
      shape: "rectangle",
    },
    {
      id: "c3",
      label: "Fails on anything unplanned",
      description: "Unhandled cases stop the program.",
      category: "Traditional software",
      emphasis: "neutral",
      shape: "rectangle",
    },
    {
      id: "c4",
      label: "Chooses its own steps",
      description: "The goal is given, the path is decided at runtime.",
      category: "AI agents",
      emphasis: "primary",
      shape: "rectangle",
    },
    {
      id: "c5",
      label: "Output varies",
      description: "Results need checking rather than assuming.",
      category: "AI agents",
      emphasis: "neutral",
      shape: "rectangle",
    },
    {
      id: "c6",
      label: "Adapts to new situations",
      description: "It can handle cases nobody wrote code for.",
      category: "AI agents",
      emphasis: "neutral",
      shape: "rectangle",
    },
  ],
  edges: [],
};

const cycle: DiagramSpec = {
  version: 1,
  title: "The content feedback loop",
  summary: "Each round of publishing feeds the next one.",
  type: "cycle",
  direction: "radial",
  nodes: [
    {
      id: "make",
      label: "Make something",
      description: "A post, a video or a small tool.",
      emphasis: "primary",
      shape: "rounded",
    },
    {
      id: "publish",
      label: "Publish it",
      description: "Put it in front of real people.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "measure",
      label: "Watch the response",
      description: "Note what people read, share and ignore.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "learn",
      label: "Find the pattern",
      description: "Work out which choices caused the response.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "adjust",
      label: "Adjust the next one",
      description: "Feed the lesson into the following piece.",
      emphasis: "primary",
      shape: "rounded",
    },
  ],
  edges: [
    { id: "y1", source: "make", target: "publish", directed: true, style: "solid" },
    { id: "y2", source: "publish", target: "measure", directed: true, style: "solid" },
    { id: "y3", source: "measure", target: "learn", directed: true, style: "solid" },
    { id: "y4", source: "learn", target: "adjust", directed: true, style: "solid" },
    { id: "y5", source: "adjust", target: "make", directed: true, style: "solid" },
  ],
};

const hubSpoke: DiagramSpec = {
  version: 1,
  title: "What a local AI app touches",
  summary: "The parts that sit around a local model.",
  type: "hub_spoke",
  direction: "radial",
  nodes: [
    {
      id: "hub",
      label: "Local model runtime",
      description: "Runs entirely on the user's own machine.",
      emphasis: "primary",
      shape: "circle",
    },
    {
      id: "editor",
      label: "Editing canvas",
      description: "Where the user changes the result.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "storage",
      label: "Local storage",
      description: "Projects saved in the browser database.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "export",
      label: "Export files",
      description: "Images and JSON written to disk.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "layout",
      label: "Layout engine",
      description: "Decides where every element sits.",
      emphasis: "secondary",
      shape: "rounded",
    },
    {
      id: "themes",
      label: "Theme system",
      description: "Controls every colour and stroke.",
      emphasis: "neutral",
      shape: "rounded",
    },
  ],
  edges: [
    { id: "s1", source: "hub", target: "editor", directed: false, style: "solid" },
    { id: "s2", source: "hub", target: "storage", directed: false, style: "solid" },
    { id: "s3", source: "hub", target: "export", directed: false, style: "dashed" },
    { id: "s4", source: "hub", target: "layout", directed: false, style: "solid" },
    { id: "s5", source: "hub", target: "themes", directed: false, style: "dashed" },
  ],
};

export const FIXTURES: Record<DiagramType, DiagramSpec> = {
  flowchart,
  timeline,
  hierarchy,
  comparison,
  cycle,
  hub_spoke: hubSpoke,
};

export const FIXTURE_LIST: DiagramSpec[] = Object.values(FIXTURES);
