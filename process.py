#!/usr/bin/python3
import sys
import spacy
import en_core_web_sm

nlp = en_core_web_sm.load()

with open('/var/www/temp/'+sys.argv[1]+'.txt') as f:
    string = f.read()
    doc = nlp(string)
    output = [(w.text, w.pos_) for w in doc]

    # Convert the output to string format with double quotes
    formatted_output = "[{}]".format(", ".join(["(\"{}\", \"{}\")".format(w.text, w.pos_) for w in doc]))

    print(formatted_output)