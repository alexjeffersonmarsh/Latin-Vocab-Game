// =====================================================
// SETTINGS & STATE
// =====================================================
const rows = 5;
const cols = 4;
const colorMap = {
    red: "radial-gradient(circle at 30% 30%, #ff7e7e, #ff3e3e 70%, #a30000)",
    blue: "radial-gradient(circle at 30% 30%, #82ccdd, #0a3d62 70%, #062c43)",
    green: "radial-gradient(circle at 30% 30%, #a2ffaf, #27ae60 70%, #145a32)",
    purple: "radial-gradient(circle at 30% 30%, #d982ff, #8e44ad 70%, #4a235a)",
    gold: "radial-gradient(circle at 30% 30%, #ffeaa7, #f1c40f 70%, #967117)"
};
const colors = Object.keys(colorMap);

let score = 0;
let timeLeft = 180;
let comboMultiplier = 1;
let gemBoard = [];
let recyclePool = [];
let selectedGem = null;
let selectedCard = null;
let fullVocab = [];

const gemGrid = document.getElementById("gemGrid");
const cardGrid = document.getElementById("cardGrid");
const scoreDisplay = document.getElementById("score");
const timerDisplay = document.getElementById("timer");

// =====================================================
// UTILITIES
// =====================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration, type = "sine") {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// =====================================================
// INITIALIZATION
// =====================================================
function loadVocab() {
    const params = new URLSearchParams(window.location.search);
    const listName = params.get("list");
    if (!listName) return false;

    const saved = localStorage.getItem("vocab_" + listName);
    if (!saved) return false;

    fullVocab = saved.split("\n").map((line, i) => {
        const [word, def] = line.split(",");
        return { id: i + 1, word: word?.trim(), definition: def?.trim() };
    }).filter(v => v.word && v.definition);

    return fullVocab.length > 0;
}

function positionGem(g) {
    g.element.style.left = (g.col * 105) + "px";
    g.element.style.top = (g.row * 85) + "px";
}

function createGemElement(g) {
    const d = document.createElement("div");
    d.className = "cell gem";
    d.style.background = colorMap[g.color];
    d.innerHTML = `<span class="label">${g.word}</span>`;
    d.onclick = () => {
        if (selectedGem) selectedGem.element.classList.remove("selected");
        selectedGem = g;
        g.element.classList.add("selected");
        tryMatch();
    };
    return d;
}

// =====================================================
// CORE GAMEPLAY LOGIC
// =====================================================
function buildBoard() {
    gemGrid.innerHTML = "";
    const shuffled = [...fullVocab].sort(() => Math.random() - 0.5);
    for (let r = 0; r < rows; r++) {
        gemBoard[r] = [];
        for (let c = 0; c < cols; c++) {
            let item = shuffled.pop() || fullVocab[0];
            let g = { ...item, color: colors[Math.floor(Math.random() * colors.length)], row: r, col: c };
            g.element = createGemElement(g);
            positionGem(g);
            gemGrid.appendChild(g.element);
            gemBoard[r][c] = g;
        }
    }
}

function buildCards() {
    cardGrid.innerHTML = "";
    [...fullVocab].sort(() => Math.random() - 0.5).forEach(item => {
        const d = document.createElement("div");
        d.className = "cell card";
        d.textContent = item.definition;
        d.dataset.id = item.id;
        d.onclick = () => {
            if (selectedCard) selectedCard.classList.remove("selected");
            selectedCard = d;
            d.classList.add("selected");
            tryMatch();
        };
        cardGrid.appendChild(d);
    });
}

function tryMatch() {
    if (!selectedGem || !selectedCard) return;

    if (selectedGem.id === Number(selectedCard.dataset.id)) {
        playTone(600, 0.2); // Success
        score += 10;
        scoreDisplay.textContent = score;

        // Clear matched gems from board
        const matchId = selectedGem.id;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gemBoard[r][c]?.id === matchId) {
                    gemBoard[r][c].element.remove();
                    gemBoard[r][c] = null;
                }
            }
        }
        selectedCard.remove();
        resolveBoard();
    } else {
        playTone(150, 0.3, "square"); // Fail
    }

    selectedGem.element.classList.remove("selected");
    selectedCard?.classList.remove("selected");
    selectedGem = null; 
    selectedCard = null;
}

// =====================================================
// GRAVITY & CASCADES
// =====================================================
function resolveBoard() {
    comboMultiplier = 1;
    function processCycle() {
        applyGravity();
        refillBoard();
        
        setTimeout(() => {
            const matches = findMatches();
            if (matches.length > 0) {
                playTone(90, 0.2); // Explosion
                score += (20 * comboMultiplier);
                scoreDisplay.textContent = score;
                
                matches.forEach(g => {
                    recyclePool.push({ id: g.id, word: g.word, definition: g.definition });
                    g.element.classList.add("fade-out");
                    setTimeout(() => g.element.remove(), 400);
                    gemBoard[g.row][g.col] = null;
                });

                comboMultiplier++;
                setTimeout(processCycle, 600);
            }
        }, 400);
    }
    processCycle();
}

function applyGravity() {
    for (let c = 0; c < cols; c++) {
        let emptySlot = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
            if (gemBoard[r][c]) {
                const g = gemBoard[r][c];
                gemBoard[r][c] = null;
                gemBoard[emptySlot][c] = g;
                g.row = emptySlot;
                positionGem(g);
                emptySlot--;
            }
        }
    }
}

function refillBoard() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!gemBoard[r][c] && recyclePool.length > 0) {
                const item = recyclePool.shift();
                const g = { ...item, color: colors[Math.floor(Math.random() * colors.length)], row: r, col: c };
                g.element = createGemElement(g);
                gemBoard[r][c] = g;
                gemGrid.appendChild(g.element);
                positionGem(g);
            }
        }
    }
}

function findMatches() {
    const matched = new Set();
    // Horizontal
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 2; c++) {
            let color = gemBoard[r][c]?.color;
            if (color && gemBoard[r][c+1]?.color === color && gemBoard[r][c+2]?.color === color) {
                matched.add(gemBoard[r][c]); matched.add(gemBoard[r][c+1]); matched.add(gemBoard[r][c+2]);
            }
        }
    }
    // Vertical
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 2; r++) {
            let color = gemBoard[r][c]?.color;
            if (color && gemBoard[r+1][c]?.color === color && gemBoard[r+2][c]?.color === color) {
                matched.add(gemBoard[r][c]); matched.add(gemBoard[r+1][c]); matched.add(gemBoard[r+2][c]);
            }
        }
    }
    return Array.from(matched);
}

// =====================================================
// START
// =====================================================
if (loadVocab()) {
    buildBoard();
    buildCards();
    setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
        }
    }, 1000);
} else {
    alert("Please ensure the URL has ?list=NAME and the list exists in LocalStorage.");
}
