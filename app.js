const APP='missionEnglishClub2';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const defaultSave={level:'A1',xp:0,completed:[],scores:{Vocabulary:0,Grammar:0,Listening:0,Reading:0,Writing:0,Speaking:0},badges:[],review:[],placementDone:false};
let save=load();
function load(){try{return {...defaultSave,...JSON.parse(localStorage.getItem(APP)||'{}')}}catch{return {...defaultSave}}}
function persist(){localStorage.setItem(APP,JSON.stringify(save));updateStatus()}
function updateStatus(){ $('#xpText').textContent=`${save.xp%100} / 100`; $('#xpBar').style.width=`${save.xp%100}%`; $('#levelBadge').textContent=`${save.level} • Niveau ${Math.floor(save.xp/100)+1}` }

const locations=[
 {id:'hall',name:'English Club Hall',x:-1,y:-1,color:'#f0c46d',icon:'🏠'},
 {id:'garden',name:'Vocabulary Garden',x:-2,y:1,color:'#73b96a',icon:'🌳'},
 {id:'grammar',name:'Grammar Classroom',x:-1,y:2,color:'#d99b62',icon:'A'},
 {id:'listening',name:'Listening Lounge',x:1,y:2,color:'#80bfd3',icon:'♫'},
 {id:'reading',name:'Reading Library',x:2,y:1,color:'#a58bc8',icon:'📖'},
 {id:'cafe',name:'Conversation Café',x:2,y:-1,color:'#df826f',icon:'☕'},
 {id:'writing',name:'Writing Office',x:1,y:-2,color:'#79a4cf',icon:'✎'},
 {id:'arena',name:'Challenge Arena',x:-2,y:-1,color:'#cd6d70',icon:'★'},
 {id:'achievement',name:'Achievement Room',x:-1,y:-2,color:'#efbd57',icon:'🏆'}
];

const placement=[
 {q:'Choisis la bonne traduction : “Hello!”',a:['Bonjour','Merci','Au revoir'],ok:0,why:'“Hello” signifie « Bonjour ». “Thank you” signifie merci.'},
 {q:'Complete: I ___ from Paris.',a:['am','is','are'],ok:0,why:'Avec « I », on utilise « am » : I am.'},
 {q:'Which sentence is in the Present Simple?',a:['I eat breakfast.','I am eating now.','I ate yesterday.'],ok:0,why:'« eat » à la base est la forme habituelle du présent simple.'},
 {q:'Choose the correct past: Yesterday, we ___ football.',a:['play','played','playing'],ok:1,why:'Pour ce verbe régulier, le passé se forme avec -ed.'},
 {q:'What does “Could you help me?” express?',a:['A polite request','An announcement','A command'],ok:0,why:'“Could you…” est une formulation polie pour demander quelque chose.'},
 {q:'Choisis le mot qui suit : I am interested ___ music.',a:['on','in','at'],ok:1,why:'On utilise « interested in » en anglais.'}
];

let placementIndex=0, placementScore=0;
function showPlacement(){
 if(save.placementDone){showScreen('campus');return}
 $('#placementQuiz').innerHTML=`<div class="eyebrow">QUESTION ${placementIndex+1} / ${placement.length}</div><h2>${placement[placementIndex].q}</h2><div class="answer-grid">${placement[placementIndex].a.map((x,i)=>`<button data-answer="${i}">${x}</button>`).join('')}</div>`;
 $$('#placementQuiz [data-answer]').forEach(b=>b.onclick=()=>{
  const item=placement[placementIndex]; const chosen=+b.dataset.answer;
  if(chosen===item.ok) placementScore++;
  $('#placementQuiz').innerHTML=`<div class="feedback"><strong>${chosen===item.ok?'Bravo !':'Pas tout à fait.'}</strong><br>${item.why}</div><button class="primary-btn" id="nextPlacement">Continuer</button>`;
  $('#nextPlacement').onclick=()=>{placementIndex++;if(placementIndex<placement.length)showPlacement();else finishPlacement()};
 });
}
function finishPlacement(){
 save.level=placementScore>=5?'A2':placementScore>=3?'A1':'A1';save.placementDone=true;persist();
 $('#placementQuiz').innerHTML=`<h2>Niveau estimé : ${save.level}</h2><p>${placementScore>=5?'Tu as de bonnes bases.':'Bienvenue ! Nous commencerons avec les fondamentaux.'}</p><button class="primary-btn" id="startGame">Entrer dans le campus</button>`;
 $('#startGame').onclick=()=>showScreen('campus');
}

const lessons={
 hall:{title:'Introductions',skill:'Speaking',objective:'Se présenter simplement',explain:'Pour dire ton nom, on utilise “My name is …” ou “I’m …”. Pour demander le nom de quelqu’un : “What is your name?”',example:'Hello! My name is Sam. I’m 16 and I’m from Lyon.',fr:'Bonjour ! Je m’appelle Sam. J’ai 16 ans et je suis de Lyon.',quiz:[{q:'« Je m’appelle Lina. » en anglais ?',options:['I name Lina','My name is Lina','Name Lina I'],ok:1,why:'“My name is” est la structure standard pour présenter son nom.'},{q:'Quelle question demande le nom ?',options:['How are you?','What is your name?','Where are you?'],ok:1,why:'“What is your name?” signifie « Comment tu t’appelles ? ».'}]},
 garden:{title:'Family & Daily Life',skill:'Vocabulary',objective:'Reconnaître des mots utiles',explain:'Un vocabulaire devient mémorisable quand on l’utilise dans une phrase. Apprends “mother”, “father”, “sister”, “brother”, “breakfast” et “lunch”.',example:'My mother cooks lunch for my brother.',fr:'Ma mère prépare le déjeuner pour mon frère.',quiz:[{q:'Que signifie “brother” ?',options:['sœur','frère','mère'],ok:1,why:'“Brother” signifie frère.'},{q:'Complete : I eat ___ at noon.',options:['breakfast','lunch','dinner'],ok:1,why:'Le déjeuner à midi se dit “lunch”.'}]},
 grammar:{title:'Be, Have & Present',skill:'Grammar',objective:'Construire des phrases au présent',explain:'Avec TO BE : I am / you are / he is. Avec TO HAVE : I have / you have / he has. Au présent simple, ajoute -s avec he/she/it.',example:'She is a student. He has a bike. She studies English.',fr:'Elle est élève. Il a un vélo. Elle étudie l’anglais.',quiz:[{q:'Choisis : She ___ a teacher.',options:['am','is','are'],ok:1,why:'Avec he/she/it, “be” devient “is”.'},{q:'Complète : Tom ___ English every day.',options:['study','studies','studying'],ok:1,why:'À la 3e personne du singulier, on ajoute -s à “study” → “studies”.'}]},
 listening:{title:'Daily Conversation',skill:'Listening',objective:'Comprendre une courte conversation',explain:'Écoute les mots-clés, pas chaque mot. Cherche qui parle, où ils sont et quel est leur problème.',example:'A: How are you? B: Fine, thanks. I’m looking for the library.',fr:'A : Comment vas-tu ? B : Bien, merci. Je cherche la bibliothèque.',quiz:[{q:'Le second personnage cherche…',options:['un café','une bibliothèque','un train'],ok:1,why:'Il dit précisément “I’m looking for the library”.'}]},
 reading:{title:'Club Notice',skill:'Reading',objective:'Comprendre un message court',explain:'Dans un texte court, repère le titre, les dates, les horaires et les verbes d’action.',example:'MEETING: Monday at 4 p.m. in the Hall. Bring your notebook and two ideas.',fr:'RÉUNION : lundi à 16 h dans le hall. Apporte ton cahier et deux idées.',quiz:[{q:'Quand a lieu la réunion ?',options:['Le lundi','Le mardi','Le dimanche'],ok:0,why:'Le texte dit clairement “Monday”.'},{q:'Que faut-il apporter ?',options:['Deux livres','Un cahier et deux idées','De la nourriture'],ok:1,why:'“Bring your notebook and two ideas” correspond exactement à cette réponse.'}]},
 cafe:{title:'At the Café',skill:'Speaking',objective:'Passer une commande polie',explain:'Pour commander : “I’d like…” ou “Can I have…?” Pour vérifier : “How much is it?”',example:'Can I have a tea and a sandwich, please?',fr:'Puis-je avoir un thé et un sandwich, s’il vous plaît ?',quiz:[{q:'La formulation la plus naturelle ?',options:['Give me tea','I’d like a tea, please','Tea wants I'],ok:1,why:'“I’d like…, please” est courtois et naturel.'}]},
 writing:{title:'Write an Email',skill:'Writing',objective:'Rédiger un message utile',explain:'Un message court contient : une formule d’accueil, une demande claire, une formule de politesse et une signature.',example:'Dear Ms. Smith,\nCould you tell me the time of the meeting?\nThank you.\nAlex',fr:'Chère Mme Smith, pourriez-vous me dire l’heure de la réunion ? Merci. Alex.',quiz:[{q:'Quel élément manque dans : “Meeting Monday?” ?',options:['Une demande claire','Une majuscule','Le mot “meeting”'],ok:0,why:'Cette phrase est brève et manque de contexte, mais reste compréhensible. Un message peut dire “Could you tell me if the meeting is on Monday?”'}]},
 arena:{title:'A1 Challenge',skill:'Grammar',objective:'Valider les bases',explain:'Ce défi mélange les présentations, les verbes BE/HAVE et le vocabulaire quotidien.',example:'I am Leo. I have a notebook and I study English.',fr:'Je suis Leo. J’ai un cahier et j’étudies l’anglais.',quiz:[{q:'Choose: I ___ in the English Club.',options:['is','am','are'],ok:1,why:'Avec “I”, la bonne forme de “be” est “am”.'},{q:'Choose: We ___ three English lessons.',options:['has','have','haves'],ok:1,why:'Avec “we”, on utilise “have”.'}]},
 achievement:{title:'Achievements',skill:'Vocabulary',objective:'Célébrer tes progrès',explain:'Tes récompenses sont attribuées après les réussites des leçons. Elles reflètent les compétences maîtrisées, pas seulement le nombre de clics.',example:'Badge: New Member',fr:'Recompense obtenue après ton entrée dans le club.',quiz:[{q:'Que mesure surtout cette salle ?',options:['Tes réussites','Tes clics','La vitesse de la souris'],ok:0,why:'Les badges représentent les compétences validées et les missions accomplies.'}]}
};

function showScreen(id){
 $$('.screen').forEach(s=>s.classList.remove('active')); $(`#${id}`).classList.add('active');
 $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
 $('#sideMenu').classList.remove('open');
 if(id==='progress')renderProgress(); if(id==='missions')renderMissions(); if(id==='review')renderReview();
}

let currentLesson=null, step=0;
function openLesson(id){currentLesson=id;step=0;showScreen('lessonScreen');renderLessonNav();renderLessonStep()}
function renderLessonNav(){const l=lessons[currentLesson];$('#lessonPlaceTitle').textContent=l.title;$('#lessonSteps').innerHTML=['Objectif','Explication','Exemple','Exercice','Synthèse'].map((x,i)=>`<button data-step="${i}" class="${i===step?'done':''}">${i+1}. ${x}</button>`).join('');$$('#lessonSteps button').forEach(b=>b.onclick=()=>{step=+b.dataset.step;renderLessonNav();renderLessonStep()})}
function renderLessonStep(){const l=lessons[currentLesson];let html='';
 if(step===0)html=`<p class="eyebrow">OBJECTIF PÉDAGOGIQUE</p><h1>${l.title}</h1><p class="lesson-lead">${l.objective}</p><button class="primary-btn next-step">Continuer</button>`;
 if(step===1)html=`<p class="eyebrow">EXPLICATION SIMPLE</p><h1>Comprendre la notion</h1><p class="lesson-lead">${l.explain}</p><button class="primary-btn next-step">Voir un exemple</button>`;
 if(step===2)html=`<p class="eyebrow">EXEMPLES EN ANGLAIS</p><h1>In context</h1><div class="example-box"><strong>${l.example.replace(/\n/g,'<br>')}</strong><p>🇫🇷 ${l.fr}</p></div>${l.skill==='Listening'?'<button class="primary-btn" id="listenBtn">▶ Écouter</button><p id="audioStatus"></p>':''}<button class="primary-btn next-step">Faire les exercices</button>`;
 if(step===3)renderExercise();
 if(step===4)html=`<p class="eyebrow">RÉSUMÉ</p><h1>Tu as compris</h1><div class="example-box">${l.explain}</div><button class="primary-btn" id="completeLesson">Valider la leçon</button>`;
 $('#lessonContent').innerHTML=html;
 $$('.next-step').forEach(b=>b.onclick=()=>{step++;renderLessonNav();renderLessonStep()});
 if($('#listenBtn'))$('#listenBtn').onclick=()=>listen(l.example);
 if($('#completeLesson'))$('#completeLesson').onclick=completeLesson;
}
function renderExercise(){const l=lessons[currentLesson];const q=l.quiz[0];let html=`<p class="eyebrow">EXERCICE • ${l.skill}</p><h1>${q.q}</h1><div class="option-list">${q.options.map((o,i)=>`<button class="option-btn" data-option="${i}">${o}</button>`).join('')}</div><div id="feedback"></div>`;$('#lessonContent').innerHTML=html;$$('#lessonContent [data-option]').forEach(b=>b.onclick=()=>answerExercise(+b.dataset.option));}
function answerExercise(choice){const q=lessons[currentLesson].quiz[0],ok=choice===q.ok;$$('#lessonContent [data-option]').forEach((b,i)=>{b.disabled=true;if(i===q.ok)b.classList.add('correct');if(i===choice&&!ok)b.classList.add('wrong')});$('#feedback').innerHTML=`<div class="feedback"><strong>${ok?'Bonne réponse !':'À revoir.'}</strong><br>${q.why}</div><button class="primary-btn" id="exerciseNext">Continuer</button>`;$('#exerciseNext').onclick=()=>{step=4;renderLessonNav();renderLessonStep();if(!ok)addReview({lesson:currentLesson,question:q.q})}};
function listen(text){if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(text);u.lang='en-US';speechSynthesis.speak(u);$('#audioStatus').textContent='Lecture en cours…'}else $('#audioStatus').textContent='Audio indisponible : lis la transcription ci-dessus.'}
function addReview(item){if(!save.review.some(x=>x.lesson===item.lesson))save.review.push(item);persist()}
function completeLesson(){if(!save.completed.includes(currentLesson)){save.completed.push(currentLesson);save.xp+=25;save.scores[lessons[currentLesson].skill]=Math.min(100,save.scores[lessons[currentLesson].skill]+20);if(save.completed.length===3&&!save.badges.includes('Explorer'))save.badges.push('Explorer');if(save.completed.length>=9&&!save.badges.includes('Club Member'))save.badges.push('Club Member');persist()}showScreen('campus')}

const missions=[
 {title:'Introduce Yourself',text:'Présenter ton nom, ton âge et ta ville.',need:'hall',xp:50},
 {title:'Welcome a New Member',text:'Guider un membre dans le campus.',need:'cafe',xp:75},
 {title:'Find Your Classroom',text:'Comprendre les indications et réussir le cours.',need:'grammar',xp:75},
 {title:'Organize an English Workshop',text:'Rédiger une annonce pour le club.',need:'writing',xp:100},
 {title:'Interview a Guest',text:'Compréter un dialogue et poser des questions.',need:'listening',xp:100},
 {title:'Present Your Project',text:'Construire une présentation courte.',need:'reading',xp:125},
 {title:'Join the Club Debate',text:'Réussir le challenge final.',need:'arena',xp:150}
];
function renderMissions(){const unlocked=save.completed.length;$('#missionList').innerHTML=missions.map((m,i)=>`<article class="game-card ${i>unlocked?'locked':''}"><p class="eyebrow">MISSION ${i+1}</p><h2>${m.title}</h2><p>${m.text}</p><strong>+${m.xp} XP</strong>${i<=unlocked?`<br><button class="primary-btn" data-mission="${m.need}">Commencer</button>`:'<p>🔒 À débloquer</p>'}</article>`).join('');$$('[data-mission]').forEach(b=>b.onclick=()=>openLesson(b.dataset.mission))}

function renderProgress(){const names=['Vocabulary','Grammar','Listening','Reading','Writing','Speaking'];$('#statsGrid').innerHTML=names.map(n=>`<div class="stat-card"><span>${n}</span><strong>${save.scores[n]}%</strong><small>${save.completed.length} activité(s)</small></div>`).join('');const badges=[['New Member','Début de l’aventure'],['Explorer','3 lieux visités'],['Club Member','Campus complet']];$('#badgeGrid').innerHTML=badges.map(([n,d])=>`<article class="game-card ${n==='New Member'||save.badges.includes(n)?'':'locked'}"><h2>${n==='New Member'?'🎓':n==='Explorer'?'🧭':'🏆'} ${n}</h2><p>${d}</p></article>`).join('')}
function renderReview(){if(!save.review.length){$('#reviewContent').innerHTML='<p>Les notions difficiles apparaîtront ici après une correction à revoir.</p>';return}$('#reviewContent').innerHTML=save.review.map((r,i)=>`<div class="game-card"><strong>${lessons[r.lesson].title}</strong><p>${r.question}</p><button class="primary-btn" data-review="${r.lesson}">Revoir la leçon</button></div>`).join('');$$('[data-review]').forEach(b=>b.onclick=()=>openLesson(b.dataset.review))}

const canvas=$('#world'),ctx=canvas.getContext('2d');let player={gx:0,gy:0};
function iso(gx,gy){return{x:canvas.width/2+gx*84,y:canvas.height/2+gy*43}}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#75b46f';ctx.fillRect(0,0,canvas.width,canvas.height);for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){const p=iso(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y-24);ctx.lineTo(p.x+84,p.y);ctx.lineTo(p.x,p.y+24);ctx.lineTo(p.x-84,p.y);ctx.closePath();ctx.fillStyle=(x+y)%2?'#91c56f':'#83b960';ctx.fill();ctx.strokeStyle='rgba(50,100,50,.35)';ctx.stroke()}locations.forEach(drawBuilding);drawPlayer();requestAnimationFrame(draw)}
function drawBuilding(l){const p=iso(l.x,l.y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(42,74,52,.22)';ctx.beginPath();ctx.ellipse(0,12,50,16,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=l.color;ctx.fillRect(-38,-62,76,62);ctx.fillStyle='#f8e0a0';ctx.beginPath();ctx.moveTo(-38,-62);ctx.lineTo(0,-91);ctx.lineTo(38,-62);ctx.closePath();ctx.fill();ctx.fillStyle='#6d4b3c';ctx.fillRect(-8,-28,16,28);ctx.fillStyle='#fff';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText(l.icon,0,-43);ctx.restore()}
function drawPlayer(){const p=iso(player.gx,player.gy);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(20,30,50,.25)';ctx.beginPath();ctx.ellipse(0,10,15,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5c6ca7';ctx.fillRect(-9,-25,18,27);ctx.fillStyle='#f1bd8c';ctx.beginPath();ctx.arc(0,-31,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b3427';ctx.fillRect(-10,-42,20,8);ctx.restore()}

function nearestLocation(){return locations.find(l=>Math.abs(l.x-player.gx)+Math.abs(l.y-player.gy)<=1)}
function move(dx,dy){const nx=player.gx+dx,ny=player.gy+dy;if(Math.abs(nx)<=3&&Math.abs(ny)<=3){player.gx=nx;player.gy=ny;const here=nearestLocation();if(here){$('#locationLabel').textContent=here.name}else $('#locationLabel').textContent='Campus grounds'}}
window.addEventListener('keydown',e=>{if(!$('#campus').classList.contains('active'))return;if(['ArrowUp','w','z','ArrowDown','s','ArrowLeft','a','q','ArrowRight','d'].includes(e.key)||e.key==='E'||e.key==='Enter')e.prevent; if(e.key==='ArrowUp'||e.key==='w'||e.key==='z')move(0,-1);if(e.key==='ArrowDown'||e.key==='s')move(0,1);if(e.key==='ArrowLeft'||e.key==='a'||e.key==='q')move(-1,0);if(e.key==='ArrowRight'||e.key==='d')move(1,0);if(e.key.toLower?e.key.toLowerCase():e.key==='') if(e.key.toLowerCase()==='e'||e.key==='Enter')interact()});
$$('[data-dir]').forEach(b=>b.addEventListener('pointerdown',()=>{const d=b.dataset.dir;move(d==='left'?-1:d==='right'?1:0,d==='up'?0:d==='down'?1:0)}));
$('#interactBtn').onclick=interact;
function interact(){const here=nearestLocation();if(here){openLesson(here.id)}else $('#locationLabel').textContent='Approche-toi d’un bâtiment'}

$('#menuBtn').onclick=()=>$('#sideMenu').classList.toggle('open');$('#closeMenu').onclick=()=>$('#sideMenu').classList.remove('open');$$('.nav-item').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));$('#lessonBack').onclick=()=>showScreen('campus');$('#resetBtn').onclick=()=>{if(confirm('Réinitialiser toute ta progression ?')){localStorage.removeItem(APP);save={...defaultSave};placementIndex=0;placementScore=0;updateStatus();showPlacement();showScreen('placement')}};

updateStatus();showPlacement();draw();
