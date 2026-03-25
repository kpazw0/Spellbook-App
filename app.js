let spells = []; 
// Load saved spells from the device, or start empty if there are none
let mySpellbook = JSON.parse(localStorage.getItem('myDndSpellbook')) || [];
function saveSpellbook() {
    localStorage.setItem('myDndSpellbook', JSON.stringify(mySpellbook));
}

// DOM Elements
const libraryContainer = document.getElementById('available-spells-container');
const spellbookContainer = document.getElementById('selected-spells-container');
const classFilter = document.getElementById('filter-class');
const schoolFilter = document.getElementById('filter-school');
const levelsContainer = document.getElementById('filter-levels');

// --- PASTE YOUR GOOGLE SHEETS LINK HERE ---
const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQ0A_h9IEFBs3ynXO6BQB7suVanIiB8M9YZkT_7z3b0mLqXi_hj-TZlUOF6Q96dPXa17ML0h-p92-j/pub?gid=1061697855&single=true&output=csv";

// 1. Navigation Logic
document.getElementById('nav-browse').addEventListener('click', (e) => switchTab(e, 'view-browse'));
document.getElementById('nav-spellbook').addEventListener('click', (e) => switchTab(e, 'view-spellbook'));

function switchTab(event, viewId) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(viewId).classList.add('active');
}

// 2. Load Spells
function loadSpellsFromSheet() {
    libraryContainer.innerHTML = "<p>Loading ancient texts from the cloud...</p>";

    Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            spells = results.data.map((row, index) => {
                const schoolName = row["School"] ? row["School"].trim() : "Unknown";
                return {
                    id: index + 1,
                    name: row["Spell"],
                    level: row["Level"],
                    school: schoolName,
                    dndClass: row["Class(es)"] ? row["Class(es)"].trim() : "Any", 
                    shortDesc: row["Short Description"] || "No short description provided.", 
                    range: row["Range"],
                    concentration: row["Concentration"],
                    description: row["Description"],
                    upcast: row["Upcast"],
                    icon: `assets/${schoolName.toLowerCase()}.svg` 
                };
            });

            populateFilters();
            renderLibrary();
        }
    });
}

// 3. Build the Filter Menus dynamically 
function populateFilters() {
    const allClasses = [];
    spells.forEach(s => {
        if (s.dndClass && s.dndClass !== "Any") {
            s.dndClass.split(',').forEach(c => allClasses.push(c.trim()));
        }
    });
    
    const uniqueClasses = [...new Set(allClasses)].sort();
    const uniqueSchools = [...new Set(spells.map(s => s.school))].sort();
    const uniqueLevels = [...new Set(spells.map(s => s.level))].sort();

    uniqueClasses.forEach(c => classFilter.add(new Option(c, c)));
    uniqueSchools.forEach(s => schoolFilter.add(new Option(s, s)));

    levelsContainer.innerHTML = '';
    uniqueLevels.forEach(level => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${level}" class="level-cb"> Lvl ${level}`;
        levelsContainer.appendChild(label);
    });

    classFilter.addEventListener('change', renderLibrary);
    schoolFilter.addEventListener('change', renderLibrary);
    document.querySelectorAll('.level-cb').forEach(cb => cb.addEventListener('change', renderLibrary));
}

// 4. Render Library 
// 4. Render Library
function renderLibrary() {
    libraryContainer.innerHTML = '';

    const selectedClass = classFilter.value;
    const selectedSchool = schoolFilter.value;
    const selectedLevels = Array.from(document.querySelectorAll('.level-cb:checked')).map(cb => cb.value);

    // 1. Filter the spells based on your sidebar choices
    let filteredSpells = spells.filter(spell => {
        const matchClass = selectedClass === "All" || spell.dndClass.includes(selectedClass);
        const matchSchool = selectedSchool === "All" || spell.school === selectedSchool;
        
        // This keeps your "Nothing selected = Show Everything" logic
        const matchLevel = selectedLevels.length === 0 || selectedLevels.includes(spell.level.toString());
        
        const notInSpellbook = !mySpellbook.some(s => s.id === spell.id);

        return matchClass && matchSchool && matchLevel && notInSpellbook;
    });

    // 2. NEW: The Double-Sort Engine (Level first, then Alphabetical)
    filteredSpells.sort((a, b) => {
        // Sort by Level (Numeric)
        if (parseInt(a.level) !== parseInt(b.level)) {
            return parseInt(a.level) - parseInt(b.level);
        }
        // If levels are the same, sort by Name (A-Z)
        return a.name.localeCompare(b.name);
    });

    // 3. Draw the sorted cards to the screen
    filteredSpells.forEach(spell => {
        const card = createCardHTML(spell, "add");
        libraryContainer.appendChild(card);
    });
}

// 5. The Flying Card Animation
function animateToSpellbook(spell, cardElement) {
    const cardRect = cardElement.getBoundingClientRect();
    const targetElement = document.getElementById('nav-spellbook');
    const targetRect = targetElement.getBoundingClientRect();

    const clone = cardElement.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.top = cardRect.top + 'px';
    clone.style.left = cardRect.left + 'px';
    clone.style.width = cardRect.width + 'px';
    clone.style.height = cardRect.height + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = '9999';
    clone.style.transition = 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)';
    clone.style.pointerEvents = 'none'; 

    document.body.appendChild(clone);
    cardElement.style.opacity = '0';
    clone.getBoundingClientRect();

    clone.style.top = targetRect.top + 'px';
    clone.style.left = (targetRect.left + (targetRect.width / 2) - (cardRect.width / 2)) + 'px';
    clone.style.transform = 'scale(0.1)';
    clone.style.opacity = '0';

    setTimeout(() => {
        clone.remove(); 
        addToSpellbook(spell); 
        renderLibrary(); 
    }, 500);
}

// 6. Render Spellbook
function renderSpellbook() {
    // Clear the container
    spellbookContainer.innerHTML = '';

    if (mySpellbook.length === 0) {
        spellbookContainer.innerHTML = '<p style="padding: 20px; color: #aaa;">Your spellbook is empty! Add some spells from the library.</p>';
        return;
    }

    // 1. Get the filter value
    const filterSelect = document.getElementById('spellbook-level-filter');
    const selectedLevel = filterSelect ? filterSelect.value : 'all';

    // 2. THE UPGRADE: Sort by Level FIRST, then by Name (A-Z)
    const sortedSpellbook = [...mySpellbook].sort((a, b) => {
        // If levels are different, sort by level number
        if (parseInt(a.level) !== parseInt(b.level)) {
            return parseInt(a.level) - parseInt(b.level);
        }
        // If levels are the same, sort alphabetically by name
        return a.name.localeCompare(b.name);
    });

    // 3. Group the spells by level
    const groupedSpells = {};
    sortedSpellbook.forEach(spell => {
        const lvl = spell.level.toString();
        if (!groupedSpells[lvl]) groupedSpells[lvl] = [];
        groupedSpells[lvl].push(spell);
    });

    // 4. Create sections for each level
    for (const [level, spells] of Object.entries(groupedSpells)) {
        
        // Filter logic
        if (selectedLevel !== 'all' && selectedLevel !== level) continue;

        const levelSection = document.createElement('div');
        levelSection.style.marginBottom = '40px';

        // Create the Header (e.g., "Cantrips" or "Level 1")
        const headerName = (level === '0') ? 'Cantrips' : `Level ${level}`;
        const header = document.createElement('h3');
        header.innerText = headerName;
        header.style.cssText = `
            border-bottom: 2px solid #555; 
            padding: 10px 20px; 
            color: #f5f5f5; 
            background: rgba(255, 255, 255, 0.05); 
            margin-bottom: 20px;
        `;
        
        levelSection.appendChild(header);

        // Create a grid for the cards
        const levelGrid = document.createElement('div');
        levelGrid.className = 'card-grid'; 

        spells.forEach(spell => {
            const card = createCardHTML(spell, 'remove');
            levelGrid.appendChild(card);
        });

        levelSection.appendChild(levelGrid);
        spellbookContainer.appendChild(levelSection);
    }
}

// 7. Universal Card Generator (3D Flip, Buttons, & Foldable Print)
function createCardHTML(spell, action) {
    const card = document.createElement('div');
    card.className = 'spell-card';
    card.dataset.school = spell.school; 
    
    const btnText = action === 'add' ? '➕ Add to Spellbook' : '❌ Remove Spell';

    // NEW LOGIC: Clean up the CSV data and pick the right emoji
    const rawConc = spell.concentration ? spell.concentration.toString().trim().toLowerCase() : '';
    const concIcon = (rawConc === 'yes' || rawConc === 'true' || rawConc === 'y') ? '✅' : '❌';

    card.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                <h3>${spell.name} <img src="${spell.icon}" class="spell-icon" alt="" onerror="this.style.display='none'" style="float:right; width:20px;"></h3>
                <div class="spell-stats">
                    <strong>Lvl:</strong> ${spell.level} | <strong>School:</strong> ${spell.school}<br>
                    <strong>Range:</strong> ${spell.range || 'N/A'} | <strong>Concentration:</strong> ${concIcon}
                </div>
                <div class="spell-desc">
                    <p>${spell.shortDesc}</p>
                </div>
                <p class="no-print" style="text-align:center; font-size:0.8em; color:#aaa; margin-bottom: 5px;"><em>Click card to flip</em></p>
                <button class="action-btn no-print">${btnText}</button>
            </div>

            <div class="card-back">
                <h3>${spell.name} (Details)</h3>
                <div class="spell-desc" style="font-size: 0.8em;">
                    <p>${spell.description}</p>
                    ${spell.upcast ? `<p style="border-top: 1px dashed #555; padding-top: 5px;"><strong>At Higher Levels:</strong> ${spell.upcast}</p>` : ''}
                </div>
                <p class="no-print" style="text-align:center; font-size:0.8em; color:#aaa; margin-bottom: 5px; margin-top: 10px;"><em>Click card to flip</em></p>
                <button class="action-btn no-print">${btnText}</button>
            </div>
        </div>
    `;

    // Click anywhere on the card to flip it
    card.addEventListener('click', () => {
        card.classList.toggle('is-flipped');
    });

    // Clicking the button runs the logic (and prevents the flip from triggering)
    const buttons = card.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (action === 'add') {
                animateToSpellbook(spell, card);
            } else {
                removeFromSpellbook(spell.id);
            }
        });
    });

    return card;
}

// 8. Actions
function addToSpellbook(spellToAdd) {
    if (!mySpellbook.some(spell => spell.id === spellToAdd.id)) {
        mySpellbook.push(spellToAdd);
        saveSpellbook(); // <--- NEW 
        renderSpellbook();            
    }
}

function removeFromSpellbook(spellId) {
    mySpellbook = mySpellbook.filter(spell => spell.id !== spellId);
    saveSpellbook(); // <--- NEW
    renderSpellbook(); 
    renderLibrary();
}

// Start
loadSpellsFromSheet();
renderSpellbook();