import requests
import csv
import json

sheets = {
    'sheet1': ''
} 

for sheet in list(sheets.keys()):
    response = requests.get(sheets[sheet])
    with open(f'{sheet}.csv', 'wb') as csvfile:
        csvfile.write(response.content)

def open_csv(path):
    trace_json = {}
    with open(path, 'r') as file:
        next(file)
        reader = csv.DictReader(file)
        next(reader)

        for row in reader:
            new_entry = {row['SITE NAME']: {k: [] if v == '[]' else v or None
                 for k, v in dict(row).items() if k != 'SITE NAME' and v != ''}}
            trace_json.update(new_entry)

    return trace_json

data = open_csv('sheet1.csv')

with open('NEW.json', 'w') as new_json:
    new_json.write(json.dumps(data))