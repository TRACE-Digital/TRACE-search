import json
import os

problematic = []

base_dir = "/home/chris/Purdue/cs407/TRACE-search/src/search/stats/"
tests = [file for file in os.listdir(base_dir) if "test" in file]

for file in tests:
    filePath = base_dir + file
    with open(filePath, 'r') as test:
        sites = json.load(test)
        for site in sites:
            if site[0] not in problematic:
                problematic.append(site[0])

print(problematic)
print(len(problematic))

site_dir = "/home/chris/Purdue/cs407/TRACE-search/src/sites/"

