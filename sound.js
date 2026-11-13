/* FORCE FITNESS CLUB — immersive sound
   Original music and effects generated live with the Web Audio API (no audio files, no licensing).
   Off by default; visitors switch it on with the speaker button (browsers require a tap before sound). */
(function(){
"use strict";
var AC=window.AudioContext||window.webkitAudioContext;
if(!AC)return;

var PREF_KEY="force-sound";
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

/* ---------- music ----------
   Five original styles. Pick the site default with DEFAULT_STYLE; preview any with ?sound=<name>. */
var DEFAULT_STYLE="power";
var STYLE=(function(){var m=/[?&]sound=([a-z]+)/.exec(location.search);return m?m[1]:DEFAULT_STYLE})();

function distCurve(k){var n=1024,c=new Float32Array(n);for(var i=0;i<n;i++){var x=i*2/n-1;c[i]=(1+k)*x/(1+k*Math.abs(x))}return c}
function out(node,dry,wetRev,wetDelay){node.connect(dry||musicBus);if(wetRev)node.connect(reverb);if(wetDelay)node.connect(delay)}
function env(g,t,peak,att,dec){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+att+dec)}
function noiseSrc(t,dur){var s=ctx.createBufferSource();s.buffer=noiseBuf;s.start(t,Math.random()*1.5);s.stop(t+dur+.02);return s}

function pad(chord,t,dur,o){
  o=o||{};var lp=ctx.createBiquadFilter();lp.type="lowpass";lp.Q.value=.7;
  var lo=o.lo||380,hi=o.hi||1100,vol=o.vol||.07;
  lp.frequency.setValueAtTime(lo,t);lp.frequency.linearRampToValueAtTime(hi,t+dur*.5);lp.frequency.linearRampToValueAtTime(lo,t+dur);
  var g=ctx.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(o.att||1.6));g.gain.setValueAtTime(vol,t+dur-1);g.gain.linearRampToValueAtTime(0,t+dur+.6);
  lp.connect(g);g.connect(padBus);g.connect(reverb);
  chord.notes.forEach(function(n){[-7,7].forEach(function(det){
    var osc=ctx.createOscillator();osc.type=o.type||"sawtooth";osc.frequency.value=hz(n+(o.oct||0));osc.detune.value=det;
    osc.connect(lp);osc.start(t);osc.stop(t+dur+.8);
  })});
}
function kick(t,o){
  o=o||{};var osc=ctx.createOscillator(),g=ctx.createGain();
  osc.type="sine";osc.frequency.setValueAtTime(o.f0||130,t);osc.frequency.exponentialRampToValueAtTime(o.f1||42,t+(o.sweep||.22));
  env(g,t,o.vol||.9,.005,o.dec||.4);
  if(o.dist){var ws=ctx.createWaveShaper();ws.curve=distCurve(o.dist);osc.connect(ws);ws.connect(g)}else osc.connect(g);
  g.connect(musicBus);osc.start(t);osc.stop(t+(o.dec||.4)+.05);
  if(o.click){var n=noiseSrc(t,.02),f=ctx.createBiquadFilter(),ng=ctx.createGain();f.type="highpass";f.frequency.value=2500;env(ng,t,o.click,.001,.02);n.connect(f);f.connect(ng);ng.connect(musicBus)}
  if(o.pump!==false){padBus.gain.cancelScheduledValues(t);padBus.gain.setValueAtTime(o.pumpTo||.35,t);padBus.gain.linearRampToValueAtTime(1,t+(o.pumpTime||.32))}
}
function bass(note,t,len,o){
  o=o||{};var osc=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  osc.type=o.type||"sawtooth";osc.frequency.value=hz(note);
  f.type="lowpass";f.frequency.setValueAtTime(o.cut||520,t);f.frequency.exponentialRampToValueAtTime(o.cutEnd||140,t+len);f.Q.value=o.q||4;
  env(g,t,o.vol||.22,.01,len);
  osc.connect(f);
  if(o.dist){var ws=ctx.createWaveShaper();ws.curve=distCurve(o.dist);f.connect(ws);ws.connect(g)}else f.connect(g);
  g.connect(musicBus);osc.start(t);osc.stop(t+len+.05);
}
function sub808(note,t,len,from){
  var osc=ctx.createOscillator(),ws=ctx.createWaveShaper(),g=ctx.createGain();
  osc.type="sine";ws.curve=distCurve(2.5);
  if(from){osc.frequency.setValueAtTime(hz(from),t);osc.frequency.exponentialRampToValueAtTime(hz(note),t+.12)}else osc.frequency.setValueAtTime(hz(note),t);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5,t+.008);g.gain.setValueAtTime(.5,t+len*.25);g.gain.exponentialRampToValueAtTime(.0001,t+len);
  osc.connect(ws);ws.connect(g);g.connect(musicBus);osc.start(t);osc.stop(t+len+.05);
}
function hat(t,vol,len,hp){
  var s=noiseSrc(t,len||.035),f=ctx.createBiquadFilter(),g=ctx.createGain();
  f.type="highpass";f.frequency.value=hp||8200;env(g,t,vol,.001,len||.035);
  s.connect(f);f.connect(g);g.connect(musicBus);
}
function clap(t,vol,freq,len){
  var s=noiseSrc(t,len||.2),f=ctx.createBiquadFilter(),g=ctx.createGain();
  f.type="bandpass";f.frequency.value=freq||1500;f.Q.value=.9;env(g,t,vol||.16,.004,len||.2);
  s.connect(f);f.connect(g);out(g,null,true);
}
function snare(t,vol){
  clap(t,vol*.9,2200,.22);
  var osc=ctx.createOscillator(),g=ctx.createGain();osc.type="triangle";osc.frequency.setValueAtTime(220,t);osc.frequency.exponentialRampToValueAtTime(150,t+.1);
  env(g,t,vol*.6,.002,.12);osc.connect(g);g.connect(musicBus);osc.start(t);osc.stop(t+.15);
}
function pluck(note,t,vol,o){
  o=o||{};var osc=ctx.createOscillator(),g=ctx.createGain();
  osc.type=o.type||"triangle";osc.frequency.value=hz(note);env(g,t,vol,.004,o.dec||.28);
  osc.connect(g);out(g,null,o.rev,o.delay!==false);osc.start(t);osc.stop(t+(o.dec||.28)+.05);
  if(o.bell){var o2=ctx.createOscillator(),g2=ctx.createGain();o2.type="sine";o2.frequency.value=hz(note)*3.01;env(g2,t,vol*.35,.002,(o.dec||.28)*.5);o2.connect(g2);out(g2,null,true,true);o2.start(t);o2.stop(t+(o.dec||.28))}
}
function stab(chord,t,vol,oct){
  var f=ctx.createBiquadFilter(),g=ctx.createGain();f.type="lowpass";f.frequency.setValueAtTime(3200,t);f.frequency.exponentialRampToValueAtTime(500,t+.18);f.Q.value=3;
  env(g,t,vol,.003,.2);f.connect(g);out(g,null,true,true);
  chord.notes.forEach(function(n){var osc=ctx.createOscillator();osc.type="sawtooth";osc.frequency.value=hz(n+(oct||12));osc.detune.value=(Math.random()-.5)*14;osc.connect(f);osc.start(t);osc.stop(t+.25)});
}
function metal(t,vol){
  var g=ctx.createGain(),f=ctx.createBiquadFilter();f.type="bandpass";f.frequency.value=3400;f.Q.value=2;env(g,t,vol,.002,.18);
  [263,401,587,733,951].forEach(function(fr){var osc=ctx.createOscillator();osc.type="square";osc.frequency.value=fr*1.6;osc.connect(f);osc.start(t);osc.stop(t+.22)});
  f.connect(g);out(g,null,true);
  var n=noiseSrc(t,.12),nf=ctx.createBiquadFilter(),ng=ctx.createGain();nf.type="bandpass";nf.frequency.value=1800;env(ng,t,vol*.9,.002,.12);n.connect(nf);nf.connect(ng);out(ng,null,true);
}
function riser(t,dur,vol){
  var s=noiseSrc(t,dur),f=ctx.createBiquadFilter(),g=ctx.createGain();f.type="bandpass";f.Q.value=2;
  f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(7000,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur);g.gain.linearRampToValueAtTime(0,t+dur+.02);
  s.connect(f);f.connect(g);out(g,null,true);
}
function drone(note,t,dur,vol){
  var osc=ctx.createOscillator(),o2=ctx.createOscillator(),f=ctx.createBiquadFilter(),ws=ctx.createWaveShaper(),g=ctx.createGain();
  osc.type="sawtooth";o2.type="square";osc.frequency.value=hz(note);o2.frequency.value=hz(note)*1.005;
  f.type="lowpass";f.frequency.setValueAtTime(180,t);f.frequency.linearRampToValueAtTime(520,t+dur*.6);f.frequency.linearRampToValueAtTime(200,t+dur);f.Q.value=6;
  ws.curve=distCurve(6);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.4);g.gain.setValueAtTime(vol,t+dur-.3);g.gain.linearRampToValueAtTime(0,t+dur);
  osc.connect(f);o2.connect(f);f.connect(ws);ws.connect(g);g.connect(padBus);osc.start(t);o2.start(t);osc.stop(t+dur+.05);o2.stop(t+dur+.05);
}

var ARP=[0,1,2,1,0,2,1,2];
function ch(root,notes){return {root:root,notes:notes}}
var STYLES={
  /* 1. Cinematic Pulse — dark, steady, 96 BPM (A minor) */
  pulse:{bpm:96,level:1,chords:[ch(45,[57,60,64]),ch(41,[53,57,60]),ch(38,[50,53,57]),ch(40,[52,56,59])],barsPerChord:2,
    step:function(s,bar,cb,c,t,S){
      var intro=bar<4,brk=cb>=24&&cb<28;
      if(s===0&&bar%2===0)pad(c,t,S*32);
      if(!intro&&!brk){
        if(s===0||s===8||(s===10&&cb%4===3))kick(t);
        if(s%4===2)bass(c.root,t,S*1.6);
        if(s===14)bass(c.root+12,t,S*1.2);
        if(cb>=8&&(s===4||s===12))clap(t);
      }
      if(!intro){if(s%4===2)hat(t,.07,s===14&&cb%2===1?.16:.035);else if(s%2===1)hat(t,.022)}
      if(cb>=12&&cb<24&&s%2===0)pluck(c.notes[ARP[(s/2)%8]]+12,t,.055);
      if(brk&&s%4===0)pluck(c.notes[ARP[(s/4)%8]]+24,t,.035);
    }},
  /* 2. Power Drive — energetic four-on-the-floor workout, 128 BPM (E minor) */
  power:{bpm:128,level:.85,chords:[ch(40,[52,55,59]),ch(36,[52,55,60]),ch(43,[55,59,62]),ch(38,[54,57,62])],barsPerChord:2,
    step:function(s,bar,cb,c,t,S){
      var intro=bar<4,brk=cb>=24&&cb<28;
      if(s===0&&bar%2===0)pad(c,t,S*32,{vol:.045,hi:1600});
      if(!intro&&!brk){
        if(s%4===0)kick(t,{f0:150,f1:45,dec:.32,vol:.95,click:.08,pumpTo:.25,pumpTime:.22});
        if(s%4===2)bass(c.root+12,t,S*1.7,{cut:900,cutEnd:200,vol:.2});
        if(s%4===3&&cb>=8)bass(c.root+12,t,S*.8,{cut:700,cutEnd:200,vol:.08});
        if(s===4||s===12)clap(t,.18);
        if(cb>=8&&[3,6,10].indexOf(s)>=0&&bar%2===1)stab(c,t,.06);
      }
      if(!intro||bar>=2){if(s%4===2)hat(t,.09,.11,7000);else hat(t,s%2?.03:.018)}
      if(brk&&s%2===0)pluck(c.notes[ARP[(s/2)%8]]+24,t,.04,{type:"square",dec:.12});
      if((cb===7||cb===23)&&s===0)riser(t,S*16,.18);
    }},
  /* 3. Iron Industrial — heavy, gritty, metallic, 110 BPM (D minor) */
  iron:{bpm:110,level:.72,chords:[ch(38,[50,53,57]),ch(34,[50,53,58]),ch(43,[50,55,58]),ch(45,[52,57,61])],barsPerChord:2,
    step:function(s,bar,cb,c,t,S){
      var intro=bar<2,brk=cb>=24&&cb<28;
      if(s===0)drone(c.root-12,t,S*16,brk?.05:.09);
      if(!intro&&!brk){
        if(s===0||s===6||s===8||(s===11&&bar%2))kick(t,{f0:110,f1:38,dec:.45,vol:.9,dist:8,pumpTo:.5});
        if(s===4||s===12)metal(t,.11);
        if(s===14&&bar%2===1)clap(t,.12,900,.35);
      }
      if(!intro){if(s%2===0)hat(t,s%4===2?.06:.025,.05,6000)}
      if(brk&&s===0)metal(t,.07);
      if(cb>=16&&cb<24&&(s===0||s===3||s===6))pluck(c.notes[0]+12,t,.05,{type:"sawtooth",dec:.18});
    }},
  /* 4. Deep Focus — calm, warm, steady, 84 BPM (F major 7ths) */
  focus:{bpm:84,level:1.15,chords:[ch(41,[57,60,64,65]),ch(40,[55,59,62,64]),ch(38,[53,57,60,62]),ch(36,[52,55,59,60])],barsPerChord:2,
    step:function(s,bar,cb,c,t,S){
      var intro=bar<2,brk=cb>=24&&cb<28;
      if(s===0&&bar%2===0)pad(c,t,S*32,{type:"triangle",lo:500,hi:1400,vol:.06,att:2.4});
      if(!intro&&!brk){
        if(s===0||s===10)kick(t,{f0:90,f1:40,dec:.5,vol:.6,pumpTo:.7,pumpTime:.4});
        if(s===4||s===12)clap(t,.06,3000,.06);
        if(s===0||s===10)bass(c.root,t,S*5,{type:"sine",cut:400,cutEnd:300,vol:.28,q:1});
      }
      if(!intro&&s%2===0)hat(t,s%4===2?.035:.015,.06,6500);
      if(cb>=4&&s%2===0&&!(brk&&s%4))pluck(c.notes[ARP[(s/2)%8]%c.notes.length]+12,t,.05,{type:"sine",dec:.6,rev:true});
    }},
  /* 5. Hype Trap — hard-hitting half-time 808s, 140 BPM (C minor) */
  trap:{bpm:140,level:.7,chords:[ch(36,[60,63,67]),ch(32,[60,63,68]),ch(39,[58,63,67]),ch(34,[58,62,65])],barsPerChord:2,
    step:function(s,bar,cb,c,t,S){
      var intro=bar<4,brk=cb>=24&&cb<28;
      if(s===0&&bar%2===0)pad(c,t,S*32,{type:"triangle",vol:.04,lo:600,hi:1200});
      if(!intro&&!brk){
        if(s===0||(s===7&&bar%2===0)||s===10)kick(t,{f0:160,f1:48,dec:.3,vol:.8,click:.05,pump:false});
        if(s===0)sub808(c.root,t,S*7,bar%4===3?c.root+7:0);
        if(s===10)sub808(c.root,t,S*5);
        if(s===8)snare(t,.25);
      }
      if(!intro||bar>=2){
        if(s===14&&bar%2===1){for(var r=0;r<4;r++)hat(t+r*S/2,.05)}
        else if(s%2===0)hat(t,s%4===0?.06:.035);
      }
      if(cb>=8&&!brk&&[0,3,6,9].indexOf(s)>=0&&bar%2===0)pluck(c.notes[[2,1,0,1][[0,3,6,9].indexOf(s)]]+12,t,.05,{type:"sine",dec:.4,bell:true});
      if(brk&&s%4===0)pluck(c.notes[ARP[(s/4)%8]]+12,t,.04,{type:"sine",dec:.5,bell:true});
    }}
};
var ST=STYLES[STYLE]||STYLES.pulse;
var BPM=ST.bpm, STEP=60/BPM/4;

function playStep(i,t){
  var bar=Math.floor(i/16),s=i%16,cycleBar=bar%32;
  var chord=ST.chords[Math.floor(bar/ST.barsPerChord)%ST.chords.length];
  ST.step(s,bar,cycleBar,chord,t,STEP);
}
function scheduler(){
  while(nextStep<ctx.currentTime+.18){playStep(stepIndex,nextStep);nextStep+=STEP;stepIndex++}
}
function startMusic(){
  if(started)return;started=true;
  musicBus.gain.value=MUSIC_LEVEL*ST.level;
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
    ducked=false;if(ctx&&enabled)fadeTo(musicBus.gain,MUSIC_LEVEL*ST.level,1.2);
  },true);
});

// pause everything when the tab is hidden
document.addEventListener("visibilitychange",function(){
  if(!ctx)return;
  if(document.hidden){if(ctx.state==="running")ctx.suspend()}
  else if(enabled&&started)ctx.resume();
});
})();
