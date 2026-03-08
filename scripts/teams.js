const params = new URLSearchParams(window.location.search);
const teamNum = parseInt(params.get('team'), 10);
const teamKey = `465.l.13153.t.${teamNum}`; 
const playerPositions = {}; // player_id (string) -> positions array
const requestedDate = params.get('date');
let allPlayersMeta = {}; // player_id -> metadata from players.json
let currentMode = 'season'; 
const selectedKeepers = new Set();


const tableData = {
  skaters: [],
  goalies: []
};

const dailyState = {
  dates: [],        // sorted list of available dates
  currentIndex: 0,  // which date we’re showing
  log: null         // the loaded JSON
};

const seasonTotals = {}; // player_id -> accumulated stats

const OLYMPIC_FLAGS = {
  "Sweden": "🇸🇪",
  "Czechia": "🇨🇿",
  "Finland": "🇫🇮",
  "USA": "🇺🇸",
  "Canada": "🇨🇦",
  "Russia": "🇷🇺",
  "Slovakia": "🇸🇰",
  "Germany": "🇩🇪",
  "Switzerland": "🇨🇭",
  "Norway": "🇳🇴",
  "Latvia": "🇱🇻",
  "Austria": "🇦🇹"
};

let currentSortKey = null;
let sortDirection = -1;

document.addEventListener('DOMContentLoaded', () => {
  bindSortEvents('team-table', 'skaters');
  bindSortEvents('goalie-table', 'goalies');

  const seasonSelect = document.getElementById('season-select');
  const salaryTab = document.getElementById('tab-salary-mgmt');
  const prevBtn = document.getElementById('daily-prev');
  const nextBtn = document.getElementById('daily-next');

  if (prevBtn) prevBtn.addEventListener('click', prevDay);
  if (nextBtn) nextBtn.addEventListener('click', nextDay);

  // 1. Tab Click Handler
  salaryTab.addEventListener('click', () => {
    salaryTab.style.background = "#007bff";
    salaryTab.style.color = "white";
    
    showSalaryMgmtMode();
    loadSeasonStats('2026_stats'); 
  });

  // 2. Handle dropdown changes
  seasonSelect.addEventListener('change', () => {
    const val = seasonSelect.value;
    currentSortKey = null;
    sortDirection = -1;
    
    // Reset Salary Tab visual state when switching to standard seasons
    salaryTab.style.background = "#f0f0f0";
    salaryTab.style.color = "black";

    if (val === 'daily') {
      showDailyMode();
      loadDailyStats();
    } else {
      showSeasonMode();
      loadSeasonStats(val);
    }
  }); // Correctly closing the dropdown listener

  // 3. Initial Data Load
  fetch('../data/players.json')
    .then(r => r.json())
    .then(data => {
      data.players.forEach(p => {
        allPlayersMeta[String(p.player_id)] = p;
      });

      if (requestedDate) {
        seasonSelect.value = 'daily';
        showDailyMode();
        loadDailyStats();
      } else {
        showSeasonMode();
        loadSeasonStats(seasonSelect.value);
      }
    });
});

function showDailyMode() {
  const seasonSkaters = document.getElementById('season-skaters-wrapper');
  const seasonGoalies = document.getElementById('season-goalies-wrapper');
  const dailySkaters = document.getElementById('daily-skaters-wrapper');
  const dailyGoalies = document.getElementById('daily-goalies-wrapper');
  const dailyControls = document.getElementById('daily-controls');

  if (seasonSkaters) seasonSkaters.style.display = 'none';
  if (seasonGoalies) seasonGoalies.style.display = 'none';
  if (dailySkaters) dailySkaters.style.display = 'block';
  if (dailyGoalies) dailyGoalies.style.display = 'block';
  if (dailyControls) dailyControls.style.display = 'block';
}

function showSalaryMgmtMode() {
  currentMode = 'salary_mgmt';
  document.getElementById('daily-controls').style.display = 'none';
  document.getElementById('daily-skaters-wrapper').style.display = 'none';
  document.getElementById('daily-goalies-wrapper').style.display = 'none';
  
  document.getElementById('salary-mgmt-controls').style.display = 'block';
  document.getElementById('season-skaters-wrapper').style.display = 'block';
  document.getElementById('season-goalies-wrapper').style.display = 'block';
}

function showSeasonMode() {
  currentMode = 'season';
  document.getElementById('salary-mgmt-controls').style.display = 'none';
  document.getElementById('daily-controls').style.display = 'none';
  document.getElementById('daily-skaters-wrapper').style.display = 'none';
  document.getElementById('daily-goalies-wrapper').style.display = 'none';
  
  document.getElementById('season-skaters-wrapper').style.display = 'block';
  document.getElementById('season-goalies-wrapper').style.display = 'block';
}

function loadSeasonStats(seasonKey) {
  // Only change the mode if we AREN'T already in salary_mgmt
  if (currentMode !== 'salary_mgmt') {
    currentMode = (seasonKey === '2026_team_log') ? 'team_log' : 'season';
  }
  
  let skaterFile = '';
  let goalieFile = '';
  currentSortKey = null;
  sortDirection = -1;

  switch (seasonKey) {
    case '2026_stats':
      skaterFile = '../data/2026_skater_stats.json';
      goalieFile = '../data/2026_goalie_stats.json';
      break;
    case '2025_stats':
      skaterFile = '../data/2025_skater_stats.json';
      goalieFile = '../data/2025_goalie_stats.json';
      break;
    case '2025_projections':
      skaterFile = '../data/2025_skater_proj.json';
      goalieFile = '../data/2025_goalie_proj.json';
      break;
    case '2026_team_log':
      loadTeamLogSeason();
      return;
    default:
      console.error(`Unknown season key: ${seasonKey}`);
      return;
  }

  Promise.all([
    fetch('../data/league_teams.json').then(res => res.json()),
    fetch('../data/2025_standings.json').then(res => res.json()),
    fetch(skaterFile).then(res => res.json()),
    fetch(goalieFile).then(res => res.json())
  ])
    .then(([teams, standings, skaterStats, goalieStats]) => {
      const skaterMap = buildStatMap(skaterStats.players);
      const goalieMap = buildStatMap(goalieStats.players);
      renderTeamPage(teams, standings, skaterMap, goalieMap);
    })
    .catch(err => console.error('Error loading season stats:', err));
}

function buildStatMap(players) {
  const map = {};
  players.forEach(p => {
    const id = p.player_key.split('.').pop(); // extract player_id
    const statMap = {};
    p.stats.forEach(s => {
      const statId = s.stat_id ?? s._extracted_data?.stat_id;
      let value = s._extracted_data?.value ?? s.value;

      if (
        value === '-' ||
        value === '–' ||
        value === '' ||
        value === undefined ||
        value === null ||
        Number.isNaN(value)
      ) {
        value = statId === 34 ? '00:00' : 0;
      }

      statMap[statId] = statId === 34 ? value : Number(value);
    });
    map[id] = { ...p, statMap };
  });

  return map;
}

function renderTeamPage(teams, standings, skaterMap, goalieMap) {
  const teamData = teams.find(t => t.team_info.team_key === teamKey);
  if (!teamData) return;

  const roster = teamData.roster;
  const standingsInfo = standings.teams.find(s => s.team_key === teamKey);

  // Build roster metadata map
  window.teamRosterMeta = {};
  roster.forEach(player => {
    const id = player.player_key.split('.').pop(); // <-- THIS WAS MISSING
    playerPositions[id] = player.positions || [];

    window.teamRosterMeta[id] = {
      primary_position: player.primary_position,
      positions: player.positions,
      selected_position: player.selected_position,
      cost: player.cost ?? '-',
      contract_year: player.contract_year,
      team_abbr: player.team_abbr,
      olympics: player.olympics
    };
  });
  
  const totalCost = roster.reduce((sum, player) => {
    const cost = parseFloat(player.cost ?? 0);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);
  const fCost = totalCost + roster.length * 3;

  document.title = `${teamData.team_info.name} Roster`;

  const teamHeader = document.getElementById('team-header');
  if (teamHeader) {
    teamHeader.innerHTML = `
      <div class="team-profile">
        <img class="team-menu_logo-img" src="${teamData.team_info.logo_url}" alt="${teamData.team_info.name} logo">
        <div class="team-details">
          <h2 class="team-name">${teamData.team_info.name}</h2>
          <p class="team-manager">Managed by ${teamData.team_info.manager}</p>
          <p class="team-meta">
            <strong>Rank:</strong> ${standingsInfo?.rank ?? 'N/A'} |
            <strong>Record:</strong> ${standingsInfo?.wins ?? '-'}-${standingsInfo?.losses ?? '-'} |
            <strong>Points For:</strong> ${standingsInfo?.["points for"]?.toFixed(1) ?? 'N/A'}
            <br>
            <strong>Salary:</strong> $${totalCost}
            <strong>Future Salary:</strong> $${fCost}
          </p>
        </div>
        ${standingsInfo?.currentChampion ? `
          <div class="champion-badge">
            <img src="../images/champion_2025.png" alt="League Champion" />
          </div>
        ` : ''}
        ${standingsInfo?.presidentTrophy ? `
          <div class="trophy-badge">
            <img src="../images/presidentstrophy_2025.png" alt="Presidents' Trophy Winner" />
          </div>
        ` : ''}
      </div>
    `;
  }

  const skaters = [];
  const goalies = [];

  roster.forEach(player => {
    const playerId = player.player_key.split('.').pop();
    const source = player.primary_position === 'G' ? goalieMap[playerId] : skaterMap[playerId];
    const statMap = source?.statMap ?? {};

    const FP = player.primary_position === 'G'
      ? calculateGoalieFP(statMap)
      : calculateSkaterFP(statMap);

    const GP = statMap[0] ?? 0;
    const FPG = GP > 0 ? FP / GP : 0.0;

    const enriched = {
      ...player,
      FP,
      FPG,
      GP,
      G: statMap[1] ?? 0,
      A: statMap[2] ?? 0,
      PTS: statMap[3] ?? 0,
      PIM: statMap[5] ?? 0,
      SOG: statMap[14] ?? 0,
      SPCT: `${((statMap[15] ?? 0) * 100).toFixed(1)}`,
      SHG: statMap[9] ?? 0,
      GWG: statMap[12] ?? 0,
      BLK: statMap[32] ?? 0,
      HIT: statMap[31] ?? 0,
      ATOI: statMap[34] ?? '00:00',
      W: statMap[19] ?? 0,
      L: statMap[20] ?? 0,
      GA: statMap[22] ?? 0,
      SV: statMap[25] ?? 0,
      GAA: statMap[23] ?? 0,
      SVP: statMap[26] ?? 0,
      SO: statMap[27] ?? 0,
      MIN: statMap[25] ?? 0
    };

    if (player.primary_position === 'G') {
      goalies.push(enriched);
    } else {
      skaters.push(enriched);
    }
  });

  tableData.skaters = skaters;
  tableData.goalies = goalies;

  renderSkaterTable(tableData.skaters);
  renderGoalieTable(tableData.goalies);
}

function atoiToSeconds(atoi) {
  if (!atoi || typeof atoi !== 'string') return 0;
  const [min, sec] = atoi.split(':').map(Number);
  return (min ?? 0) * 60 + (sec ?? 0);
}

function renderSkaterTable(players) {
  const tbody = document.getElementById('team-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  players.forEach(p => {
      const row = document.createElement('tr');
      const isExpired = p.contract_year >= 3; // Ensure this is defined FIRST
      
      let checkboxHtml = '';
      if (currentMode === 'salary_mgmt') {
          const isChecked = selectedKeepers.has(String(p.player_id)) ? 'checked' : '';
          const disabledAttr = isExpired ? 'disabled' : '';
          // Add data-pos attribute here
          checkboxHtml = `<input type="checkbox" class="keeper-checkbox" 
              data-id="${p.player_id}" 
              data-cost="${p.cost}" 
              data-pos="${p.primary_position}" 
              ${isChecked} ${disabledAttr}> `;
      }
      
      if (isExpired && currentMode === 'salary_mgmt') {
          row.classList.add('contract-expired');
      }

    row.innerHTML = `
      <td>
        ${checkboxHtml}${p.player_name}
        ${p.olympics ? ` <span class="flag-emoji">${OLYMPIC_FLAGS[p.olympics] ?? ''}</span>` : ''}
      </td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td class="${p.contract_year >= 3 ? 'contract-red' : ''}">${p.contract_year ?? '-'}</td>
      <td>${p.FP.toFixed(1)}</td>
      <td>${p.FPG.toFixed(2)}</td>
      <td>${p.GP}</td>
      <td>${p.G}</td>
      <td>${p.A}</td>
      <td>${p.PTS}</td>
      <td>${p.PIM}</td>
      <td>${p.SOG}</td>
      <td>${p.SPCT}%</td>
      <td>${p.SHG}</td>
      <td>${p.GWG}</td>
      <td>${p.BLK}</td>
      <td>${p.HIT}</td>
      <td>${p.ATOI}</td>
    `;
    tbody.appendChild(row);
  });

  if (currentMode === 'salary_mgmt') initSalaryMgmt();
}

function renderGoalieTable(players) {
  const tbody = document.getElementById('goalie-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  players.forEach(p => {
    const row = document.createElement('tr');
    const isExpired = p.contract_year >= 3; // Ensure this is defined FIRST
    
    let checkboxHtml = '';
    if (currentMode === 'salary_mgmt') {
        const isChecked = selectedKeepers.has(String(p.player_id)) ? 'checked' : '';
        const disabledAttr = isExpired ? 'disabled' : '';
        // Add data-pos attribute here
        checkboxHtml = `<input type="checkbox" class="keeper-checkbox" 
            data-id="${p.player_id}" 
            data-cost="${p.cost}" 
            data-pos="${p.primary_position}" 
            ${isChecked} ${disabledAttr}> `;
    }
    
    if (isExpired && currentMode === 'salary_mgmt') {
        row.classList.add('contract-expired');
    }

    row.innerHTML = `
      <td>
        ${checkboxHtml}${p.player_name}
        ${p.olympics ? ` <span class="flag-emoji">${OLYMPIC_FLAGS[p.olympics] ?? ''}</span>` : ''}
      </td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td class="${p.contract_year === 3 ? 'contract-red' : ''}">${p.contract_year ?? '-'}</td>
      <td>${p.FP.toFixed(1)}</td>
      <td>${p.FPG.toFixed(2)}</td>
      <td>${p.GP}</td>
      <td>${p.W}</td>
      <td>${p.L}</td>
      <td>${p.GA}</td>
      <td>${p.SV}</td>
      <td>${p.GAA.toFixed(2)}</td>
      <td>${p.SVP.toFixed(3)}</td>
      <td>${p.SO}</td>
      <td>${p.MIN}</td>
    `;
    tbody.appendChild(row);
  });
  
  if (currentMode === 'salary_mgmt') initSalaryMgmt();
}

function bindSortEvents(tableId, dataKey) {
  if (tableId.startsWith('daily-')) return;

  document.querySelectorAll(`#${tableId} th[data-sort]`).forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.getAttribute('data-sort');
      const players = tableData[dataKey];

      if (!sortKey || sortKey === 'rank') return;
      if (!Array.isArray(players)) {
        console.error("Sort error: players array missing for", dataKey);
        return;
      }

      if (currentSortKey === sortKey) {
        sortDirection *= -1;
      } else {
        currentSortKey = sortKey;
        sortDirection = -1;
      }

      const sorted = [...players].sort((a, b) => {
        let aStat, bStat;

        if (sortKey === 'ATOI') {
          aStat = atoiToSeconds(a.ATOI);
          bStat = atoiToSeconds(b.ATOI);
        } else if (sortKey === 'cost') {
          aStat = Number(a.cost ?? 0);
          bStat = Number(b.cost ?? 0);
        } else {
          aStat = a[sortKey];
          bStat = b[sortKey];
        }

        let result;
        if (typeof aStat === 'string') {
          result = aStat.localeCompare(bStat);
        } else {
          result = (aStat ?? 0) - (bStat ?? 0);
        }

        if (result === 0) {
          result = (a.FP ?? 0) - (b.FP ?? 0);
        }

        if (result === 0) {
          result = a.player_name.localeCompare(b.player_name);
        }

        return result * sortDirection;
      });

      if (tableId === 'team-table') {
        renderSkaterTable(sorted);
      } else if (tableId === 'goalie-table') {
        renderGoalieTable(sorted);
      } else if (tableId === 'daily-skaters-table') {
        renderDailySkaters(sorted);
      } else if (tableId === 'daily-goalies-table') {
        renderDailyGoalies(sorted);
      }

      tableData[dataKey] = sorted;
    });
  });
}

function calculateSkaterFP(stats) {
  return (
    (stats[1] ?? 0) * 3 +
    (stats[2] ?? 0) * 2 +
    (stats[5] ?? 0) * 0.2 +
    (stats[14] ?? 0) * 0.2 +
    (stats[31] ?? 0) * 0.1 +
    (stats[32] ?? 0) * 0.3 +
    (stats[12] ?? 0) * 0.5 +
    (stats[9] ?? 0) * 2
  );
}

function calculateGoalieFP(stats) {
  return (
    (stats[18] ?? 0) +
    (stats[19] ?? 0) * 3 +
    (stats[20] ?? 0) * -1 +
    (stats[27] ?? 0) * 5 +
    (stats[25] ?? 0) * 0.2 +
    (stats[22] ?? 0) * -1
  );
}

// DAILY STATS

async function loadDailyStats() {
  currentMode = 'daily';
  try {
    const url = `../data/team_logs/team_${teamNum}_log.json`;
    const log = await fetch(url).then(r => r.json());
    dailyState.log = log;

    dailyState.dates = Object.keys(log.log).sort();

    // If user requested a specific date, use it
    if (requestedDate && dailyState.dates.includes(requestedDate)) {
      dailyState.currentIndex = dailyState.dates.indexOf(requestedDate);
    } else {
      // Otherwise default to today or latest available
      const today = new Date().toISOString().slice(0, 10);
      const idx = dailyState.dates.indexOf(today);
      dailyState.currentIndex = idx >= 0 ? idx : dailyState.dates.length - 1;
    }


    renderDailyForCurrentDate();
  } catch (e) {
    console.error('Error loading daily stats:', e);
  }
}

function renderDailyForCurrentDate() {
  if (!dailyState.log || dailyState.dates.length === 0) return;

  const date = dailyState.dates[dailyState.currentIndex];

  // Update the URL
  updateDailyURL(date);
  const dayEntry = dailyState.log.log[date];
  
  if (!dayEntry) return;

  const players = dayEntry.players || [];
  const skaters = [];
  const goalies = [];

  players.forEach(p => {
    const stats = p.stats || {};
    const id = String(p.player_id);
    const positions = playerPositions[id] || [];
    const isGoalie = positions.includes('G');

    if (isGoalie) {
      goalies.push({
        ...p,
        FP: calcDailyGoalieFP(stats),
        GS: stats[18],
        W:  stats[19],
        L:  stats[20],
        GA: stats[22],
        SV: stats[25],
        SVP: calcSVP(stats),
        SHO: stats[27]
      });
    } else {
      skaters.push({
        ...p,
        FP: calcDailySkaterFP(stats),
        G:  stats[1],
        A:  stats[2],
        PIM: stats[5],
        SHG: stats[9],
        GWG: stats[12],
        SOG: stats[14],
        HIT: stats[31],
        BLK: stats[32]
      });
    }
    const summary = computeDailySummary(skaters, goalies);

    const summaryDiv = document.getElementById('daily-summary');
    summaryDiv.style.display = 'block';

    summaryDiv.innerHTML = `
      <div>Skater Points: ${summary.skaterFP.toFixed(1)}</div>
      <div>Goalie Points: ${summary.goalieFP.toFixed(1)}</div>
      <div>Total Points: ${(summary.skaterFP + summary.goalieFP).toFixed(1)}</div>
      <br>
      <div>Bench Skater Points: ${summary.benchSkaterFP.toFixed(1)}</div>
      <div>Bench Goalie Points: ${summary.benchGoalieFP.toFixed(1)}</div>
      <div>Total Bench Points: ${(summary.benchSkaterFP + summary.benchGoalieFP).toFixed(1)}</div>
    `;

  });

  const dateDisplay = document.getElementById('daily-date-display');
  if (dateDisplay) dateDisplay.textContent = date;

  renderDailyTables(skaters, goalies);
}

function calcDailySkaterFP(s) {
  // Check if any stat has a non-null, non-undefined value
  const hasStats = [1,2,5,14,31,32,12,9].some(id => s[id] !== undefined && s[id] !== null);
  if (!hasStats) return "-";

  return (
    (s[1] ?? 0) * 3 +
    (s[2] ?? 0) * 2 +
    (s[5] ?? 0) * 0.2 +
    (s[14] ?? 0) * 0.2 +
    (s[31] ?? 0) * 0.1 +
    (s[32] ?? 0) * 0.3 +
    (s[12] ?? 0) * 0.5 +
    (s[9] ?? 0) * 2
  );
}

function calcDailyGoalieFP(s) {
  const hasStats = [18,19,20,27,25,22].some(id => s[id] !== undefined && s[id] !== null);
  if (!hasStats) return "-";

  return (
    (s[18] ?? 0) +
    (s[19] ?? 0) * 3 +
    (s[20] ?? 0) * -1 +
    (s[27] ?? 0) * 5 +
    (s[25] ?? 0) * 0.2 +
    (s[22] ?? 0) * -1
  );
}

function calcSVP(s) {
  const sv = s[25];
  const ga = s[22];
  if (sv === undefined && ga === undefined) return "-";

  const shots = (sv ?? 0) + (ga ?? 0);
  return shots > 0 ? (sv / shots).toFixed(3) : "-";
}


function nextDay() {
  if (dailyState.currentIndex < dailyState.dates.length - 1) {
    dailyState.currentIndex++;
    renderDailyForCurrentDate();
  }
}

function prevDay() {
  if (dailyState.currentIndex > 0) {
    dailyState.currentIndex--;
    renderDailyForCurrentDate();
  }
}

function renderDailyTables(skaters, goalies) {
  renderDailySkaters(skaters);
  renderDailyGoalies(goalies);
}

function renderDailySkaters(players) {
  const tbody = document.getElementById('daily-skaters-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  players.forEach(p => {
    const fpDisplay =
      typeof p.FP === 'number' ? p.FP.toFixed(1) : (p.FP ?? '-');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.player_name}</td>
      <td>${p.position_status}</td>
      <td>${fpDisplay}</td>
      <td>${p.G ?? '-'}</td>
      <td>${p.A ?? '-'}</td>
      <td>${p.PIM ?? '-'}</td>
      <td>${p.SHG ?? '-'}</td>
      <td>${p.GWG ?? '-'}</td>
      <td>${p.SOG ?? '-'}</td>
      <td>${p.HIT ?? '-'}</td>
      <td>${p.BLK ?? '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderDailyGoalies(players) {
  const tbody = document.getElementById('daily-goalies-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  players.forEach(p => {
    const fpDisplay =
      typeof p.FP === 'number' ? p.FP.toFixed(1) : (p.FP ?? '-');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.player_name}</td>
      <td>${p.position_status}</td>
      <td>${fpDisplay}</td>
      <td>${p.GS ?? '-'}</td>
      <td>${p.W ?? '-'}</td>
      <td>${p.L ?? '-'}</td>
      <td>${p.GA ?? '-'}</td>
      <td>${p.SV ?? '-'}</td>
      <td>${p.SVP ?? '-'}</td>
      <td>${p.SHO ?? '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateDailyURL(date) {
  const newUrl = `${window.location.pathname}?team=${teamNum}&date=${date}`;
  history.replaceState(null, '', newUrl);
}

function computeDailySummary(skaters, goalies) {
  const isBench = pos => pos === 'BN' || pos === 'IR' || pos === 'IR+';

  const sumFP = arr =>
    arr.reduce((sum, p) => sum + (typeof p.FP === 'number' ? p.FP : 0), 0);

  const startersSkaters = skaters.filter(p => !isBench(p.position_status));
  const startersGoalies = goalies.filter(p => !isBench(p.position_status));

  const benchSkaters = skaters.filter(p => isBench(p.position_status));
  const benchGoalies = goalies.filter(p => isBench(p.position_status));

  return {
    skaterFP: sumFP(startersSkaters),
    goalieFP: sumFP(startersGoalies),
    benchSkaterFP: sumFP(benchSkaters),
    benchGoalieFP: sumFP(benchGoalies)
  };
}

async function loadTeamLogSeason() {
  const url = `../data/team_logs/team_${teamNum}_log.json`;
  const log = await fetch(url).then(r => r.json());

  const seasonTotals = {}; // player_id -> accumulated stats

  // Loop through each date in the log
  for (const date of Object.keys(log.log)) {
    const players = log.log[date].players;

    players.forEach(p => {
      const id = String(p.player_id);
      const stats = p.stats || {};

      if (!seasonTotals[id]) {
        seasonTotals[id] = {
          ...p,
          stats: {} // accumulate raw stat IDs
        };
      }

      // Accumulate stats
      for (const statId in stats) {
        const val = stats[statId];
        seasonTotals[id].stats[statId] =
          (seasonTotals[id].stats[statId] ?? 0) + val;
      }
      // Count games played: any non-empty stats object counts as a game
      if (Object.keys(stats).length > 0) {
        seasonTotals[id].gamesPlayed = (seasonTotals[id].gamesPlayed ?? 0) + 1;
      }

    });
  }

  // Convert accumulated stats into enriched objects
  const skaters = [];
  const goalies = [];

  Object.values(seasonTotals).forEach(p => {
    const stats = p.stats;
    const id = String(p.player_id);
    const positions = playerPositions[id] || allPlayersMeta[id]?.eligible_positions || [];
    const isGoalie = positions.includes('G');


    if (isGoalie) {
      goalies.push(enrichGoalieFromLog(p, stats));
    } else {
      skaters.push(enrichSkaterFromLog(p, stats));
    }
  });

  tableData.skaters = skaters;
  tableData.goalies = goalies;

  renderSkaterTable(skaters);
  renderGoalieTable(goalies);
}

function enrichSkaterFromLog(p, stats) {
  const id = String(p.player_id);
  const meta = window.teamRosterMeta[id] || allPlayersMeta[id] || {};

  const GP = p.gamesPlayed ?? 0;
  const FP = calculateSkaterFP(stats);
  const FPG = GP > 0 ? FP / GP : 0;
  const goals = stats[1] ?? 0;
  const shots = stats[14] ?? 0;
  const SPCT = shots > 0 ? ((goals / shots) * 100).toFixed(1) : '0.0';

  return {
    ...p,
    ...meta,
    FP,
    FPG,
    GP,
    G: stats[1] ?? 0,
    A: stats[2] ?? 0,
    PTS: (stats[1] ?? 0) + (stats[2] ?? 0),
    PIM: stats[5] ?? 0,
    SOG: stats[14] ?? 0,
    SPCT: SPCT, //
    SHG: stats[9] ?? 0,
    GWG: stats[12] ?? 0,
    BLK: stats[32] ?? 0,
    HIT: stats[31] ?? 0,
    ATOI: stats[34] ?? '00:00'
  };
}

function enrichGoalieFromLog(p, stats) {
  const id = String(p.player_id);
  const meta = window.teamRosterMeta[id] || allPlayersMeta[id] || {};

  const GP = p.gamesPlayed ?? 0;
  const FP = calculateGoalieFP(stats);
  const FPG = GP > 0 ? FP / GP : 0;

  const goalsAgainst = stats[22] ?? 0;   // GA
  const saves = stats[25] ?? 0;          // SV
  const minutes = stats[28] ?? 0;        // MIN (correct stat_id)
  const shotsAgainst = saves + goalsAgainst;

  // Save percentage (numeric)
  const SVP =
    shotsAgainst > 0
      ? saves / shotsAgainst
      : 0;

  // Goals Against Average (numeric)
  const GAA =
    minutes > 0
      ? (goalsAgainst * 60) / minutes
      : 0;

  return {
    ...p,
    ...meta,
    FP,
    FPG,
    GP,
    W: stats[19] ?? 0,
    L: stats[20] ?? 0,
    GA: goalsAgainst,
    SV: saves,
    GAA,   // numeric
    SVP,   // numeric
    SO: stats[27] ?? 0,
    MIN: minutes
  };
}

function initSalaryMgmt() {
  const checkboxes = document.querySelectorAll('.keeper-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      // Save state so sorting doesn't wipe selections
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) selectedKeepers.add(id);
      else selectedKeepers.delete(id);
      
      calculateSalaryTotals();
    });
  });
  calculateSalaryTotals();
}

function calculateSalaryTotals() {
  const checkboxes = document.querySelectorAll('.keeper-checkbox:checked');
  let count = checkboxes.length;
  let totalSalary = 0;

  // Initialize position counters
  const counts = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };

  checkboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    const currentCost = parseFloat(cb.getAttribute('data-cost')) || 0;
    const pos = cb.getAttribute('data-pos');
    
    // Add to salary total
    totalSalary += (currentCost + 3);

    // Increment the count if the position exists in our object
    if (pos && counts.hasOwnProperty(pos)) {
      counts[pos]++;
    }
  });

  const capSpace = 200 - totalSalary;
  const emptySlots = 19 - count;
  const statusEl = document.getElementById('roster-status');
  
  const isLegal = count <= 19 && totalSalary <= 200 && capSpace >= emptySlots;

  // Update Main UI
  document.getElementById('keep-count').textContent = count;
  document.getElementById('keep-salary').textContent = totalSalary;
  document.getElementById('cap-space').textContent = capSpace;

  // Update Position UI
  document.getElementById('pos-C').textContent = counts.C;
  document.getElementById('pos-LW').textContent = counts.LW;
  document.getElementById('pos-RW').textContent = counts.RW;
  document.getElementById('pos-D').textContent = counts.D;
  document.getElementById('pos-G').textContent = counts.G;

  // Set Status Visuals
  if (isLegal) {
    statusEl.textContent = "VALID ROSTER";
    statusEl.style.backgroundColor = "#d4edda";
    statusEl.style.color = "#155724";
  } else {
    statusEl.textContent = "ILLEGAL ROSTER";
    statusEl.style.backgroundColor = "#f8d7da";
    statusEl.style.color = "#721c24";
  }
}
