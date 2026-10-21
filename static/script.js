const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();
const form=document.getElementById("mentorForm"),submitBtn=document.getElementById("submitBtn"),result=document.getElementById("result");
function makeList(items){return '<ul>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>'}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
if(form){form.addEventListener("submit",async event=>{event.preventDefault();const code=document.getElementById("code").value,question=document.getElementById("question").value,mode=document.getElementById("mode").value;if(!code.trim()){document.getElementById("code").focus();return}
submitBtn.disabled=true;submitBtn.innerHTML='Analyzing… <span>◌</span>';result.innerHTML='<div class="result-placeholder"><span>✳</span><b>Checking your code…</b><p>Looking for Python syntax issues and useful next steps.</p></div>';
try{const response=await fetch("/api/mentor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,question,mode})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Something went wrong.");
const diagnostics=(data.diagnostics||[]).length?'<h5>Smart error finder</h5>'+makeList(data.diagnostics):'';
const examples=(data.examples||[]).map(example=>'<div class="example-card"><b>'+escapeHtml(example.title||"Example")+'</b><pre>'+escapeHtml(example.code||"")+'</pre><p><strong>Expected result:</strong></p><pre>'+escapeHtml(example.result||"")+'</pre><p>'+escapeHtml(example.explanation||"")+'</p></div>').join('');
result.innerHTML='<div class="result-content"><h4>'+escapeHtml(data.headline||"Your guidance")+'</h4><h5>Syntax check</h5><p>'+escapeHtml(data.syntax||"No syntax details available.")+'</p>'+diagnostics+'<h5>Hints to consider</h5>'+makeList(data.hints||[])+'<h5>Example-based explanation</h5>'+(examples||'<p>Try a small example to see a related concept.</p>')+'<h5>What to try next</h5>'+makeList(data.next_steps||[])+'<div class="notice">'+escapeHtml(data.message||"Review these suggestions and test your code.")+'</div></div>';
}catch(error){result.innerHTML='<div class="result-content"><h4>Could not analyze</h4><p>'+escapeHtml(error.message)+'</p><p>Check your connection and try again.</p></div>'}
finally{submitBtn.disabled=false;submitBtn.innerHTML='Analyze code <span>→</span>'}
})}

const practiceData = {
  output: {
    prompt: "What does this code display?",
    code: "number = 2 + 3\nprint(number)",
    hint: "Work out the arithmetic on the right side of = before print() runs.",
    answers: ["5"],
    correct: "It displays 5. Python calculates 2 + 3, stores 5 in number, then print() displays it.",
  },
  input: {
    prompt: "Which function converts the text \"18\" into an integer?",
    code: 'age_text = "18"\nage = int(age_text)',
    hint: "Look for the built-in type-conversion function used around age_text.",
    answers: ["int", "int()", "int(age_text)"],
    correct: "int() converts a value to an integer, so int(\"18\") becomes 18.",
  },
  index: {
    prompt: "What expression gets the last item from a list named fruits?",
    code: 'fruits = ["apple", "mango", "grape"]',
    hint: "Python supports negative indexes; -1 refers to the last item.",
    answers: ["fruits[-1]", "[-1]", "fruits[-1]"],
    correct: "fruits[-1] returns the last item, which is grape in this example.",
  },
  loop: {
    prompt: "How many times does this loop print a number?",
    code: "for number in range(4):\n    print(number)",
    hint: "range(4) produces four values: 0, 1, 2, and 3.",
    answers: ["4", "four", "4 times", "4 times."],
    correct: "It prints 4 times, once for each value in range(4): 0, 1, 2, and 3.",
  },
};
const challengeSelect = document.getElementById("practiceChallenge");
const practicePrompt = document.getElementById("practicePrompt");
const practiceCode = document.getElementById("practiceCode");
const practiceHint = document.getElementById("practiceHint");
const practiceAnswer = document.getElementById("practiceAnswer");
const practiceFeedback = document.getElementById("practiceFeedback");
function loadPracticeChallenge() {
  if (!challengeSelect) return;
  const challenge = practiceData[challengeSelect.value];
  practicePrompt.textContent = challenge.prompt;
  practiceCode.textContent = challenge.code;
  practiceHint.textContent = "Hint: " + challenge.hint;
  practiceHint.hidden = true;
  practiceAnswer.value = "";
  practiceFeedback.textContent = "Try it, then check your answer.";
  practiceFeedback.className = "practice-feedback";
}
if (challengeSelect) {
  challengeSelect.addEventListener("change", loadPracticeChallenge);
  document.getElementById("practiceHintBtn").addEventListener("click", () => {
    practiceHint.hidden = !practiceHint.hidden;
  });
  document.getElementById("practiceCheckBtn").addEventListener("click", () => {
    const challenge = practiceData[challengeSelect.value];
    const answer = practiceAnswer.value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!answer) {
      practiceFeedback.textContent = "Type an answer first, then check it.";
      practiceFeedback.className = "practice-feedback";
      practiceAnswer.focus();
      return;
    }
    const accepted = challenge.answers.some(item => answer === item.toLowerCase());
    practiceFeedback.textContent = (accepted ? "Correct! " : "Not quite. ") + challenge.correct;
    practiceFeedback.className = "practice-feedback " + (accepted ? "is-correct" : "is-try-again");
  });
  document.getElementById("practiceNextBtn").addEventListener("click", () => {
    const values = Object.keys(practiceData);
    const current = values.indexOf(challengeSelect.value);
    challengeSelect.value = values[(current + 1) % values.length];
    loadPracticeChallenge();
  });
  loadPracticeChallenge();
}
