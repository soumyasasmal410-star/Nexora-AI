const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();
const form=document.getElementById("mentorForm"),submitBtn=document.getElementById("submitBtn"),result=document.getElementById("result");
function makeList(items){return '<ul>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>'}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
if(form){form.addEventListener("submit",async event=>{event.preventDefault();const code=document.getElementById("code").value,question=document.getElementById("question").value,mode=document.getElementById("mode").value;if(!code.trim()){document.getElementById("code").focus();return}
submitBtn.disabled=true;submitBtn.innerHTML='Analyzing… <span>◌</span>';result.innerHTML='<div class="result-placeholder"><span>✳</span><b>Checking your code…</b><p>Looking for Python syntax issues and useful next steps.</p></div>';
try{const response=await fetch("/api/mentor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,question,mode})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Something went wrong.");
result.innerHTML='<div class="result-content"><h4>'+escapeHtml(data.headline||"Your guidance")+'</h4><h5>Syntax check</h5><p>'+escapeHtml(data.syntax||"No syntax details available.")+'</p><h5>Hints to consider</h5>'+makeList(data.hints||[])+'<h5>What to try next</h5>'+makeList(data.next_steps||[])+'<div class="notice">'+escapeHtml(data.message||"Review these suggestions and test your code.")+'</div></div>';
}catch(error){result.innerHTML='<div class="result-content"><h4>Could not analyze</h4><p>'+escapeHtml(error.message)+'</p><p>Check your connection and try again.</p></div>'}
finally{submitBtn.disabled=false;submitBtn.innerHTML='Analyze code <span>→</span>'}
})}
