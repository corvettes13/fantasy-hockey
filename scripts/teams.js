const jsonUrl = 'data/teams/t.1.json'; // Update path as needed

fetch(jsonUrl)
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('team-body');

    data.forEach(player => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${player.position}</td>
        <td>${player.Team}</td>
        <td>${player.Player}</td>
        <td>${player.Age}</td>
        <td>$${player.cost}</td>
        <td>${player["Contract Year"]}</td>
        <td>${player.GP}</td>
        <td>${player.G}</td>
        <td>${player.A}</td>
        <td>${player.PTS}</td>
        <td>${player.PIM}</td>
        <td>${player.SOG}</td>
        <td>${player.SPCT}%</td>
        <td>${player.SHG}</td>
        <td>${player.GWG}</td>
        <td>${player.BLK}</td>
        <td>${player.HIT}</td>
        <td>${player.ATOI}</td>
        <td>${player.Points.toFixed(1)}</td>
        <td>${player["P/G"].toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  })
  .catch(err => {
    console.error('Error loading team data:', err);
    document.getElementById('team-body').innerHTML = `<tr><td colspan="20">Failed to load team data.</td></tr>`;
  });
