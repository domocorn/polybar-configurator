import os
import json

base_dir = 'models'
catalog = { 'visual': {}, 'print': {} }

# Parse both visual and print folders
for env in ['visual', 'print']:
    env_dir = os.path.join(base_dir, env)
    if os.path.exists(env_dir):
        for category in os.listdir(env_dir):
            category_path = os.path.join(env_dir, category)
            
            if os.path.isdir(category_path):
                catalog[env][category] = []
                
                for root, _, files in os.walk(category_path):
                    for filename in files:
                        if filename.lower().endswith(('.stl', '.glb', '.gltf', '.3mf')):
                            full_path = os.path.join(root, filename)
                            rel_path = os.path.relpath(full_path, category_path)
                            web_path = rel_path.replace('\\', '/')
                            catalog[env][category].append(web_path)

with open('catalog.json', 'w') as f:
    json.dump(catalog, f, indent=4)

print("Catalog updated successfully for visual and print files!")