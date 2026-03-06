let allTransactions = []; 
let currentTypeFilter = 'all';
let currentTeamFilter = 'all';
let currentPage = 0;
const pageSize = 25;
let filteredData = []; 

let globalPlayerLookup = {};
let globalTeamLookup = {};

async function loadTransactions() {
    try {
        const [txRes, playersRes, teamsRes] = await Promise.all([
            fetch("/fantasy-hockey/data/transactions.json"),
            fetch("/fantasy-hockey/data/players.json"),
            fetch("/fantasy-hockey/data/league_teams.json")
        ]);

        const tx = await txRes.json();
        const playersData = await playersRes.json();
        const teamsData = await teamsRes.json();

        // 1. Prepare Metadata
        tx.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        playersData.players.forEach(p => globalPlayerLookup[p.player_id] = p);

        const teamSelect = document.getElementById('team-filter');
        teamsData.forEach(t => {
            const key = t.team_info.team_key;
            const name = t.team_info.name;
            globalTeamLookup[key] = { name: name, logo: t.team_info.logo_url };

            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = name;
            teamSelect.appendChild(opt);
        });

        allTransactions = tx;
        setupEventListeners();
        applyFilters();
        calculateTransactionStats();

    } catch (err) {
        console.error("Error loading transaction data:", err);
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTypeFilter = e.target.dataset.filter;
            applyFilters();
        });
    });

    document.getElementById('team-filter').addEventListener('change', (e) => {
        currentTeamFilter = e.target.value;
        applyFilters();
    });
    
    document.getElementById('next-btn').addEventListener('click', () => {
        if ((currentPage + 1) * pageSize < filteredData.length) {
            currentPage++;
            renderCurrentPage();
        }
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            renderCurrentPage();
        }
    });
}

function applyFilters() {
    currentPage = 0; 
    filteredData = allTransactions.filter(tx => {
        // Skip commish transactions with no players
        if (tx.type === 'commish' || !tx.players || tx.players.length === 0) return false;

        // 1. Team Filtering
        if (currentTeamFilter !== 'all') {
            const teamInvolved = tx.players.some(p => p.team_key === currentTeamFilter);
            if (!teamInvolved) return false;
        }

        // 2. Type Filtering
        if (currentTypeFilter === 'add') {
            return tx.type === 'add' || tx.type === 'add/drop' || tx.type === 'draft';
        } else if (currentTypeFilter === 'drop') {
            return tx.type === 'drop' || tx.type === 'add/drop';
        } else if (currentTypeFilter === 'trade') {
            return tx.type === 'trade';
        }

        return true;
    });

    renderCurrentPage();
}

function renderCurrentPage() {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const pageData = filteredData.slice(start, end);
    
    renderTransactions(pageData);
    updatePaginationUI();
}

function renderTransactions(transactions) {
    const tbody = document.getElementById("transactions-body");
    tbody.innerHTML = "";

    transactions.forEach((tx, idx) => {
        const formattedDate = formatYahooDate(tx.datetime);
        const rowColorClass = idx % 2 === 0 ? "row-even" : "row-odd";

        if (tx.type === 'trade') {
            const byTeam = {};
            tx.players.forEach(p => {
                if (!byTeam[p.team_key]) byTeam[p.team_key] = [];
                byTeam[p.team_key].push(p);
            });

            const teamKeys = Object.keys(byTeam);
            teamKeys.forEach((teamKey, tIdx) => {
                const tr = document.createElement("tr");
                tr.className = rowColorClass;
                const teamData = globalTeamLookup[teamKey] || { name: "Free Agent", logo: "" };
                let finalLogo = (!teamData.logo || teamKey === "free_agent") 
                    ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                    : teamData.logo;

                const playerHtml = byTeam[teamKey].map(tp => {
                    const p = globalPlayerLookup[tp.player_id] || { full_name: "Unknown", team_abbr: "??", position: "???" };
                    return `<div class="player-entry-trade">
                        <a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                        <span class="player-pos-team">${p.team_abbr} - ${p.position}</span>
                    </div>`;
                }).join("");

                if (tIdx === 0) {
                    tr.innerHTML = `<td rowspan="${teamKeys.length}" class="icon-col trade-icon-cell"><span class="f-icon icon-trade">🔄</span></td>`;
                }

                tr.innerHTML += `
                    <td class="player-info-col No-pstart">${playerHtml}</td>
                    <td class="trade-text-cell">Traded to</td>
                    <td class="team-time-col Ta-end">
                        <div class="yahoo-team-wrapper">
                            <div class="team-time-stack">
                                <a href="#" class="team-link">${teamData.name}</a>
                                <span class="timestamp-text">${formattedDate}</span>
                            </div>
                            <img src="${finalLogo}" class="team-logo-small">
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            tr.className = rowColorClass;

            // Find the active league team involved in this add/drop/draft
            const mainAction = tx.players.find(p => p.team_key !== 'free_agent') || tx.players[0];
            const teamData = globalTeamLookup[mainAction.team_key] || { name: "Free Agent", logo: "" };
            let finalLogo = (!teamData.logo || mainAction.team_key === "free_agent") 
                ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                : teamData.logo;

            const iconsHtml = tx.players.map(p => {
                if (tx.type === 'draft') return `<span class="f-icon icon-draft">🏆</span>`;
                const symbol = p.type === "add" ? "+" : "–";
                const cls = p.type === "add" ? "icon-add" : "icon-drop";
                return `<span class="f-icon ${cls}">${symbol}</span>`;
            }).join("");

            const playersHtml = tx.players.map(tp => {
                const p = globalPlayerLookup[tp.player_id] || { full_name: "Unknown", team_abbr: "??", position: "???" };
                let sub = "";
                if (tx.type === 'draft') sub = `Drafted ($${tp.cost})`;
                else if (tp.type === 'drop') sub = "To Waivers";
                else sub = tp.cost > 0 ? `$${tp.cost} Waiver` : "Waiver";

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
                </td>`;
            tbody.appendChild(tr);
        }
    });
}

function formatYahooDate(datetime) {
    const dateObj = new Date(datetime);
    return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ", " + 
           dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const info = document.getElementById('paging-info');

    if (prevBtn && nextBtn && info) {
        prevBtn.classList.toggle('disabled', currentPage === 0);
        nextBtn.classList.toggle('disabled', (currentPage + 1) * pageSize >= filteredData.length);

        const startIdx = filteredData.length === 0 ? 0 : (currentPage * pageSize) + 1;
        const endIdx = Math.min((currentPage + 1) * pageSize, filteredData.length);
        info.textContent = `Showing ${startIdx}-${endIdx} of ${filteredData.length}`;
    }
}

function calculateTransactionStats() {
    const addCounts = {}; // { player_id: total_count }
    const teamBreakdown = {}; // { player_id: { team_key: count } }

    allTransactions.forEach(tx => {
        if (!tx.players) return;
        tx.players.forEach(p => {
            if (p.type === 'add' || tx.type === 'draft') {
                const pid = p.player_id;
                const tkey = p.team_key;

                // Update Total Count
                addCounts[pid] = (addCounts[pid] || 0) + 1;

                // Update Team Breakdown
                if (!teamBreakdown[pid]) teamBreakdown[pid] = {};
                teamBreakdown[pid][tkey] = (teamBreakdown[pid][tkey] || 0) + 1;
            }
        });
    });

    renderStatTable("most-added-body", addCounts, teamBreakdown);
}

function renderStatTable(elementId, countMap, teamMap) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    const sortedIds = Object.keys(countMap)
        .sort((a, b) => countMap[b] - countMap[a])
        .slice(0, 20);

    tbody.innerHTML = sortedIds.map((pid, index) => {
        const p = globalPlayerLookup[pid] || { full_name: "Unknown", team_abbr: "??", position: "???" };
        const rowColorClass = index % 2 === 0 ? "row-even" : "row-odd";
        
        // Generate the Team list HTML
        const teamsInvolved = teamMap[pid];
        const teamChipsHtml = Object.entries(teamsInvolved)
            .map(([tkey, count]) => {
                const tData = globalTeamLookup[tkey] || { name: "Unknown" };
                // If they added them more than once (streaming), show the count next to the team
                const countSuffix = count > 1 ? ` (x${count})` : "";
                return `<span class="team-stat-chip">${tData.name}${countSuffix}</span>`;
            }).join("");

        return `
            <tr class="${rowColorClass}">
                <td class="rank-number" style="text-align: center;">${index + 1}</td>
                <td style="text-align: left;">
                    <a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                    <span class="player-pos-team">${p.team_abbr} - ${p.position}</span>
                </td>
                <td style="text-align: left;">
                    <div class="team-chips-container">${teamChipsHtml}</div>
                </td>
                <td style="text-align: right; padding-right: 25px;">
                    <span class="count-badge">${countMap[pid]}</span>
                </td>
            </tr>
        `;
    }).join("");
}

document.addEventListener('DOMContentLoaded', loadTransactions);