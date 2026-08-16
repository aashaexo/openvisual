import type { DiagramType } from "@/diagrams/schema";

export interface ExampleInput {
  id: string;
  title: string;
  blurb: string;
  suggestedType: DiagramType;
  text: string;
}

/** The three starting points offered on the empty canvas and in the input panel. */
export const EXAMPLES: ExampleInput[] = [
  {
    id: "agent-task",
    title: "How an AI agent completes a task",
    blurb: "A loop of planning, tool calls and checking",
    suggestedType: "flowchart",
    text: `An AI agent starts with a goal given by a person. It plans a first step, then calls a tool such as a search, a file read or a code run. The result of that tool becomes new context for the agent. The agent checks whether the goal has been met. If it has not, it plans another step and calls another tool. When the goal is met, the agent stops and reports what it did and what it found. The important difference from ordinary software is that the sequence of steps is decided while the agent runs, not written in advance by a developer.`,
  },
  {
    id: "content-loop",
    title: "The content creation feedback loop",
    blurb: "Why publishing regularly compounds",
    suggestedType: "cycle",
    text: `Making things in public works as a loop. You make something small: a post, a video, a tool. You publish it so real people can see it. You watch how people respond, noting what gets read, shared and ignored. You look for the pattern behind the response and work out which of your choices caused it. Then you feed that lesson into the next thing you make. Each pass around the loop is fast and cheap, and the lessons accumulate, which is why people who publish often improve faster than people who plan for a long time before publishing once.`,
  },
  {
    id: "software-vs-agents",
    title: "Traditional software vs AI agents",
    blurb: "Two different ways of getting work done",
    suggestedType: "comparison",
    text: `Traditional software follows instructions that a developer wrote in advance. Every step is fixed, so the same input produces the same output, which makes it repeatable and easy to test. Its weakness is that anything the developer did not plan for causes it to fail or stop. AI agents work differently. They are given a goal rather than a procedure, and they choose their own steps while running. Their output varies between runs, so results need checking rather than assuming. In exchange, they can handle situations nobody wrote code for. Traditional software is predictable and narrow; agents are flexible and uncertain.`,
  },
];
