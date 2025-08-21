const standingsUrl = 'data/standings.json'; // Update path if needed

let standingsData = [];

function renderTable(data) {
  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '';

  data.forEach(team => {
    const diffClass = team.difference > 0 ? 'positive' : team.difference < 0 ? 'negative' : '';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${team.rank}</td>
      <td class="left-align">${team.team}</td>
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

function sortBy(key) {
  standingsData.sort((a, b) => {
    if (typeof a[key] === 'string') {
      return a[key].localeCompare(b[key]);
    }
    return b[key] - a[key];
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
