const standingsUrl = 'data/2024_standings.json';

let standingsData = [];
let currentSortKey = null;
let sortDirection = 1;

function renderTable(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';

  data.forEach(team => {
    const diffClass = team.difference > 0 ? 'positive' : team.difference < 0 ? 'negative' : '';
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
      <td>$${team.faab_balance}</td>
      <td>${team.number_of_moves}</td>
      <td>${team["Weekly High Score"]}</td>
    `;
    tbody.appendChild(row);
  });
}

function sortDivision(data, key, direction) {
  return [...data].sort((a, b) => {
    let valA = a[key];
    let valB = b[key];

    // Ensure numeric sorting for currency fields
    if (key === 'faab_balance') {
      valA = Number(valA);
      valB = Number(valB);
    }

    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * direction;
    }

    return (valA - valB) * direction;
  });
}


document.querySelectorAll('th button').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.getAttribute('data-sort');

    if (currentSortKey === key) {
      sortDirection *= -1;
    } else {
      sortDirection = key === 'rank' ? 1 : -1;
      currentSortKey = key;
    }

    const bruhsSorted = sortDivision(standingsData.filter(t => t.division_id === 1), key, sortDirection);
    const brosSorted = sortDivision(standingsData.filter(t => t.division_id === 2), key, sortDirection);

    renderTable(bruhsSorted, 'bruhs-body');
    renderTable(brosSorted, 'bros-body');
  });
});


fetch(standingsUrl)
  .then(res => res.json())
  .then(data => {
    standingsData = data; // ✅ use raw array directly

    const bruhs = standingsData.filter(t => t.division_id === 1);
    const bros = standingsData.filter(t => t.division_id === 2);

    renderTable(bruhs, 'bruhs-body');
    renderTable(bros, 'bros-body');
  })
  .catch(err => console.error('Error loading standings:', err));

