# Script Name: Website Scraper for Passage and Questions

# Goal: Scrape passage content and a list of questions with their answer choices
# from a specific HTML structure.

# Instructions for Vibe:
# Find the main item container.

# Step 1: Locate the passage content.
# - Find the element with class 'bbcodeBoxOut'.
# - Within this, find the first 'bbcodeBoxIn'.
# - Extract all text and HTML content from this first 'bbcodeBoxIn'.
# - Preserve line breaks from '<br>' tags by converting them to newline characters ('\n').
# - Identify text within '<span>' tags.
# - For these highlighted texts, enclose them in a special marker, for example, `**<text>**` to indicate they are highlighted.
# - Store the final processed passage text.

# Step 2: Locate and extract questions and answers.
# - Find the second 'bbcodeBoxIn' within the same 'bbcodeBoxOut'.
# - Within this second box, locate all elements with the class 'question_wrapper'.
# - Iterate through each 'question_wrapper'.
# - For each wrapper:
#   - Find question text within `<span style="font-weight: bold">` tags.
#   - Extract the question number and remove it from the question text.
#   - Find the answer choices (A, B, C, D, E) that follow the question.
#   - Parse answer choices by looking for lines that start with a letter followed by a period or parenthesis.
#   - Store each question and its choices as a structured object, e.g., a dictionary or a custom class instance.
#   - Ensure to handle cases where there might be a varying number of answer choices.

# Step 3: Compile and format the final output.
# - Create a final data structure (e.g., a dictionary) to hold all the scraped information.
# - This dictionary should have two keys: 'passage' and 'questions'.
# - The 'passage' value should be the processed text from Step 1.
# - The 'questions' value should be a list of the structured question objects from Step 2.
# - Display the passage with highlighted text (enclosed in **) rendered with a yellow background.
# - Display answer choices without bullet points and without periods after the letter (A, B, C, D, E).
# - Print the final data structure in a human-readable format.

# Example of expected output structure:
# {
#   "passage": "This is the passage content. **This part is highlighted.** And this is the rest.",
#   "questions": [
#     {
#       "question_text": "What is the main topic of the passage?",
#       "choices": {
#         "A": "Choice A text",
#         "B": "Choice B text",
#         "C": "Choice C text",
#         "D": "Choice D text",
#         "E": "Choice E text"
#       }
#     },
#     {
#       "question_text": "Another question here...",
#       "choices": {
#         "A": "Another choice A text",
#         "B": "Another choice B text"
#       }
#     }
#   ]
# }

# Features and Enhancements:
# - Text enclosed in ** markers is displayed with a yellow background highlight for better visibility
# - Periods are removed from answer choice letters for cleaner formatting
# - Questions are properly extracted from `<span style="font-weight: bold">` tags
# - Answer choices are parsed from text following the question span
# - Error handling for cases where expected elements are not found
# - Copy to clipboard functionality for easy data transfer