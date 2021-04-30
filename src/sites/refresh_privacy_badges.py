import json
import requests
import re

from pprint import pprint

TRACE_JSON = "trace.json"
SHERLOCK_JSON = "sherlock.json"

ratings = ["A", "B", "C", "D", "E"]

# https://stackoverflow.com/questions/3173320/text-progress-bar-in-the-console
# Print iterations progress
def printProgressBar (iteration, total, prefix = '', suffix = '', decimals = 1, length = 100, fill = '█', printEnd = "\r"):
    """
    Call in a loop to create terminal progress bar
    @params:
        iteration   - Required  : current iteration (Int)
        total       - Required  : total iterations (Int)
        prefix      - Optional  : prefix string (Str)
        suffix      - Optional  : suffix string (Str)
        decimals    - Optional  : positive number of decimals in percent complete (Int)
        length      - Optional  : character length of bar (Int)
        fill        - Optional  : bar fill character (Str)
        printEnd    - Optional  : end character (e.g. "\r", "\r\n") (Str)
    """
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filledLength = int(length * iteration // total)
    bar = fill * filledLength + '-' * (length - filledLength)
    print(f'\r{prefix} |{bar}| {percent}% {suffix}', end = printEnd)
    # Print New Line on Complete
    if iteration == total: 
        print()



def clean(string):
    string = string.replace("http://", "")
    string = string.replace("https://", "")
    string = string.replace("www.", "")
    string = string.replace("/", "")
    string = string.lower()
    return string


def get_rating(site):
    # Try just site name
    name = clean(site[0])
    try:
        r = requests.get(f'https://api.tosdr.org/search/v3/?query={name}').json()
        rating = r["parameters"]["services"]["hits"][0]["_source"]["rating"]

        if rating in ratings:
            return rating
    except:
        pass

    # Try URL
    url = clean(site[1])
    try:
        r = requests.get(f'https://api.tosdr.org/search/v3/?query={url}').json()
        rating = r["parameters"]["services"]["hits"][0]["_source"]["rating"]

        if rating in ratings:
            return rating
    except:
        pass

    # If you're here, no rating available
    return "none"



def get_site_names():
    sites = []

    with open(SHERLOCK_JSON, "r") as f:
        sherlock = json.loads(f.read())
        for site in sherlock:
            try:
                if site not in sites:
                    sites.append([site, sherlock[site]["urlMain"]])
            except:
                continue


    with open(TRACE_JSON, "r") as f:
        trace = json.loads(f.read())
        for site in trace:
            try:
                if site not in sites:
                    sites.append([site, trace[site]["urlMain"]])
            except:
                continue

    return sites


##### MAIN #####


sites = get_site_names()
privacy_ratings = {}
total_length = len(sites)

for i, site in enumerate(sites):
    rating = get_rating(site)
    privacy_ratings[site[0]] = {"privacyRating": rating}    
    printProgressBar(i + 1, total_length, prefix = 'Progress:', suffix = f'Complete ({i+1}/{total_length})', length = 50)

print()

with open("privacy_ratings.json", "w") as f:
    f.write(json.dumps(privacy_ratings, indent=5))