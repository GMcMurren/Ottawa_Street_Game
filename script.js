document.addEventListener('DOMContentLoaded', () => {
  let map = L.map('map').setView([45.4215, -75.6972], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);

  let guessed = new Set();
  let guessedAltNames = [];
  let guessedAltNameSet = new Set();
  let altNameCasing = new Map(); // lowercase → original casing
  let allStreets = new Map();
  let totalLength = 0;
  let guessedLength = 0;
  let sortMode = 'recency';

  fetch('Ottawa_Urban_Streets_3.json')
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: { color: "#666", weight: 1 },
        onEachFeature: (feature, layer) => {
          const name = feature.properties.ROAD_NAME?.trim().toLowerCase();
          const altName = feature.properties.FULL_ROADN?.trim();
          const length = feature.properties.SHAPE_Leng || 0;

          if (!name || name.length < 2) return;

          totalLength += length;

          if (!allStreets.has(name)) {
            allStreets.set(name, { layers: [], length: 0, altNames: new Set() });
          }

          const entry = allStreets.get(name);
          entry.layers.push(layer);
          entry.length += length;

          if (altName) {
            entry.altNames.add(altName);
          }
        },
        renderer: L.canvas(),
      }).addTo(map);
    });

  function addToGuessedList(name) {
    guessedAltNames.push(name);
    renderGuessedList();
  }

  function updateProgress() {
    const percent = (guessedLength / totalLength) * 100;
    document.getElementById('progress').textContent =
      `${guessedAltNameSet.size} segments guessed! That's ${percent.toFixed(2)}% of the road network.`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  function renderGuessedList() {
    const list = document.getElementById('guessed-list');
    list.innerHTML = '';

    let sorted = [...guessedAltNames];
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => {
        const aText = altNameCasing.get(a) || a;
        const bText = altNameCasing.get(b) || b;
        return aText.localeCompare(bText);
      });
    } else {
      sorted.reverse();
    }

    for (const name of sorted) {
      const item = document.createElement('li');
      item.textContent = altNameCasing.get(name) || name;
      list.appendChild(item);
    }
  }

  document.getElementById('sort-toggle').addEventListener('click', () => {
    sortMode = sortMode === 'recency' ? 'alphabetical' : 'recency';
    const nextMode = sortMode === 'recency' ? 'alphabetical' : 'recency';
    document.getElementById('sort-toggle').textContent = `Sort by: ${capitalize(nextMode)}`;
    renderGuessedList();
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  document.getElementById('streetInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = e.target.value.trim().toLowerCase();
      if (allStreets.has(input) && !guessed.has(input)) {
        guessed.add(input);
        const { layers, length, altNames } = allStreets.get(input);
        guessedLength += length;

        layers.forEach(layer => {
          layer.setStyle({ color: "#007700", weight: 3 });
          altNames.forEach(alt => {
            const altLower = alt.toLowerCase();
            layer.bindTooltip(alt);
          });
        });

        for (const alt of altNames) {
          const altLower = alt.toLowerCase();
          if (!guessedAltNameSet.has(altLower)) {
            guessedAltNameSet.add(altLower);
          }
          if (!altNameCasing.has(altLower)) {
            altNameCasing.set(altLower, alt);
          }
          addToGuessedList(altLower);
        }

        updateProgress();
      }
      e.target.value = '';
    }
  });
});