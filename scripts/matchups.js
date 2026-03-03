fetch('data/2025_matchups.json')
  .then(res => res.json())
  .then(data => {
    const weekSelect = document.getElementById('week-select');
    const weekPrev = document.getElementById('week-prev');
    const weekNext = document.getElementById('week-next');
    const weekTitle = document.getElementById('week-title');
    const container = document.getElementById('matchups-body');

    const weeks = Object.keys(data.weeks).sort((a, b) => Number(a) - Number(b));

    weeks.forEach(week => {
      const option = document.createElement('option');
      option.value = week;
      option.textContent = `Week ${week}`;
      weekSelect.appendChild(option);
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let currentWeek = null;
    weeks.forEach(week => {
      const w = data.weeks[week];
      
      // Guard against empty playoff weeks
      if (w.matchups && w.matchups.length > 0) {
        const firstMatchup = w.matchups[0];
        const start = new Date(firstMatchup.week_start + "T00:00:00");
        const end = new Date(firstMatchup.week_end + "T23:59:59");
        
        if (today >= start && today <= end) {
          currentWeek = week;
        }
      }
    });

    let defaultWeek;
    if (currentWeek) {
      defaultWeek = currentWeek;
    } else if (today < new Date(data.weeks[weeks[0]].week_start)) {
      defaultWeek = weeks[0];
    } else {
      defaultWeek = weeks[weeks.length - 1];
    }

    // Helper functions for Top Scorers
    function getPreviousWeekTopScorer(weekNumber) {
      const prevWeek = String(Number(weekNumber) - 1);
      return getWeekTopScorer(prevWeek);
    }

    function getWeekTopScorer(weekNumber) {
      const week = data.weeks[weekNumber];
      if (!week) return null;
      let bestTeam = null;
      let bestPoints = -Infinity;
      week.matchups.forEach(matchup => {
        matchup.teams.forEach(t => {
          const pts = t.team.team_points?.total ?? 0;
          if (pts > bestPoints) {
            bestPoints = pts;
            bestTeam = t.team;
          }
        });
      });
      return formatTopScorer(bestTeam, bestPoints);
    }

    function getWeekTopProjection(weekNumber) {
      const week = data.weeks[weekNumber];
      if (!week) return null;
      let bestTeam = null;
      let bestProj = -Infinity;
      week.matchups.forEach(matchup => {
        matchup.teams.forEach(t => {
          const proj = t.team.initial_projection ?? 0;
          if (proj > bestProj) {
            bestProj = proj;
            bestTeam = t.team;
          }
        });
      });
      return formatTopScorer(bestTeam, bestProj);
    }

    function formatTopScorer(team, points) {
      if (!team) return null;
      return {
        name: team.name,
        logo: team.team_logos.team_logo.url,
        points: points,
        id: team.team_id
      };
    }

    function renderWeek(weekNumber) {
      const weekData = data.weeks[weekNumber];
      container.innerHTML = '';
      weekTitle.textContent = `Week ${weekNumber} Matchups`;

      // Handle Empty Playoff Weeks
      if (!weekData.matchups || weekData.matchups.length === 0) {
        const tbdMessage = document.createElement('div');
        tbdMessage.className = 'playoff-tbd-message';
        tbdMessage.innerHTML = `
          <div style="text-align: center; padding: 40px; border: 2px dashed #ccc; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-bottom: 10px;">🏆 Championship Bracket</h3>
            <p style="color: #666;">Matchups TBD: Check back soon for the playoff schedule!</p>
          </div>
        `;
        container.appendChild(tbdMessage);
        return; // Exit function so it doesn't try to loop through matchups
      }
      
      weekData.matchups.forEach(matchup => {
        const [teamA, teamB] = matchup.teams.map(t => t.team);

        let projA, projB;
        if (Number(weekNumber) === Number(currentWeek)) {
          projA = teamA.new_projected_total ?? teamA.initial_projection ?? 0;
          projB = teamB.new_projected_total ?? teamB.initial_projection ?? 0;
        } else {
          projA = teamA.initial_projection ?? 0;
          projB = teamB.initial_projection ?? 0;
        }

        const scoreA = teamA.team_points?.total ?? 0;
        const scoreB = teamB.team_points?.total ?? 0;
        const teamNumA = teamA.team_id;
        const teamNumB = teamB.team_id;

        const projClassA = scoreA >= projA ? 'projected-up' : 'projected-down';
        const projClassB = scoreB >= projB ? 'projected-up' : 'projected-down';

        const row = document.createElement('div');
        row.className = 'matchup-row';
        row.style.cursor = 'pointer';

        // Matchup Detail Redirect
        row.addEventListener('click', (e) => {
          if (e.target.tagName === 'A') return;
          window.location.href = `matchups.html?team1=${teamNumA}&team2=${teamNumB}&week=${weekNumber}`;
        });

        row.innerHTML = `
          <div class="team-left">
            <div class="team-info">
              <div class="team-name right-align">
                <a href="teams/team.html?team=${teamNumA}">${teamA.name}</a>
              </div>
              <div class="team-record right-align">${teamA.record ?? ''}</div>
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
              <div class="team-record left-align">${teamB.record ?? ''}</div>
            </div>
          </div>
        `;
        container.appendChild(row);
      });

      // Handle Top Scorer Display
      let top, label;
      if (Number(weekNumber) === Number(currentWeek)) {
        top = getPreviousWeekTopScorer(weekNumber);
        label = "Top Scorer Last Week";
      } else if (Number(weekNumber) > Number(currentWeek)) {
        top = getWeekTopProjection(weekNumber);
        label = `Top Projected Team Week ${weekNumber}`;
      } else {
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

    // Initialization
    weekSelect.value = defaultWeek;
    renderWeek(defaultWeek);

    weekSelect.addEventListener('change', () => renderWeek(weekSelect.value));

    weekPrev.addEventListener('click', () => {
      const index = weeks.indexOf(weekSelect.value);
      if (index > 0) {
        weekSelect.value = weeks[index - 1];
        renderWeek(weekSelect.value);
      }
    });

    weekNext.addEventListener('click', () => {
      const index = weeks.indexOf(weekSelect.value);
      if (index < weeks.length - 1) {
        weekSelect.value = weeks[index + 1];
        renderWeek(weekSelect.value);
      }
    });
  })
  .catch(err => console.error('Error loading matchups:', err));