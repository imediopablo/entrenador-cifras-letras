import { solveNumbers } from "./agente.js";
import { normalizeText } from "./letras.js";

const BIG_NUMBERS = [25, 50, 75, 100];
const SMALL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PRO_SMALL_NUMBERS = [3, 4, 5, 6, 7, 8, 9, 3, 4, 6, 7, 8, 9, 5];
const OPERATIONS = ["+", "-", "*", "/", "(", ")"];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let expressionTokens = [];
let recognition = null;
let listening = false;

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function countOccurrences(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function generateNumbers() {
  return generateNumbersByDifficulty("medium");
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isPrime(value) {
  if (value < 2) return false;
  if (value % 2 === 0) return value === 2;

  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) return false;
  }

  return true;
}

function generateEasyTarget() {
  const candidates = [];

  for (let value = 110; value <= 990; value += 10) {
    candidates.push(value);
  }

  for (let value = 125; value <= 975; value += 25) {
    candidates.push(value);
  }

  return getRandomItem(candidates.filter((value) => value >= 101 && value <= 999));
}

function generateProTarget() {
  const primeCandidates = [];

  for (let value = 101; value <= 999; value += 2) {
    if (value % 10 !== 5 && isPrime(value)) {
      primeCandidates.push(value);
    }
  }

  if (primeCandidates.length) {
    return getRandomItem(primeCandidates);
  }

  let target = randomInteger(101, 999);
  while (target % 2 === 0 || target % 10 === 5) {
    target = randomInteger(101, 999);
  }
  return target;
}

function generateStandardNumbers() {
  return {
    big: shuffle(BIG_NUMBERS).slice(0, 2),
    small: Array.from({ length: 4 }, () => getRandomItem(SMALL_NUMBERS))
  };
}

function generateEasyNumbers() {
  const required = getRandomItem([10, 5, 2]);
  const small = [required];

  while (small.length < 4) {
    small.push(getRandomItem(SMALL_NUMBERS));
  }

  return {
    big: shuffle(BIG_NUMBERS).slice(0, 2),
    small
  };
}

function generateProNumbers() {
  const big = shuffle(BIG_NUMBERS).slice(0, 2);
  const small = Array.from({ length: 4 }, () => getRandomItem(PRO_SMALL_NUMBERS));

  return { big, small };
}

export function generateNumbersByDifficulty(difficulty = "medium") {
  const normalizedDifficulty = ["easy", "medium", "pro"].includes(difficulty) ? difficulty : "medium";
  const generators = {
    easy: generateEasyNumbers,
    medium: generateStandardNumbers,
    pro: generateProNumbers
  };
  const targets = {
    easy: generateEasyTarget,
    medium: () => randomInteger(101, 999),
    pro: generateProTarget
  };
  const { big, small } = generators[normalizedDifficulty]();

  return {
    target: targets[normalizedDifficulty](),
    numbers: shuffle([...big, ...small])
  };
}

export function resetNumbersInterface({ input, numbersGrid, operationKeys, numbers }) {
  expressionTokens = [];
  input.value = "";
  input.readOnly = true;

  numbersGrid.innerHTML = numbers
    .map((number, index) => (
      `<button class="tile number-tile number-choice" type="button" data-token-id="n-${index}" data-used="false" data-value="${number}">${number}</button>`
    ))
    .join("");

  operationKeys.innerHTML = [
    ...OPERATIONS.map((operation) => (
      `<button class="key-btn" type="button" data-operation="${operation}">${operation}</button>`
    )),
    '<button class="key-btn control-key" type="button" data-control="backspace">Borrar último</button>',
    '<button class="key-btn control-key" type="button" data-control="clear">Limpiar todo</button>',
    '<button class="key-btn submit-key" type="button" data-control="submit">Enviar Solución</button>'
  ].join("");
}

export function setNumbersControlsDisabled({ numbersGrid, operationKeys }, disabled) {
  numbersGrid.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled || button.dataset.used === "true";
  });
  operationKeys.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
}

function syncInput(input) {
  input.value = expressionTokens.map((token) => token.value).join(" ");
}

function enableAllNumberKeys(numbersGrid) {
  numbersGrid.querySelectorAll(".number-choice").forEach((button) => {
    button.disabled = false;
    button.dataset.used = "false";
  });
}

export function bindVirtualKeyboard({ input, numbersGrid, operationKeys, onSubmit }) {
  numbersGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-token-id]");
    if (!button || button.disabled) return;

    expressionTokens.push({
      type: "number",
      id: button.dataset.tokenId,
      value: button.dataset.value
    });
    button.disabled = true;
    button.dataset.used = "true";
    syncInput(input);
  });

  operationKeys.addEventListener("click", (event) => {
    const operationButton = event.target.closest("[data-operation]");
    const controlButton = event.target.closest("[data-control]");

    if (operationButton) {
      expressionTokens.push({
        type: "operation",
        value: operationButton.dataset.operation
      });
      syncInput(input);
      return;
    }

    if (!controlButton) return;

    if (controlButton.dataset.control === "clear") {
      expressionTokens = [];
      enableAllNumberKeys(numbersGrid);
      syncInput(input);
      return;
    }

    if (controlButton.dataset.control === "submit") {
      onSubmit();
      return;
    }

    const removed = expressionTokens.pop();
    if (removed?.type === "number") {
      const numberButton = numbersGrid.querySelector(`[data-token-id="${removed.id}"]`);
      if (numberButton) {
        numberButton.disabled = false;
        numberButton.dataset.used = "false";
      }
    }
    syncInput(input);
  });
}

function extractNumbers(expression) {
  const matches = expression.match(/\d+(?:\.\d+)?/g) || [];
  return matches.map(Number);
}

function usesOnlyAvailableNumbers(usedNumbers, availableNumbers) {
  const available = countOccurrences(availableNumbers.map(String));
  const used = countOccurrences(usedNumbers.map(String));
  return Object.entries(used).every(([number, count]) => available[number] >= count);
}

function safelyEvaluateMath(expression) {
  const compactExpression = expression.replace(/\s+/g, "");

  if (!compactExpression) {
    throw new Error("La operación está vacía.");
  }

  if (!/^[\d+\-*/().\s]+$/.test(expression)) {
    throw new Error("Solo se permiten números, paréntesis y los operadores + - * /.");
  }

  const result = Function(`"use strict"; return (${compactExpression});`)();

  if (!Number.isFinite(result)) {
    throw new Error("La operación no produce un resultado finito.");
  }

  return result;
}

export function validateNumbersAnswer(expression, numbers, target) {
  try {
    const usedNumbers = extractNumbers(expression);

    if (!usedNumbers.length) {
      return { success: false, value: null, message: "Introduce una operación antes de comprobar.", type: "warning" };
    }

    if (usedNumbers.some((number) => !Number.isInteger(number))) {
      return { success: false, value: null, message: "Usa solo números enteros del panel disponible.", type: "error" };
    }

    if (!usesOnlyAvailableNumbers(usedNumbers, numbers)) {
      return { success: false, value: null, message: "La operación contiene números no disponibles o repetidos.", type: "error" };
    }

    const result = safelyEvaluateMath(expression);
    const difference = Math.abs(target - result);

    if (Math.abs(result - target) < Number.EPSILON) {
      return { success: true, value: result, diff: 0, message: `Correcto: la operación da exactamente ${target}.`, type: "success" };
    }

    return { success: false, value: result, diff: target - result, message: `Resultado: ${result}. Objetivo: ${target}. Diferencia: ${difference}.`, type: "error" };
  } catch (error) {
    return { success: false, value: null, message: error.message, type: "error" };
  }
}

function spanishNumberToValue(words) {
  const normalized = words.trim().toLowerCase();
  const units = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
    cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100, ciento: 100
  };

  if (Object.prototype.hasOwnProperty.call(units, normalized)) {
    return units[normalized];
  }

  const parts = normalized.split(/\s+y\s+/);
  if (parts.length === 2 && units[parts[0]] >= 30 && units[parts[1]] > 0 && units[parts[1]] < 10) {
    return units[parts[0]] + units[parts[1]];
  }

  return null;
}

function speechToExpression(transcript) {
  const text = normalizeText(transcript)
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\bmas\b/g, " + ")
    .replace(/\bmenos\b/g, " - ")
    .replace(/\bdividido\s+por\b/g, " / ")
    .replace(/\bentre\b/g, " / ")
    .replace(/\bpor\b/g, " * ")
    .replace(/\babre\s+parentesis\b/g, " ( ")
    .replace(/\bcierra\s+parentesis\b/g, " ) ");

  const operators = new Set(["+", "-", "*", "/", "(", ")"]);
  const tokens = text.split(/\s+/).filter(Boolean);
  const output = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (operators.has(token) || /^\d+$/.test(token)) {
      output.push(token);
      continue;
    }

    let matched = false;
    for (let length = Math.min(3, tokens.length - index); length >= 1; length -= 1) {
      const candidate = tokens.slice(index, index + length).join(" ");
      const value = spanishNumberToValue(candidate);

      if (value !== null) {
        output.push(String(value));
        index += length - 1;
        matched = true;
        break;
      }
    }

    if (!matched && token !== "y") {
      output.push(token);
    }
  }

  return output.join(" ").replace(/\s+/g, " ").trim();
}

async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador no expone permisos de micrófono.");
  }

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "microphone" });
      if (permission.state === "denied") {
        throw new Error("El permiso de micrófono está bloqueado en el navegador.");
      }
    } catch (error) {
      if (error.message.includes("bloqueado")) throw error;
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function createRecognition({ input, setStatus }) {
  if (!SpeechRecognition) {
    setStatus("La Web Speech API no está disponible en este navegador.", "warning");
    return null;
  }

  const nextRecognition = new SpeechRecognition();
  nextRecognition.lang = "es-ES";
  nextRecognition.continuous = true;
  nextRecognition.interimResults = true;

  nextRecognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .slice(event.resultIndex)
      .map((result) => result[0].transcript)
      .join(" ");
    const expression = speechToExpression(transcript);

    if (expression) {
      input.value = expression;
    }
  });

  nextRecognition.addEventListener("end", () => {
    listening = false;
  });

  nextRecognition.addEventListener("error", (event) => {
    listening = false;
    setStatus(`No se pudo transcribir el audio: ${event.error}.`, "error");
  });

  return nextRecognition;
}

export async function toggleSpeechRecognition({ input, micButton, setStatus }) {
  try {
    if (listening) {
      recognition?.stop();
      micButton.classList.remove("listening");
      return;
    }

    await ensureMicrophonePermission();
    recognition = recognition || createRecognition({ input, setStatus });

    if (!recognition) return;

    recognition.start();
    listening = true;
    micButton.classList.add("listening");
    setStatus("Micrófono activo. Dicta la operación en voz alta.", "");
  } catch (error) {
    setStatus(error.message || "No se pudo acceder al micrófono.", "error");
  }
}

export function stopSpeechRecognition(micButton) {
  recognition?.stop();
  listening = false;
  micButton?.classList.remove("listening");
}

export function resolveNumbersRound(numbers, target) {
  return solveNumbers(numbers, target);
}
