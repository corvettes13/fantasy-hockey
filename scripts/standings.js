fetch('data/standings.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('standings-body');
    data.forEach(team => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${team.rank}</td>
        <td class="left-align">${team.team}</td>
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
  });
