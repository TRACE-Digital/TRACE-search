import requests
import csv
import json

sheets = {
    'sheet1': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5B8RW3aFa--1VZf5Ix29fi9tZvCBjg9aOIBilrxqyHF94sNsKEafs0Se052C6Fos1vlHJI5Ln_3mT/pub?gid=0&single=true&output=csv'
} 

for sheet in list(sheets.keys()):
    response = requests.get(sheets[sheet])
    with open(f'{sheet}.csv', 'wb') as csvfile:
        csvfile.write(response.content)

def open_csv(path):
    '''return a list of dictionaries
    '''
    trace_json = {}
    with open(path, 'r') as file:
        next(file)
        reader = csv.DictReader(file)
        next(reader)
        # simple way to do the replacements, but do you really need to do this?

        for row in reader:
            new_entry = {row['SITE NAME']: {k: [] if v == '[]' else v or None
                 for k, v in dict(row).items() if k != 'SITE NAME' and v != ''}}
            trace_json.update(new_entry)

    return trace_json

data = open_csv('sheet1.csv')

with open('NEW.json', 'w') as new_json:
    new_json.write(json.dumps(data))