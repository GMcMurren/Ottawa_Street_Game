document.addEventListener('DOMContentLoaded', () => {
  const firebaseConfig = {
    apiKey: "AIzaSyAlXtXImG5XglMlYdkCpM0YroEiGhaiObc",
    authDomain: "ottawa-street-guessing.firebaseapp.com",
    projectId: "ottawa-street-guessing",
    storageBucket: "ottawa-street-guessing.firebasestorage.app",
    messagingSenderId: "364832541296",
    appId: "1:364832541296:web:8817df8fcc4d4f67b9c2b5",
    measurementId: "G-NHNTFEN1CT"
  };
  const map = L.map('map').setView([45.4215, -75.6972], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);

  let guessed = new Set();
  let guessedAltNames = [];
  let guessedAltNameSet = new Set();
  let altNameCasing = new Map();
  let allStreets = new Map();
  let totalLength = 0;
  let guessedLength = 0;
  let sortMode = 'recency';

  fetch("Ottawa_Urban_Streets_5000.json")
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: { color: "#666", weight: 1 },
        onEachFeature: (feature, layer) => {
          const name = normalizeStreetName(feature.properties.ROAD_NAME || "");
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
      
      document.getElementById('streetInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const input = normalizeStreetName(e.target.value);
          if (allStreets.has(input) && !guessed.has(input)) {
            guessed.add(input);
            const { layers, length, altNames } = allStreets.get(input);
            guessedLength += length;
    
            layers.forEach(layer => {
              layer.setStyle({ color: "#007700", weight: 3 });
              const fullName = layer.feature.properties.FULL_ROADN?.trim();
              if (fullName) {
                layer.bindTooltip(fullName, { permanent: false, direction: 'top' });
              }
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
            const currentUser = auth.currentUser;
            if (currentUser) {
              db.collection('users')
                .doc(currentUser.uid)
                .set({ guesses: Array.from(guessedAltNameSet) });
            }
          }
          e.target.value = '';
        }
      });
    });
  
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  document.getElementById('login-btn').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(result => {
    const user = result.user;
    console.log('Signed in:', user.displayName);

  }).catch(console.error);
  });

  auth.onAuthStateChanged(user => {
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
  
    if (user) {
      console.log('User signed in:', user.displayName);
  
      userInfoDiv.style.display = 'block';
      userNameSpan.textContent = `Logged in as ${user.displayName}`;
  
      const userDoc = db.collection('users').doc(user.uid);
  
      userDoc.get().then(doc => {
        if (doc.exists) {
          const savedGuesses = doc.data().guesses || [];
          savedGuesses.forEach(guess => {
            const normGuess = normalizeStreetName(guess);
            if (allStreets.has(normGuess) && !guessed.has(normGuess)) {
              guessed.add(normGuess);
              const { layers, length, altNames } = allStreets.get(normGuess);
              guessedLength += length;
  
              layers.forEach(layer => {
                layer.setStyle({ color: "#007700", weight: 3 });
                const fullName = layer.feature.properties.FULL_ROADN?.trim();
                if (fullName) {
                  layer.bindTooltip(fullName, { permanent: false, direction: 'top' });
                }
              });
  
              for (const alt of altNames) {
                const altLower = alt.toLowerCase();
                guessedAltNameSet.add(altLower);
                if (!altNameCasing.has(altLower)) {
                  altNameCasing.set(altLower, alt);
                }
                addToGuessedList(altLower);
              }
            }
          });
  
          updateProgress();
        }
      });
    } else {
      userInfoDiv.style.display = 'none';
      userNameSpan.textContent = '';
    }
  });
      
  function addToGuessedList(name) {
    if (!guessedAltNames.includes(name)) {
      guessedAltNames.push(name);
      renderGuessedList();
    }
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
    const button = document.getElementById('sort-toggle');
    button.textContent = `Sort by: ${capitalize(sortMode === 'recency' ? 'alphabetical' : 'recency')}`;
    renderGuessedList();
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  function normalizeStreetName(str){
    return str
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "");
  }
  
  document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
      console.log('User signed out.');
    }).catch(console.error);
  });
});
