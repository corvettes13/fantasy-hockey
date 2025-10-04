let draftData = [];
let playerMap = {};
let teamNameMap = {};
let currentSortKey = "team";
let sortDirection = 1;
let teamFilter;
let filteredDraftData = [];

document.addEventListener("DOMContentLoaded", () => {
  Promise.all([
    fetch("/fantasy-hockey/data/2025_draft_results.json").then(res => res.json()),
    fetch("/fantasy-hockey/data/players.json").then(res => res.json()),
    fetch("/fantasy-hockey/data/2025_standings.json").then(res => res.json())
  ])
  .then(([draftPayload, playersPayload, standingsPayload]) => {
    draftData = draftPayload.draft_results;
    const players = playersPayload.players || [];
    const teams = standingsPayload.teams || [];
    
    // Populate team filter using standings
    teamFilter = document.getElementById("team-filter");
    teamFilter.addEventListener("change", applyTeamFilter);

    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team.team_key;
      option.textContent = team.name;
      teamFilter.appendChild(option);
    });

    // Build lookup maps
    playerMap = Object.fromEntries(players.map(p => [p.player_key, p]));
    teamNameMap = Object.fromEntries(teams.map(t => [t.team_key, t.name]));

    filteredDraftData = [...draftData];
    renderDraftTable(filteredDraftData);
    bindDraftHeaderSortEvents();
  });
});

teamFilter = document.getElementById("team-filter");
teamFilter.addEventListener("change", applyTeamFilter);

// Populate team options
const teamKeys = [...new Set(draftData.map(d => d.team_key))];
teamKeys.forEach(key => {
  const name = teamNameMap[key] || key;
  const option = document.createElement("option");
  option.value = key;
  option.textContent = name;
  teamFilter.appendChild(option);
});

function renderDraftTable(data) {
  const tbody = document.getElementById("draft-body");
  tbody.innerHTML = "";

  data.forEach(entry => {
    const player = playerMap[entry.player_key] || {};
    const name = player.full_name || entry.player_key;
    const position = player.position || "";
    const teamName = teamNameMap[entry.team_key] || entry.team_key;
    const cost = entry.cost ?? "";
    const kept = entry.kept ? "Yes" : "No";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align: left;">${teamName}</td>
      <td class="player-cell left-align">
        <a href="${player.url}" target="_blank">${player.full_name}</a>
        <span class="team-abbr">${player.team_abbr}</span>
      </td>
      <td class="left-align">${position}</td>
      <td>$${cost}</td>
      <td class="${entry.kept ? 'kept' : ''}">${kept}</td>
    `;
    tbody.appendChild(row);
  });
}

function bindDraftHeaderSortEvents() {
  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      sortDraftBy(key);
    });
  });
}

function sortDraftBy(key) {
  if (currentSortKey === key) {
    sortDirection *= -1;
  } else {
    currentSortKey = key;
    sortDirection = 1;
  }

  filteredDraftData.sort((a, b) => {
    const aVal = getSortValue(a, key);
    const bVal = getSortValue(b, key);

    if (typeof aVal === "string") {
      return aVal.localeCompare(bVal) * sortDirection;
    } else {
      return (aVal - bVal) * sortDirection;
    }
  });

  renderDraftTable(filteredDraftData);
}

function getSortValue(entry, key) {
  const player = playerMap[entry.player_key] || {};
  switch (key) {
    case "team": return teamNameMap[entry.team_key] || "";
    case "player": return player.full_name || "";
    case "pos": return player.position || "";
    case "cost": return parseFloat(entry.cost) || 0;
    case "kept": return entry.kept ? 1 : 0;
    default: return 0;
  }
}

function applyTeamFilter() {
  const selectedTeam = teamFilter.value;
  filteredDraftData = selectedTeam
    ? draftData.filter(d => d.team_key === selectedTeam)
    : [...draftData]; // clone to avoid mutation

  renderDraftTable(filteredDraftData);
}