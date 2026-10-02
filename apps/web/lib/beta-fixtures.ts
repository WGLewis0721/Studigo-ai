import type { ChallengeKind, ExplainLevel } from '@studigo/learning';

export type FixtureTask = { prompt: string; answers: string[]; answer: string; hint: string; context: string };
export type FixtureTopic = {
  id: string; title: string; objective: string; priority: number; order: number; active: boolean;
  documentId: string; page: number; source: string;
  explanations: Record<ExplainLevel, string>; tasks: Record<ChallengeKind, FixtureTask[]>;
};
export type FixtureRoom = { id: string; title: string; subject: string; topics: FixtureTopic[] };
type Row = [string, string, string];
function tasks(rows: Row[], hint: string, id: string): FixtureTopic['tasks'] {
  const kinds: ChallengeKind[] = ['recognize','recall','explain','compare','predict','apply','transfer','novel_problem','defend','teach_back'];
  return Object.fromEntries(kinds.map((kind, i) => {
    const [prompt, answer, context] = rows[i];
    return [kind, [{ prompt, answers: [answer], answer, hint, context: id + ':' + context }]];
  })) as FixtureTopic['tasks'];
}
const fractions: FixtureTopic = {
  id: 'fractions', title: 'Equivalent fractions', objective: 'Recognize and explain equivalent fractions.', priority: 100, order: 0, active: true,
  documentId: 'math-guide', page: 1,
  source: 'Equivalent fractions name the same amount. Multiply or divide both the numerator and denominator by the same nonzero number. One half equals two fourths and three sixths. One third equals two sixths. Equal-sized wholes are needed when comparing amounts.',
  explanations: {
    simpler: 'Two fractions can name the same amount. Half a sandwich is the same amount as two of four equal pieces. Multiply the top and bottom by the same number.',
    standard: 'Equivalent fractions represent the same amount. Multiply the numerator and denominator by the same nonzero number: 1/2 = 2/4 = 3/6.',
    deeper: 'Scaling the numerator and denominator by the same nonzero factor preserves the ratio. Comparisons of physical amounts require equal-sized wholes.'
  },
  tasks: tasks([
    ['Which equals 1/2? A) 2/4  B) 1/4', 'A', 'recognize'],
    ['Complete: 1/2 = __/6. Type the missing number.', '3', 'recall'],
    ['Why does 1/2 equal 2/4? Explain what happens to both numbers.', 'Both the numerator and denominator are multiplied by 2.', 'explain'],
    ['Compare 1/2 and 1/3. Which is greater for equal-sized wholes?', '1/2', 'compare'],
    ['If you multiply both numbers in 1/3 by 2, what fraction will you get?', '2/6', 'predict'],
    ['Fill the missing numerator: 1/3 = __/6.', '2', 'apply'],
    ['A ribbon is divided into 6 equal pieces. How many pieces make half the ribbon?', '3', 'ribbon'],
    ['A recipe uses half a cup. Your scoop holds one sixth of a cup. How many scoops?', '3', 'recipe'],
    ['Someone changes 1/2 to 2/2 and says the amount is unchanged. What must be changed too?', 'The denominator must also be multiplied by 2.', 'defend'],
    ['Teach the rule for making an equivalent fraction in one sentence.', 'Multiply or divide the numerator and denominator by the same nonzero number.', 'teach']
  ], 'Do the same thing to the top and bottom numbers.', 'fractions')
};
const area: FixtureTopic = {
  id: 'area', title: 'Area of rectangles', objective: 'Use length times width to find rectangle area.', priority: 95, order: 1, active: true,
  documentId: 'math-guide', page: 2,
  source: 'The area of a rectangle is length times width. Area counts the square units that cover a surface. A rectangle 3 units long and 4 units wide has area 12 square units. Doubling one side doubles the area if the other side stays the same. Different rectangles can have the same area.',
  explanations: {
    simpler: 'Area tells you how many little squares cover a shape. For a rectangle, multiply how long it is by how wide it is. A 3 by 4 rectangle covers 12 squares.',
    standard: 'Rectangle area equals length times width and is measured in square units. A 3 by 4 rectangle has area 12 square units.',
    deeper: 'A rectangular array has one unit square for every row-column pair, so its area is the product of its dimensions. Equal areas do not require equal dimensions.'
  },
  tasks: tasks([
    ['Which finds rectangle area? A) length + width  B) length × width', 'B', 'recognize'],
    ['What is the area of a 3 by 4 rectangle? Type the number of square units.', '12', 'recall'],
    ['Why do we multiply length by width to find area?', 'We count the square units in rows and columns.', 'explain'],
    ['Compare a 3 by 4 rectangle and a 2 by 6 rectangle. Do they have the same area?', 'yes', 'compare'],
    ['A rectangle has area 12. One side doubles and the other stays the same. What is its new area?', '24', 'predict'],
    ['Find the area of a 5 by 3 rectangle.', '15', 'apply'],
    ['A garden is 4 meters by 6 meters. How many square meters does it cover?', '24', 'garden'],
    ['A rectangular mat covers 24 square units and is 6 units long. How wide is it?', '4', 'mat'],
    ['A learner says area uses ordinary units instead of square units. Explain why area uses squares.', 'Area counts square units that cover a surface.', 'defend'],
    ['Teach someone how to find rectangle area, including the units.', 'Multiply length by width and use square units.', 'teach']
  ], 'Picture rows of equal-sized squares. Multiply the number of rows by squares in each row.', 'area')
};
const magnets: FixtureTopic = {
  id: 'magnets', title: 'Magnetic poles', objective: 'Explain attraction and repulsion between magnetic poles.', priority: 100, order: 0, active: true,
  documentId: 'science-guide', page: 1,
  source: 'Magnets have north and south poles. Opposite poles attract, meaning they pull together. Like poles repel, meaning they push apart. North and north repel. North and south attract. A magnet can attract some materials such as iron; not every metal is magnetic.',
  explanations: {
    simpler: 'A magnet has two ends called poles: north and south. Different poles pull together. Matching poles push apart. Magnets can pull iron, but not every metal.',
    standard: 'Magnets have north and south poles. Opposite poles attract; like poles repel. Iron is magnetic, but not all metals are.',
    deeper: 'The interaction depends on the poles facing each other: unlike poles attract and like poles repel. Magnetic attraction to iron does not imply that all metals are magnetic.'
  },
  tasks: tasks([
    ['Two north poles face each other. A) attract  B) repel', 'B', 'recognize'],
    ['What do opposite magnetic poles do?', 'attract', 'recall'],
    ['Explain what repel means for two magnets.', 'They push apart.', 'explain'],
    ['Compare north-north and north-south: which pair attracts?', 'north-south', 'compare'],
    ['A north pole faces a north pole. One magnet is turned so its south pole faces the other. What happens?', 'attract', 'predict'],
    ['A south pole faces a south pole. Do the magnets attract or repel?', 'repel', 'apply'],
    ['A magnetic clasp has a north pole on one side. Which pole on the other side would pull it closed?', 'south', 'clasp'],
    ['A magnet attracts an iron clip. Can you conclude that every metal is magnetic?', 'no', 'clip'],
    ['Someone says all metals are magnetic. Which source example disproves that conclusion?', 'Not every metal is magnetic.', 'defend'],
    ['Teach the two pole rules in one sentence.', 'Opposite poles attract and like poles repel.', 'teach']
  ], 'Matching poles push apart; different poles pull together.', 'magnets')
};
const water: FixtureTopic = {
  id: 'water', title: 'The water cycle', objective: 'Distinguish evaporation, condensation, and precipitation.', priority: 95, order: 1, active: true,
  documentId: 'science-guide', page: 2,
  source: 'Evaporation changes liquid water into water vapor. Condensation changes water vapor into liquid droplets as it cools. Precipitation is water falling from clouds as rain or snow. The sun provides energy that helps liquid water evaporate. Water moves through the cycle rather than disappearing.',
  explanations: {
    simpler: 'Water can go into the air as vapor. That is evaporation. Vapor cools into tiny drops: condensation. Water falls from clouds as rain or snow: precipitation.',
    standard: 'Evaporation turns liquid water into vapor. Cooling vapor condenses into droplets. Rain and snow are precipitation. The sun supplies energy for evaporation.',
    deeper: 'The cycle moves water between locations and states: evaporation converts liquid to vapor, condensation reverses that change, and precipitation returns water from clouds.'
  },
  tasks: tasks([
    ['Liquid water becomes vapor. A) evaporation  B) precipitation', 'A', 'recognize'],
    ['What is water falling from clouds called?', 'precipitation', 'recall'],
    ['What happens during condensation?', 'Water vapor cools into liquid droplets.', 'explain'],
    ['Which changes vapor into liquid: evaporation or condensation?', 'condensation', 'compare'],
    ['Water vapor cools. What will it form?', 'liquid droplets', 'predict'],
    ['Name the process that turns liquid water into vapor.', 'evaporation', 'apply'],
    ['Tiny water drops appear when water vapor meets a cool surface. What process is this?', 'condensation', 'surface'],
    ['A puddle becomes smaller in sunlight. Did its water disappear, or move into the air?', 'move into the air', 'puddle'],
    ['Why is it wrong to say water simply disappears when it evaporates?', 'It changes into water vapor.', 'defend'],
    ['Teach evaporation, condensation, and precipitation in order.', 'Liquid becomes vapor, vapor becomes droplets, and water falls from clouds.', 'teach']
  ], 'Think about what water starts as and what it changes into.', 'water')
};
export const FIXTURE_ROOMS: FixtureRoom[] = [
  { id: 'math', title: 'Math explorers', subject: 'Mathematics · Grades 3–8', topics: [fractions, area] },
  { id: 'science', title: 'Science detectives', subject: 'Science · Grades 3–8', topics: [magnets, water] }
];
