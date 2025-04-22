let map = L.map('map').setView([45.4215, -75.6972], 12); // Ottawa center
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);

let guessed = new Set();
let allStreets = new Map(); // name → { layers: [...], length: total length }
let totalLength = 0;
let guessedLength = 0;

fetch('Ottawa_Urban_Streets_3.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: { color: "#666", weight: 1 },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ROAD_NAME?.trim().toLowerCase();
        const length = feature.properties.SHAPE_Length || 0;

        if (!name || name.length < 2) return;

        totalLength += length;

        if (!allStreets.has(name)) {
          allStreets.set(name, { layers: [], length: 0 });
        }

        const entry = allStreets.get(name);
        entry.layers.push(layer);
        entry.length += length;
      }
    }).addTo(map);
  });

function updateProgress() {
  const percent = (guessedLength / totalLength) * 100;
  document.getElementById('progress').textContent =
    `${guessed.size} streets guessed! That's ${percent.toFixed(2)}% of the road network.`;
  document.getElementById('progress-bar').style.width = `${percent}%`;
}

document.getElementById('streetInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const input = e.target.value.trim().toLowerCase();
    if (allStreets.has(input) && !guessed.has(input)) {
      guessed.add(input);
      const { layers, length } = allStreets.get(input);
      guessedLength += length;
      layers.forEach(layer => {
        layer.setStyle({ color: "#007700", weight: 3 });
      });
      updateProgress();
    }
    e.target.value = '';
  }
});