import os
import json

# The folder where your STLs live
models_dir = 'models'
catalog = {}

# Walk through the models directory
for category in os.listdir(models_dir):
    category_path = os.path.join(models_dir, category)
    
    # Check if it's a folder (like 'bodies' or 'necks')
    if os.path.isdir(category_path):
        catalog[category] = []
        
        # Find all STLs inside
        for filename in os.listdir(category_path):
            if filename.lower().endswith('.stl'):
                catalog[category].append(filename)

# Save the map to a JSON file
with open('catalog.json', 'w') as f:
    json.dump(catalog, f, indent=4)

print("Catalog updated successfully!")