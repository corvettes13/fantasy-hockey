fetch('../data/champions.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('champions-body');

    data.forEach(season => {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${season.season}</td>
        <td>${season.champion?.manager ?? ''}</td>
        <td>${season.champion?.team ?? ''}</td>
        <td>${season.runnerUp?.manager ?? ''}</td>
        <td>${season.runnerUp?.team ?? ''}</td>
        <td>${season.champion?.score ?? ''}</td>
        <td>${season.regularSeasonChampion?.manager ?? ''}</td>
        <td>${season.regularSeasonChampion?.team ?? ''}</td>
        <td>${season.regularSeasonChampion?.record ?? ''}</td>
      `;

      tbody.appendChild(row);
    });
  })
  .catch(err => {
    console.error('Error loading champions data:', err);
    document.getElementById('champions-body').innerHTML = `<tr><td colspan="9">Failed to load data.</td></tr>`;
  });

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
  })
  .catch(err => {
    console.error('Error loading playoff pool data:', err);
    document.getElementById('playoff-body').innerHTML = `<tr><td colspan="6">Failed to load data.</td></tr>`;
  });
