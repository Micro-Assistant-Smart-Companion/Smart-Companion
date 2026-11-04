"""Intent classification and topic routing prompt components.

Used by the intent router to categorize user queries into appropriate operational
domains (medical, exam, cooking, cleaning, finance, travel, general).
"""

ROUTING_DOMAINS = [
    "medical",
    "exam",
    "cooking",
    "cleaning",
    "finance",
    "travel",
    "general",
]

ROUTING_RULES = (
    "INTENT ROUTING RULES:\n"
    "Classify the user's message into exactly ONE primary topic/domain:\n"
    "- 'medical': queries about symptoms, health records, medications, clinic visits, wellness.\n"
    "- 'exam': study goals, test prep, homework, academic problem solving.\n"
    "- 'cooking': recipes, meal preparation, culinary tasks, kitchen errands.\n"
    "- 'cleaning': tidying up, chores, home maintenance, organizing.\n"
    "- 'finance': budgeting, banking, bills, expenses.\n"
    "- 'travel': trip planning, transit, tickets, commuting.\n"
    "- 'general': all other conversational, informational, or miscellaneous tasks.\n\n"
    "Respond with ONLY the single lowercase word for the selected domain, nothing else."
)


def build_routing_prompt(goal: str) -> str:
    """Build the prompt for topic classification."""
    return (
        f"{ROUTING_RULES}\n\n"
        f'Message to classify: "{goal}"'
    )

