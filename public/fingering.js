(function () {
  console.log('[fingering] script loaded');
  const img = document.getElementById('fingeringImg');
  if (!img) return;

  // Parse images
  let images = [];
  let currentIndex = 0;
  try { images = JSON.parse(img.dataset.images || '[]'); } catch(e) {}
  const initial = img.dataset.initial || '';
  currentIndex = images.indexOf(initial);
  if (currentIndex === -1) currentIndex = 0;

  const answerKey = {
    'C1.png': ['0'], 'D1.png': ['1','3'], 'E1.png': ['1','2'],
    'F1.png': ['1'], 'G1.png': ['0'], 'A1.png': ['1','2'],
    'B1.png': ['2'], 'C2.png': ['0']
  };

  const activeKeys = new Set();
  const recentPresses = [];
  const TOUCH_WINDOW = 180;
  let wrongTimeout = null;
  const wrongCounts = {};

  // Streak
  let streak = parseInt(localStorage.getItem('fingering-streak') || '0',10) || 0;
  let best = parseInt(localStorage.getItem('fingering-best') || '0',10) || 0;
  const streakEl = document.getElementById('streak-value');
  const bestEl = document.getElementById('best-value');
  if(streakEl) streakEl.textContent = String(streak);
  if(bestEl) bestEl.textContent = String(best);

  // -------------------------------
  // IMAGE & ANIMATION
  // -------------------------------
  function setImage(idx){
    const url = `/assets/images/${images[idx]}`;
    const pre = new Image();
    pre.src = url;
    pre.onload = () => { img.src = url; };
  }

  function advanceToNext(){ currentIndex=(currentIndex+1)%images.length; setImage(currentIndex); }

  function triggerCorrect(){
    img.classList.remove('correct-anim');
    void img.offsetWidth;
    img.classList.add('correct-anim');
    setTimeout(() => img.classList.remove('correct-anim'), 700);
  }

  function spawnConfetti(delay=0){
    setTimeout(()=>{
      const conf = document.createElement('div');
      conf.classList.add('confetti');
      conf.style.left = `${Math.random()*80+10}%`;
      conf.style.backgroundColor = `hsl(${Math.random()*360},70%,60%)`;
      img.parentElement.appendChild(conf);
      setTimeout(()=>conf.remove(),1000);
    }, delay);
  }

  function triggerWrong(pressedBtn=null){
    const filename = images[currentIndex];
    wrongCounts[filename] = (wrongCounts[filename] || 0) + 1;

    // Remove existing classes
    img.classList.remove('shake','wrong-glow','correct-anim','fingering-anim');
    if(pressedBtn) pressedBtn.classList.remove('gp-wrong');

    // Force reflow then add classes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        img.classList.add('shake','wrong-glow');
        if(pressedBtn) pressedBtn.classList.add('gp-wrong');
        setTimeout(() => {
          img.classList.remove('shake','wrong-glow');
          if(pressedBtn) pressedBtn.classList.remove('gp-wrong');
        }, 420);
      });
    });

    // reset streak
    streak = 0;
    localStorage.setItem('fingering-streak','0');
    if(streakEl) streakEl.textContent = '0';

    // Reveal combo if too many wrongs
    if((wrongCounts[filename] || 0) >= 3){
      revealComboForCurrent();
      wrongCounts[filename] = 0;
    }
  }

  function revealComboForCurrent(){
    const filename = images[currentIndex];
    const req = answerKey[filename] || [];
    const buttons = document.querySelectorAll('#gamepad [data-button]');
    buttons.forEach(b => { if(req.includes(b.getAttribute('data-button'))) b.classList.add('gp-hint'); });
    setTimeout(()=>buttons.forEach(b=>b.classList.remove('gp-hint')),2500);
  }

  function checkComboAndAdvance(){
    const filename = images[currentIndex];
    const req = answerKey[filename] || [];
    if(!req.length) return false;

    const nowKeys = new Set(activeKeys);
    const now = Date.now();
    for(let i=recentPresses.length-1;i>=0;i--){
      if(now-recentPresses[i].time <= TOUCH_WINDOW) nowKeys.add(recentPresses[i].key);
      else recentPresses.splice(i,1);
    }

    const ok = req.every(k=>nowKeys.has(k));
    if(ok){
      triggerCorrect();
      advanceToNext();
      recentPresses.length=0; activeKeys.clear();
      wrongCounts[filename]=0;

      // update streak/best
      streak++; localStorage.setItem('fingering-streak',String(streak));
      if(streakEl) streakEl.textContent=String(streak);
      if(streak>best){ best=streak; localStorage.setItem('fingering-best',String(best)); if(bestEl) bestEl.textContent=String(best); }

      const streakBox = document.getElementById('streak');
      if(streakBox){
        streakBox.classList.remove('streak-pulse'); void streakBox.offsetWidth; streakBox.classList.add('streak-pulse');
        setTimeout(()=>streakBox.classList.remove('streak-pulse'),900);
      }
      return true;
    }
    return false;
  }

  // -------------------------------
  // EVENT LISTENERS
  // -------------------------------
  img.addEventListener('click',()=>{
    let next=Math.floor(Math.random()*images.length);
    if(images.length>1) while(next===currentIndex) next=Math.floor(Math.random()*images.length);
    currentIndex=next; setImage(currentIndex);
  });

  // Keyboard
  window.addEventListener('keydown',e=>{
    let k='';
    if(e.code?.startsWith('Numpad')) k=e.code.replace('Numpad','');
    else if(/^[0-9]$/.test(e.key)) k=e.key;
    if(!k || !['0','1','2','3'].includes(k)) return;
    activeKeys.add(k);
    const matched = checkComboAndAdvance();
    if(!matched) triggerWrong(); // use unified wrong handler
  });
  window.addEventListener('keyup',e=>{
    let k='';
    if(e.code?.startsWith('Numpad')) k=e.code.replace('Numpad','');
    else if(/^[0-9]$/.test(e.key)) k=e.key;
    if(!k) return;
    activeKeys.delete(k);
  });

  // Gamepad buttons
  document.querySelectorAll('#gamepad [data-button]').forEach(b=>{
    const key = b.getAttribute('data-button');
    if(!key) return;
    const pressHandler = ()=>{
      recentPresses.push({key,time:Date.now()});
      const matched = checkComboAndAdvance();
      if(!matched) triggerWrong(b);
      else {
        // visual feedback for correct
        b.classList.add('gp-pressed'); setTimeout(()=>b.classList.remove('gp-pressed'),120);
      }
    };
    b.addEventListener('click',pressHandler);
    b.addEventListener('touchstart', e=>{ e.preventDefault(); pressHandler(); }, {passive:false});
  });
})();
