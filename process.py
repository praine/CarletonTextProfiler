#!/usr/bin/python3
import sys
import spacy
nlp = spacy.load("en_core_web_sm")
import en_core_web_sm
nlp = en_core_web_sm.load()
with open('/var/www/temp/'+sys.argv[1]+'.txt') as f:
	string = f.read()
	doc = nlp(string)
	print([(w.text, w.pos_) for w in doc])
