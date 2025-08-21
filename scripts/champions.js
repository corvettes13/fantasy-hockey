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
        <td>${season.regularSeasonChampion?.team ?? ''}</td>
        <td>${season.regularSeasonChampion?.manager ?? ''}</td>
        <td>${season.regularSeasonChampion?.record ?? ''}</td>
      `;

      tbody.appendChild(row);
    });
  })
  .catch(err => {
    console.error('Error loading champions data:', err);
    document.getElementById('champions-body').innerHTML = `<tr><td colspan="9">Failed to load data.</td></tr>`;
  });
