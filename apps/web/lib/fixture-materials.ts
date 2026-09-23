/**
 * Synthetic "study guide" content for the local dev-only fixture room
 * (`/dev/study`, `roomId === "fixture"`). Shared between the client (to show
 * the "FROM YOUR STUDY GUIDE" panel) and the fixture engine (to build real
 * RetrievedChunk objects so fixture mode exercises the same RAG + LLM brain
 * as production, instead of canned strings).
 */
export type MaterialNote = { summary: string; example: string; source: string };

export const MATERIAL_NOTES: Record<string, MaterialNote> = {
  "Instinctive and learned behaviors": {
    summary:
      "Instincts are behaviors an organism is born knowing how to do. Learned behaviors develop through experience or practice.",
    example: "A spider building a web is instinctive; a dog responding to a trained command is learned.",
    source: "Study guide · Life Science"
  },
  "Inherited traits and environment": {
    summary:
      "Inherited traits come from parents through genes. The environment can influence how traits develop and how organisms behave.",
    example: "Eye color is inherited; nutrition and exercise can affect growth and strength.",
    source: "Study guide · Heredity and Environment"
  },
  "Variation and survival advantages": {
    summary:
      "Individuals of the same species can vary. Some variations help an organism survive and reproduce in a particular environment.",
    example: "A moth whose color blends with tree bark may be harder for predators to see.",
    source: "Study guide · Adaptation"
  },
  "Fossils and rock layers": {
    summary:
      "Fossils are evidence of past life. In undisturbed rock layers, deeper layers are generally older than layers above them.",
    example: "A fossil found in a lower layer usually provides evidence of an earlier time than a fossil in a layer above it.",
    source: "Study guide · Earth History"
  },
  "Phase changes and conservation of matter": {
    summary: "Matter can change state from solid, liquid, or gas, but the matter itself is conserved during a phase change.",
    example: "When ice melts, it becomes liquid water; its form changes, but the amount of water remains the same.",
    source: "Study guide · Matter"
  },
  "Dissolving": {
    summary: "Temperature, stirring, and particle size can affect how quickly a substance dissolves.",
    example: "Sugar usually dissolves faster in warm water when the water is stirred.",
    source: "Study guide · Properties of Matter"
  },
  "Solar system objects and motion": {
    summary:
      "The solar system includes the Sun, planets, moons, and smaller objects. Objects move in predictable patterns because of gravity.",
    example: "Earth revolves around the Sun while rotating on its axis.",
    source: "Study guide · Space Science"
  },
  "Balanced and unbalanced forces": {
    summary:
      "Balanced forces do not change an object's motion. Unbalanced forces can make an object speed up, slow down, or change direction.",
    example: "A book resting on a table has balanced forces; a pushed book accelerates because the forces become unbalanced.",
    source: "Study guide · Physical Science"
  }
};
