/* FORCE FITNESS CLUB — immersive sound
   Original music and effects generated live with the Web Audio API (no audio files, no licensing).
   Off by default; visitors switch it on with the speaker button (browsers require a tap before sound). */
(function(){
"use strict";
var AC=window.AudioContext||window.webkitAudioContext;
if(!AC)return;

var PREF_KEY="force-sound";
var BPM=96, STEP=60/BPM/4;           // 16th-note length in seconds
var MUSIC_LEVEL=.5, SFX_LEVEL=.55, DUCK_LEVEL=.07;

var ctx=null, master, musicBus, padBus, sfxBus, reverb, delay, noiseBuf;
var enabled=false, started=false, nextStep=0, stepIndex=0, timer=null, ducked=false;

/* ---------- helpers ---------- */
function getPref(){try{return localStorage.getItem(PREF_KEY)}catch(e){return null}}
function setPref(v){try{localStorage.setItem(PREF_KEY,v)}catch(e){}}
function hz(n){return 440*Math.pow(2,(n-69)/12)} // MIDI note -> Hz
function lang(){return document.documentElement.lang==="el"?"el":"en"}

function makeNoise(){
  var len=ctx.sampleRate*2,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=Math.random()*2-1;
  return b;
}
function makeImpulse(sec,decay){
  var len=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(2,len,ctx.sampleRate);
  for(var c=0;c<2;c++){var d=b.getChannelData(c);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}
  return b;
}

function init(){
  if(ctx)return;
  ctx=new AC();
  var comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-16;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.25;
  master=ctx.createGain();master.gain.value=0;
  master.connect(comp);comp.connect(ctx.destination);

  reverb=ctx.createConvolver();reverb.buffer=makeImpulse(3.2,2.6);
  var revGain=ctx.createGain();revGain.gain.value=.38;reverb.connect(revGain);revGain.connect(master);

  delay=ctx.createDelay(1);delay.delayTime.value=STEP*3;
  var fb=ctx.createGain();fb.gain.value=.32;
  var dlp=ctx.createBiquadFilter();dlp.type="lowpass";dlp.frequency.value=2600;
  delay.connect(dlp);dlp.connect(fb);fb.connect(delay);
  var dGain=ctx.createGain();dGain.gain.value=.5;dlp.connect(dGain);dGain.connect(master);

  musicBus=ctx.createGain();musicBus.gain.value=MUSIC_LEVEL;musicBus.connect(master);
  padBus=ctx.createGain();padBus.gain.value=1;padBus.connect(musicBus);
  sfxBus=ctx.createGain();sfxBus.gain.value=SFX_LEVEL;sfxBus.connect(master);sfxBus.connect(reverb);

  noiseBuf=makeNoise();
}

/* ---------- music ---------- */
// A minor cinematic progression, two bars per chord: Am – F – Dm – E
var CHORDS=[
  {root:45,notes:[57,60,64]},   // Am
  {root:41,notes:[53,57,60]},   // F
  {root:38,notes:[50,53,57]},   // Dm
  {root:40,notes:[52,56,59]}    // E
];
var ARP=[0,1,2,1,0,2,1,2];

function pad(chord,t,dur){
  var lp=ctx.createBiquadFilter();lp.type="lowpass";lp.Q.value=.7;
  lp.frequency.setValueAtTime(380,t);lp.frequency.linearRampToValueAtTime(1100,t+dur*.5);lp.frequency.linearRampToValueAtTime(420,t+dur);
  var g=ctx.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+1.6);g.gain.setValueAtTime(.07,t+dur-1);g.gain.linearRampToValueAtTime(0,t+dur+.6);
  lp.connect(g);g.connect(padBus);g.connect(reverb);
  chord.notes.forEach(function(n){
    [-7,7].forEach(function(det){
      var o=ctx.createOscillator();o.type="sawtooth";o.frequency.value=hz(n);o.detune.value=det;
      o.connect(lp);o.start(t);o.stop(t+dur+.8);
    });
  });
}
function kick(t){
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.22);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.9,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.42);
  o.connect(g);g.connect(musicBus);o.start(t);o.stop(t+.45);
  // sidechain pump on the pad
  padBus.gain.cancelScheduledValues(t);padBus.gain.setValueAtTime(.35,t);padBus.gain.linearRampToValueAtTime(1,t+.32);
}
function bass(note,t,len){
  var o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  o.type="sawtooth";o.frequency.value=hz(note);
  f.type="lowpass";f.frequency.setValueAtTime(520,t);f.frequency.exponentialRampToValueAtTime(140,t+len);f.Q.value=4;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.22,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+len);
  o.connect(f);f.connect(g);g.connect(musicBus);o.start(t);o.stop(t+len+.02);
}
function hat(t,vol,open){
  var s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noiseBuf;f.type="highpass";f.frequency.value=8200;
  var len=open?.16:.035;
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+len);
  s.connect(f);f.connect(g);g.connect(musicBus);s.start(t,Math.random()*1.5);s.stop(t+len+.01);
}
function clap(t){
  var s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noiseBuf;f.type="bandpass";f.frequency.value=1500;f.Q.value=.9;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.2);
  s.connect(f);f.connect(g);g.connect(musicBus);g.connect(reverb);s.start(t,Math.random());s.stop(t+.22);
}
function pluck(note,t,vol){
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type="triangle";o.frequency.value=hz(note);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
  o.connect(g);g.connect(musicBus);g.connect(delay);o.start(t);o.stop(t+.3);
}

// one 16th-note step; the track evolves over a 32-bar cycle
function playStep(i,t){
  var bar=Math.floor(i/16),s=i%16,cycleBar=bar%32;
  var chord=CHORDS[Math.floor(bar/2)%CHORDS.length];
  var intro=bar<4, breakdown=cycleBar>=24&&cycleBar<28;
  if(s===0&&bar%2===0)pad(chord,t,STEP*32);
  if(!intro&&!breakdown){
    if(s===0||s===8||(s===10&&cycleBar%4===3))kick(t);
    if(s%4===2)bass(chord.root,t,STEP*1.6);
    if(s===14)bass(chord.root+12,t,STEP*1.2);
    if(cycleBar>=8&&(s===4||s===12))clap(t);
  }
  if(!intro){
    if(s%4===2)hat(t,.07,s===14&&cycleBar%2===1);
    else if(s%2===1)hat(t,.022,false);
  }
  if(cycleBar>=12&&cycleBar<24&&s%2===0)pluck(chord.notes[ARP[(s/2)%8]]+12,t,.055);
  if(breakdown&&s%4===0)pluck(chord.notes[ARP[(s/4)%8]]+24,t,.035);
}
function scheduler(){
  while(nextStep<ctx.currentTime+.18){playStep(stepIndex,nextStep);nextStep+=STEP;stepIndex++}
}
function startMusic(){
  if(started)return;started=true;
  nextStep=ctx.currentTime+.08;stepIndex=0;
  timer=setInterval(scheduler,40);scheduler();
}

/* ---------- effects ---------- */
function tick(){
  if(!enabled)return;var t=ctx.currentTime;
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(2100,t);o.frequency.exponentialRampToValueAtTime(1300,t+.04);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
  o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+.07);
}
function whoosh(up){
  if(!enabled)return;var t=ctx.currentTime;
  var s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noiseBuf;f.type="bandpass";f.Q.value=1.4;
  f.frequency.setValueAtTime(up?260:3200,t);f.frequency.exponentialRampToValueAtTime(up?3400:240,t+.42);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.32,t+.16);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
  s.connect(f);f.connect(g);g.connect(sfxBus);s.start(t,Math.random());s.stop(t+.52);
}
function impact(){
  var t=ctx.currentTime;
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(32,t+1.3);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.8,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+1.5);
  o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+1.55);
  var s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),ng=ctx.createGain();
  s.buffer=noiseBuf;f.type="lowpass";f.frequency.setValueAtTime(2400,t);f.frequency.exponentialRampToValueAtTime(160,t+.7);
  ng.gain.setValueAtTime(.35,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.8);
  s.connect(f);f.connect(ng);ng.connect(sfxBus);s.start(t);s.stop(t+.85);
  [81,88,93].forEach(function(n,i){
    var so=ctx.createOscillator(),sg=ctx.createGain();so.type="sine";so.frequency.value=hz(n);
    sg.gain.setValueAtTime(.0001,t+.05);sg.gain.exponentialRampToValueAtTime(.035,t+.25+i*.05);sg.gain.exponentialRampToValueAtTime(.0001,t+2.4);
    so.connect(sg);sg.connect(reverb);so.start(t+.05);so.stop(t+2.5);
  });
}

/* ---------- on / off ---------- */
function fadeTo(param,v,sec){var t=ctx.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(v,t+sec)}
function turnOn(withImpact){
  init();
  var p=ctx.resume?ctx.resume():null;
  enabled=true;setPref("on");render();
  function go(){fadeTo(master.gain,1,withImpact?.4:2.5);if(withImpact)impact();startMusic();if(ducked)fadeTo(musicBus.gain,DUCK_LEVEL,.1)}
  if(p&&p.then)p.then(go,go);else go();
}
function turnOff(){
  enabled=false;setPref("off");render();
  if(!ctx)return;fadeTo(master.gain,0,.6);
  setTimeout(function(){if(!enabled&&ctx.state==="running")ctx.suspend()},700);
}

/* ---------- button ---------- */
var css=document.createElement("style");
css.textContent=[
".snd-btn{position:fixed;left:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:1200;width:48px;height:48px;border-radius:50%;border:1px solid rgba(45,182,255,.34);background:rgba(4,13,22,.78);color:#fff;display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:0;box-shadow:0 12px 32px rgba(0,0,0,.36),0 0 24px rgba(7,140,255,.18);backdrop-filter:blur(16px) saturate(135%);-webkit-backdrop-filter:blur(16px) saturate(135%);transition:border-color .2s,background .2s,opacity .35s;-webkit-tap-highlight-color:transparent}",
".snd-btn:hover{border-color:rgba(45,182,255,.7)}",
".snd-btn i{display:block;width:3px;height:6px;border-radius:2px;background:#8ea6ba;transition:height .2s,background .2s}",
".snd-btn.on{border-color:rgba(45,182,255,.75);background:rgba(7,140,255,.18)}",
".snd-btn.on i{background:#2db6ff;box-shadow:0 0 8px rgba(45,182,255,.8);animation:sndBar .9s ease-in-out infinite}",
".snd-btn.on i:nth-child(2){animation-delay:-.45s}.snd-btn.on i:nth-child(3){animation-delay:-.2s}.snd-btn.on i:nth-child(4){animation-delay:-.65s}",
".snd-btn:not(.on):after{content:'';position:absolute;width:26px;height:1.5px;background:#8ea6ba;transform:rotate(-40deg);border-radius:2px}",
"@keyframes sndBar{0%,100%{height:5px}50%{height:18px}}",
".snd-hint{position:fixed;left:72px;bottom:calc(30px + env(safe-area-inset-bottom));z-index:1200;padding:7px 12px;background:rgba(4,13,22,.9);border:1px solid rgba(45,182,255,.3);color:#cfe8ff;font:800 9px/1 Inter,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;opacity:0;transform:translateX(-6px);transition:opacity .35s,transform .35s;pointer-events:none}",
".snd-hint.show{opacity:1;transform:none}",
"body.menu-open .snd-btn,body.menu-open .snd-hint{opacity:0;pointer-events:none}",
"@media (prefers-reduced-motion:reduce){.snd-btn.on i{animation:none;height:12px}}"
].join("");
document.head.appendChild(css);

var btn=document.createElement("button");
btn.type="button";btn.className="snd-btn";btn.innerHTML="<i></i><i></i><i></i><i></i>";
var hint=document.createElement("div");hint.className="snd-hint";
document.body.appendChild(btn);document.body.appendChild(hint);

function render(){
  var el=lang()==="el";
  btn.classList.toggle("on",enabled);
  btn.setAttribute("aria-pressed",enabled?"true":"false");
  var label=enabled?(el?"Απενεργοποίηση ήχου":"Sound off"):(el?"Ενεργοποίηση ήχου":"Sound on");
  btn.setAttribute("aria-label",label);btn.title=label;
  hint.textContent=el?"Πάτα για ήχο":"Tap for sound";
}
render();
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});

btn.addEventListener("click",function(e){
  e.stopPropagation();hint.classList.remove("show");
  if(enabled)turnOff();else turnOn(true);
});

// returning visitor who left sound on: resume on their first tap anywhere
var pref=getPref();
if(pref==="on"){
  enabled=true;render();
  var resume=function(e){
    if(btn.contains(e.target))return;
    document.removeEventListener("pointerdown",resume,true);document.removeEventListener("keydown",resume,true);
    if(enabled)turnOn(false);
  };
  document.addEventListener("pointerdown",resume,true);document.addEventListener("keydown",resume,true);
}else if(pref!=="off"){
  // first visit: gentle hint after the intro
  setTimeout(function(){if(!enabled&&!getPref()&&!document.documentElement.classList.contains("intro-lock")){hint.classList.add("show");setTimeout(function(){hint.classList.remove("show")},5000)}},2800);
}

// used by the opening screen's "Enter with sound / Without sound" buttons
window.ForceSound={on:function(){hint.classList.remove("show");turnOn(true)},off:function(){hint.classList.remove("show");turnOff()}};

/* ---------- interaction sounds ---------- */
document.addEventListener("click",function(e){
  if(!enabled||!ctx||btn.contains(e.target))return;
  var el=e.target.closest("button,a,.lightbox-item,[role=button]");if(!el)return;
  if(el.closest(".lightbox-item")||el.id==="lightboxNext"||el.id==="lightboxPrev")whoosh(true);
  else if(el.id==="menuBtn")whoosh(!document.body.classList.contains("menu-open"));
  else if(el.id==="lightboxClose"||el.id==="backToTop")whoosh(false);
  else tick();
},true);

// duck the music while a video with sound plays (e.g. the member registration guide)
document.addEventListener("play",function(e){
  if(e.target.tagName!=="VIDEO"||e.target.muted)return;
  ducked=true;if(ctx&&enabled)fadeTo(musicBus.gain,DUCK_LEVEL,.4);
},true);
["pause","ended"].forEach(function(ev){
  document.addEventListener(ev,function(e){
    if(e.target.tagName!=="VIDEO"||e.target.muted)return;
    ducked=false;if(ctx&&enabled)fadeTo(musicBus.gain,MUSIC_LEVEL,1.2);
  },true);
});

// pause everything when the tab is hidden
document.addEventListener("visibilitychange",function(){
  if(!ctx)return;
  if(document.hidden){if(ctx.state==="running")ctx.suspend()}
  else if(enabled&&started)ctx.resume();
});
})();
