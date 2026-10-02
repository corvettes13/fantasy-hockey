let standingsData = [];
let currentSortKey = null;
let sortDirection = 1;

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('standings-select');
  
  if (!select) {
    console.error("Could not find element with ID 'standings-select'");
    return;
  }

  function loadStandings(seasonValue) {
    // Call your Cloudflare Worker D1 API endpoint
    fetch(`/api/standings?season=${seasonValue}`)
      .then(res => res.json())
      .then(data => {
        // data.teams comes directly from your worker's JSON response
        standingsData = (data.teams || []).map(t => ({
          ...t,
          name: t.team_name,
          percentage: t.win_percentage,
          "points for": t.points_for,
          "points against": t.points_against,
          waiver_budget: t.waiver_budget,
          transactions: t.transactions
        }));

        const bruhs = standingsData.filter(t => t.division_id === 1);
        const bros = standingsData.filter(t => t.division_id === 2);

        renderTable(bruhs, 'bruhs-body');
        renderTable(bros, 'bros-body');
      })
      .catch(err => console.error('Error loading standings from D1:', err));
  }

  // Initial load using the default selected option in your dropdown
  loadStandings(select.value);

  // Reload when the dropdown changes
  select.addEventListener('change', () => {
    loadStandings(select.value);
  });

  // Sorting logic for table column headers
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
  if (!tbody) return;
  tbody.innerHTML = '';

  data.forEach(teams => {
    const PFminusPA = (teams["points for"] || 0) - (teams["points against"] || 0);
    const diffClass = PFminusPA > 0 ? 'positive' : PFminusPA < 0 ? 'negative' : '';
    const teamNum = teams.team_key ? teams.team_key.split('.').pop() : teams.team_id || '';

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
      <td>${Number(teams.percentage || 0).toFixed(3)}</td>
      <td>${Number(teams["points for"] || 0).toFixed(1)}</td>
      <td>${Number(teams["points against"] || 0).toFixed(1)}</td>
      <td class="${diffClass}">${PFminusPA.toFixed(1)}</td>
      <td>$${teams.waiver_budget || 0}</td>
      <td>${teams.transactions || 0}</td>
      <td>${teams.weekly_high_score || 0}</td>
    `;
    tbody.appendChild(row);
  });
}

function sortDivision(data, key, direction) {
  return [...data].sort((a, b) => {
    let valA, valB;

    if (key === 'difference') {
      valA = (a["points for"] || 0) - (a["points against"] || 0);
      valB = (b["points for"] || 0) - (b["points against"] || 0);
    } else {
      valA = a[key];
      valB = b[key];
    }

    if (key === 'waiver_budget' || key === 'transactions') {
      valA = Number(valA || 0);
      valB = Number(valB || 0);
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB) * direction;
    }

    return (Number(valA || 0) - Number(valB || 0)) * direction;
  });
}