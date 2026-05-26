import { solveLetters } from "./agente.js";

const VOWELS = "AEIOU".split("");
const EASY_CONSONANTS = "SRNDLCMPTBV".split("");
const MEDIUM_CONSONANTS = "BCDFGHJLMNPQRSTVXYZÑ".split("");
const HARD_CONSONANTS = "ZXJÑFGHY".split("");

let dictionarySet = new Set();
let dictionaryWords = [];

export function normalizeText(value) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ü/g, "U");
}

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

export function isWordBuildable(word, letters) {
  const available = countOccurrences(letters);
  const requested = countOccurrences(word.split(""));
  return Object.entries(requested).every(([letter, count]) => available[letter] >= count);
}

export async function loadDictionary({ newGameButton }) {
  newGameButton.disabled = true;
  newGameButton.textContent = "Cargando diccionario...";

  try {
    const response = await fetch("./data/palabras.txt");

    if (!response.ok) {
      throw new Error(`No se pudo cargar /data/palabras.txt (${response.status})`);
    }

    const text = await response.text();
    dictionaryWords = text
      .split("\n")
      .map((word) => normalizeText(word))
      .filter(Boolean);
    dictionarySet = new Set(dictionaryWords);
    newGameButton.disabled = false;
    newGameButton.textContent = "Nueva Partida";
  } catch (error) {
    console.error("Error cargando el diccionario real:", error);
    alert("No se pudo cargar el archivo /data/palabras.txt. Revisa que exista y que estés sirviendo la app desde un servidor local.");
    newGameButton.disabled = true;
    newGameButton.textContent = "Diccionario no disponible";
  }
}

export function getDictionarySize() {
  return dictionarySet.size;
}

export function generateLetters({ vowelInput, consonantInput }) {
  return generateLettersByDifficulty({ vowelInput, consonantInput, difficulty: "medium" });
}

function getLetterCountsByDifficulty({ vowelInput, consonantInput, difficulty }) {
  let vowels = Number.parseInt(vowelInput.value, 10);
  let consonants = Number.parseInt(consonantInput.value, 10);

  if (difficulty === "easy") {
    vowelInput.value = 4;
    consonantInput.value = 5;
    return { vowels: 4, consonants: 5 };
  }

  if (difficulty === "pro") {
    vowelInput.value = 3;
    consonantInput.value = 6;
    return { vowels: 3, consonants: 6 };
  }

  if (!Number.isInteger(vowels)) vowels = 4;
  if (!Number.isInteger(consonants)) consonants = 5;

  vowels = Math.min(Math.max(vowels, 0), 9);
  consonants = Math.min(Math.max(consonants, 0), 9);

  if (vowels + consonants !== 9) {
    consonants = 9 - vowels;
  }

  vowelInput.value = vowels;
  consonantInput.value = consonants;

  return { vowels, consonants };
}

function getConsonantPool(difficulty) {
  if (difficulty === "easy") return EASY_CONSONANTS;
  if (difficulty === "pro") return [...MEDIUM_CONSONANTS, ...HARD_CONSONANTS, ...HARD_CONSONANTS];
  return MEDIUM_CONSONANTS;
}

function generateProConsonants(count) {
  const consonants = Array.from({ length: count }, () => getRandomItem(getConsonantPool("pro")));

  if (Math.random() < 0.4 && consonants.length) {
    const index = Math.floor(Math.random() * consonants.length);
    consonants[index] = getRandomItem(HARD_CONSONANTS);
  }

  return consonants;
}

export function generateLettersByDifficulty({ vowelInput, consonantInput, difficulty = "medium" }) {
  const normalizedDifficulty = ["easy", "medium", "pro"].includes(difficulty) ? difficulty : "medium";
  const { vowels, consonants } = getLetterCountsByDifficulty({
    vowelInput,
    consonantInput,
    difficulty: normalizedDifficulty
  });
  const consonantLetters = normalizedDifficulty === "pro"
    ? generateProConsonants(consonants)
    : Array.from({ length: consonants }, () => getRandomItem(getConsonantPool(normalizedDifficulty)));

  return shuffle([
    ...Array.from({ length: vowels }, () => getRandomItem(VOWELS)),
    ...consonantLetters
  ]);
}

export function validateLettersAnswer(rawAnswer, letters) {
  const word = normalizeText(rawAnswer);
  const best = solveLetters(letters, dictionaryWords, isWordBuildable);
  const suffix = best.words.length
    ? ` ${best.message}`
    : " No había palabras válidas en el diccionario.";

  if (!word) {
    return { success: false, message: "Introduce una palabra antes de comprobar.", type: "warning" };
  }

  if (!/^[A-ZÑ]+$/.test(word)) {
    return { success: false, message: "La respuesta solo puede contener letras.", type: "error" };
  }

  if (!isWordBuildable(word, letters)) {
    return { success: false, message: `"${word}" usa letras que no están disponibles.${suffix}`, type: "error" };
  }

  if (!dictionarySet.has(word)) {
    return { success: false, message: `"${word}" se puede formar, pero no existe en el diccionario.${suffix}`, type: "error" };
  }

  return { success: true, message: `Correcto: "${word}" está en el diccionario y usa letras válidas.`, type: "success" };
}

export function resolveLettersRound(letters) {
  return solveLetters(letters, dictionaryWords, isWordBuildable);
}
