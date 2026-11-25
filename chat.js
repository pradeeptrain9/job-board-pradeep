// Form assistant: ask the question from a job application form, get a paste-ready answer.
// Facts (CTC, experience...) answer instantly in the browser; open-ended ones (why this role, cover letter...) go to the LLM Worker, with a template fallback.
// Needs globals from index.html: jobs, RESUME, el, $, clean, plus window.CHAT = {who, api, fixed:{exp,cur,exp_ctc,loc,edu}, extra}.
(()=>{
const C=window.CHAT;if(!C)return;
let saved={};try{saved=JSON.parse(localStorage.getItem("answers")||"{}")}catch{}
const keep=()=>{try{localStorage.setItem("answers",JSON.stringify(saved))}catch{}};
const prof=()=>{try{return JSON.parse(localStorage.getItem("profile")||"{}")}catch{return{}}};
// [key, label, question pattern, fixed value or null]. Order matters: first match wins. Value null = only from what the user told the bot.
const RULES=[
 ["exp_ctc","expected CTC",/expected (ctc|salary|compensation|package|pay)|salary expectation|desired (salary|ctc)|ctc expectation/,C.fixed.exp_ctc],
 ["cur","current CTC",/current (ctc|salary|compensation|package|pay)|present (ctc|salary)|last drawn|current annual/,C.fixed.cur],
 ["notice","notice period",/notice period|how soon (can|could) you join|when can you (join|start)|earliest (start|join)|joining (time|date)/,null],
 ["exp","total experience",/(total|years of|how many years|overall).{0,25}experience|experience in years/,C.fixed.exp],
 ["loc","current location",/current location|where are you (based|located)|city of residence|which city/,C.fixed.loc],
 ["reloc","relocation",/relocat/,null],
 ["auth","work authorisation",/authori[sz]ed to work|work authori[sz]ation|visa|sponsorship/,null],
 ["edu","education",/highest (qualification|education)|education level|degree/,C.fixed.edu],
 ["phone","phone",/phone|mobile|contact number/,null],
 ["email","email",/e-?mail/,null],
 ["linkedin","LinkedIn",/linkedin/,null],
];
const PERSONAL=/gender|date of birth|\bdob\b|caste|religion|marital|aadhaar|pan card|passport|disabilit|veteran|ethnic/;
const OPEN=["Why do you want this role?","Why should we hire you?","Write a short cover letter","Describe your strengths","Why are you leaving your current job?"];
const cand=()=>[RESUME.summary,"Skills: "+RESUME.skills.join(", "),...RESUME.experience.map(x=>x.role+", "+x.company+" ("+x.dates+"): "+x.bullets.join(" ")),C.extra,
  ...RULES.filter(r=>r[3]).map(r=>r[1]+": "+r[3]),...Object.entries(saved).map(([k,v])=>k+": "+v)].filter(Boolean).join("\n");

const box=el("form","prof");box.id="chat";
box.innerHTML="<h2>Form assistant</h2>";
const sel=el("select");sel.setAttribute("aria-label","Job the question is for");
const log=el("div","det");log.style.cssText="max-height:340px;overflow:auto;display:grid;gap:8px";
const inp=el("input");inp.type="text";inp.placeholder="Paste a question from the application form…";inp.autocomplete="off";
const send=el("button","copy","Ask");send.type="submit";
const chips=el("div","btns");
const top=el("div","r");top.append(el("span","meta","Question is for:"),sel);
const row=el("div","r");row.append(inp,send);inp.style.flex="1";
box.append(top,chips,log,row,el("p","meta","Answers come only from your resume and what you tell me. Personal facts I don't have (notice period...) are asked once: type e.g. “notice period = 30 days”. Saved in this browser only."));
$("#q").before(box);

// Jobs from outside the board: added here, kept in this browser only.
let ext=[];try{ext=JSON.parse(localStorage.getItem("extjobs")||"[]")}catch{}
const opt=(t,v)=>{const o=el("option",null,t);o.value=v;sel.append(o)};
const fillSel=()=>{const cur=sel.value;sel.textContent="";opt("General (no specific job)","");
  jobs.forEach((j,i)=>opt((j.title||"")+" - "+(j.company||""),"j"+i));
  ext.forEach((j,i)=>opt("[Mine] "+j.title+(j.company?" - "+j.company:""),"e"+i));opt("+ Add a job from a link…","new");sel.value=cur};
fillSel();setInterval(()=>{if(sel.options.length-1!==jobs.length+ext.length+1)fillSel()},2000);
const add=el("div","det");add.hidden=true;add.style.display="none";
const fld=(ph,tag)=>{const x=el(tag||"input");if(!tag)x.type="text";x.placeholder=ph;x.style.cssText="font:inherit;font-size:13px;padding:8px 9px;border:1px solid var(--line);border-radius:14px;background:var(--bg);color:var(--fg);width:100%;box-sizing:border-box";return x};
const aUrl=fld("Job link (https://…)"),aTitle=fld("Job title (optional, read from the link)"),aCo=fld("Company (optional)"),aJd=fld("Or paste the job description if the link can't be read","textarea");aJd.rows=3;
const aBtn=el("button","copy","Add job");aBtn.type="button";const aMsg=el("span","meta","");
add.append(aUrl,aTitle,aCo,aJd,aBtn,aMsg);top.after(add);
sel.onchange=()=>{const n=sel.value==="new";add.hidden=!n;add.style.display=n?"grid":"none";add.style.gap="6px"};
aBtn.onclick=async()=>{
  let jd=aJd.value.trim(),url=aUrl.value.trim(),title=aTitle.value.trim();
  if(url&&!jd){aMsg.textContent="Reading the link…";try{const r=await fetch("https://r.jina.ai/"+url);const raw=(await r.text()).trim();
      if(!title){const m=raw.match(/^Title:\s*(.+)$/m);if(m)title=m[1].trim()}jd=tidyJd(raw);if(jd.length<120)throw 0}
    catch{aMsg.textContent="Couldn't read that link (bot-blocked?). Paste the job description instead.";return}}
  if(!jd&&!title){aMsg.textContent="Add a link or paste the description.";return}
  ext.push({title:clean(title||"Job from link").slice(0,120),company:clean(aCo.value.trim()).slice(0,80),url,jd:clean(jd).slice(0,3000)});
  try{localStorage.setItem("extjobs",JSON.stringify(ext))}catch{}
  fillSel();sel.value="e"+(ext.length-1);sel.onchange();aUrl.value=aTitle.value=aCo.value=aJd.value="";aMsg.textContent="";
  say("bot","Added “"+ext[ext.length-1].title+"”. Ask your questions for it now.")};
["Current CTC?","Expected CTC?","Notice period?","Total experience?",...OPEN].forEach(t=>{const b=el("button","copy",t.replace(/\?$/,""));b.type="button";b.onclick=()=>ask(t);chips.append(b)});

const say=(who,t)=>{const m=el("div");m.style.cssText="padding:8px 10px;border-radius:12px;white-space:pre-wrap;"+(who==="me"?"background:color-mix(in srgb,var(--accent),transparent 85%);justify-self:end;max-width:85%":"background:var(--bg);border:1px solid var(--line);max-width:92%");
  m.textContent=t;if(who==="bot"){const b=el("button","copy","Copy");b.type="button";b.style.cssText="display:block;margin-top:6px;font-size:11px";b.onclick=async()=>{try{await navigator.clipboard.writeText(t);b.textContent="Copied"}catch{b.textContent="Copy blocked"}};m.append(b)}
  log.append(m);log.scrollTop=log.scrollHeight;return m};

// "notice period = 30 days" teaches the bot a fact.
const teach=q=>{const m=q.match(/^(.{3,40}?)\s*(?:=|:| is )\s*(.+)$/);if(!m)return false;const r=RULES.find(r=>r[2].test(m[1].toLowerCase())&&!r[3]);if(!r)return false;
  saved[r[0]]=m[2].trim();keep();say("bot","Saved "+r[1]+": "+saved[r[0]]);return true};
const fact=q=>{const l=q.toLowerCase();const r=RULES.find(r=>r[2].test(l));if(!r)return null;const p=prof();
  const v=r[3]||saved[r[0]]||({phone:p.phone,email:p.email,linkedin:p.linkedin}[r[0]]);
  return v?{text:v}:{ask:r[1],hint:r[0]==="phone"||r[0]==="email"||r[0]==="linkedin"?"Fill it in the contact details box above and ask again.":"Tell me once, e.g. “"+r[1]+" = ...”, and I'll remember it."}};
const job=()=>{const v=sel.value;return v[0]==="j"?jobs[+v.slice(1)]:v[0]==="e"?ext[+v.slice(1)]:null};
const template=(q,j)=>{const t=j?(j.title+(j.company?" at "+j.company:"")):"this role";const m=j&&j.matched?" "+j.matched:"";
  return "I am interested in "+t+" because it matches my background. "+RESUME.summary+m};

async function llm(q,j){
  const body={qa:{question:q,candidate:cand(),job:j?{title:j.title,company:j.company,matched:j.matched,location:j.location,jd:j.jd}:{}}};
  const r=await fetch(C.api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error("backend "+r.status);const s=await r.json();if(!s.id)throw new Error(s.error||"no id");
  for(let i=0;i<24;i++){await new Promise(x=>setTimeout(x,1500));const p=await fetch(C.api+"?id="+encodeURIComponent(s.id));if(!p.ok)continue;const d=await p.json();
    if(d.status==="done")return d.result;if(d.status==="error")throw new Error(d.error)}
  throw new Error("timed out");
}
async function ask(q){
  q=q.trim();if(!q)return;say("me",q);inp.value="";
  if(PERSONAL.test(q.toLowerCase())){say("bot","That is a personal detail I don't hold. Fill it in yourself.");return}
  if(teach(q))return;
  const f=fact(q);
  if(f&&f.text){say("bot",clean(f.text));return}
  if(f){say("bot","I don't have your "+f.ask+". "+f.hint);return}
  const j=job(),w=say("bot","Thinking…");
  try{const o=await llm(q,j);w.remove();say("bot",clean(o.answer)+(o.missing?"\n\n(Add your "+o.missing+" for a better answer.)":""))}
  catch(e){w.remove();say("bot",clean(template(q,j))+"\n\n(AI backend unavailable: "+e.message+". This is a template answer, edit before sending.)")}
}
box.onsubmit=e=>{e.preventDefault();ask(inp.value)};
say("bot","Hi "+C.who+". Pick the job above, paste any question from its application form, and I'll draft the answer.");
})();
