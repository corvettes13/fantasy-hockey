// ---------------------------------------------------------
// LEADERBOARD CONFIGURATION
// Define which types to score and the max number of winners to show.
// Only keys with a limit greater than 0 will build/display a section.
// ---------------------------------------------------------
const LEADERBOARD_CONFIG = {
  "horizontal": 4,   // Track up to 4 horizontal winners
  "vertical": 10,     // Track up to 3 vertical winners
  "diagonal": 2,     // Track up to 2 diagonal winners
  "cross": 2,        // Track up to 2 cross (X) winners
  "blackout": 1      // Track up to 1 blackout winner
};

async function loadAllCards() {
  const res = await fetch("/fantasy-hockey/data/fifa_world_cup_bingo_cards.json");
  const data = await res.json();
  return data.cards;
}

function formatTimestamp(ts) {
  if (!ts) return null;

  const date = new Date(ts);
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  };

  return date.toLocaleString("en-US", options);
}

function renderSingleCard(cardNum, card, container) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("card", "bingo-card");

  let winnerHTML = "";

  if (card.winner?.is_winner) {
    const parts = [];

    // Dynamically display all valid winning types matching our config keys
    Object.keys(LEADERBOARD_CONFIG).forEach(type => {
      if (card.winner[type]) {
        const titleCased = type.charAt(0).toUpperCase() + type.slice(1);
        parts.push(`${titleCased} — ${formatTimestamp(card.winner[type])}`);
      }
    });

    if (parts.length > 0) {
      winnerHTML = `<p class="winner-status">BINGO!<br>${parts.join("<br>")}</p>`;
    }
  }

  wrapper.innerHTML = `
    <h2>${card.name}</h2>
    <h3>Card #${cardNum}</h3>
    ${winnerHTML}
    <div class="bingo-grid"></div>
  `;

  const grid = wrapper.querySelector(".bingo-grid");

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const event = card.grid[r][c];
      const cell = document.createElement("div");

      if (event === "FREE") {
        cell.classList.add("free");
        cell.textContent = ""; 
      } else {
        cell.textContent = event;
      }

      if (card.events[event] && card.events[event].validated) {
        cell.classList.add("validated");
      }

      grid.appendChild(cell);
    }
  }

  container.appendChild(wrapper);
}

function renderAllCardsForName(name, cards) {
  const container = document.getElementById("cards-container");
  container.innerHTML = "";

  Object.entries(cards).forEach(([num, card]) => {
    if (card.name === name) {
      renderSingleCard(num, card, container);
    }
  });
}

function buildLeaderboard(cards) {
  const leaderboard = document.getElementById("leaderboard");
  leaderboard.innerHTML = "";

  // Extract all cards into a flatter array for easier filtering
  const allCards = Object.entries(cards).map(([num, card]) => ({ num, ...card }));

  // Helper function to safely sort cards chronologically by a specific bingo type timestamp
  const sortByTimestamp = (arr, type) => {
    return arr.sort((a, b) => new Date(a.winner[type]) - new Date(b.winner[type]));
  };

  let totalVisibleSections = 0;

  // Process each bingo type dynamically based on the configuration layout
  Object.entries(LEADERBOARD_CONFIG).forEach(([type, maxWinners]) => {
    // Skip entirely if it's set to 0 or negative
    if (maxWinners <= 0) return;

    totalVisibleSections++;

    // A card qualifies if its winner block has a non-null string timestamp for this specific type
    const typedWinners = allCards.filter(c => c.winner && typeof c.winner[type] === "string");
    
    // Sort chronologically (earliest timestamp wins) and slice to the customized limit
    const sortedLeaderboard = sortByTimestamp(typedWinners, type).slice(0, maxWinners);

    // Create the dashboard view element
    const section = document.createElement("div");
    section.classList.add("leaderboard-section");

    const capitalizedTitle = type.charAt(0).toUpperCase() + type.slice(1);
    section.innerHTML = `<h3>Fastest ${capitalizedTitle} Bingos</h3>`;

    if (sortedLeaderboard.length === 0) {
      section.innerHTML += `<p>No ${type} bingos yet.</p>`;
    } else {
      sortedLeaderboard.forEach(c => {
        const formatted = formatTimestamp(c.winner[type]);
        const div = document.createElement("div");
        div.classList.add("leaderboard-entry");
        div.textContent = `${c.name} — Card #${c.num} — ${formatted}`;
        section.appendChild(div);
      });
    }

    leaderboard.appendChild(section);
  });

  if (totalVisibleSections === 0) {
    leaderboard.innerHTML = "<p>Leaderboard tracking is completely disabled.</p>";
  }
}

function renderMostMarkedLeaderboard(cards) {
  // Target either a dedicated container OR append to main leaderboard
  const container = document.getElementById("most-marked-leaderboard") || document.getElementById("leaderboard");
  if (!container) return;

  // 1. Extract all cards with max_marked data
  const cardList = Object.entries(cards)
    .map(([num, card]) => ({
      num,
      name: card.name,
      maxMarked: card.winner?.max_marked || { count: 0, timestamp: null }
    }))
    .filter(c => c.maxMarked.count > 0);

  if (cardList.length === 0) {
    return;
  }

  // 2. Find the highest count across all cards
  const highestCount = Math.max(...cardList.map(c => c.maxMarked.count));

  // 3. Filter cards that tied for the highest count
  const topCards = cardList.filter(c => c.maxMarked.count === highestCount);

  // 4. Sort ties by who reached that count fastest (earliest timestamp)
  topCards.sort((a, b) => new Date(a.maxMarked.timestamp) - new Date(b.maxMarked.timestamp));

  // 5. Render section
  const section = document.createElement("div");
  section.classList.add("leaderboard-section");
  
  const title = document.createElement("h3");
  title.textContent = `Most Squares Marked (${highestCount} Squares)`;
  section.appendChild(title);

  topCards.forEach(c => {
    const formatted = formatTimestamp(c.maxMarked.timestamp);
    const div = document.createElement("div");
    div.classList.add("leaderboard-entry");
    div.textContent = `${c.name} — Card #${c.num} — Reached on ${formatted}`;
    section.appendChild(div);
  });

  container.appendChild(section);
}

async function init() {
  const cards = await loadAllCards();
  const select = document.getElementById("card-select");

  // Build configured bingo type sections
  buildLeaderboard(cards);

  // Build the most marked squares section
  renderMostMarkedLeaderboard(cards);

  // Populate dropdown
  Object.keys(cards).forEach(cardNum => {
    const opt = document.createElement("option");
    opt.value = cardNum;
    opt.textContent = `#${cardNum} — ${cards[cardNum].name}`;
    select.appendChild(opt);
  });

  // Check URL for ?name=
  const params = new URLSearchParams(window.location.search);
  const urlName = params.get("name");

  if (urlName) {
    renderAllCardsForName(urlName, cards);
  }

  select.addEventListener("change", () => {
    const cardNum = select.value;
    if (!cardNum) return;

    const name = cards[cardNum].name;

    history.replaceState(null, "", `?name=${encodeURIComponent(name)}`);
    renderAllCardsForName(name, cards);
  });
}

init();