import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

DATA = [
    ("my father have diabetes", "medical"),
    ("i have fever what to eat", "medical"),
    ("what does this medicine do", "medical"),
    ("i have pcod what to do", "medical"),
    ("my head hurts a lot", "medical"),
    ("how to make maggi", "cooking"),
    ("how to make biryani", "cooking"),
    ("recipe for pasta", "cooking"),
    ("how to bake a cake", "cooking"),
    ("i have upsc exam next month", "exam"),
    ("i ahve biology exam tomorrow help me prepare", "exam"),
    ("how to prepare for arithmetic exam", "exam"),
    ("study plan for chemistry test", "exam"),
    ("planning a trip to goa", "travel"),
    ("how to book a flight", "travel"),
    ("best places to visit in kerala", "travel"),
    ("how to save money every month", "finance"),
    ("how to file income tax", "finance"),
    ("budget for a wedding", "finance"),
    ("how to clean my kitchen", "cleaning"),
    ("how to remove stains from carpet", "cleaning"),
    ("what is 5 plus 7", "general"),
    ("what is a blackhole", "general"),
    ("tell me a joke", "general"),
]

texts, labels = zip(*DATA)

model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("clf", LogisticRegression(max_iter=1000)),
])
model.fit(texts, labels)

with open("intent_classifier.pkl", "wb") as f:
    pickle.dump(model, f)

print("Saved intent_classifier.pkl | train accuracy:", model.score(texts, labels))