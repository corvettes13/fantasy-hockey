Promise.all([
  fetch('/fantasy-hockey/data/players.json').then(res => res.json()),
  fetch('/fantasy-hockey/teams/nhl_teams.json').then(res => res.json()),
  fetch('/fantasy-hockey/data/2024_season_stats.json').then(res => res.json())
]).then(([playersData, teamsData, statsData]) => {
  const allPlayers = playersData.players;
  let players = allPlayers; // default view
  const teamMap = Object.fromEntries(teamsData.map(t => [t.team_abbreviation, t.logo_url]));
  
  const statIdMap = {
    0: 'GP',
    1: 'G',
    2: 'A',
    3: 'PTS',
    4: 'PlusMinus',
    5: 'PIM',
    6: 'PPG',
    7: 'PPA',
    9: 'SHG',
    10: 'SHA',
    12: 'GWG',
    14: 'SOG',
    15: 'SPCT',
    31: 'HIT',
    32: 'BLK',
    34: 'ATOI'
  };
  
  const statsMap = {};
  statsData.players.forEach(p => {
    const statObj = {};
    
    p.stats.forEach(s => {
      const key = statIdMap[s._extracted_data?.stat_id ?? s.stat_id];
      let value = s._extracted_data?.value ?? s.value;
    
      // Normalize dash to 0
      if (value === '-' || value === '–') value = 0;

      if (key) statObj[key] = value;
    });

    const gp = parseFloat(statObj.GP) || 0;

    // Example formula: 1pt per goal, 1pt per assist, 0.5pt per SOG, 0.25pt per HIT
    const fp = (
      (parseFloat(statObj.G) || 0) * 3 +
      (parseFloat(statObj.A) || 0) * 2 +
      (parseFloat(statObj.PIM) || 0) * 0.5 +
      (parseFloat(statObj.SHG) || 0) * 2 +
      (parseFloat(statObj.GWG) || 0) * 0.5 +
      (parseFloat(statObj.SOG) || 0) * .2 +
      (parseFloat(statObj.HIT) || 0) * .1 +
      (parseFloat(statObj.BLK) || 0) * .3
    );

    statObj.FP = parseFloat(fp.toFixed(1));
    statObj.FPG = gp ? (fp / gp).toFixed(2) : "0.00";

    // Extract player_id from player_key (e.g. "453.p.4257" → 4257)
    const id = parseInt(p.player_key.split('.').pop(), 10);
    statsMap[id] = statObj;
  });

  let currentSortKey = null;
  let sortDirection = 1;

  function renderTable(data) {
    const tbody = document.getElementById('players-body');
    tbody.innerHTML = '';
    
    const limited = data.slice(0, 250);

    limited.forEach((player, index) => {
      const stats = statsMap[player.player_id] || {};
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
        <td>${stats.FP ?? '0'}</td>
        <td>${stats.FPG ?? '0.0'}</td>
        <td>${stats.ATOI ?? '00:00'}</td>
      `;
      tbody.appendChild(row);
    });
  }
  
    const nameInput = document.getElementById('name-filter');
    const positionSelect = document.getElementById('position-filter');

    function applyFilters() {
      const nameQuery = nameInput.value.toLowerCase();
      const positionQuery = positionSelect.value;

      const filtered = allPlayers.filter(p => {
        const matchesName = p.full_name.toLowerCase().includes(nameQuery);
        const matchesPosition =
          positionQuery === '' || p.position.replace(/\s+/g, '').split(',').includes(positionQuery);
        const isGoalie = p.position.includes('G');
        const excludeGoalieByDefault = positionQuery === '' && !isGoalie;

        return matchesName && (matchesPosition || excludeGoalieByDefault);
      });
      
      currentSortKey = 'FP'; //default sort by fantasy points
      sortDirection = -1;
      
      players.sort((a, b) => {
        const aFP = statsMap[a.player_id]?.FP ?? 0;
        const bFP = statsMap[b.player_id]?.FP ?? 0;
        return (aFP - bFP) * sortDirection;
      });
      
      renderTable(filtered);
    }

    nameInput.addEventListener('input', applyFilters);
    positionSelect.addEventListener('change', applyFilters);

  function sortBy(key) {
    if (key === 'rank') return; // prevent sorting by rank

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

    renderTable(players);
  }

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      sortBy(key);
    });
  });

  renderTable(players);
});

function atoiToSeconds(timeStr) {
  if (typeof timeStr !== 'string') return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return (min || 0) * 60 + (sec || 0);

}
