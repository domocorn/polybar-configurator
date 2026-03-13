// ==========================================
// 1. IMPORTS & SCENE SETUP
// ==========================================
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 5000);
camera.position.set(0, 150, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// Notice: We drop the "THREE." prefix here because of the module import
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

// ==========================================
// 2. RECIPES, RULES & OFFSETS
// ==========================================
const buildRecipes = {
    'Micro': ['Core_Micro', 'Shared_Inputs'],
    'Mini':  ['Core_Mini', 'Shared_Inputs', 'Shared_Necks'],
    'Max':   ['Core_Mini', 'Core_Max', 'Shared_Inputs', 'Shared_Necks']
};

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

const partRules = {
    'fret.stl': [
        { x: 0, y: 0, z: 0 },   
        { x: 0, y: 0, z: 25 },  
        { x: 0, y: 0, z: 50 },  
        { x: 0, y: 0, z: 75 },  
        { x: 0, y: 0, z: 100 }  
    ]
};

// ==========================================
// 3. ENGINE STATE & LOADING
// ==========================================
// Notice: We drop the "THREE." prefix here too
const loader = new STLLoader();
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.4, metalness: 0.1 });

let globalCatalog = {};   
let activeMeshes = [];    

function clearScene() {
    activeMeshes.forEach(mesh => scene.remove(mesh));
    activeMeshes = [];
}

function loadPart(category, filepath) {
    const path = `models/${category}/${filepath}`;
    const filename = filepath.split('/').pop(); 
    
    loader.load(path, function (geometry) {
        
        // COMMENTED OUT: This preserves your STL positional data from CAD!
        geometry.center(); 
        
        const positions = partRules[filename] || [{ x: 0, y: 0, z: 0 }];
        const catOffset = assemblyOffsets[category] || { x: 0, y: 0, z: 0 };
        const isExploded = document.getElementById('explodeToggle')?.checked;
        const expOff = explodeOffsets[category] || { x: 0, y: 150, z: 0 };

        positions.forEach(pos => {
            const mesh = new THREE.Mesh(geometry, defaultMaterial);
            mesh.rotation.x = -Math.PI / 2;
            
            const finalX = catOffset.x + pos.x;
            const finalY = catOffset.y + pos.y;
            const finalZ = catOffset.z + pos.z;

            mesh.userData.basePosition = { x: finalX, y: finalY, z: finalZ };
            mesh.userData.category = category;

            if (isExploded) {
                mesh.position.set(finalX + expOff.x, finalY + expOff.y, finalZ + expOff.z);
            } else {
                mesh.position.set(finalX, finalY, finalZ);
            }

            scene.add(mesh);
            activeMeshes.push(mesh); 
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

    const activeCoreFolders = buildRecipes[buildType] || [];
    activeCoreFolders.forEach(category => {
        if (globalCatalog[category]) {
            globalCatalog[category].forEach(filepath => {
                loadPart(category, filepath);
            });
        }
    });

    const allGroups = document.querySelectorAll('.dynamic-group');
    allGroups.forEach(group => {
        const category = group.dataset.category;
        const select = group.querySelector('select');
        let shouldShowDropdown = false;

        if (showFrame && category === 'Addon_Frame') shouldShowDropdown = true;
        if (showHeadstock && category === 'Addon_Headstock') shouldShowDropdown = true;

        group.style.display = shouldShowDropdown ? 'block' : 'none';

        if (shouldShowDropdown && select.value) {
            loadPart(category, select.value);
        }
    });
}

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
        
        for (const category in globalCatalog) {
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
            
            select.addEventListener('change', updateSceneAndUI);
            
            groupDiv.appendChild(select);
            menuContainer.appendChild(groupDiv);
        }
        
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

        activeCoreFolders.forEach(category => {
            if (globalCatalog[category]) {
                globalCatalog[category].forEach(filepath => {
                    filesToFetch.push({ category, filepath });
                });
            }
        });

        const visibleGroups = document.querySelectorAll('.dynamic-group');
        visibleGroups.forEach(group => {
            if (group.style.display !== 'none') {
                const select = group.querySelector('select');
                filesToFetch.push({ category: select.dataset.category, filepath: select.value });
            }
        });

        for (let i = 0; i < filesToFetch.length; i++) {
            const item = filesToFetch[i];
            const filenameOnly = item.filepath.split('/').pop(); 
            
            if (partRules[filenameOnly] && partRules[filenameOnly].length > 1) {
                instructionsText += `- ${filenameOnly}: Print ${partRules[filenameOnly].length} copies\n`;
                needsInstructions = true;
            }

            const blob = await fetch(`models/${item.category}/${item.filepath}`).then(res => res.blob());
            zip.file(`${item.category}_${filenameOnly}`, blob);
        }

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