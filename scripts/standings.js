const standingsUrl = 'data/standings.json'; // Update path if needed

let standingsData = [];

function renderTable(data) {
  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '';

  data.forEach(team => {
    const diffClass = team.difference > 0 ? 'positive' : team.difference < 0 ? 'negative' : '';

    // Derive team number from teamKey or add your own mapping logic
    const teamNum = team.teamKey ? team.teamKey.split('.')[1] : team.teamNum || '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${team.rank}</td>
      <td class="left-align">
        <a href="teams/team.html?team=${teamNum}">${team.team}</a>
      </td>
      <td>${team.wins}</td>
      <td>${team.losses}</td>
      <td>${team["Win Percentage"].toFixed(3)}</td>
      <td>${team["Points For"].toFixed(1)}</td>
      <td>${team["Points Against"].toFixed(1)}</td>
      <td class="${diffClass}">${team.difference.toFixed(1)}</td>
      <td>${team["Weekly High Score"]}</td>
    `;
    tbody.appendChild(row);
  });
}

let currentSortKey = null;
let sortDirection = 1;

function sortBy(key) {
  // Default to ascending for 'rank', descending for others
  if (currentSortKey === key) {
    sortDirection *= -1; // toggle direction
  } else {
    sortDirection = key === 'rank' ? 1 : -1;
    currentSortKey = key;
  }

  standingsData.sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * sortDirection;
    }
    return (valA - valB) * sortDirection;
  });

  renderTable(standingsData);
}


document.querySelectorAll('th button').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.getAttribute('data-sort');
    sortBy(key);
  });
});

fetch(standingsUrl)
  .then(res => res.json())
  .then(data => {
    standingsData = data;
    renderTable(standingsData);
  })
  .catch(err => console.error('Error loading standings:', err));
