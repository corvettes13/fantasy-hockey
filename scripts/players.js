let playersData, teamsData, goalieStatsData;
let skaterStatsLoaded = false;
let skaterStatsData = null;
let goalieStatsLoaded = false;
let statsMap = {};
let allPlayers = [];
let teamMap = {};
let players = [];
let positionSelect, nameInput, gpInput;
let currentSortKey = "FP";
let sortDirection = -1;
let teamSelect;

let seasonSelect;
let skaterStatsMap = {};
let goalieStatsMap = {};


document.addEventListener('DOMContentLoaded', () => {
  positionSelect = document.getElementById('position-filter');
  nameInput = document.getElementById('name-filter');
  gpInput = document.getElementById('gp-filter');
  seasonSelect = document.getElementById('season-select');

  positionSelect.addEventListener('change', applyFilters);
  nameInput.addEventListener('input', applyFilters);
  gpInput.addEventListener('input', applyFilters);
  seasonSelect.addEventListener('change', () => {
    loadSeasonStats(seasonSelect.value);
  });
  
  teamSelect = document.getElementById('team-filter');
  teamSelect.addEventListener('change', applyFilters);

  Promise.all([
    fetch('/fantasy-hockey/data/players.json').then(res => res.json()),
    fetch('/fantasy-hockey/teams/nhl_teams.json').then(res => res.json())
  ])
  .then(([players, teams]) => {
    playersData = players;
    teamsData = teams;
    init(playersData, teamsData);
    
    const teamKeys = new Set();
    playersData.players.forEach(p => {
      if (p.owner_team_key && p.owner_team_name) {
        teamKeys.add(p.owner_team_key + '|' + p.owner_team_name);
      }
    });

    [...teamKeys].sort().reverse().forEach(entry => {
      const [key, name] = entry.split('|');
      const option = document.createElement('option');
      option.value = key;
      option.textContent = name;
      teamSelect.appendChild(option);
    });
    loadSeasonStats(seasonSelect.value); // initial load
  });
});


const skaterStatIdMap = {
  0: 'GP', 1: 'G', 2: 'A', 3: 'PTS', 4: 'PlusMinus', 5: 'PIM',
  6: 'PPG', 7: 'PPA', 9: 'SHG', 10: 'SHA', 12: 'GWG', 14: 'SOG',
  15: 'SPCT', 31: 'HIT', 32: 'BLK', 34: 'ATOI'
};
const goalieStatIdMap = {
  0: 'GP', 18: 'GS', 19: 'W', 20: 'L', 22: 'GA', 23: 'GAA',
  24: 'SA', 25: 'SV', 26: 'SV%', 27: 'SHO', 28: 'Min'
};

function init(playersData, teamsData) {
  allPlayers = playersData.players?.filter(p => typeof p.position === 'string') || [];
  teamMap = Object.fromEntries(teamsData.map(t => [t.team_abbreviation, t.logo_url]));
}

function applyFilters() {
  const positionQuery = positionSelect.value;
  const nameQuery = nameInput.value.toLowerCase();
  const selectedTeam = teamSelect.value;
  const minGP = parseInt(gpInput.value, 10) || 0;

  statsMap = positionQuery === 'G' ? goalieStatsMap : skaterStatsMap;

  const filtered = allPlayers.filter(p => {
    if (!p.position || typeof p.position !== 'string') return false;

    const stats = statsMap[p.player_id];
    const ownerKey = p.owner_team_key?.toLowerCase() ?? '';

    const matchesTeam =
      selectedTeam === '' // All Teams
        ? true
        : selectedTeam === 'Free Agent'
          ? ownerKey === 'free_agent'
          : p.owner_team_key === selectedTeam;

    if (!stats) return false;

    const gp = parseFloat(stats.GP) || 0;
    const matchesName = p.full_name.toLowerCase().includes(nameQuery);
    const matchesPosition =
      positionQuery === '' || p.position.replace(/\s+/g, '').split(',').includes(positionQuery);
    return matchesName && matchesPosition && matchesTeam && gp >= minGP;
  });


  filtered.sort((a, b) => {
    const aFP = statsMap[a.player_id]?.FP ?? 0;
    const bFP = statsMap[b.player_id]?.FP ?? 0;

    return bFP - aFP;
  });

  players = filtered;
  renderTableHeader();
  bindHeaderSortEvents();
  renderTable(filtered, statsMap);
}

function buildStatsMap(statsArray, type = "skater") {

  if (!Array.isArray(statsArray)) {
    console.error('statsArray is not an array:', statsArray);
    return {};
  }

  const map = {};
  for (const stat of statsArray) {
    const id = parseInt(stat.player_key.split('.').pop(), 10);

    if (!id) {
      console.warn('Missing player_id in stat:', stat);
      continue;
    }

    const statObj = {};
    const statMap = type === "goalie" ? goalieStatIdMap : skaterStatIdMap;

    stat.stats.forEach(s => {
      const statId = s._extracted_data?.stat_id ?? s.stat_id;
      const statKey = statMap[statId];
      let value = s._extracted_data?.value ?? s.value;

      if (value === '-' || value === '–' || value === undefined || value === null) value = 0;
      if (statKey) {
        statObj[statKey] = statKey === 'ATOI' ? value : parseFloat(value);
      }
    });

    map[id] = statObj;
  }

  return map;
}

function renderTableHeader() {
  const thead = document.getElementById('players-head');
  const isGoalieView = positionSelect.value === 'G';

  thead.innerHTML = `
    <tr>
      <th data-sort="rank">#</th>
      <th>Player</th>
      <th>Pos</th>
      <th>Owner</th>
      <th data-sort="GP">GP</th>
      ${isGoalieView ? `
        <th data-sort="GS">GS</th>
        <th data-sort="W">W</th>
        <th data-sort="L">L</th>
        <th data-sort="GA">GA</th>
        <th data-sort="GAA">GAA</th>
        <th data-sort="SA">SA</th>
        <th data-sort="SV">SV</th>
        <th data-sort="SV%">SV%</th>
        <th data-sort="SHO">SO</th>
      ` : `
        <th data-sort="G">G</th>
        <th data-sort="A">A</th>
        <th data-sort="PTS">PTS</th>
        <th data-sort="PlusMinus">+/-</th>
        <th data-sort="PIM">PIM</th>
        <th data-sort="PPG">PPG</th>
        <th data-sort="PPA">PPA</th>
        <th data-sort="SHG">SHG</th>
        <th data-sort="SHA">SHA</th>
        <th data-sort="GWG">GWG</th>
        <th data-sort="SOG">SOG</th>
        <th data-sort="SPCT">S%</th>
        <th data-sort="HIT">HIT</th>
        <th data-sort="BLK">BLK</th>
        <th data-sort="ATOI">ATOI</th>
      `}
      <th data-sort="FP">FP</th>
      <th data-sort="FPG">FPG</th>
    </tr>
  `;
}

function renderTable(data, statsMap) {
  const tbody = document.getElementById('players-body');
  tbody.innerHTML = '';
  const isGoalieView = positionSelect.value === 'G';

  data.slice(0, 250).forEach((player, index) => {
    const stats = statsMap[player.player_id];

    const logo = teamMap[player.team_abbr] || '';
    const owner = player.owner_team_name || 'Free Agent';
    let team_url = '';
    if (owner !== 'Free Agent') {
      const parts = player.owner_team_key.split('.');
      const team_num = parts[parts.length - 1];
      team_url = "/fantasy-hockey/teams/team.html?team=" + team_num;
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td class="player-cell">
        <img src="${logo}" alt="${player.team_abbr} logo" />
        <a href="${player.url}" target="_blank">${player.full_name}</a>
        <span class="team-abbr">${player.team_abbr}</span>
      </td>
      <td class="position-cell">${player.position}</td>
      <td class="owner-cell">
        ${team_url
          ? `<a href="${team_url}" target="_blank">${owner}</a>`
          : `${owner}`}
      </td>
      <td>${stats.GP ?? '0'}</td>
      ${isGoalieView ? `
        <td>${stats.GS ?? '0'}</td>
        <td>${stats.W ?? '0'}</td>
        <td>${stats.L ?? '0'}</td>
        <td>${stats.GA ?? '0'}</td>
        <td>${stats.GAA.toFixed(2) ?? '0.00'}</td>
        <td>${stats.SA ?? '0'}</td>
        <td>${stats.SV ?? '0'}</td>
        <td>${typeof stats['SV%'] === 'number' ? (stats['SV%'] * 100).toFixed(1) + '%' : '0'}</td>
        <td>${stats.SHO ?? '0'}</td>
      ` : `
        <td>${stats.G ?? '0'}</td>
        <td>${stats.A ?? '0'}</td>
        <td>${stats.PTS ?? '0'}</td>
        <td>${stats.PlusMinus ?? ''}</td>
        <td>${stats.PIM ?? '0'}</td>
        <td>${stats.PPG ?? '0'}</td>
        <td>${stats.PPA ?? '0'}</td>
        <td>${stats.SHG ?? '0'}</td>
        <td>${stats.SHA ?? '0'}</td>
        <td>${stats.GWG ?? '0'}</td>
        <td>${stats.SOG ?? '0'}</td>
        <td>${typeof stats.SPCT === 'number' ? (stats.SPCT * 100).toFixed(1) + '%' : '0'}</td>
        <td>${stats.HIT ?? '0'}</td>
        <td>${stats.BLK ?? '0'}</td>
        <td>${stats.ATOI ?? '00:00'}</td>
      `}
      <td>${stats.FP.toFixed(1) ?? '0'}</td>
      <td>${stats.FPG ?? '0.0'}</td>
    `;
    tbody.appendChild(row);
  });
}

function atoiToSeconds(timeStr) {
  if (typeof timeStr !== 'string') return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return (min || 0) * 60 + (sec || 0);
}

function bindHeaderSortEvents() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      sortBy(key);
    });
  });
}

function sortBy(key) {
  if (key === 'rank') return;
  if (!statsMap || Object.keys(statsMap).length === 0) {
    console.warn('statsMap is not ready');
    return;
  }

  if (currentSortKey === key) {
    sortDirection *= -1;
  } else {
    sortDirection = -1;
    currentSortKey = key;
  }

  players.sort((a, b) => {
    let aStat, bStat;

    if (key === 'ATOI') {
      aStat = atoiToSeconds(statsMap[a.player_id]?.ATOI ?? '00:00');
      bStat = atoiToSeconds(statsMap[b.player_id]?.ATOI ?? '00:00');
    } else {
      // Try statsMap first, fallback to player object
      aStat = statsMap[a.player_id]?.[key] ?? a[key];
      bStat = statsMap[b.player_id]?.[key] ?? b[key];

      // Default to numeric comparison unless both are strings
      const bothStrings = typeof aStat === 'string' && typeof bStat === 'string';
      if (!bothStrings) {
        aStat = parseFloat(aStat ?? 0);
        bStat = parseFloat(bStat ?? 0);
      }
    }

    let result = aStat - bStat;

    // Fallback sort by FP descending
    if (result === 0) {
      const aFP = statsMap[a.player_id]?.FP ?? 0;
      const bFP = statsMap[b.player_id]?.FP ?? 0;
      result = bFP - aFP;
    }

    return result * sortDirection;
  });

  renderTable(players, statsMap);
}


function fantasyPoints(statsMap, players, type) {
  players.forEach(p => {
    const statObj = statsMap[p.player_id];
    if (!statObj) return;

    const gp = parseFloat(statObj.GP) || 0;
    let fp = 0;

    if (type === "goalie" || p.position.includes('G')) {
      fp = (
        (parseFloat(statObj.GS) || 0) * 1 +
        (parseFloat(statObj.W) || 0) * 3 +
        (parseFloat(statObj.L) || 0) * -1 +
        (parseFloat(statObj.SV) || 0) * .2 +
        (parseFloat(statObj.GA) || 0) * -1 +
        (parseFloat(statObj.SHO) || 0) * 5
      );
    } else {
      fp = (
        (parseFloat(statObj.G) || 0) * 3 +
        (parseFloat(statObj.A) || 0) * 2 +
        (parseFloat(statObj.PIM) || 0) * 0.2 +
        (parseFloat(statObj.SHG) || 0) * 2 +
        (parseFloat(statObj.GWG) || 0) * 0.5 +
        (parseFloat(statObj.SOG) || 0) * .2 +
        (parseFloat(statObj.HIT) || 0) * .1 +
        (parseFloat(statObj.BLK) || 0) * .3
      );
    }

    statObj.FP = parseFloat(fp.toFixed(1));
    statObj.FPG = gp ? (fp / gp).toFixed(2) : "0.00";
  });
}

function loadSeasonStats(seasonKey) {
  const fileMap = {
    "2024_stats": {
      skater: "/fantasy-hockey/data/2024_skater_stats.json",
      goalie: "/fantasy-hockey/data/2024_goalie_stats.json"
    },
    "2025_stats": {
      skater: "/fantasy-hockey/data/2025_skater_stats.json",
      goalie: "/fantasy-hockey/data/2025_goalie_stats.json"
    },
    "2025_projections": {
      skater: "/fantasy-hockey/data/2025_skater_proj.json",
      goalie: "/fantasy-hockey/data/2025_goalie_proj.json"
    }
  };

  const { skater, goalie } = fileMap[seasonKey];

  Promise.all([
    fetch(skater).then(res => res.json()),
    fetch(goalie).then(res => res.json())
  ])
  .then(([skaterStatsRaw, goalieStatsRaw]) => {
    skaterStatsData = skaterStatsRaw.players;
    goalieStatsData = goalieStatsRaw.players;

    skaterStatsMap = buildStatsMap(skaterStatsData, "skater");
    goalieStatsMap = buildStatsMap(goalieStatsData, "goalie");

    fantasyPoints(skaterStatsMap, playersData.players, "skater");
    fantasyPoints(goalieStatsMap, playersData.players, "goalie");

    applyFilters(); // refresh view
  })
  .catch(err => console.error("Failed to load season stats:", err));
}
