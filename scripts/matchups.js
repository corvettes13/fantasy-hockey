fetch('data/2025_matchups.json')
  .then(res => res.json())
  .then(data => {
    const weekSelect = document.getElementById('week-select');
    const weekPrev = document.getElementById('week-prev');
    const weekNext = document.getElementById('week-next');
    const tbody = document.getElementById('matchups-body');
    const weekTitle = document.getElementById('week-title');

    const weeks = Object.keys(data.weeks).sort((a, b) => Number(a) - Number(b));
    // Determine today's date

    weeks.forEach(week => {
      const option = document.createElement('option');
      option.value = week;
      option.textContent = `Week ${week}`;
      weekSelect.appendChild(option);
    });

    // Determine today's date
    // Normalize today's date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let currentWeek = null;

    weeks.forEach(week => {
      const w = data.weeks[week];
      const firstMatchup = w.matchups[0];

      const start = new Date(firstMatchup.week_start + "T00:00:00");
      const end = new Date(firstMatchup.week_end + "T23:59:59");

      if (today >= start && today <= end) {
        currentWeek = week;
      }
    });

    // Choose default week
    let defaultWeek;

    if (currentWeek) {
      defaultWeek = currentWeek;
    } else if (today < new Date(data.weeks[weeks[0]].week_start)) {
      defaultWeek = weeks[0];
    } else {
      defaultWeek = weeks[weeks.length - 1];
    }

    function getPreviousWeekTopScorer(weekNumber) {
      const prevWeek = String(Number(weekNumber) - 1);
      if (!data.weeks[prevWeek]) return null;

      let bestTeam = null;
      let bestPoints = -Infinity;

      data.weeks[prevWeek].matchups.forEach(matchup => {
        matchup.teams.forEach(t => {
          const team = t.team;
          const pts = team.team_points?.total ?? 0;

          if (pts > bestPoints) {
            bestPoints = pts;
            bestTeam = team;
          }
        });
      });

      return bestTeam
        ? {
            name: bestTeam.name,
            logo: bestTeam.team_logos.team_logo.url,
            points: bestPoints,
            id: bestTeam.team_id
          }
        : null;
    }
    
    function getWeekTopScorer(weekNumber) {
      const week = data.weeks[weekNumber];
      if (!week) return null;

      let bestTeam = null;
      let bestPoints = -Infinity;

      week.matchups.forEach(matchup => {
        matchup.teams.forEach(t => {
          const team = t.team;
          const pts = team.team_points?.total ?? 0;

          if (pts > bestPoints) {
            bestPoints = pts;
            bestTeam = team;
          }
        });
      });

      return bestTeam
        ? {
            name: bestTeam.name,
            logo: bestTeam.team_logos.team_logo.url,
            points: bestPoints,
            id: bestTeam.team_id
          }
        : null;
    }
    
    function getWeekTopProjection(weekNumber) {
      const week = data.weeks[weekNumber];
      if (!week) return null;

      let bestTeam = null;
      let bestProj = -Infinity;

      week.matchups.forEach(matchup => {
        matchup.teams.forEach(t => {
          const team = t.team;
          const proj = team.initial_projection ?? 0;

          if (proj > bestProj) {
            bestProj = proj;
            bestTeam = team;
          }
        });
      });

      return bestTeam
        ? {
            name: bestTeam.name,
            logo: bestTeam.team_logos.team_logo.url,
            points: bestProj,
            id: bestTeam.team_id
          }
        : null;
    }

    // Set dropdown and render
    weekSelect.value = defaultWeek;
    renderWeek(defaultWeek);

    function renderWeek(weekNumber) {
      const weekData = data.weeks[weekNumber];
      const container = document.getElementById('matchups-body');
      container.innerHTML = '';

      weekTitle.textContent = `Week ${weekNumber} Matchups`;

      weekData.matchups.forEach(matchup => {
        const [teamA, teamB] = matchup.teams.map(t => t.team);

        const scoreA = teamA.team_points?.total ?? 0;
        const projA = teamA.new_projected_total ?? 0;
        const scoreB = teamB.team_points?.total ?? 0;
        const projB = teamB.new_projected_total ?? 0;

        const teamNumA = teamA.team_id;
        const teamNumB = teamB.team_id;

        const projClassA = scoreA >= projA ? 'projected-up' : 'projected-down';
        const projClassB = scoreB >= projB ? 'projected-up' : 'projected-down';

        const recordA = teamA.record ?? '';
        const recordB = teamB.record ?? '';

        const row = document.createElement('div');
        row.className = 'matchup-row';

        row.innerHTML = `
          <div class="team-left">
            <div class="team-info">
              <div class="team-name right-align">
                <a href="teams/team.html?team=${teamNumA}">${teamA.name}</a>
              </div>
              <div class="team-record right-align">${recordA}</div>
            </div>

            <img class="team-logo" src="${teamA.team_logos.team_logo.url}" alt="${teamA.name}">

            <div class="team-scores-left">
              <div class="current-score">${scoreA.toFixed(1)}</div>
              <div class="projected-score ${projClassA}">${projA.toFixed(1)}</div>
            </div>
          </div>

          <div class="vs">vs</div>

          <div class="team-right">
            <div class="team-scores-right">
              <div class="current-score">${scoreB.toFixed(1)}</div>
              <div class="projected-score ${projClassB}">${projB.toFixed(1)}</div>
            </div>

            <img class="team-logo" src="${teamB.team_logos.team_logo.url}" alt="${teamB.name}">

            <div class="team-info">
              <div class="team-name left-align">
                <a href="teams/team.html?team=${teamNumB}">${teamB.name}</a>
              </div>
              <div class="team-record left-align">${recordB}</div>
            </div>
          </div>
        `;

        container.appendChild(row);
      });

      // Determine which top scorer to show
      let top;
      let label;

      if (Number(weekNumber) === Number(currentWeek)) {
        // Current week → show last week's top scorer
        top = getPreviousWeekTopScorer(weekNumber);
        label = "Top Scorer Last Week";

      } else if (Number(weekNumber) > Number(currentWeek)) {
        // Future week → show highest projection
        top = getWeekTopProjection(weekNumber);
        label = `Top Projected Team Week ${weekNumber}`;

      } else {
        // Past week → show that week's top scorer
        top = getWeekTopScorer(weekNumber);
        label = `Top Scorer Week ${weekNumber}`;
      }

      if (top) {
        const highlight = document.createElement('div');
        highlight.className = 'top-scorer-row';

        highlight.innerHTML = `
          <div class="top-scorer-inner">
            <img class="team-logo" src="${top.logo}" alt="${top.name}">
            <div class="top-scorer-info">
              <div class="top-scorer-label">${label}</div>
              <div class="top-scorer-name">
                <a href="teams/team.html?team=${top.id}">${top.name}</a>
              </div>
            </div>
            <div class="top-scorer-points">${top.points.toFixed(1)} pts</div>
          </div>
        `;

        container.appendChild(highlight);
      }
    }

    
    // Dropdown change
    weekSelect.addEventListener('change', () => {
      renderWeek(weekSelect.value);
    });

  // Arrow navigation
    weekPrev.addEventListener('click', () => {
      const index = weeks.indexOf(weekSelect.value);
      if (index > 0) {
        const newWeek = weeks[index - 1];
        weekSelect.value = newWeek;   // <-- update dropdown
        renderWeek(newWeek);
      }
    });

    weekNext.addEventListener('click', () => {
      const index = weeks.indexOf(weekSelect.value);
      if (index < weeks.length - 1) {
        const newWeek = weeks[index + 1];
        weekSelect.value = newWeek;   // <-- update dropdown
        renderWeek(newWeek);
      }
    });
  })
  .catch(err => console.error('Error loading matchups:', err));
