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

    let defaultWeek = currentWeek || (standingsData.teams[0].current_week).toString();

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
        
        // Handle Header Title for Playoffs
        if (weekNumber == "21") weekTitle.textContent = `Round 1: Quarterfinals`;
        else if (weekNumber == "22") weekTitle.textContent = `Round 2: Semifinals`;
        else if (weekNumber == "23") weekTitle.textContent = `Round 3: Championship`;
        else weekTitle.textContent = `Week ${weekNumber} Matchups`;

        // Handle Empty Weeks (Round 2 & 3 TBD)
        if (!weekData.matchups || weekData.matchups.length === 0) {
            container.innerHTML = `
                <div class="playoff-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 20px; border: 2px dashed #444; border-radius: 12px; margin: 20px auto; max-width: 600px;">
                    <h3 style="margin: 0; font-size: 1.5rem;">🏆 Championship Bracket</h3>
                    <p style="margin-top: 10px; opacity: 0.7;">Matchups TBD. Winners will be updated after the previous round.</p>
                </div>`;
            return;
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
                        <div class="top-scorer-name"><a href="teams/team.html?team=${top.id}">${top.name}</a></div>
                    </div>
                    <div class="top-scorer-points">${top.points.toFixed(1)} pts</div>
                </div>`;
            container.appendChild(highlight);
        }
    }

    // Nav Controls and Listeners
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