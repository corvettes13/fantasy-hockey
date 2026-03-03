async function loadTransactionsWidget() {
    const [txRes, playersRes, teamsRes] = await Promise.all([
        fetch("data/transactions.json"),
        fetch("data/players.json"),
        fetch("data/league_teams.json")
    ]);

    const tx = await txRes.json();
    const playersData = await playersRes.json();
    const teamsData = await teamsRes.json();

    tx.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

    const playerLookup = {};
    playersData.players.forEach(p => playerLookup[p.player_id] = p);

    const teamLookup = {};
    teamsData.forEach(t => {
        teamLookup[t.team_info.team_key] = { 
            name: t.team_info.name, 
            logo: t.team_info.logo_url 
        };
    });

    const allGrouped = groupTransactions(tx);
    
    // Filter logic: All of today, but at least the last 5 transactions
    const today = new Date().toLocaleDateString();
    let displayList = allGrouped.filter(g => new Date(g.datetime).toLocaleDateString() === today);
    
    if (displayList.length < 5) {
        displayList = allGrouped.slice(0, 5);
    }

    renderWidget(displayList, playerLookup, teamLookup);
}

function renderWidget(blocks, playerLookup, teamLookup) {
    const tbody = document.getElementById("transactions-widget-body");
    tbody.innerHTML = "";

    blocks.forEach((block, groupIndex) => {
        const rowColorClass = groupIndex % 2 === 0 ? "row-even" : "row-odd";
        const formattedDate = formatYahooDate(block.datetime);

        if (block.type === 'trade') {
            const byTeam = {};
            block.items.forEach(item => {
                if (!byTeam[item.team_key]) byTeam[item.team_key] = [];
                byTeam[item.team_key].push(item);
            });

            const teamKeys = Object.keys(byTeam);
            teamKeys.forEach((teamKey, index) => {
                const tr = document.createElement("tr");
                tr.className = rowColorClass;
                const teamData = teamLookup[teamKey] || { name: teamKey, logo: "" };
                let finalLogo = (teamKey === "Free Agent" || !teamData.logo) ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" : teamData.logo;

                const p1Html = byTeam[teamKey].map(item => {
                    const p = playerLookup[item.player_id] || { full_name: "Unknown" };
                    return `<p class="player-entry-trade"><a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                            <span class="player-pos-team">${p.team_abbr} - ${p.position}</span></p>`;
                }).join("");

                if (index === 0) {
                    tr.innerHTML = `<td rowspan="${teamKeys.length}" class="icon-col trade-icon-cell"><span class="f-icon icon-trade">🔄</span></td>`;
                }

                tr.innerHTML += `
                    <td class="player-info-col No-pstart">${p1Html}</td>
                    <td class="trade-text-cell">Traded to</td>
                    <td class="team-time-col Ta-end">
                        <div class="yahoo-team-wrapper">
                            <div class="team-time-stack">
                                <a href="#" class="team-link">${teamData.name}</a>
                                <span class="timestamp-text">${formattedDate}</span>
                            </div>
                            <img src="${finalLogo}" class="team-logo-small">
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            tr.className = rowColorClass;
            const teamData = teamLookup[block.team_display_key] || { name: block.team_display_key, logo: "" };
            let finalLogo = (block.team_display_key === "Free Agent" || !teamData.logo) ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" : teamData.logo;

            const iconsHtml = block.items.map(item => {
                if (item.acq_type === "draft") {
                    return `<span class="f-icon icon-draft">🏆</span>`;
                }
                const symbol = item.acq_type === "add" ? "+" : "–";
                const cls = item.acq_type === "add" ? "icon-add" : "icon-drop";
                return `<span class="f-icon ${cls}">${symbol}</span>`;
            }).join("");
            
            const playersHtml = block.items.map(item => {
                const p = playerLookup[item.player_id] || { full_name: "Unknown" };
                
                // Logic for subtext based on acquisition type
                let sub = "";
                if (item.acq_type === "draft") {
                    sub = `Drafted ($${item.cost})`;
                } else if (item.acq_type === "drop") {
                    sub = "To Waivers";
                } else {
                    sub = item.cost > 0 ? `$${item.cost} Waiver` : "Waiver";
                }

                return `<div class="player-entry">
                    <a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                    <span class="player-pos-team">${p.team_abbr} - ${p.position}</span>
                    <h6 class="transaction-subtext">${sub}</h6>
                </div>`;
            }).join("");

            tr.innerHTML = `
                <td class="icon-col">${iconsHtml}</td>
                <td class="player-info-col" colspan="2">${playersHtml}</td>
                <td class="team-time-col Ta-end">
                    <div class="yahoo-team-wrapper">
                        <div class="team-time-stack">
                            <a href="#" class="team-link">${teamData.name}</a>
                            <span class="timestamp-text">${formattedDate}</span>
                        </div>
                        <img src="${finalLogo}" class="team-logo-small">
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function groupTransactions(tx) {
    const grouped = [];
    const usedIndices = new Set();
    for (let i = 0; i < tx.length; i++) {
        if (usedIndices.has(i)) continue;
        const current = tx[i];
        let group = { type: current.acq_type, datetime: current.datetime, items: [current], team_display_key: current.team_key };
        if (current.acq_type === 'trade') {
            group.type = 'trade';
            for (let j = i + 1; j < tx.length; j++) {
                if (!usedIndices.has(j) && tx[j].datetime === current.datetime && tx[j].acq_type === 'trade') {
                    group.items.push(tx[j]);
                    usedIndices.add(j);
                }
            }
        } else if (current.acq_type === 'add' || current.acq_type === 'drop') {
            for (let j = i + 1; j < tx.length; j++) {
                if (!usedIndices.has(j) && tx[j].datetime === current.datetime) {
                    const isPair = (current.acq_type === 'add' && tx[j].acq_type === 'drop') || (current.acq_type === 'drop' && tx[j].acq_type === 'add');
                    if (isPair) {
                        group.items.push(tx[j]);
                        usedIndices.add(j);
                        group.type = 'add_drop';
                        group.team_display_key = current.team_key === "Free Agent" ? tx[j].team_key : current.team_key;
                        break;
                    }
                }
            }
        }
        usedIndices.add(i);
        grouped.push(group);
    }
    return grouped;
}

function formatYahooDate(datetime) {
    const dateObj = new Date(datetime);
    return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ", " + 
           dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

document.addEventListener('DOMContentLoaded', loadTransactionsWidget);