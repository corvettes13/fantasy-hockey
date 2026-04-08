fetch('../data/champions.json')
  .then(res => res.json())
  .then(data => {
    if (!data || data.length === 0) return;

    // 1. POPULATE HERO SECTION (Latest Season)
    const latest = data[0];
    const heroTeamName = document.querySelector('.hero-team-name');
    const heroManager = document.querySelector('.hero-manager');
    const seasonLabel = document.querySelector('.season-label');

    if (heroTeamName) heroTeamName.textContent = latest.champion?.team || "TBD";
    if (heroManager) heroManager.textContent = `Manager: ${latest.champion?.manager || "N/A"}`;
    if (seasonLabel) seasonLabel.textContent = `${latest.season} CHAMPION`;

    // 2. POPULATE HISTORICAL TABLES
    const champBody = document.getElementById('champions-body');
    const presidentsBody = document.getElementById('presidents-body');

    data.forEach(season => {
      // 1. ADD TO STANLEY CUP HISTORY TABLE
      if (season.champion?.manager || season.runnerUp?.manager) {
        const cRow = document.createElement('tr');
        
        // Only create the score badge if a score exists
        const scoreHtml = season.champion?.score 
          ? `<span class="score-badge">${season.champion.score}</span>` 
          : '';

        cRow.innerHTML = `
          <td><strong>${season.season}</strong></td>
          <td>
            <div class="team-cell-content">
              <span class="manager-name">${season.champion?.manager ?? '—'}</span>
              <small class="team-name">${season.champion?.team ?? ''}</small>
              ${scoreHtml}
            </div>
          </td>
          <td>
            <div class="team-cell-content">
              <span class="manager-name">${season.runnerUp?.manager ?? '—'}</span>
              <small class="team-name">${season.runnerUp?.team ?? ''}</small>
            </div>
          </td>
        `;
        champBody.appendChild(cRow);
      }

      // 2. ADD TO PRESIDENTS' TROPHY TABLE (Only if a winner exists)
      if (season.regularSeasonChampion?.manager) {
        const pRow = document.createElement('tr');
        pRow.innerHTML = `
          <td><strong>${season.season}</strong></td>
          <td>
            <div class="team-cell-content">
              <span class="manager-name">${season.regularSeasonChampion.manager}</span>
              <small class="team-name">${season.regularSeasonChampion.team ?? ''}</small>
            </div>
          </td>
          <td>${season.regularSeasonChampion.record ?? '—'}</td>
        `;
        presidentsBody.appendChild(pRow);
      }
    });
  })
  .catch(err => {
    console.error('Error loading champions data:', err);
  });

// Playoff Pool Logic (Keep your existing fetch here)
fetch('../data/playoff_pool.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('playoff-body');
    data.forEach(entry => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${entry.Year}</td>
        <td>${entry.Manager}</td>
        <td>${entry.Points}</td>
        <td>${entry.Margin}</td>
        <td>${entry["Cup Winner"]}</td>
        <td>${entry["Stanley Cup Winner"]}</td>
      `;
      tbody.appendChild(row);
    });
  });