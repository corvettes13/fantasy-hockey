async function initBracket() {
    const [standingsRes, matchupsRes] = await Promise.all([
        fetch('data/2025_standings.json'),
        fetch('data/2025_matchups.json')
    ]);
    const standingsData = await standingsRes.json();
    const matchupsData = await matchupsRes.json();

    // 1. Setup Time/Week Context
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week21Data = matchupsData.weeks["21"];
    
    // Determine active week for projection logic
    let currentWeek = standingsData.teams[0]?.current_week.toString();
    const weeks = Object.keys(matchupsData.weeks);
    weeks.forEach(wKey => {
        const w = matchupsData.weeks[wKey];
        if (w.matchups && w.matchups.length > 0) {
            const m = w.matchups[0];
            const start = new Date(m.week_start + "T00:00:00");
            const end = new Date(m.week_end + "T23:59:59");
            if (today >= start && today <= end) currentWeek = wKey;
        }
    });

    // 2. Map Standings Ranks to Team IDs for Sorting
    const rankMap = {};
    standingsData.teams.forEach(t => rankMap[t.team_id] = t.rank);

    // 3. Define Bracket Order (Seeds: 1v8, 4v5, 2v7, 3v6)
    // This helper finds the specific matchup object from your Week 21 JSON
    const getMatchupBySeeds = (s1, s2) => {
        return week21Data.matchups.find(m => {
            const seeds = m.teams.map(t => rankMap[t.team.team_id]);
            return seeds.includes(s1) && seeds.includes(s2);
        });
    };

    const bracketPairs = [
        getMatchupBySeeds(1, 8),
        getMatchupBySeeds(4, 5),
        getMatchupBySeeds(2, 7),
        getMatchupBySeeds(3, 6)
    ];

    // 4. Render
    const container = document.getElementById('bracket-container');
    container.innerHTML = `
        <div class="bracket-round">
            <h3>Quarterfinals</h3>
            ${bracketPairs.map(m => m ? renderMatchupCard(m, 21, currentWeek, rankMap) : '').join('')}
        </div>
        <div class="bracket-round">
            <h3>Semifinals</h3>
            <div class="bracket-placeholder">TBD</div>
            <div class="bracket-placeholder">TBD</div>
        </div>
        <div class="bracket-round">
            <h3>Finals</h3>
            <div class="bracket-placeholder">TBD</div>
        </div>
    `;
}

function renderMatchupCard(matchup, weekNum, currentWeek, rankMap) {
    const [teamA, teamB] = matchup.teams.map(t => t.team);

    const renderTeamRow = (team) => {
        const score = team.team_points?.total ?? 0;
        const seed = rankMap[team.team_id] || '';
        
        let proj;
        if (Number(weekNum) === Number(currentWeek)) {
            proj = team.new_projected_total ?? team.initial_projection ?? 0;
        } else {
            proj = team.initial_projection ?? 0;
        }

        const projClass = score >= proj ? 'projected-up' : 'projected-down';
        // Sourcing logo directly from the matchup JSON structure
        const logoUrl = team.team_logos.team_logo.url;

        return `
            <div class="bracket-row">
                <img class="team-logo" src="${logoUrl}" alt="${team.name}">
                <div class="bracket-team-info">
                    <div class="bracket-team-name">
                        <span class="bracket-seed">${seed}</span> ${team.name}
                    </div>
                </div>
                <div class="bracket-score-box">
                    <div class="current-score">${score > 0 ? score.toFixed(1) : '—'}</div>
                    <div class="projected-score ${projClass}">${proj.toFixed(1)}</div>
                </div>
            </div>
        `;
    };

    return `
        <div class="bracket-matchup-card" onclick="window.location.href='matchups.html?team1=${teamA.team_id}&team2=${teamB.team_id}&week=${weekNum}'">
            ${renderTeamRow(teamA)}
            ${renderTeamRow(teamB)}
        </div>
    `;
}

// Tab Switching Logic
document.getElementById('tab-matchups').addEventListener('click', function() {
    this.classList.add('Selected');
    document.getElementById('tab-bracket').classList.remove('Selected');
    document.getElementById('view-matchups').style.display = 'block';
    document.getElementById('view-bracket').style.display = 'none';
});

document.getElementById('tab-bracket').addEventListener('click', function() {
    this.classList.add('Selected');
    document.getElementById('tab-matchups').classList.remove('Selected');
    document.getElementById('view-matchups').style.display = 'none';
    document.getElementById('view-bracket').style.display = 'block';
    initBracket();
});