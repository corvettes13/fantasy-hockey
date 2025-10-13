const params = new URLSearchParams(window.location.search);
const week = params.get('week') || '1';
document.getElementById('week-label').textContent = week;

// Replace with your actual API proxy endpoint if needed
const apiUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/465.l.13153/scoreboard;week=${week}`;

fetch(apiUrl, {
  headers: {
    Authorization: `Bearer YOUR_ACCESS_TOKEN` // or use a proxy that handles OAuth
  }
})
  .then(res => res.json())
  .then(data => {
    const matchups = data.scoreboard["0"].matchups;
    renderMatchups(matchups);
  })
  .catch(err => console.error('Error fetching matchups:', err));

function renderMatchups(matchups) {
  const container = document.getElementById('matchup-container');
  container.innerHTML = '';

  Object.values(matchups).forEach((matchupObj, i) => {
    const matchup = matchupObj.matchup;
    const teams = matchup["0"].teams;

    const teamA = teams["0"].team;
    const teamB = teams["1"].team;

    const nameA = teamA[2].name;
    const nameB = teamB[2].name;

    const logoA = teamA[5].team_logos[0].team_logo.url;
    const logoB = teamB[5].team_logos[0].team_logo.url;

    const pointsA = teamA[1].team_points?.total ?? 'N/A';
    const pointsB = teamB[1].team_points?.total ?? 'N/A';

    const div = document.createElement('div');
    div.className = 'matchup';
    div.innerHTML = `
      <h2>Matchup ${i + 1}</h2>
      <div class="team-row">
        <div class="team">
          <img src="${logoA}" alt="${nameA} logo" />
          <p>${nameA}</p>
          <strong>${pointsA}</strong>
        </div>
        <div class="team">
          <img src="${logoB}" alt="${nameB} logo" />
          <p>${nameB}</p>
          <strong>${pointsB}</strong>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}