// ==========================================
// 1. SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 150, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

// ==========================================
// 2. RECIPES, RULES & OFFSETS
// ==========================================
// Defines which folders load entirely automatically based on the radio button
const buildRecipes = {
    'Micro': ['Core_Micro', 'Shared_Inputs'],
    'Mini':  ['Core_Mini', 'Shared_Inputs', 'Shared_Necks'],
    'Max':   ['Core_Mini', 'Core_Max', 'Shared_Inputs', 'Shared_Necks']
};

// Assembly offsets for snapping whole folders together
const assemblyOffsets = {
    'Core_Max': { x: 0, y: 0, z: -100 },
    'Shared_Necks': { x: 0, y: 0, z: 150 },
    'Addon_Headstock': { x: 0, y: 0, z: 300 }
};

const explodeOffsets = {
    'Core_Max': { x: 0, y: 0, z: -100 },
    'Shared_Necks': { x: 0, y: 0, z: 100 },
    'Addon_Frame': { x: 0, y: -150, z: 0 }, 
    'Addon_Headstock': { x: 0, y: 0, z: 150 }
};

// DUPLICATION RULES: If a file needs multiple copies, define their relative coordinates here.
// IMPORTANT: Update 'fret.stl' to match your actual fret filename!
const partRules = {
    'fret.stl': [
        { x: 0, y: 0, z: 0 },   // Fret 1 (Green)
        { x: 0, y: 0, z: 25 },  // Fret 2 (Red)
        { x: 0, y: 0, z: 50 },  // Fret 3 (Yellow)
        { x: 0, y: 0, z: 75 },  // Fret 4 (Blue)
        { x: 0, y: 0, z: 100 }  // Fret 5 (Orange)
    ],
    // Add other duplicates here if needed (e.g., 'start_button.stl': [ {x:0...}, {x:20...} ])
};

// ==========================================
// 3. ENGINE STATE & LOADING
// ==========================================
const loader = new THREE.STLLoader();
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.4, metalness: 0.1 });

let globalCatalog = {};   // Stores the JSON map
let activeMeshes = [];    // Keeps track of what is currently on screen so we can clear it

// Clears the 3D scene completely
function clearScene() {
    activeMeshes.forEach(mesh => scene.remove(mesh));
    activeMeshes = [];
}

// Loads a part and handles any duplication rules
function loadPart(category, filepath) {
    const path = `models/${category}/${filepath}`;
    const filename = filepath.split('/').pop(); // Gets just "fret.stl"
    
    loader.load(path, function (geometry) {
        
        // PRO TIP: If you exported your STLs from CAD using "Global Origins", 
        // delete or comment out the line below. They will snap together automatically!
        geometry.center(); 
        
        // Check if this part has duplication rules. If not, just spawn 1 at [0,0,0]
        const positions = partRules[filename] || [{ x: 0, y: 0, z: 0 }];
        const catOffset = assemblyOffsets[category] || { x: 0, y: 0, z: 0 };
        const isExploded = document.getElementById('explodeToggle')?.checked;
        const expOff = explodeOffsets[category] || { x: 0, y: 150, z: 0 };

        // Loop through the rules and spawn the meshes
        positions.forEach(pos => {
            const mesh = new THREE.Mesh(geometry, defaultMaterial);
            mesh.rotation.x = -Math.PI / 2;
            
            // Calculate final position (Category Offset + Duplication Rule Offset)
            const finalX = catOffset.x + pos.x;
            const finalY = catOffset.y + pos.y;
            const finalZ = catOffset.z + pos.z;

            // Store the base position inside the mesh for the Explode toggle to reference
            mesh.userData.basePosition = { x: finalX, y: finalY, z: finalZ };
            mesh.userData.category = category;

            if (isExploded) {
                mesh.position.set(finalX + expOff.x, finalY + expOff.y, finalZ + expOff.z);
            } else {
                mesh.position.set(finalX, finalY, finalZ);
            }

            scene.add(mesh);
            activeMeshes.push(mesh); // Save to our state tracker
        });
        
    }, undefined, function (error) {
        console.error(`Error loading ${filepath}:`, error);
    });
}

// ==========================================
// 4. UI & SCENE UPDATER
// ==========================================
function updateSceneAndUI() {
    clearScene();

    const buildType = document.querySelector('input[name="buildType"]:checked').value;
    const showFrame = document.getElementById('toggleFrame').checked;
    const showHeadstock = document.getElementById('toggleHeadstock').checked;

    // 1. AUTO-LOAD CORE FOLDERS
    const activeCoreFolders = buildRecipes[buildType] || [];
    activeCoreFolders.forEach(category => {
        if (globalCatalog[category]) {
            // Load EVERY file inside this core folder
            globalCatalog[category].forEach(filepath => {
                loadPart(category, filepath);
            });
        }
    });

    // 2. HANDLE ADD-ON DROPDOWNS
    const allGroups = document.querySelectorAll('.dynamic-group');
    allGroups.forEach(group => {
        const category = group.dataset.category;
        const select = group.querySelector('select');
        let shouldShowDropdown = false;

        // Only show dropdowns for optional Add-ons if their checkbox is ticked
        if (showFrame && category === 'Addon_Frame') shouldShowDropdown = true;
        if (showHeadstock && category === 'Addon_Headstock') shouldShowDropdown = true;

        group.style.display = shouldShowDropdown ? 'block' : 'none';

        // If the dropdown is visible, load the specific part currently selected in it
        if (shouldShowDropdown && select.value) {
            loadPart(category, select.value);
        }
    });
}

// Attach listeners to trigger scene updates
document.querySelectorAll('input[name="buildType"]').forEach(r => r.addEventListener('change', updateSceneAndUI));
document.getElementById('toggleFrame')?.addEventListener('change', updateSceneAndUI);
document.getElementById('toggleHeadstock')?.addEventListener('change', updateSceneAndUI);

// ==========================================
// 5. CATALOG INITIALIZATION
// ==========================================
async function loadCatalog() {
    try {
        const response = await fetch('catalog.json?' + new Date().getTime());
        globalCatalog = await response.json();
        const menuContainer = document.getElementById('dynamic-menus');
        
        // Build the dropdowns for the Add-ons, but leave them hidden initially
        for (const category in globalCatalog) {
            // We only build dropdown menus for Add-ons now. Core files load automatically.
            if (!category.startsWith('Addon_')) continue; 

            const files = globalCatalog[category];
            if (files.length === 0) continue; 
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'control-group dynamic-group'; 
            groupDiv.dataset.category = category; 
            
            const label = document.createElement('label');
            label.textContent = `Select ${category.replace(/_/g, ' ')}:`;
            groupDiv.appendChild(label);
            
            const select = document.createElement('select');
            select.dataset.category = category; 
            
            files.forEach(filepath => {
                const option = document.createElement('option');
                option.value = filepath; 
                option.textContent = filepath.split('/').pop().replace('.stl', '');
                select.appendChild(option);
            });
            
            // When an Add-on dropdown changes, reload the scene to reflect the new part
            select.addEventListener('change', updateSceneAndUI);
            
            groupDiv.appendChild(select);
            menuContainer.appendChild(groupDiv);
        }
        
        // Trigger the initial load
        updateSceneAndUI();

    } catch (error) {
        console.error("Failed to load catalog.json", error);
    }
}
loadCatalog();

// ==========================================
// 6. SMART ZIP EXPORT & INSTRUCTIONS
// ==========================================
document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    btn.innerText = "Packaging Files...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        let filesToFetch = [];
        let instructionsText = "POLYBAR SYSTEM - CUSTOM BUILD INSTRUCTIONS\n==========================================\n\nPRINT QUANTITIES:\n";
        let needsInstructions = false;

        const buildType = document.querySelector('input[name="buildType"]:checked').value;
        const activeCoreFolders = buildRecipes[buildType] || [];

        // 1. Queue all core files
        activeCoreFolders.forEach(category => {
            if (globalCatalog[category]) {
                globalCatalog[category].forEach(filepath => {
                    filesToFetch.push({ category, filepath });
                });
            }
        });

        // 2. Queue selected Add-ons
        const visibleGroups = document.querySelectorAll('.dynamic-group');
        visibleGroups.forEach(group => {
            if (group.style.display !== 'none') {
                const select = group.querySelector('select');
                filesToFetch.push({ category: select.dataset.category, filepath: select.value });
            }
        });

        // 3. Fetch files and generate instructions
        for (let i = 0; i < filesToFetch.length; i++) {
            const item = filesToFetch[i];
            const filenameOnly = item.filepath.split('/').pop(); 
            
            // Check if this part needs multiple prints
            if (partRules[filenameOnly] && partRules[filenameOnly].length > 1) {
                instructionsText += `- ${filenameOnly}: Print ${partRules[filenameOnly].length} copies\n`;
                needsInstructions = true;
            }

            const blob = await fetch(`models/${item.category}/${item.filepath}`).then(res => res.blob());
            zip.file(`${item.category}_${filenameOnly}`, blob);
        }

        // Add the instruction text file to the ZIP if there are multiples required
        if (needsInstructions) {
            instructionsText += "\nHappy Printing!\n- The Polybar Configurator";
            zip.file("Print_Instructions.txt", instructionsText);
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Custom_Polybar_Build.zip");

    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to package files. Ensure your local server is running.");
    }

    btn.innerText = "Download Print Files (.zip)";
    btn.disabled = false;
});

// ==========================================
// 7. COLOR & EXPLODE TOGGLES
// ==========================================
document.getElementById('filamentColor')?.addEventListener('input', (e) => {
    const hexColor = e.target.value;
    defaultMaterial.color.set(hexColor);
    activeMeshes.forEach(mesh => mesh.material.color.set(hexColor));
});

document.getElementById('explodeToggle')?.addEventListener('change', (e) => {
    const isExploded = e.target.checked;
    activeMeshes.forEach(mesh => {
        const basePos = mesh.userData.basePosition;
        const cat = mesh.userData.category;
        
        if (isExploded) {
            const expOff = explodeOffsets[cat] || { x: 0, y: 150, z: 0 };
            mesh.position.set(basePos.x + expOff.x, basePos.y + expOff.y, basePos.z + expOff.z);
        } else {
            mesh.position.set(basePos.x, basePos.y, basePos.z);
        }
    });
});

// ==========================================
// 8. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});