fetch('data/standings.json')
  .then(response => response.json())
  .then(data => {
    const table = document.getElementById('standings-table');
    const tbody = table.querySelector('tbody');

    function renderTable(rows) {
      tbody.innerHTML = '';
      rows.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${team.rank}</td>
          <td>${team.team}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${team["Win Percentage"].toFixed(3)}</td>
          <td>${team["Points For"].toFixed(1)}</td>
          <td>${team["Points Against"].toFixed(1)}</td>
          <td>${team.difference.toFixed(1)}</td>
          <td>${team["Weekly High Score"]}</td>
        `;
        tbody.appendChild(row);
      });
    }

    renderTable(data);

    // Add sorting
    const headers = table.querySelectorAll('th');
    let sortDirection = 1;
    let currentColumn = null;

    headers.forEach((header, index) => {
      header.addEventListener('click', () => {
        const key = header.textContent.trim();
        if (currentColumn === index) {
          sortDirection *= -1;
        } else {
          sortDirection = 1;
          currentColumn = index;
        }

        const sorted = [...data].sort((a, b) => {
          const valA = a[key] ?? a[Object.keys(a)[index]];
          const valB = b[key] ?? b[Object.keys(b)[index]];
          return (valA > valB ? 1 : -1) * sortDirection;
        });

        renderTable(sorted);
      });
    });
  })
  .catch(error => console.error('Error loading standings:', error));
