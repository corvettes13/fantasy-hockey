async function loadAllCards() {
  const res = await fetch("/fantasy-hockey/data/olympic_bingo_cards.json");
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

  // Winner status (new JSON structure)
  const isWinner = card.winner?.is_winner;
  let winnerText = "Winner: false";

  // Winner status (new JSON structure)
  let winnerHTML = "";

  if (card.winner?.is_winner) {
    const formatted = formatTimestamp(card.winner.timestamp);
    winnerHTML = `<p class="winner-status">BINGO! (${card.winner.type}) (${formatted})</p>`; 
  }
  
  wrapper.innerHTML = `
    <h2>${card.name}</h2>
    <h3>Card #${cardNum}</h3>
    ${winnerHTML}
    <div class="bingo-grid"></div>
  `

  const grid = wrapper.querySelector(".bingo-grid");

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const event = card.grid[r][c];
      const cell = document.createElement("div");

      if (event === "FREE") {
        cell.classList.add("free");
        cell.textContent = ""; // no text needed, image will show
      } else {
        cell.textContent = event;
      }

      if (card.events[event].validated) {
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

  // Extract winners
  const winners = Object.entries(cards)
    .map(([num, card]) => ({ num, ...card }))
    .filter(c => c.winner?.is_winner);

  if (winners.length === 0) {
    leaderboard.innerHTML = "<p>No bingos yet.</p>";
    return;
  }

  // Helper: sort by timestamp
  const sortByTime = arr =>
    arr.sort((a, b) => new Date(a.winner.timestamp) - new Date(b.winner.timestamp));

  // Filter by type
  const regular = sortByTime(
    winners.filter(c => c.winner.type.includes("regular"))
  ).slice(0, 5);

  const xbingos = sortByTime(
    winners.filter(c => c.winner.type.includes("x"))
  ).slice(0, 2);

  const box = sortByTime(
    winners.filter(c => c.winner.type.includes("box"))
  ).slice(0, 1);

  // Render a section
  const renderSection = (title, list) => {
    const section = document.createElement("div");
    section.classList.add("leaderboard-section");

    section.innerHTML = `<h3>${title}</h3>`;

    if (list.length === 0) {
      section.innerHTML += `<p>No ${title.toLowerCase()} yet.</p>`;
    } else {
      list.forEach(c => {
        const formatted = formatTimestamp(c.winner.timestamp);
        const div = document.createElement("div");
        div.classList.add("leaderboard-entry");
        div.textContent = `${c.name} — Card #${c.num} — ${formatted}`;
        section.appendChild(div);
      });
    }

    leaderboard.appendChild(section);
  };

  renderSection("Fastest Regular Bingos", regular);
  renderSection("Fastest X Bingos", xbingos);
  renderSection("Fastest Box Bingo", box);
}

async function init() {
  const cards = await loadAllCards();
  const select = document.getElementById("card-select");

  buildLeaderboard(cards);

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