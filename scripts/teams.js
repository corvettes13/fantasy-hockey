const params = new URLSearchParams(window.location.search);
const teamNum = parseInt(params.get('team'), 10);
const teamKey = `465.l.13153.t.${teamNum}`; // Match Yahoo format
  
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

document.addEventListener('DOMContentLoaded', () => {
  const seasonSelect = document.getElementById('season-select');
  if (!seasonSelect) return;

  loadSeasonStats(seasonSelect.value);

  seasonSelect.addEventListener('change', () => {
    loadSeasonStats(seasonSelect.value);
  });
});

let currentSortKey = null;
let sortDirection = -1;

function loadSeasonStats(seasonKey) {
  let skaterFile = '';
  let goalieFile = '';

  switch (seasonKey) {
    case '2025_stats':
      skaterFile = '../data/2025_skater_stats.json';
      goalieFile = '../data/2025_goalie_stats.json';
      break;
    case '2024_stats':
      skaterFile = '../data/2024_skater_stats.json';
      goalieFile = '../data/2024_goalie_stats.json';
      break;
    case '2025_projections':
      skaterFile = '../data/2025_skater_proj.json';
      goalieFile = '../data/2025_goalie_proj.json';
      break;
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

      if (value === '-' || value === '–' || value === undefined || value === null) {
        value = statId === 34 ? '00:00' : 0;
      }
      statMap[statId] = statId === 34 ? value : parseFloat(value);
    });
    map[id] = { ...p, statMap };
  });
  return map;
}


function renderTeamPage(teams, standings, skaterMap, goalieMap) {
  const teamData = teams.find(t => t.team_info.team_key === teamKey);
  const standingsInfo = standings.teams.find(s => s.team_key === teamKey);


  if (!teamData) {
    console.error("Team not found for key:", teamKey);
    document.querySelector('.page-content').innerHTML =
      `<h2>Team not found.</h2>`;
    return;
  }

  if (!standingsInfo) {
    console.warn("Standings not found for key:", teamKey);
  }

  const teamInfo = teamData.team_info;
  const roster = teamData.roster;
  
  // Calculate total team cost
  const totalCost = roster.reduce((sum, player) => {
    const cost = parseFloat(player.cost ?? 0);
    console.log(player.player_name, player.cost);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);
  const fCost = totalCost + roster.length * 3;

  document.title = `${teamInfo.name} Roster`;

  const teamHeader = document.getElementById('team-header');
  teamHeader.innerHTML = `
    <div class="team-profile">
      <img class="team-menu_logo-img" src="${teamInfo.logo_url}" alt="${teamInfo.name} logo">
      <div class="team-details">
        <h2 class="team-name">${teamInfo.name}</h2>
        <p class="team-manager">Managed by ${teamInfo.manager}</p>
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

  const skaters = [];
  const goalies = [];
  const skaterStatsMap = {};
  const goalieStatsMap = {};

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
      goalieStatsMap[player.player_id] = enriched;
    } else {
      skaters.push(enriched);
      skaterStatsMap[player.player_id] = enriched;
    }
  });

  renderSkaterTable(skaters);
  renderGoalieTable(goalies);
  bindSortEvents('team-table', skaters, skaterStatsMap);
  bindSortEvents('goalie-table', goalies, goalieStatsMap);
}

function atoiToSeconds(atoi) {
  if (!atoi || typeof atoi !== 'string') return 0;
  const [min, sec] = atoi.split(':').map(Number);
  return (min ?? 0) * 60 + (sec ?? 0);
}

function renderSkaterTable(players) {
  const tbody = document.getElementById('team-body');
  tbody.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        ${p.player_name}
        ${p.olympics ? ` <span class="flag-emoji">${OLYMPIC_FLAGS[p.olympics] ?? ''}</span>` : ''}
      </td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td class="${p.contract_year === 3 ? 'contract-red' : ''}">${p.contract_year}</td>
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
}

function renderGoalieTable(players) {
  const tbody = document.getElementById('goalie-body');
  tbody.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        ${p.player_name}
        ${p.olympics ? ` <span class="flag-emoji">${OLYMPIC_FLAGS[p.olympics] ?? ''}</span>` : ''}
      </td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td class="${p.contract_year === 3 ? 'contract-red' : ''}">${p.contract_year}</td>
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
}

function bindSortEvents(tableId, players, statsMap) {
  document.querySelectorAll(`#${tableId} th[data-sort]`).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (!key || key === 'rank') return;

      if (currentSortKey === key) {
        sortDirection *= -1;
      } else {
        currentSortKey = key;
        sortDirection = -1;
      }

      const sorted = [...players].sort((a, b) => {
        let aStat, bStat;

        if (key === 'ATOI') {
          aStat = atoiToSeconds(a.ATOI);
          bStat = atoiToSeconds(b.ATOI);
        } else if (key === 'cost') {
          aStat = parseFloat(a.cost ?? 0);
          bStat = parseFloat(b.cost ?? 0);
        } else {
          aStat = a[key];
          bStat = b[key];
        }

        let result;
        if (typeof aStat === 'string') {
          result = aStat.localeCompare(bStat);
        } else {
          result = (aStat ?? 0) - (bStat ?? 0);
        }

        // Secondary sort by FP descending
        if (result === 0) {
          const aFP = a.FP ?? 0;
          const bFP = b.FP ?? 0;
          result = aFP - bFP;
        }

        return result * sortDirection;
      });

      if (tableId === 'team-table') {
        renderSkaterTable(sorted);
      } else {
        renderGoalieTable(sorted);
      }
    });
  });
}

function getPlayerId(playerKey) {
  return playerKey.split('.').pop(); // "6743"
}

function calculateSkaterFP(stats) {
  return (
    (stats[1] ?? 0) * 3 +     // Goals
    (stats[2] ?? 0) * 2 +     // Assists
    (stats[5] ?? 0) * 0.2 +   // PIM
    (stats[14] ?? 0) * 0.2 +  // SOG
    (stats[31] ?? 0) * 0.1 +  // Hits
    (stats[32] ?? 0) * 0.3 +  // Blocks
    (stats[12] ?? 0) * 0.5 +  // GWG
    (stats[9] ?? 0) * 2       // SHG
  );
}

function calculateGoalieFP(stats) {
  return (
    (stats[18] ?? 0) +         // GS
    (stats[19] ?? 0) * 3 +     // Wins
    (stats[20] ?? 0) * -1 +    // Loss
    (stats[27] ?? 0) * 5 +     // Shutouts
    (stats[25] ?? 0) * 0.2 +   // Saves
    (stats[22] ?? 0) * -1      // Goals Against
  );
}