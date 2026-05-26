import {
  generateNumbersByDifficulty,
  resetNumbersInterface,
  bindVirtualKeyboard,
  setNumbersControlsDisabled,
  validateNumbersAnswer,
  resolveNumbersRound,
  toggleSpeechRecognition,
  stopSpeechRecognition
} from "./modules/cifras.js";
import {
  generateLettersByDifficulty,
  getDictionarySize,
  loadDictionary,
  resolveLettersRound,
  validateLettersAnswer
} from "./modules/letras.js";

const HISTORY_KEY = "cylTrainingHistory";

const state = {
  mode: "letters",
  timerId: null,
  timeLeft: 30,
  active: false,
  roundSaved: false,
  difficulty: "easy",
  letters: [],
  numbers: [],
  target: null
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  gameTitle: document.getElementById("gameTitle"),
  timer: document.getElementById("timer"),
  lettersGame: document.getElementById("lettersGame"),
  numbersGame: document.getElementById("numbersGame"),
  lettersGrid: document.getElementById("lettersGrid"),
  numbersGrid: document.getElementById("numbersGrid"),
  targetNumber: document.getElementById("targetNumber"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  lettersAnswerInput: document.getElementById("lettersAnswerInput"),
  micBtn: document.getElementById("micBtn"),
  checkBtn: document.getElementById("checkBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  status: document.getElementById("status"),
  agentPanel: document.getElementById("agentPanel"),
  agentOutput: document.getElementById("agentOutput"),
  vowelCount: document.getElementById("vowelCount"),
  consonantCount: document.getElementById("consonantCount"),
  lettersSettings: document.getElementById("lettersSettings"),
  roundInfo: document.getElementById("roundInfo"),
  operationKeys: document.getElementById("operationKeys"),
  statsBtn: document.getElementById("statsBtn"),
  statsModal: document.getElementById("statsModal"),
  closeStatsBtn: document.getElementById("closeStatsBtn"),
  numbersSuccessRate: document.getElementById("numbersSuccessRate"),
  lettersSuccessRate: document.getElementById("lettersSuccessRate"),
  avgWinTime: document.getElementById("avgWinTime"),
  statsNote: document.getElementById("statsNote")
};

elements.difficultySelect = document.getElementById("difficultySelect");

const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Medio",
  pro: "Pro"
};

function setStatus(message, type = "") {
  elements.status.className = `status ${type}`.trim();
  elements.status.textContent = message;
}

function setAgentMessage(message, visible = true) {
  elements.agentPanel.classList.toggle("visible", visible);
  elements.agentOutput.textContent = message;
}

function renderTiles(container, values, className = "") {
  container.innerHTML = values
    .map((value) => `<div class="tile ${className}">${value}</div>`)
    .join("");
}

function renderTimer() {
  elements.timer.textContent = String(state.timeLeft).padStart(2, "0");
  elements.timer.classList.toggle("danger", state.timeLeft <= 5);
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "sin resultado";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function buildNumbersSummary(userResult, optimalResult) {
  const optimalLine = `IA óptima: ${optimalResult.expression} = ${formatNumber(optimalResult.value)}.`;

  if (userResult.value === null) {
    return `${userResult.message} ${optimalLine}`;
  }

  const userDiff = state.target - userResult.value;
  const userAbsDiff = Math.abs(userDiff);
  const matchedOptimal = Math.abs(userAbsDiff - optimalResult.absDiff) < 0.000001;
  const comparison = matchedOptimal
    ? "Has igualado la mejor solución encontrada."
    : `Te quedaste a ${formatNumber(userDiff)}. Diferencia: ${formatNumber(userAbsDiff)}.`;

  return `Tu resultado: ${formatNumber(userResult.value)}. ${comparison} ${optimalLine}`;
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.active = false;
}

function startTimer(seconds) {
  stopTimer();
  state.timeLeft = seconds;
  state.active = true;
  renderTimer();

  state.timerId = window.setInterval(() => {
    state.timeLeft -= 1;
    renderTimer();

    if (state.timeLeft <= 0) {
      stopTimer();
      handleTimeUp();
    }
  }, 1000);
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    setStatus("No se pudo guardar el historial en localStorage.", "warning");
  }
}

function saveRoundHistory({ answer, success }) {
  if (state.roundSaved) return;

  const round = {
    fecha: new Date().toISOString(),
    prueba: state.mode === "letters" ? "Letras" : "Cifras",
    objetivo: state.mode === "letters" ? state.letters.join("") : state.target,
    respuestaUsuario: answer || "",
    resultado: success ? "Acierto" : "Fallo",
    tiempoRestante: state.timeLeft
  };

  const history = readHistory();
  history.push(round);
  writeHistory(history);
  state.roundSaved = true;
}

function calculateStats() {
  const history = readHistory();
  const numbers = history.filter((round) => round.prueba === "Cifras");
  const letters = history.filter((round) => round.prueba === "Letras");
  const wins = history.filter((round) => round.resultado === "Acierto");

  const rate = (rounds) => {
    if (!rounds.length) return 0;
    return Math.round((rounds.filter((round) => round.resultado === "Acierto").length / rounds.length) * 100);
  };

  const avgWinTime = wins.length
    ? Math.round(wins.reduce((total, round) => total + Number(round.tiempoRestante || 0), 0) / wins.length)
    : 0;

  return {
    total: history.length,
    numbersRate: rate(numbers),
    lettersRate: rate(letters),
    avgWinTime
  };
}

function renderStats() {
  const stats = calculateStats();
  elements.numbersSuccessRate.textContent = `${stats.numbersRate}%`;
  elements.lettersSuccessRate.textContent = `${stats.lettersRate}%`;
  elements.avgWinTime.textContent = `${stats.avgWinTime}s`;
  elements.statsNote.textContent = stats.total
    ? `${stats.total} partidas guardadas en localStorage.`
    : "Todavía no hay partidas guardadas en localStorage.";
}

function updateRoundInfo() {
  const items = state.mode === "letters"
    ? [
        ["Modo", "Letras"],
        ["Dificultad", DIFFICULTY_LABELS[state.difficulty]],
        ["Tiempo", "30 segundos"],
        ["Diccionario", `${getDictionarySize()} palabras`]
      ]
    : [
        ["Modo", "Cifras"],
        ["Dificultad", DIFFICULTY_LABELS[state.difficulty]],
        ["Tiempo", "45 segundos"],
        ["Objetivo", state.target || "---"]
      ];

  elements.roundInfo.innerHTML = items
    .map(([label, value]) => `<li><strong>${label}:</strong> ${value}</li>`)
    .join("");
}

function syncDifficultyControls() {
  state.difficulty = elements.difficultySelect.value;
  const lockedLetterRatio = state.difficulty !== "medium";
  elements.vowelCount.disabled = lockedLetterRatio;
  elements.consonantCount.disabled = lockedLetterRatio;

  if (state.difficulty === "easy") {
    elements.vowelCount.value = 4;
    elements.consonantCount.value = 5;
  }

  if (state.difficulty === "pro") {
    elements.vowelCount.value = 3;
    elements.consonantCount.value = 6;
  }

  updateRoundInfo();
}

function startNewGame() {
  syncDifficultyControls();
  elements.answerInput.value = "";
  elements.lettersAnswerInput.value = "";
  elements.checkBtn.disabled = false;
  state.roundSaved = false;
  stopSpeechRecognition(elements.micBtn);
  setAgentMessage("Esperando a que termine el tiempo.", false);

  if (state.mode === "letters") {
    elements.lettersAnswerInput.readOnly = false;
    state.letters = generateLettersByDifficulty({
      vowelInput: elements.vowelCount,
      consonantInput: elements.consonantCount,
      difficulty: state.difficulty
    });
    renderTiles(elements.lettersGrid, state.letters);
    startTimer(30);
    setStatus("Ronda de letras iniciada. Forma la palabra más larga que puedas.", "");
  } else {
    elements.answerInput.readOnly = true;
    const round = generateNumbersByDifficulty(state.difficulty);
    state.target = round.target;
    state.numbers = round.numbers;
    elements.targetNumber.textContent = state.target;
    resetNumbersInterface({
      input: elements.answerInput,
      numbersGrid: elements.numbersGrid,
      operationKeys: elements.operationKeys,
      numbers: state.numbers
    });
    setNumbersControlsDisabled({
      numbersGrid: elements.numbersGrid,
      operationKeys: elements.operationKeys
    }, false);
    startTimer(45);
    setStatus("Ronda de cifras iniciada. Usa el teclado virtual o el micrófono.", "");
  }

  updateRoundInfo();
  if (state.mode === "letters") {
    elements.lettersAnswerInput.focus();
  }
}

function handleTimeUp() {
  elements.checkBtn.disabled = true;
  stopSpeechRecognition(elements.micBtn);

  if (state.mode === "letters") {
    const solution = resolveLettersRound(state.letters);
    setStatus("Tiempo agotado. El agente resolutor ha calculado el Top 3.", "error");
    setAgentMessage(solution.message);
    saveRoundHistory({ answer: elements.lettersAnswerInput.value, success: false });
    return;
  }

  const userResult = validateNumbersAnswer(elements.answerInput.value, state.numbers, state.target);
  const solution = resolveNumbersRound(state.numbers, state.target);
  setNumbersControlsDisabled({
    numbersGrid: elements.numbersGrid,
    operationKeys: elements.operationKeys
  }, true);
  setStatus(`Tiempo agotado. El objetivo era ${state.target}; revisa la solución de la máquina.`, "error");
  setAgentMessage(buildNumbersSummary(userResult, solution));
  saveRoundHistory({ answer: elements.answerInput.value, success: false });
}

function checkAnswer() {
  if (!state.active) {
    setStatus("Inicia una nueva partida antes de comprobar.", "warning");
    return;
  }

  stopTimer();
  stopSpeechRecognition(elements.micBtn);
  elements.checkBtn.disabled = true;

  if (state.mode === "letters") {
    const result = validateLettersAnswer(elements.lettersAnswerInput.value, state.letters);
    setStatus(result.message, result.type);
    saveRoundHistory({ answer: elements.lettersAnswerInput.value, success: result.success });
    return;
  }

  const userResult = validateNumbersAnswer(elements.answerInput.value, state.numbers, state.target);
  const solution = resolveNumbersRound(state.numbers, state.target);
  const userAbsDiff = userResult.value === null ? Infinity : Math.abs(state.target - userResult.value);
  const matchedOptimal = userResult.value !== null && Math.abs(userAbsDiff - solution.absDiff) < 0.000001;

  setStatus(matchedOptimal ? "Solución enviada: has alcanzado la mejor marca posible." : "Solución enviada: compara tu resultado con la IA.", matchedOptimal ? "success" : "error");
  setAgentMessage(buildNumbersSummary(userResult, solution));
  setNumbersControlsDisabled({
    numbersGrid: elements.numbersGrid,
    operationKeys: elements.operationKeys
  }, true);
  saveRoundHistory({ answer: elements.answerInput.value, success: matchedOptimal });
}

function switchMode(mode) {
  if (state.mode === mode) return;

  stopTimer();
  stopSpeechRecognition(elements.micBtn);
  state.mode = mode;
  state.roundSaved = false;
  elements.answerInput.value = "";
  elements.lettersAnswerInput.value = "";
  elements.checkBtn.disabled = false;
  elements.timer.textContent = mode === "letters" ? "30" : "45";
  elements.timer.classList.remove("danger");
  elements.gameTitle.textContent = mode === "letters" ? "Prueba de Letras" : "Prueba de Cifras";
  elements.lettersGame.classList.toggle("hidden", mode !== "letters");
  elements.numbersGame.classList.toggle("hidden", mode !== "numbers");
  elements.lettersSettings.classList.toggle("hidden", mode !== "letters");
  elements.answerForm.classList.toggle("hidden", mode !== "letters");
  elements.answerInput.readOnly = mode === "numbers";
  elements.lettersAnswerInput.placeholder = "Escribe tu palabra";

  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  setStatus("Pulsa Nueva Partida para empezar.", "");
  setAgentMessage("Esperando a que termine el tiempo.", false);
  updateRoundInfo();
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  elements.difficultySelect.addEventListener("change", syncDifficultyControls);

  elements.newGameBtn.addEventListener("click", startNewGame);
  elements.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    checkAnswer();
  });

  elements.micBtn.addEventListener("click", () => {
    toggleSpeechRecognition({
      input: elements.answerInput,
      micButton: elements.micBtn,
      setStatus
    });
  });

  bindVirtualKeyboard({
    input: elements.answerInput,
    numbersGrid: elements.numbersGrid,
    operationKeys: elements.operationKeys,
    onSubmit: checkAnswer
  });

  elements.vowelCount.addEventListener("input", () => {
    const vowels = Math.min(Math.max(Number.parseInt(elements.vowelCount.value, 10) || 0, 0), 9);
    elements.consonantCount.value = 9 - vowels;
  });

  elements.consonantCount.addEventListener("input", () => {
    const consonants = Math.min(Math.max(Number.parseInt(elements.consonantCount.value, 10) || 0, 0), 9);
    elements.vowelCount.value = 9 - consonants;
  });

  elements.statsBtn.addEventListener("click", () => {
    renderStats();
    elements.statsModal.classList.add("open");
  });

  elements.closeStatsBtn.addEventListener("click", () => {
    elements.statsModal.classList.remove("open");
  });

  elements.statsModal.addEventListener("click", (event) => {
    if (event.target === elements.statsModal) {
      elements.statsModal.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      elements.statsModal.classList.remove("open");
    }
  });
}

async function init() {
  bindEvents();
  syncDifficultyControls();
  state.letters = generateLettersByDifficulty({
    vowelInput: elements.vowelCount,
    consonantInput: elements.consonantCount,
    difficulty: state.difficulty
  });
  renderTiles(elements.lettersGrid, state.letters);
  updateRoundInfo();
  await loadDictionary({ newGameButton: elements.newGameBtn });
  updateRoundInfo();
}

init();
