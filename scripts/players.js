let playersData, teamsData, goalieStatsData;
let skaterStatsLoaded = false;
let skaterStatsData = null;
let goalieStatsLoaded = false;
let statsMap = {};
let allPlayers = [];
let teamMap = {};
let players = [];
let positionSelect, nameInput, gpInput;
let currentSortKey = null;
let sortDirection = -1;

document.addEventListener('DOMContentLoaded', () => {
  positionSelect = document.getElementById('position-filter');
  nameInput = document.getElementById('name-filter');
  gpInput = document.getElementById('gp-filter');

  positionSelect.addEventListener('change', applyFilters);
  nameInput.addEventListener('input', applyFilters);
  gpInput.addEventListener('input', applyFilters);

  Promise.all([
    fetch('/fantasy-hockey/data/players.json').then(res => res.json()),
    fetch('/fantasy-hockey/teams/nhl_teams.json').then(res => res.json()),
    fetch('/fantasy-hockey/data/2024_skater_stats.json').then(res => res.json()),
    fetch('/fantasy-hockey/data/2024_goalie_stats.json').then(res => res.json())
  ])
  .then(([players, teams, skaterStatsRaw, goalieStatsRaw]) => {
    playersData = players;
    teamsData = teams;

    skaterStatsData = skaterStatsRaw.players;
    goalieStatsData = goalieStatsRaw.players;

    skaterStatsMap = buildStatsMap(skaterStatsData, "skater");
    goalieStatsMap = buildStatsMap(goalieStatsData, "goalie");

    fantasyPoints(skaterStatsMap, playersData.players, "skater");
    fantasyPoints(goalieStatsMap, playersData.players, "goalie");

    init(playersData, teamsData); // just sets up allPlayers and teamMap
    applyFilters(); // now safe to run
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
  const minGP = parseInt(gpInput.value, 10) || 0;

  statsMap = positionQuery === 'G' ? goalieStatsMap : skaterStatsMap;

  const filtered = allPlayers.filter(p => {
    if (!p.position || typeof p.position !== 'string') return false;

    const stats = statsMap[p.player_id];

    if (!stats) return false;

    const gp = parseFloat(stats.GP) || 0;
    const matchesName = p.full_name.toLowerCase().includes(nameQuery);
    const matchesPosition =
      positionQuery === '' || p.position.replace(/\s+/g, '').split(',').includes(positionQuery);
    return matchesName && matchesPosition && gp >= minGP;
  });

  filtered.sort((a, b) => {
    const aKey = `453.p.${a.player_id}`;
    const bKey = `453.p.${b.player_id}`;
    const aFP = statsMap[aKey]?.FP ?? 0;
    const bFP = statsMap[bKey]?.FP ?? 0;
    return bFP - aFP;
  });

  players = filtered;
  renderTableHeader();
  bindHeaderSortEvents();
  renderTable(filtered, statsMap); // ✅ pass correct map
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
    //const statMap = key.startsWith('453.p.') ? skaterStatIdMap : goalieStatIdMap;
      const statMap = type === "goalie" ? goalieStatIdMap : skaterStatIdMap;

    stat.stats.forEach(s => {
      const statId = s._extracted_data?.stat_id ?? s.stat_id;
      const statKey = statMap[statId];
      let value = s._extracted_data?.value ?? s.value;

      if (value === '-' || value === '–' || value === undefined || value === null) value = 0;
      if (statKey) statObj[statKey] = parseFloat(value);
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
    const owner = player.player_owner || 'Free Agent';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td class="player-cell">
        <img src="${logo}" alt="${player.team_abbr} logo" />
        <a href="${player.url}" target="_blank">${player.full_name}</a>
        <span class="team-abbr">${player.team_abbr}</span>
      </td>
      <td>${player.position}</td>
      <td>${owner}</td>
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
    const aStat = statsMap[a.player_id]?.[key] ?? '';
    const bStat = statsMap[b.player_id]?.[key] ?? '';

    if (key === 'ATOI') {
      return (atoiToSeconds(aStat) - atoiToSeconds(bStat)) * sortDirection;
    }

    if (typeof aStat === 'string') {
      return aStat.localeCompare(bStat) * sortDirection;
    }

    return (aStat - bStat) * sortDirection;
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
        (parseFloat(statObj.PIM) || 0) * 0.5 +
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
