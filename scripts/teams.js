const params = new URLSearchParams(window.location.search);
const teamNum = params.get('team');
const teamKey = `465.l.13153.t.${teamNum}`; // Match Yahoo format

let currentSortKey = null;
let sortDirection = -1;

Promise.all([
  fetch('../data/league_teams.json').then(res => res.json()),
  fetch('../data/2025_standings.json').then(res => res.json()),
  fetch('../data/2025_skater_proj.json').then(res => res.json()),
  fetch('../data/2025_goalie_proj.json').then(res => res.json())
]).then(([teams, standings, skaterProj, goalieProj]) => {
  const teamData = teams.find(t => t.team_info.team_key === teamKey);
  const standingsInfo = standings.teams.find(s => s.team_key === teamKey);

  const teamInfo = teamData.team_info;
  const roster = teamData.roster;

  document.title = `${teamInfo.name} Roster`;
  document.querySelector('h1').textContent = `${teamInfo.name}`;

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
    const projStats = (player.primary_position === 'G'
      ? goalieProj.players
      : skaterProj.players
    ).find(p => p.player_key === player.player_key);

    const statMap = {};
    if (projStats?.stats) {
      projStats.stats.forEach(s => statMap[s.stat_id] = s.value);
    }

    const enriched = {
      ...player,
      FP: statMap[98] ?? 0,
      PG: statMap[99] ?? 0,
      GP: statMap[0] ?? 0,
      G: statMap[1] ?? 0,
      A: statMap[2] ?? 0,
      PTS: statMap[3] ?? 0,
      PIM: statMap[5] ?? 0,
      SOG: statMap[14] ?? 0,
      SPCT: statMap[15] ?? 0,
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
      goalieStatsMap[player.player_key] = enriched;
    } else {
      skaters.push(enriched);
      skaterStatsMap[player.player_key] = enriched;
    }
  });

  renderSkaterTable(skaters);
  renderGoalieTable(goalies);
  bindSortEvents('team-table', skaters, skaterStatsMap);
  bindSortEvents('goalie-table', goalies, goalieStatsMap);
});

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
      <td>${p.player_name}</td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td>${p.FP.toFixed(1)}</td>
      <td>${p.PG.toFixed(2)}</td>
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
      <td>${p.player_name}</td>
      <td>${p.team_abbr ?? ''}</td>
      <td>${p.primary_position}</td>
      <td>$${p.cost}</td>
      <td>${p.FP.toFixed(1)}</td>
      <td>${p.PG.toFixed(2)}</td>
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
          aStat = statsMap[a.player_key]?.[key];
          bStat = statsMap[b.player_key]?.[key];
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