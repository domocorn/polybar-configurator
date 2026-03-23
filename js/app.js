// ==========================================
// 1. IMPORTS & SCENE SETUP
// ==========================================
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // NEW IMPORT
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 5000); // Updated Far Plane
camera.position.set(0, 150, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

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
    'Mini': ['Core_Mini', 'Shared_Inputs', 'Shared_Necks'],
    'Max': ['Core_Mini', 'Core_Max', 'Shared_Inputs', 'Shared_Necks']
};

const assemblyOffsets = {
    'Core_Max': { x: 0, y: 0, z: 0 },
    'Shared_Necks': { x: 0, y: 0, z: 0 },
    'Addon_Headstock': { x: 0, y: 0, z: 0 }
};

const explodeOffsets = {
    // 1. FOLDER Defaults (fallback if specific file isn't listed)
    //'Core_Max': { x: 0, y: 0, z: -100 },
    //'Shared_Necks': { x: 0, y: 0, z: 100 },
    //'Addon_Frame': { x: 0, y: -150, z: 0 },
    //'Addon_Headstock': { x: 0, y: 0, z: 150 },

    // 2. FILE-SPECIFIC Overrides (matches exactly against the filename without .stl)
    // You can add exact STL names here to move individual pieces differently!
    // Example: 'PolybarMicroBuildPrint_(Unsaved)_Housing Parts_1_Housing Cap - Fret_1_Body1': { x: 0, y: 200, z: 50 },
    'PolybarMicroBuildPrint_StrumBar': { x: 0, y: 0, z: 100 },
    'PolybarMicroBuildPrint_Strum Bar Chassis': { x: 0, y: 0, z: 75 },
    'PolybarMicroBuildPrint_Micro Housing Top': { x: 0, y: 0, z: 50 },
    'PolybarMicroBuildPrint - Housing Cap - Fret': { x: -50, y: 0, z: 0 },
    'PolybarMicroBuildPrint - Housing Cap - Strum': { x: 50, y: 0, z: 0 },
};

const partRules = {
    // If you plan to export each fret as an individual file (e.g., Fret_1.stl, Fret_2.stl),
    // you don't need these rules. If you still import 1 fret and want to clone it, 
    // you will need to re-add the Z offsets here. For now, we spawn exactly as exported.
};

// ==========================================
// 3. ENGINE STATE & LOADING
// ==========================================
const stlLoader = new STLLoader();
const gltfLoader = new GLTFLoader(); // NEW LOADER INIT
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.4, metalness: 0.1 });

let globalCatalog = {};
let activeMeshes = [];

function clearScene() {
    activeMeshes.forEach(mesh => scene.remove(mesh));
    activeMeshes = [];
}

// Helper function to handle positioning for both STL and GLTF
function setupAndAddMesh(object3D, pos, catOffset, isExploded, expOff, category, filename) {
    const finalX = catOffset.x + pos.x;
    const finalY = catOffset.y + pos.y;
    const finalZ = catOffset.z + pos.z;

    object3D.userData.basePosition = { x: finalX, y: finalY, z: finalZ };
    object3D.userData.category = category;
    object3D.userData.filename = filename;

    // Start parts at their built location
    object3D.position.set(finalX, finalY, finalZ);

    // Set target position for lerp animation
    if (isExploded) {
        object3D.userData.targetPosition = { x: finalX + expOff.x, y: finalY + expOff.y, z: finalZ + expOff.z };
    } else {
        object3D.userData.targetPosition = { x: finalX, y: finalY, z: finalZ };
    }

    scene.add(object3D);
    activeMeshes.push(object3D);
}

function loadPart(category, filepath) {
    const path = `models/visual/${category}/${filepath}`;
    const filename = filepath.split('/').pop();
    const extension = filename.split('.').pop().toLowerCase(); // Grab the extension

    const positions = partRules[filename] || [{ x: 0, y: 0, z: 0 }];
    const catOffset = assemblyOffsets[category] || { x: 0, y: 0, z: 0 };
    const isExploded = document.getElementById('explodeToggle')?.checked;

    const baseFilename = filename.split('.')[0];
    const expOff = explodeOffsets[baseFilename] || explodeOffsets[category] || { x: 0, y: 0, z: 0 };

    if (extension === 'stl') {
        stlLoader.load(path, function (geometry) {
            positions.forEach(pos => {
                const mesh = new THREE.Mesh(geometry, defaultMaterial);
                // mesh.rotation.x = -Math.PI / 2; // COMMENTED OUT: If using native Fusion coords, you may not need to flip 90 degrees anymore depending on your up-axis.

                setupAndAddMesh(mesh, pos, catOffset, isExploded, expOff, category, baseFilename);
            });
        }, undefined, function (error) { console.error(`Error loading ${filepath}:`, error); });

    } else if (extension === 'glb' || extension === 'gltf') {
        gltfLoader.load(path, function (gltf) {
            positions.forEach(pos => {
                const model = gltf.scene.clone();

                // GLTFs come with their own materials baked in. 
                // This forces them to use your UI's Filament Color picker instead.
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = defaultMaterial;
                    }
                });

                // GLTFs usually handle up-axis better than STLs, so we skip the Math.PI/2 rotation here.
                setupAndAddMesh(model, pos, catOffset, isExploded, expOff, category, baseFilename);
            });
        }, undefined, function (error) { console.error(`Error loading ${filepath}:`, error); });
    }
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
        if (globalCatalog.visual && globalCatalog.visual[category]) {
            globalCatalog.visual[category].forEach(filepath => {
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

        for (const category in globalCatalog.visual) {
            if (!category.startsWith('Addon_')) continue;

            const files = globalCatalog.visual[category];
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
            if (globalCatalog.print && globalCatalog.print[category]) {
                globalCatalog.print[category].forEach(filepath => {
                    filesToFetch.push({ category, filepath });
                });
            }
        });

        const visibleGroups = document.querySelectorAll('.dynamic-group');
        visibleGroups.forEach(group => {
            if (group.style.display !== 'none') {
                const select = group.querySelector('select');
                const selectedVisualBase = select.value.split('/').pop().split('.')[0];

                if (globalCatalog.print && globalCatalog.print[select.dataset.category]) {
                    globalCatalog.print[select.dataset.category].forEach(filepath => {
                        const printBase = filepath.split('/').pop().split('.')[0];
                        // Export if the base filename matches, OR if there's only 1 master print file in this addon category
                        if (printBase === selectedVisualBase || globalCatalog.print[select.dataset.category].length === 1) {
                            filesToFetch.push({ category: select.dataset.category, filepath });
                        }
                    });
                }
            }
        });

        for (let i = 0; i < filesToFetch.length; i++) {
            const item = filesToFetch[i];
            const filenameOnly = item.filepath.split('/').pop();

            if (partRules[filenameOnly] && partRules[filenameOnly].length > 1) {
                instructionsText += `- ${filenameOnly}: Print ${partRules[filenameOnly].length} copies\n`;
                needsInstructions = true;
            }

            const timestamp = new Date().getTime();
            const blob = await fetch(`models/print/${item.category}/${item.filepath}?v=${timestamp}`).then(res => res.blob());
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
        const filename = mesh.userData.filename;

        // 1. Try file-specific offset, 2. Try folder category offset, 3. Default fallback (Zero)
        const expOff = explodeOffsets[filename] || explodeOffsets[cat] || { x: 0, y: 0, z: 0 };

        if (isExploded) {
            mesh.userData.targetPosition = {
                x: basePos.x + expOff.x,
                y: basePos.y + expOff.y,
                z: basePos.z + expOff.z
            };
        } else {
            mesh.userData.targetPosition = { x: basePos.x, y: basePos.y, z: basePos.z };
        }
    });
});

// ==========================================
// 8. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Smooth animation (lerp) for positions
    activeMeshes.forEach(mesh => {
        if (mesh.userData.targetPosition) {
            mesh.position.x += (mesh.userData.targetPosition.x - mesh.position.x) * 0.1;
            mesh.position.y += (mesh.userData.targetPosition.y - mesh.position.y) * 0.1;
            mesh.position.z += (mesh.userData.targetPosition.z - mesh.position.z) * 0.1;
        }
    });

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});