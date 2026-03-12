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

// We keep track of what is currently loaded so we can remove it before adding a new part
let currentParts = {
    body: null,
    neck: null
};

function loadPart(category, filename) {
    const path = `models/${category === 'body' ? 'bodies' : 'necks'}/${filename}`;
    
    loader.load(path, function (geometry) {
        // Remove the old part if it exists
        if (currentParts[category]) {
            scene.remove(currentParts[category]);
        }

        geometry.center(); // Center the geometry for preview
        const mesh = new THREE.Mesh(geometry, defaultMaterial);
        
        // Fix STL rotation
        mesh.rotation.x = -Math.PI / 2;
        
        // Save to our tracker and add to scene
        currentParts[category] = mesh;
        scene.add(mesh);
        
    }, undefined, function (error) {
        console.error(`Error loading ${filename}:`, error);
    });
}

// 3. UI Event Listeners
const bodySelect = document.getElementById('bodySelect');
const neckSelect = document.getElementById('neckSelect');

bodySelect.addEventListener('change', (e) => loadPart('body', e.target.value));
neckSelect.addEventListener('change', (e) => loadPart('neck', e.target.value));

// Load initial default parts on startup
loadPart('body', bodySelect.value);
loadPart('neck', neckSelect.value);

// 4. ZIP Export Logic
document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    btn.innerText = "Packaging Files...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        
        // Get current selections
        const selectedBody = bodySelect.value;
        const selectedNeck = neckSelect.value;

        // Fetch the raw STL data from the server/folder
        const bodyBlob = await fetch(`models/bodies/${selectedBody}`).then(res => res.blob());
        const neckBlob = await fetch(`models/necks/${selectedNeck}`).then(res => res.blob());

        // Add them to the ZIP archive
        zip.file(`Polybar_Body_${selectedBody}`, bodyBlob);
        zip.file(`Polybar_Neck_${selectedNeck}`, neckBlob);

        // Generate the ZIP and download
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Custom_Polybar_Build.zip");

    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to package files. Are you running this on a local server?");
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