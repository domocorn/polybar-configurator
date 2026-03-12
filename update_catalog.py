import os
import json

models_dir = 'models'
catalog = {}

# Find all top-level folders (these become your categories like 'Frames', 'Necks')
for category in os.listdir(models_dir):
    category_path = os.path.join(models_dir, category)
    
    if os.path.isdir(category_path):
        catalog[category] = []
        
        # os.walk digs recursively into every nested sub-folder
        for root, _, files in os.walk(category_path):
            for filename in files:
                if filename.lower().endswith('.stl'):
                    # Get the full file path
                    full_path = os.path.join(root, filename)
                    
                    # Make it relative to the category folder (e.g., 'subfolder/part.stl')
                    rel_path = os.path.relpath(full_path, category_path)
                    
                    # Force web-safe forward slashes for Windows users
                    web_path = rel_path.replace('\\', '/')
                    
                    catalog[category].append(web_path)

with open('catalog.json', 'w') as f:
    json.dump(catalog, f, indent=4)

print("Catalog updated successfully with nested files!")