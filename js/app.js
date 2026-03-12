// 1. Scene Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 100, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

// 2. Part Management Logic
const loader = new THREE.STLLoader();
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.4, metalness: 0.1 });

// Store loaded parts dynamically based on their category
let currentParts = {}; 

function loadPart(category, filepath) {
    // Construct the full path using the category folder and the nested filepath
    const path = `models/${category}/${filepath}`;
    
    loader.load(path, function (geometry) {
        // Remove the old part for this specific category if it exists
        if (currentParts[category]) {
            scene.remove(currentParts[category]);
        }

        geometry.center(); 
        const mesh = new THREE.Mesh(geometry, defaultMaterial);
        
        // Fix STL rotation
        mesh.rotation.x = -Math.PI / 2;
        
        // Save to our tracker and add to scene
        currentParts[category] = mesh;
        scene.add(mesh);
        
    }, undefined, function (error) {
        console.error(`Error loading ${filepath}:`, error);
    });
}

// 3. Dynamic UI Generation
async function loadCatalog() {
    try {
        // We append a timestamp to the fetch URL so the browser doesn't cache an old JSON file during testing
        const response = await fetch('catalog.json?' + new Date().getTime());
        const catalog = await response.json();
        
        const menuContainer = document.getElementById('dynamic-menus');
        
        // Loop through every category found in the JSON (e.g., "Frames")
        for (const category in catalog) {
            const files = catalog[category];
            if (files.length === 0) continue; // Skip empty folders
            
            // Create the wrapper div
            const groupDiv = document.createElement('div');
            groupDiv.className = 'control-group';
            
            // Create the label
            const label = document.createElement('label');
            label.textContent = `Select ${category}:`;
            groupDiv.appendChild(label);
            
            // Create the dropdown menu
            const select = document.createElement('select');
            select.dataset.category = category; // We store the category name here for the export function
            
            // Populate the dropdown with options
            files.forEach(filepath => {
                const option = document.createElement('option');
                option.value = filepath; // Keep the full nested path as the underlying value
                
                // Clean up the text for the UI (extracts just the filename and removes '.stl')
                const filenameOnly = filepath.split('/').pop().replace('.stl', '');
                option.textContent = filenameOnly;
                
                select.appendChild(option);
            });
            
            // When the user changes this dropdown, load the new part
            select.addEventListener('change', (e) => {
                loadPart(category, e.target.value);
            });
            
            groupDiv.appendChild(select);
            menuContainer.appendChild(groupDiv);
            
            // Automatically load the very first item in the list into the 3D viewer
            loadPart(category, select.value);
        }

    } catch (error) {
        console.error("Failed to load catalog.json", error);
    }
}

// Start the UI build process
loadCatalog();

// 4. ZIP Export Logic
document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    btn.innerText = "Packaging Files...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        
        // Find every dynamically generated dropdown menu on the page
        const selects = document.querySelectorAll('#dynamic-menus select');
        
        // Loop through them to fetch the actively selected files
        for (let i = 0; i < selects.length; i++) {
            const select = selects[i];
            const category = select.dataset.category;
            const filepath = select.value;
            
            // Extract just the filename so the final ZIP is a clean, flat list of files
            const filenameOnly = filepath.split('/').pop(); 
            
            // Fetch the raw STL data from the server
            const blob = await fetch(`models/${category}/${filepath}`).then(res => {
                if(!res.ok) throw new Error(`Could not fetch ${filepath}`);
                return res.blob();
            });

            // Add the file into the ZIP archive (e.g., "Frames_Wizard Plate - Back Left (Max).stl")
            zip.file(`${category}_${filenameOnly}`, blob);
        }

        // Generate the ZIP and trigger the download
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Custom_Polybar_Build.zip");

    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to package files. Are you running this via local server or GitHub?");
    }

    // Reset button
    btn.innerText = "Download Print Files (.zip)";
    btn.disabled = false;
});

// 5. Animation Loop & Resize handling
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

// 6. Color Picker Logic
const colorPicker = document.getElementById('filamentColor');

colorPicker.addEventListener('input', (e) => {
    const hexColor = e.target.value;
    
    // 1. Update the default material so any NEW parts the user selects load in this color
    defaultMaterial.color.set(hexColor);
    
    // 2. Loop through the currently loaded parts on the screen and update their color immediately
    for (const category in currentParts) {
        if (currentParts[category]) {
            currentParts[category].material.color.set(hexColor);
        }
    }
});