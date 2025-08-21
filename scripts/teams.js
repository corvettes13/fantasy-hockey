const teamKey = location.pathname.split('/').pop().replace('.html', '').replace('team', 't.');

Promise.all([
  fetch(`../data/teams/${teamKey}.json`).then(res => res.json()),
  fetch(`../data/teams/teams.json`).then(res => res.json())
]).then(([players, teams]) => {
  const teamInfo = teams.find(t => t.key === teamKey);

  document.title = `${teamInfo.name} Roster`;
  document.querySelector('h1').textContent = `${teamInfo.name} (${teamInfo.abbreviation})`;

  const teamHeader = document.getElementById('team-header'); // Add this container to your HTML

  teamHeader.innerHTML = `
    <div class="team-profile">
      <img class="team-menu_logo-img" src="${teamInfo.logo}" alt="${teamInfo.abbreviation} logo">
      <div class="team-details">
        <h2 class="team-name">${teamInfo.name}</h2>
        <p class="team-manager">Managed by ${teamInfo.manager}</p>
      </div>
    </div>
  `;
  
  const tbody = document.getElementById('team-body');
  players.forEach(player => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${player.position}</td>
      <td>${player.Team}</td>
      <td>${player.Player}</td>
      <td>${player.Age}</td>
      <td>$${player.cost}</td>
      <td>${player["Contract Year"]}</td>
      <td>${player.Points.toFixed(1)}</td>
      <td>${player["P/G"].toFixed(2)}</td>
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
    `;
    tbody.appendChild(row);
  });
});
