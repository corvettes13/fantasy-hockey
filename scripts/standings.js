const standingsUrl = 'data/2024_standings.json';

let standingsData = [];
let currentSortKey = null;
let sortDirection = 1;

const select = document.getElementById('standings-select');

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('standings-select');

  function loadStandings(file) {
    fetch(`data/${file}`)
      .then(res => res.json())
      .then(data => {
        standingsData = data.teams;

        const bruhs = standingsData.filter(t => t.division_id === 1);
        const bros = standingsData.filter(t => t.division_id === 2);

        renderTable(bruhs, 'bruhs-body');
        renderTable(bros, 'bros-body');
      })
      .catch(err => console.error('Error loading standings:', err));
  }

  // Initial load
  loadStandings(select.value);

  // Reload when dropdown changes
  select.addEventListener('change', () => {
    loadStandings(select.value);
  });

  // Sorting logic
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
});

function renderTable(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';

  data.forEach(teams => {
    const PFminusPA = teams["points for"] - teams["points against"];
    const diffClass = PFminusPA > 0 ? 'positive' : PFminusPA < 0 ? 'negative' : '';
    const teamNum = teams.team_key ? teams.team_key.split('.').pop() : teams.team_id || '';

    // Badge HTML
    const badges = `
      ${teams.currentChampion ? `<img src="images/champion_2026.png" alt="Champion" class="inline-badge">` : ''}
      ${teams.presidentTrophy ? `<img src="images/presidentstrophy_2026.png" alt="Presidents' Trophy" class="inline-badge">` : ''}
    `;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${teams.rank}</td>
      <td class="left-align team-name-cell">
        <div class="team-name-wrapper">
          <a href="teams/team.html?team=${teamNum}">${teams.name}</a>
          ${teams.currentChampion ? `<img src="images/champion_2025.png" alt="Champion" class="floating-badge">` : ''}
          ${teams.presidentTrophy ? `<img src="images/presidentstrophy_2025.png" alt="Presidents' Trophy" class="floating-badge">` : ''}
        </div>
      </td>
      <td>${teams.wins}</td>
      <td>${teams.losses}</td>
      <td>${teams.percentage.toFixed(3)}</td>
      <td>${teams["points for"].toFixed(1)}</td>
      <td>${teams["points against"].toFixed(1)}</td>
      <td class="${diffClass}">${PFminusPA.toFixed(1)}</td>
      <td>$${teams.faab_balance}</td>
      <td>${teams.number_of_moves}</td>
      <td>${teams.weekly_high_score}</td>
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
