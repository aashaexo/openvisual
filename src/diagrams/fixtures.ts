import type { DiagramSpec, DiagramType } from "@/diagrams/schema";

/**
 * Hand-written specs, one per diagram type.
 *
 * They are the reference input for the visual engine: the layouts, themes,
 * converter and export path are all developed and tested against these before
 * any model output is involved.
 *
 * Between them they cover every rendering path on purpose — label-only nodes,
 * label plus description, description plus items, items with no description,
 * every shape, and both shared and per-node `category` values so the accent
 * assignment is exercised in all of its modes.
 */

const flowchart: DiagramSpec = {
  version: 1,
  title: "How a production issue gets fixed",
  summary: "What happens between the first alert and a verified fix.",
  type: "flowchart",
  direction: "horizontal",
  nodes: [
    {
      id: "deploy",
      label: "A change ships",
      description: "New code reaches real users for the first time.",
      category: "Ship",
      emphasis: "primary",
      shape: "rounded",
    },
    {
      id: "detect",
      label: "Something looks wrong",
      description: "The first sign that production is misbehaving.",
      items: ["Error rate spikes", "Latency climbs", "Eval scores drop", "Users report failures"],
      category: "Detect",
      emphasis: "secondary",
      shape: "rectangle",
    },
    {
      id: "investigate",
      label: "Investigate the cause",
      description: "Gather the evidence that explains what changed.",
      items: ["Traces", "Metrics", "Evals", "User signals", "Recent deploys"],
      category: "Investigate",
      emphasis: "secondary",
      shape: "rectangle",
    },
    {
      id: "judge",
      label: "Real regression?",
      category: "Decide",
      emphasis: "secondary",
      shape: "diamond",
    },
    {
      id: "fix",
      label: "Fix and verify",
      description: "Ship the change, then watch the same signals recover.",
      items: ["Roll back or patch", "Add a regression eval", "Watch it recover"],
      category: "Fix",
      emphasis: "primary",
      shape: "rounded",
    },
  ],
  edges: [
    { id: "e1", source: "deploy", target: "detect", directed: true, style: "solid" },
    { id: "e2", source: "detect", target: "investigate", directed: true, style: "solid" },
    { id: "e3", source: "investigate", target: "judge", directed: true, style: "solid" },
    { id: "e4", source: "judge", target: "fix", label: "yes", directed: true, style: "solid" },
    {
      id: "e5",
      source: "judge",
      target: "detect",
      label: "false alarm",
      directed: true,
      style: "dashed",
    },
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
      items: ["Cut the sections that drag", "Tighten the opening", "Check every claim"],
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
      // Items with no description: the only fixture node on that path.
      id: "export",
      label: "Export files",
      items: ["PNG image", "SVG vector", "Excalidraw scene JSON"],
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
