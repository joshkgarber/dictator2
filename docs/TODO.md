# TODO

## P0

### Ready

- [ ] Use structured outputs for tutor responses, and then format them for the output/console. This will provide more consistency.
    - Structured output preliminary research findings/idea:
```py
# Pseudo/example code

from pydantic import BaseModel

class Correction(BaseModel):
    error: str
    explanation: str
    takeaway: str

class Corrections(BaseModel):
    corrections: list[Correction]

response = client.responses.parse(
    model=model_name,
    input=[
       ... # inputs as currently existing
    ],
    text_format=Corrections, # for structured output definition in api
)

corrections = response.output_parsed # sdk method to parse structured output

# TODO Validate using pydantic method
# TODO Return tutor response tuple
```
    - Formatting:
**Your attempt**: {attempt}
**Correct answer**: {answer}

for i in range(corrections):
h`Mistake $i`
p{error}
p{explanation}
p{takeaway}

### Needs Refinement

- [ ] Change "Attempt Input" label to something else (maybe nothing).
- [ ] Deal with the overflow of main (the background radial gradient cuts off and I would prefer interior scroll areas for the windows within the base views).

## P1

- [ ] rename the tone `answer` (session console messages) because it is now also used by the "replay" command. rename it to something neutral like
- [ ] The "Due Today" label in the schedule view should be green not yellow.
- [ ] There should not be a replay button in the top right. Currently the tutor spinner is rendered here. Move that to another location because this is being removed.
- [ ] Repetition feature is missing. The keep command should only be available when reps > 0. Otherwise, keep should still be evaluated as a command, but help text in the console output to say keep is not available here.
- [ ] Make the tutor spinner more pronounced.
- [ ] Option for dark mode and system default
- [ ] Help text needs a lot of love. including using the help command to toggle the instructions panel. and the up/down arrow history feature.

## P2

- [ ] Check the next launch target calculation. It should be older texts first.
- [ ] I want to know the spread of the score points per clip.
- [ ] On the schedule view, it says plan and launch your next sessions. It should say view your schedule and launch your next session.
- [ ] The calendar panel on the schedule view is too narrow, it needs to be wider so that there's no overflow of the session indicator pills within the day boxes.

## P3

- [ ] Convert to a desktop app
- [ ] Landing page for the project
- [ ] Open source deployment (via docker)
- [ ] Stop saving tutor responses to DB
