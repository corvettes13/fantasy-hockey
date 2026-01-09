const dateSelect = document.getElementById('date-select');
const tableBody = document.querySelector('#players-table tbody');
const seasonTableBody = document.querySelector('#season-table tbody');
const positionSelect = document.getElementById('position-select');
const topFreeAgentToggle = document.getElementById('top-free-agent-toggle');
const worstFreeAgentToggle = document.getElementById('worst-free-agent-toggle');
const worstTableBody = document.querySelector('#worst-table tbody');

function formatDatePretty(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Load JSON file
fetch('/fantasy-hockey/data/fantasy_leaders_by_day.json')
  .then(res => res.json())
  .then(data => {
    const dates = Object.keys(data).sort().reverse(); // latest dates first

    // Populate dropdown
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDatePretty(date);
      dateSelect.appendChild(option);
    });
    
    // Flatten all days into one big array
    const allPlayers = Object.values(data)
      .filter(arr => Array.isArray(arr) && arr.length > 0)
      .flat();
      
    const worstSeason = allPlayers
      .filter(p => p.fp < 0)        // only negative FP
      .sort((a, b) => a.fp - b.fp)  // most negative first
      .slice(0, 10);

    // Sort by fantasy points descending
    const sortedSeason = [...allPlayers].sort((a, b) => b.fp - a.fp);

    // Keep top 10
    let topSeason = sortedSeason.slice(0, 10);

    // Initial render of season table
    renderSeasonTable(topSeason);
    renderWorstTable(worstSeason);
    
    function applySeasonFilters() {
      const pos = positionSelect.value;
      const topFreeAgentsOnly = topFreeAgentToggle.checked;
      const worstFreeAgentsOnly = worstFreeAgentToggle.checked;

      let filteredTop = [...sortedSeason];
      let filteredWorst = [...worstSeason];

      // Position filter (top table only)
      if (pos) {
        filteredTop = filteredTop.filter(p =>
          p.position.split(',').includes(pos)
        );
      }

      // Top table free-agent filter
      if (topFreeAgentsOnly) {
        filteredTop = filteredTop.filter(p => p.owner_team_key === "free_agent");
      }

      // Worst table free-agent filter
      if (worstFreeAgentsOnly) {
        filteredWorst = filteredWorst.filter(p => p.owner_team_key === "free_agent");
      }

      renderSeasonTable(filteredTop.slice(0, 10));
      renderWorstTable(filteredWorst.slice(0, 10));
    }

    // Update on position filter change
    positionSelect.addEventListener('change', applySeasonFilters);
    topFreeAgentToggle.addEventListener('change', applySeasonFilters);
    worstFreeAgentToggle.addEventListener('change', applySeasonFilters);

    // Initial render
    const firstDateWithData = dates.find(d => data[d] && data[d].length > 0);
    renderTable(data, firstDateWithData);

    // Update on change
    dateSelect.addEventListener('change', () => {
      const selectedDate = dateSelect.value;
      renderTable(data, selectedDate);
      applySeasonFilters();
    });
  })
  .catch(err => console.error('Error loading fantasy leaders:', err));

// Render table for selected date
function renderTable(data, date) {
  let players = (data[date] || [])
    .filter(p => p.fp >= 0)          // remove negative scores
    .sort((a, b) => a.fp - b.fp)     // ascending order
    .slice(0, 5);                    // top 5 only


  tableBody.innerHTML = '';

  if (!players || players.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="6" style="text-align:center; padding:1rem; color:#666;">
        No games played on this date
      </td>
    `;
    tableBody.appendChild(row);
    return;
  }

  players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="player-cell">
        <img src="${p.headshot_url}" alt="${p.team_abbr} logo" />
        <a href="${p.url}" target="_blank">${p.player}</a>
        <span class="team-abbr">${p.team_abbr}</span>
      </td>
      <td class="owner-cell">${p.owner_team_name || 'Free Agent'}</td>
      <td>${p.position}</td>
      <td>${p.team}</td>
      <td>${p.fp.toFixed(1)}</td>
      <td class="stats-cell">${formatStats(p.position, p.stats)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function formatStats(position, stats) {
  if (!stats || typeof stats !== 'object') return '';

  const skaterOrder = ['G', 'A', 'PIM', 'GWG', 'SHG', 'HIT', 'BLK', 'SOG'];
  const goalieOrder = ['DEC', 'SV', 'GA', 'SHO'];

  const keys = position === 'G' ? goalieOrder : skaterOrder;

  return keys
    .filter(stat => {
      const value = stats[stat];
      if (stat === 'DEC') return value !== undefined && value !== null && value !== '';
      return value && parseFloat(value) > 0;
    })
    .map(stat => stat === 'DEC' ? `${stats[stat]}` : `${stats[stat]} ${stat}`)
    .join(', ');
}

function renderSeasonTable(players) {
  seasonTableBody.innerHTML = '';

  players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="player-cell">
        <img src="${p.headshot_url}" alt="${p.team_abbr} logo" />
        <a href="${p.url}" target="_blank">${p.player}</a>
        <span class="team-abbr">${p.team_abbr}</span>
      </td>
      <td class="owner-cell">${p.owner_team_name || 'Free Agent'}</td>
      <td>${p.position}</td>
      <td>${p.team}</td>
      <td>${p.fp.toFixed(1)}</td>
      <td>${formatDatePretty(p.date)}</td>
      <td class="stats-cell">${formatStats(p.position, p.stats)}</td>
    `;
    seasonTableBody.appendChild(row);
  });
}

function renderWorstTable(players) {
  worstTableBody.innerHTML = '';

  players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="player-cell">
        <img src="${p.headshot_url}" alt="${p.team_abbr} logo" />
        <a href="${p.url}" target="_blank">${p.player}</a>
        <span class="team-abbr">${p.team_abbr}</span>
      </td>
      <td class="owner-cell">${p.owner_team_name || 'Free Agent'}</td>
      <td>${p.position}</td>
      <td>${p.team}</td>
      <td>${p.fp.toFixed(1)}</td>
      <td>${formatDatePretty(p.date)}</td>
      <td class="stats-cell">${formatStats(p.position, p.stats)}</td>
    `;
    worstTableBody.appendChild(row);
  });
}

