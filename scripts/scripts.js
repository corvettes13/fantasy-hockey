fetch('data/standings.json')
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector('#standings-table tbody');
    data.forEach(team => {
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
  })
  .catch(error => console.error('Error loading standings:', error));
