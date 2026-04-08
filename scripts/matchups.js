Promise.all([
    fetch('data/2025_matchups.json').then(res => res.json()),
    fetch('data/2025_standings.json').then(res => res.json())
])
.then(([data, standingsData]) => {
    const weekSelect = document.getElementById('week-select');
    const weekPrev = document.getElementById('week-prev');
    const weekNext = document.getElementById('week-next');
    const weekTitle = document.getElementById('week-title');
    const container = document.getElementById('matchups-body');

    const weeks = Object.keys(data.weeks).sort((a, b) => Number(a) - Number(b));

    // Populate Dropdown
    weekSelect.innerHTML = '';
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Week ${week}`;
        weekSelect.appendChild(option);
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Determine Current Week for Default View
    let currentWeek = null;
    weeks.forEach(week => {
        const w = data.weeks[week];
        if (w.matchups && w.matchups.length > 0 && w.week_start) {
            const start = new Date(w.week_start + "T00:00:00");
            const end = new Date(w.week_end + "T23:59:59");
            if (today >= start && today <= end) currentWeek = week;
        }
    });

    // Fallback if no active week found (Season over)
    if (currentWeek === null || Number(currentWeek) >= 23) {
        currentWeek = "23";
    }

    // Set the default week based on standings or current detection
    let defaultWeek = currentWeek || (standingsData.teams[0].current_week).toString();

    // ADD FINALE OPTION & OVERRIDE DEFAULT
    // If we are at week 23 or beyond, add the finale to the dropdown and make it the default
    if (Number(currentWeek) >= 23) {
        const finaleOption = document.createElement('option');
        finaleOption.value = "finale"; 
        finaleOption.textContent = "🏆 Season Finale";
        weekSelect.appendChild(finaleOption);
        
        // This ensures the page loads the Finale summary immediately
        defaultWeek = "finale";
    }

    // Helper functions for Top Scorers
    function getPreviousWeekTopScorer(weekNumber) {
        const prevWeek = String(Number(weekNumber) - 1);
        return getWeekTopScorer(prevWeek);
    }

    function getWeekTopScorer(weekNumber) {
        const week = data.weeks[weekNumber];
        if (!week || !week.matchups) return null;
        let bestTeam = null, bestPoints = -Infinity;
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
        if (!week || !week.matchups) return null;
        let bestTeam = null, bestProj = -Infinity;
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
        if (!team || !team.team_logos) return null;
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
        
        // 1. Check if season is completed (Week > 23)
        const isSeasonOver = Number(currentWeek) >= 23; 
        // Or use a specific flag if you prefer

        if (weekNumber === "finale") {
          renderChampionshipSummary();
          return; // Exit here so it doesn't try to render standard matchups
        }
        
        if (!weekData) {
            container.innerHTML = `<p style="text-align:center; padding:20px;">Week ${weekNumber} data not found.</p>`;
            return;
        }

        // Standard Header Logic
        if (weekNumber == "21") weekTitle.textContent = `Round 1: Quarterfinals`;
        else if (weekNumber == "22") weekTitle.textContent = `Round 2: Semifinals`;
        else if (weekNumber == "23") weekTitle.textContent = `Round 3: Championship`;
        else weekTitle.textContent = `Week ${weekNumber} Matchups`;

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
            const projClassA = scoreA >= projA ? 'projected-up' : 'projected-down';
            const projClassB = scoreB >= projB ? 'projected-up' : 'projected-down';

            const row = document.createElement('div');
            row.className = 'matchup-row';
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') return;
                window.location.href = `matchups.html?team1=${teamA.team_id}&team2=${teamB.team_id}&week=${weekNumber}`;
            });

            row.innerHTML = `
                <div class="team-left">
                    <div class="team-info">
                        <div class="team-name right-align">
                            <a href="teams/team.html?team=${teamA.team_id}">${teamA.name}</a>
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
                            <a href="teams/team.html?team=${teamB.team_id}">${teamB.name}</a>
                        </div>
                        <div class="team-record left-align">${teamB.record ?? ''}</div>
                    </div>
                </div>
            `;
            container.appendChild(row);
        });

        // Top Scorer Highlights
        let top, label;
        const selectedWeekNum = Number(weekNumber);
        const currentWeekNum = Number(currentWeek);
        
        // 1. Logic for the active week
        if (selectedWeekNum === currentWeekNum) {
            top = getPreviousWeekTopScorer(weekNumber);
            label = "Top Scorer Last Week";
        } 
        // 2. Logic for FUTURE weeks (ONLY if the season isn't over)
        else if (selectedWeekNum > currentWeekNum && currentWeekNum < 23) {
            top = getWeekTopProjection(weekNumber);
            label = `Top Projected Team Week ${weekNumber}`;
        } 
        // 3. Logic for PAST weeks (or final week once season ends)
        else {
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
                        <div class="top-scorer-name"><a href="teams/team.html?team=${top.id}">${top.name}</a></div>
                    </div>
                    <div class="top-scorer-points">${top.points.toFixed(1)} pts</div>
                </div>`;
            container.appendChild(highlight);
        }
    }
    
    function renderChampionshipSummary() {
        weekTitle.textContent = "2025-26 League Champion";
        
        // Get the Championship Matchup (Week 23, Matchup 0)
        const finalMatch = data.weeks["23"]?.matchups[0];
        if (!finalMatch) {
            container.innerHTML = "<div style='text-align:center; padding:50px;'><h3>Finale results pending...</h3></div>";
            return;
        }

        const [tA, tB] = finalMatch.teams.map(wrapper => wrapper.team);
        const scoreA = tA.team_points?.total ?? 0;
        const scoreB = tB.team_points?.total ?? 0;

        const winner = scoreA > scoreB ? tA : tB;
        const loser = scoreA > scoreB ? tB : tA;
        const winScore = Math.max(scoreA, scoreB);
        const loseScore = Math.min(scoreA, scoreB);

        container.innerHTML = `
            <div class="championship-container" style="text-align: center; padding: 10px;">
                <div class="winner-display">
                    <h2 style="color: #ffd700; font-size: 2.2rem; margin: 0 0 10px 0;">🏆 CHAMPION 🏆</h2>
                    <img src="${winner.team_logos.team_logo.url}" style="width: 130px; height: 130px; border-radius: 50%; border: 4px solid #ffd700; display: block; margin: 0 auto;">
                    <h1 style="margin: 5px 0 5px 0; font-size: 2.5rem;">${winner.name}</h1>
                    <p style="font-size: 1.4rem; font-weight: bold; margin: 0;">${winScore.toFixed(2)} pts</p>
                </div>

                <div style="font-style: italic; margin: 10px 0;">defeated</div>

                <div class="loser-display" style="opacity: 0.8;">
                    <img src="${loser.team_logos.team_logo.url}" style="width: 70px; height: 70px; border-radius: 50%; border: 2px solid #666; display: block; margin: 0 auto;">
                    <h3 style="margin: 5px 0 0 0;">${loser.name}</h3>
                    <p style="margin: 0;">${loseScore.toFixed(2)} pts</p>
                </div>

                <div class="custom-celebration-image">
                    <hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">
                    <img src="images/hype_machine_wins.png" alt="Champion Image" style="max-width: 90%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                </div>
            </div>
        `;
        }

    // Nav Controls and Listeners
    weekSelect.value = defaultWeek;
    renderWeek(defaultWeek);

    weekSelect.addEventListener('change', () => renderWeek(weekSelect.value));
    weekNext.addEventListener('click', () => {
        const index = weeks.indexOf(weekSelect.value);
        // If we are at the last week (23), and the Finale option exists, go to Finale
        if (index === weeks.length - 1 && Number(weeks[index]) === 23) {
            weekSelect.value = "finale";
            renderWeek("finale");
        } else if (index < weeks.length - 1) {
            weekSelect.value = weeks[index + 1];
            renderWeek(weekSelect.value);
        }
    });
})
.catch(err => console.error('Error loading matchups:', err));