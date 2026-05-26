const EPSILON = 0.000001;
const PRECEDENCE = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  value: 3
};

export function solveLetters(letters, dictionaryWords, isWordBuildable, limit = 3) {
  const buildableWords = dictionaryWords
    .filter((word) => isWordBuildable(word, letters))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  const topWords = buildableWords.slice(0, limit);

  if (!topWords.length) {
    return {
      words: [],
      message: "Top 3 Palabras Más Largas: no encuentro palabras válidas con estas letras."
    };
  }

  return {
    words: topWords,
    message: `Top 3 Palabras Más Largas: ${topWords
      .map((word, index) => `${index + 1}. ${word} (${word.length})`)
      .join(", ")}.`
  };
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function needsParentheses(child, parentOperator, side) {
  if (child.operator === "value") return false;

  const childPrecedence = PRECEDENCE[child.operator];
  const parentPrecedence = PRECEDENCE[parentOperator];

  if (childPrecedence < parentPrecedence) return true;
  if (side === "right" && ["-", "/"].includes(parentOperator) && childPrecedence === parentPrecedence) return true;
  return false;
}

function childExpression(child, parentOperator, side) {
  return needsParentheses(child, parentOperator, side) ? `(${child.expression})` : child.expression;
}

function createNode(left, right, operator, value) {
  return {
    value,
    expression: `${childExpression(left, operator, "left")} ${operator} ${childExpression(right, operator, "right")}`,
    operator,
    steps: left.steps + right.steps + 1
  };
}

function compareCandidates(candidate, current, target) {
  const candidateDiff = Math.abs(candidate.value - target);
  const currentDiff = Math.abs(current.value - target);

  if (candidateDiff !== currentDiff) return candidateDiff < currentDiff;
  if (candidate.steps !== current.steps) return candidate.steps < current.steps;
  if (candidate.expression.includes("(") !== current.expression.includes("(")) {
    return !candidate.expression.includes("(");
  }
  return candidate.expression.length < current.expression.length;
}

function stateComplexity(nodes) {
  return nodes.reduce((total, node) => total + node.steps + node.expression.length / 1000, 0);
}

function stateKey(nodes) {
  return nodes
    .map((node) => node.value)
    .sort((a, b) => a - b)
    .join("|");
}

function pushCandidate(candidates, left, right, operator, value) {
  if (!Number.isFinite(value) || value < 0) return;
  candidates.push(createNode(left, right, operator, value));
}

export function solveNumbers(numbers, target) {
  const initialNodes = numbers.map((number) => ({
    value: number,
    expression: String(number),
    operator: "value",
    steps: 0
  }));
  const seen = new Map();
  let best = initialNodes.reduce((currentBest, node) => (
    compareCandidates(node, currentBest, target) ? node : currentBest
  ), initialNodes[0]);

  function updateBest(node) {
    if (compareCandidates(node, best, target)) {
      best = node;
    }
  }

  function dfs(nodes) {
    const key = stateKey(nodes);
    const complexity = stateComplexity(nodes);

    if (seen.has(key) && seen.get(key) <= complexity) return;
    seen.set(key, complexity);

    nodes.forEach(updateBest);

    if (nodes.length === 1) return;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const rest = nodes.filter((_, index) => index !== i && index !== j);
        const candidates = [];

        pushCandidate(candidates, a, b, "+", a.value + b.value);
        pushCandidate(candidates, a, b, "*", a.value * b.value);

        if (a.value >= b.value) pushCandidate(candidates, a, b, "-", a.value - b.value);
        if (b.value >= a.value) pushCandidate(candidates, b, a, "-", b.value - a.value);

        if (Math.abs(b.value) > EPSILON && a.value % b.value === 0) {
          pushCandidate(candidates, a, b, "/", a.value / b.value);
        }

        if (Math.abs(a.value) > EPSILON && b.value % a.value === 0) {
          pushCandidate(candidates, b, a, "/", b.value / a.value);
        }

        candidates
          .sort((left, right) => left.steps - right.steps || left.expression.length - right.expression.length)
          .forEach((candidate) => dfs([...rest, candidate]));
      }
    }
  }

  dfs(initialNodes);

  const diff = target - best.value;
  const absDiff = Math.abs(diff);

  return {
    value: best.value,
    expression: best.expression,
    diff,
    absDiff,
    exact: absDiff < EPSILON,
    steps: best.steps,
    message: absDiff < EPSILON
      ? `Solución óptima exacta: ${best.expression} = ${target}.`
      : `Mejor aproximación: ${best.expression} = ${formatNumber(best.value)}. Te quedaste a ${formatNumber(diff)}. Diferencia: ${formatNumber(absDiff)}.`
  };
}
