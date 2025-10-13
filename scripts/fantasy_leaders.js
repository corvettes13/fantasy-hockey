const dateSelect = document.getElementById('date-select');
const tableBody = document.querySelector('#players-table tbody');

// Load JSON file
fetch('/fantasy-hockey/data/fantasy_leaders_by_day.json')
  .then(res => res.json())
  .then(data => {
    const dates = Object.keys(data).sort().reverse(); // latest dates first

    // Populate dropdown
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = date;
      dateSelect.appendChild(option);
    });

    // Initial render
    renderTable(data, dates[0]);

    // Update on change
    dateSelect.addEventListener('change', () => {
      renderTable(data, dateSelect.value);
    });
  })
  .catch(err => console.error('Error loading fantasy leaders:', err));

// Render table for selected date
function renderTable(data, date) {
  const players = data[date] || [];
  tableBody.innerHTML = '';

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