fetch('data/2025_matchups.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('matchups-body');
    data.matchups.forEach(entry => {
      const teams = entry.matchup.teams;
      if (teams.length === 2) {
        const teamA = teams[0].team;
        const teamB = teams[1].team;

        const nameA = teamA.name;
        const pointsA = teamA.team_points?.total ?? '—';
        const projectedA = teamA.team_projected_points?.total ?? '—';

        const nameB = teamB.name;
        const pointsB = teamB.team_points?.total ?? '—';
        const projectedB = teamB.team_projected_points?.total ?? '—';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${nameA}</td>
          <td>${pointsA} / ${projectedA}</td>
          <td>vs</td>
          <td>${pointsB} / ${projectedB}</td>
          <td>${nameB}</td>
        `;
        tbody.appendChild(row);
      }
    });
  })
  .catch(err => {
    console.error('Error loading matchups:', err);
  });