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

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// --- PREMIUM STUDIO LIGHTING ---
// Soft global illumination (Sky color, Ground color, Intensity)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// Key Light (Main bright sunlight)
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(100, 150, 100);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 1000;
keyLight.shadow.camera.left = -300;
keyLight.shadow.camera.right = 300;
keyLight.shadow.camera.top = 300;
keyLight.shadow.camera.bottom = -300;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Rim Light (Cool blue backlight to make geometry pop)
const rimLight = new THREE.SpotLight(0x77b5fe, 2.5);
rimLight.position.set(-150, 100, -200);
rimLight.angle = Math.PI / 4;
rimLight.penumbra = 0.5;
scene.add(rimLight);

// ==========================================
// 2. RECIPES, RULES & OFFSETS
// ==========================================
const buildRecipes = {
    'Micro': ['Core_Micro', 'Shared_Inputs'],
    'Mini': ['Core_Mini+Max', 'Shared_Inputs', 'Shared_Necks'],
    'Max': ['Core_Mini+Max', 'Shared_Inputs', 'Shared_Necks']
};

const assemblyOffsets = {
    'Core_Max': { x: 0, y: 0, z: 0 },
    'Shared_Necks': { x: 0, y: 0, z: 0 },
    'Addon_Headstock': { x: 0, y: 0, z: 0 }
};

const explodeRules = [
    // --- EXACT PART KEYWORDS ---
    // Make sure more specific names come first! e.g., 'Strumbar Chassis' before 'Strumbar'
    { keywords: ['Housing Top', 'Housing - Top'], offset: { x: 0, y: 0, z: 50 } },
    { keywords: ['Strum Bar Chassis', 'Strum Chassis', 'Action Button Chassis', 'Joystick', 'Stop Plate', 'Pivot Pin'], offset: { x: 0, y: 0, z: 75 } },
    { keywords: ['StrumBar', 'Strum Bar', 'Action Button', 'Accessory Chassis'], offset: { x: 0, y: 0, z: 100 } },
    { keywords: ['Fret Insert'], offset: { x: 0, y: 0, z: 100 } },
    { keywords: ['Fret Window'], offset: { x: 0, y: 0, z: 115 } },
    { keywords: ['Color Chip'], offset: { x: 0, y: 0, z: 130 } },
    { keywords: ['Cap - Fret', 'Cap Fret'], offset: { x: -50, y: 0, z: 0 } },
    { keywords: ['Cap - Strum', 'Cap Strum'], offset: { x: 50, y: 0, z: 0 } },

    // --- NAMING CONVENTION TAGS ---
    // Drop these tags into any filename to forcefully override its explosion distance
    { keywords: ['_ExpY100'], offset: { x: 0, y: 100, z: 0 } },
    { keywords: ['_ExpY75'], offset: { x: 0, y: 75, z: 0 } },
    { keywords: ['_ExpY50'], offset: { x: 0, y: 50, z: 0 } },
    { keywords: ['_ExpX50'], offset: { x: 50, y: 0, z: 0 } },
    { keywords: ['_ExpX-50'], offset: { x: -50, y: 0, z: 0 } },
    { keywords: ['_ExpZ50'], offset: { x: 0, y: 0, z: 50 } },
    { keywords: ['_ExpZ-50'], offset: { x: 0, y: 0, z: -50 } }
];

const partRules = {
    // If you plan to export each fret as an individual file (e.g., Fret_1.stl, Fret_2.stl),
    // you don't need these rules. If you still import 1 fret and want to clone it, 
    // you will need to re-add the Z offsets here. For now, we spawn exactly as exported.
};

// ==========================================
// 2.5 DYNAMIC SHIFT OFFSETS (For Extensions)
// ==========================================
// Define how pieces should translate to "close the gap" or "make room" when modular extensions are toggled.
// Provide the names of categories or exact filenames that need to move, and the distance they slide.
const dynamicShifts = [
    {
        id: 'ExtShort',
        isActive: () => {
            const buildType = document.querySelector('input[name="buildType"]:checked').value;
            return buildType === 'Max' || (buildType === 'Mini' && document.getElementById('toggleExtShort')?.checked);
        },
        keywords: ['Fret', 'Neck', 'Headstock', '_Slide'], // Any file containing these words will slide
        offset: { x: -85, y: 0, z: 0 } // CHANGE THIS NUMBER to the exact length of the Short Extension
    },
    {
        id: 'ExtLong',
        isActive: () => {
            const buildType = document.querySelector('input[name="buildType"]:checked').value;
            return buildType === 'Max' || (buildType === 'Mini' && document.getElementById('toggleExtLong')?.checked);
        },
        keywords: ['Fret', 'Neck', 'Headstock', '_Slide'], // Any file containing these words will slide
        offset: { x: -157, y: 0, z: 0 } // CHANGE THIS NUMBER to the exact length of the Long Extension
    },
    {
        id: 'Close_Short_Gap',
        isActive: () => {
            const buildType = document.querySelector('input[name="buildType"]:checked').value;
            if (buildType === 'Max' || buildType === 'Micro') return false; // Max has both, Micro has none

            const isShort = document.getElementById('toggleExtShort')?.checked;
            const isLong = document.getElementById('toggleExtLong')?.checked;

            return isLong && !isShort; // Only trigger if Long is checked AND Short is empty
        },
        keywords: ['Long Extension'],
        // Pulls the Long Extension backwards to dock with the Base Chassis
        offset: { x: 85, y: 0, z: 0 }
    }
];

// ==========================================
// 3. ENGINE STATE & LOADING
// ==========================================
const stlLoader = new STLLoader();
const gltfLoader = new GLTFLoader(); // NEW LOADER INIT

// Upgraded to a highly realistic physical material
const defaultMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x909090,
    roughness: 0.5,
    metalness: 0.1,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2
});

let globalCatalog = {};
let activeMeshes = [];

function clearScene() {
    activeMeshes.forEach(mesh => scene.remove(mesh));
    activeMeshes = [];
}

// Helper function to handle positioning for both STL and GLTF
function setupAndAddMesh(object3D, pos, catOffset, isExploded, expOff, category, filename) {
    let activeShiftX = 0, activeShiftY = 0, activeShiftZ = 0;

    // Apply any dynamic shift rules based on active UI extensions
    dynamicShifts.forEach(shiftRule => {
        if (shiftRule.isActive()) {
            const shouldShift = shiftRule.keywords.some(kw => filename.includes(kw) || category.includes(kw));
            if (shouldShift) {
                activeShiftX += shiftRule.offset.x;
                activeShiftY += shiftRule.offset.y;
                activeShiftZ += shiftRule.offset.z;
            }
        }
    });

    const finalX = catOffset.x + pos.x + activeShiftX;
    const finalY = catOffset.y + pos.y + activeShiftY;
    const finalZ = catOffset.z + pos.z + activeShiftZ;

    object3D.userData.basePosition = { x: finalX, y: finalY, z: finalZ };
    object3D.userData.explodeTarget = {
        x: finalX + expOff.x,
        y: finalY + expOff.y,
        z: finalZ + expOff.z
    };
    object3D.userData.category = category;
    object3D.userData.filename = filename;

    // Enable Shadows
    object3D.castShadow = true;
    object3D.receiveShadow = true;

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

    let expOff = { x: 0, y: 0, z: 0 };
    for (const rule of explodeRules) {
        if (rule.keywords.some(kw => filename.includes(kw) || category.includes(kw))) {
            expOff = { x: rule.offset.x, y: rule.offset.y, z: rule.offset.z };
            break;
        }
    }

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
    const variantType = document.querySelector('input[name="variantType"]:checked')?.value || 'USK';
    const showFrame = document.getElementById('toggleFrame').checked;
    const showHeadstock = document.getElementById('toggleHeadstock').checked;

    // Toggle extension UI visibility based on Micro/Mini/Max
    const extGroup = document.getElementById('extensions-group');
    if (extGroup) extGroup.style.display = (buildType === 'Mini') ? 'block' : 'none';

    // Figure out if extensions are active (Max forces both to be true, Micro forces both to false)
    const isShortExtActive = (buildType === 'Max') || (buildType === 'Mini' && document.getElementById('toggleExtShort')?.checked);
    const isLongExtActive = (buildType === 'Max') || (buildType === 'Mini' && document.getElementById('toggleExtLong')?.checked);

    const activeCoreFolders = [...(buildRecipes[buildType] || [])];

    // Add unified Extensions folder if any extension is active
    if (isShortExtActive || isLongExtActive) activeCoreFolders.push('Extensions');

    // Define Excluded Variants so we don't load rival UI pieces
    const allVariants = ['USK', 'Handwire', 'DIYPCB'];
    const excludeVariants = allVariants.filter(v => v !== variantType);

    activeCoreFolders.forEach(category => {
        if (globalCatalog.visual && globalCatalog.visual[category]) {
            globalCatalog.visual[category].forEach(filepath => {

                // If it's the consolidated Extensions folder, filter out the ones we didn't ask for
                if (category === 'Extensions') {
                    if (filepath.includes('Short Extension') && !isShortExtActive) return;
                    if (filepath.includes('Long Extension') && !isLongExtActive) return;
                }

                // If the filepath contains a rival variant keyword, skip loading it!
                const isExcluded = excludeVariants.some(v => filepath.includes(v));
                if (!isExcluded) {
                    loadPart(category, filepath);
                }
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

document.querySelectorAll('input[name="buildType"]').forEach(r => r.addEventListener('change', (e) => {
    // If switching away from Mini, optionally uncheck the boxes so they are fresh if returned to
    if (e.target.value !== 'Mini') {
        const shortExt = document.getElementById('toggleExtShort');
        const longExt = document.getElementById('toggleExtLong');
        if (shortExt) shortExt.checked = false;
        if (longExt) longExt.checked = false;
    }
    updateSceneAndUI();
}));
document.querySelectorAll('input[name="variantType"]')?.forEach(r => r.addEventListener('change', updateSceneAndUI));
document.getElementById('toggleExtShort')?.addEventListener('change', updateSceneAndUI);
document.getElementById('toggleExtLong')?.addEventListener('change', updateSceneAndUI);
document.getElementById('toggleFrame')?.addEventListener('change', updateSceneAndUI);
document.getElementById('toggleHeadstock')?.addEventListener('change', updateSceneAndUI);

document.getElementById('explodeToggle')?.addEventListener('change', function () {
    const isExploded = this.checked;
    activeMeshes.forEach(mesh => {
        if (isExploded && mesh.userData.explodeTarget) {
            mesh.userData.targetPosition = mesh.userData.explodeTarget;
        } else if (mesh.userData.basePosition) {
            mesh.userData.targetPosition = mesh.userData.basePosition;
        }
    });
});

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
        const variantType = document.querySelector('input[name="variantType"]:checked')?.value || 'USK';

        const isShortExtActive = (buildType === 'Max') || (buildType === 'Mini' && document.getElementById('toggleExtShort')?.checked);
        const isLongExtActive = (buildType === 'Max') || (buildType === 'Mini' && document.getElementById('toggleExtLong')?.checked);

        const activeCoreFolders = [...(buildRecipes[buildType] || [])];

        if (isShortExtActive || isLongExtActive) activeCoreFolders.push('Extensions');

        const allVariants = ['USK', 'Handwire', 'DIYPCB'];
        const excludeVariants = allVariants.filter(v => v !== variantType);

        activeCoreFolders.forEach(category => {
            if (globalCatalog.print && globalCatalog.print[category]) {
                globalCatalog.print[category].forEach(filepath => {

                    // Filter extensions by selection state if we are inside the extensions list
                    if (category === 'Extensions') {
                        if (filepath.includes('Short Extension') && !isShortExtActive) return;
                        if (filepath.includes('Long Extension') && !isLongExtActive) return;
                    }

                    // Only fetch if it doesn't contain rival variant text
                    const isExcluded = excludeVariants.some(v => filepath.includes(v));
                    if (!isExcluded) {
                        filesToFetch.push({ category, filepath });
                    }
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