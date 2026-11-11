// Pagina principală: intrarea (logo-ul 3D se întoarce, ușa de pe spatele lui se deschide, treci prin ea în pagină)
// și Ruth, mascota din colț.
// Fără acest script pagina se vede direct: intrarea apare doar dacă scriptul din <head> a pus clasa `has-intro`.
// Numele din colțul paginii rulează aceeași animație invers și te aduce înapoi la scut.
(function () {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  // ---------- Intrarea ----------

  const intro = document.getElementById('intro');
  if (intro) {
    const logo = document.getElementById('intro-logo');
    const zoom = intro.querySelector('.l3-zoom');
    const tilt = intro.querySelector('.l3-tilt');
    const float = intro.querySelector('.l3-float');
    const spin = intro.querySelector('.l3-spin');
    const door = intro.querySelector('.l3-door');
    const lock = intro.querySelector('.l3-lock');
    const shackle = intro.querySelector('.l3-shackle');
    const shade = intro.querySelector('.l3-door-shade');
    const glow = intro.querySelector('.l3-door-glow');
    const toSmile = document.getElementById('l3-to-smile');
    const toCheck = document.getElementById('l3-to-check');
    const page = document.querySelector('.page');
    // Piesele din capul paginii, în ordinea în care se așază când intri.
    const heroParts = ['.hero .eyebrow', '.hero h1', '.hero .lead', '.hero .actions', '.hero .phone-stage']
      .map(selector => document.querySelector(selector)).filter(Boolean);

    // Cât durează învârtirea de la trecerea cursorului (ca în style.css), după care apare zâmbetul.
    const HOVER_SPIN_MS = 900;
    // Mărirea scutului cât e întors cu ușa spre tine (aceeași ca la trecerea cursorului, vezi style.css).
    const OPEN_SCALE = 1.34;
    // Cât din lățimea și din înălțimea scutului ocupă ușa (desenul din build.mjs: 200 din 600, 330 din 672).
    const DOOR = { width: 200 / 600, height: 330 / 672 };

    // Toată intrarea e o singură mișcare de 1,2 secunde, la fel pe calculator și pe telefon. Pașii se suprapun:
    // fiecare are [început, durată] în milisecunde, pe același ceas. Întoarcerea la scut e aceeași mișcare, dată
    // înapoi: pagina se stinge, ușa se închide, lacătul urcă la loc și se încuie, scutul se întoarce cu fața.
    const TOTAL = 1200;
    const FLIP = [0, 520];        // A. scutul se întoarce cu ușa spre tine
    const SETTLE = [0, 300];      //    plutirea și înclinarea după cursor se îndreaptă, ca ușa să stea drept în față
    const UNLOCK = [330, 210];    // B. cum apare ușa, belciugul lacătului sare și se dă la o parte…
    const DROP = [490, 230];      //    …apoi lacătul cade și se pierde
    const SWING = [560, 460];     // C. ușa se deschide în balama…
    const ZOOM = [560, 640];      //    …și, în același timp, camera pornește spre ea și trece prin ea
    const FADE = [1008, 192];     // D. ultimii 30% din drum: intrarea se estompează, pagina apare
    const HERO = { from: 960, gap: 45, duration: 480 };
    // Belciugul sare puțin peste și se așază, ca un arc.
    const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
    const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
    const SOFT = 'cubic-bezier(0.45, 0, 0.55, 1)';

    // `active`: intrarea e pe ecran. `busy`: rulează deschiderea sau întoarcerea, deci logo-ul nu răspunde.
    let active = root.classList.contains('has-intro');
    let busy = false;
    let smiling = false;
    let smileTimer = null;
    // Fiecare deschidere / întoarcere are un număr; pașii rămași dintr-una veche se opresc singuri.
    let run = 0;

    const morph = (animation) => { try { animation.beginElement(); } catch (error) { /* fără SMIL: rămâne bifa */ } };
    const setSmile = (on) => {
      if (on === smiling) return;
      smiling = on;
      intro.classList.toggle('is-smile', on);
      morph(on ? toSmile : toCheck);
    };

    const hoverIn = () => {
      if (!active || busy) return;
      intro.classList.add('is-hover');
      clearTimeout(smileTimer);
      smileTimer = setTimeout(() => setSmile(true), reduced ? 0 : HOVER_SPIN_MS);
    };
    const hoverOut = () => {
      if (!active || busy) return;
      clearTimeout(smileTimer);
      setSmile(false);
      intro.classList.remove('is-hover');
    };
    // Pe ecranele fără cursor, logo-ul se prezintă singur după o clipă; o atingere deschide ușa.
    const settle = () => { if (!canHover) setTimeout(hoverIn, 900); };

    if (canHover) {
      logo.addEventListener('pointerenter', hoverIn);
      logo.addEventListener('pointerleave', hoverOut);
    }
    logo.addEventListener('focus', hoverIn);
    logo.addEventListener('blur', hoverOut);
    if (active) settle();

    // Logo-ul se înclină ușor după cursor, ca un obiect adevărat. Poziția cursorului se aplică o dată pe cadru.
    if (canHover && !reduced) {
      let pointer = null;
      window.addEventListener('pointermove', (event) => {
        if (!active || busy) return;
        const first = !pointer;
        pointer = event;
        if (!first) return;
        requestAnimationFrame(() => {
          const { clientX, clientY } = pointer;
          pointer = null;
          if (!active || busy) return;
          const x = clientX / window.innerWidth - 0.5;
          const y = clientY / window.innerHeight - 0.5;
          tilt.style.transform = `rotateX(${(-y * 22).toFixed(2)}deg) rotateY(${(x * 30).toFixed(2)}deg)`;
        });
      }, { passive: true });
    }

    // Animațiile intrării (toate mișcă doar `transform` și `opacity`), ca să poată fi oprite toate odată.
    const moves = new Set();
    // Așezarea pieselor din capul paginii: continuă puțin și după ce pagina e deja a ta.
    const arrivals = new Set();
    const stop = (set) => { set.forEach(animation => animation.cancel()); set.clear(); };
    // Un pas al mișcării. `back` = același pas, dat înapoi, la locul lui oglindit pe ceas (întoarcerea la scut).
    const track = (back, element, frames, [start, duration], easing) => {
      const animation = element.animate(frames, {
        duration,
        delay: back ? TOTAL - start - duration : start,
        direction: back ? 'reverse' : 'normal',
        easing: easing || 'linear',
        fill: 'both',
      });
      moves.add(animation);
      return animation;
    };

    // De câte ori trebuie mărit scutul ca golul ușii să treacă de marginile ecranului (camera a intrat pe ușă).
    const throughScale = () => {
      const doorWidth = logo.offsetWidth * DOOR.width * OPEN_SCALE;
      const doorHeight = logo.offsetHeight * DOOR.height * OPEN_SCALE;
      return Math.max(window.innerWidth / doorWidth, window.innerHeight / doorHeight) * 1.25;
    };
    // Drumul camerei spre ușă: mărirea se înmulțește de la un pas la altul (nu se adună) — așa arată o apropiere
    // adevărată; pornește lin, cât ușa abia se deschide, și prinde viteză.
    const zoomFrames = (full) => {
      const STEPS = 16;
      return Array.from({ length: STEPS + 1 }, (_, i) => {
        const scale = (full ** ((i / STEPS) ** 1.35)).toFixed(3);
        return { offset: i / STEPS, transform: `scale3d(${scale}, ${scale}, 1)` };
      });
    };
    // Unde e scutul acum (unghi și mărime), ca întoarcerea să pornească exact din poziția în care l-a prins click-ul,
    // chiar și în mijlocul învârtirii de la trecerea cursorului.
    const spinPose = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(spin).transform);
      const scale = Math.hypot(matrix.m11, matrix.m13) || 1;
      const angle = (Math.atan2(-matrix.m13, matrix.m11) * 180 / Math.PI + 360) % 360;
      return { angle, scale };
    };

    // Toți pașii, pe același ceas. `from` = poziția din care pornește scutul (la întoarcere: fața, nemărită).
    const timeline = (back, from) => {
      // Se oprește cu spatele (ușa) spre tine, după cel puțin un sfert de tură.
      let turn = 180;
      while (turn - from.angle < 90) turn += 360;
      track(back, spin, [
        { transform: `rotateY(${from.angle.toFixed(2)}deg) scale(${from.scale.toFixed(3)})` },
        { transform: `rotateY(${turn}deg) scale(${OPEN_SCALE})` },
      ], FLIP, OUT);
      track(back, float, [{ transform: from.float }, { transform: 'none' }], SETTLE, OUT);
      track(back, shackle, [
        { transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)' },
        { transform: 'translate3d(0, -13%, 0) scale3d(1, 1, 1)', offset: 0.45 },
        { transform: 'translate3d(0, -13%, 0) scale3d(-1, 1, 1)' },
      ], UNLOCK, SPRING);
      track(back, lock, [
        { transform: 'translate3d(0, 0, 0) rotate(0deg) scale3d(1, 1, 1)', opacity: 1 },
        { transform: 'translate3d(0, 70%, 0) rotate(18deg) scale3d(0.9, 0.9, 1)', opacity: 0 },
      ], DROP, SOFT);
      track(back, door, [
        { transform: 'translateZ(2px) rotateY(0deg)' },
        { transform: 'translateZ(2px) rotateY(-98deg)' },
      ], SWING, OUT);
      track(back, shade, [{ opacity: 0 }, { opacity: 0.5 }], SWING, OUT);
      track(back, glow, [{ opacity: 0 }, { opacity: 1 }], [SWING[0], 320], OUT);
      track(back, zoom, zoomFrames(throughScale()), ZOOM);
      track(back, page, [{ opacity: 0 }, { opacity: 1 }], FADE, OUT);
      track(back, intro, [{ opacity: 1 }, { opacity: 0 }], FADE, SOFT);
      // Gata abia când s-au terminat toți pașii: la întoarcere, estomparea e primul pas, nu ultimul.
      return Promise.all([...moves].map(animation => animation.finished));
    };
    // Aplică pe loc o schimbare de clasă care ar porni tranziția paginii (animația a adus deja pagina acolo).
    const snapPage = (change) => {
      root.classList.add('intro-snap');
      change();
      void page.offsetWidth;
      root.classList.remove('intro-snap');
    };
    const after = (ms, mine, step) => setTimeout(() => { if (mine === run) step(); }, ms);

    // Intrarea s-a terminat: pagina rămâne pe ecran, iar intrarea se ascunde, gata de refolosit (vezi `rewind`).
    const finish = () => {
      run += 1;
      try { sessionStorage.setItem('intro', '1'); } catch (error) { /* navigare privată: intrarea apare din nou data viitoare */ }
      snapPage(() => root.classList.remove('has-intro', 'intro-on'));
      clearTimeout(smileTimer);
      setSmile(false);
      intro.className = 'intro';
      intro.style.cssText = '';
      tilt.style.transform = '';
      stop(moves);
      active = false;
      busy = false;
    };

    // Sari peste: intrarea se stinge și pagina apare, fără drumul prin ușă.
    const skip = () => {
      if (!active || busy) return;
      busy = true;
      run += 1;
      const mine = run;
      clearTimeout(smileTimer);
      intro.classList.add('is-open');
      root.classList.add('intro-on');
      root.classList.remove('has-intro');
      const fade = intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 1 : 320, easing: OUT, fill: 'both' });
      moves.add(fade);
      fade.finished.then(() => { if (mine === run) finish(); }, () => {});
    };

    // Deschiderea, o singură mișcare: scutul se întoarce; cum apare ușa de pe spatele lui, lacătul se descuie și cade;
    // ușa se deschide și camera pornește spre ea; cât trece prin ușă, intrarea se estompează și pagina se așază.
    const open = () => {
      if (!active || busy) return;
      if (reduced) { skip(); return; }
      busy = true;
      run += 1;
      const mine = run;
      clearTimeout(smileTimer);
      // Pozițiile de pornire se citesc înainte de orice schimbare de clasă.
      const from = { ...spinPose(), float: getComputedStyle(float).transform };
      intro.classList.add('is-open');
      root.classList.add('intro-on');
      tilt.style.transform = '';
      const done = timeline(false, from);
      after(FLIP[0] + FLIP[1], mine, () => intro.classList.add('is-flat'));
      // Capul paginii se așază pe rând, de puțin mai jos și puțin mai mic.
      stop(arrivals);
      heroParts.forEach((part, i) => {
        const animation = part.animate([
          { opacity: 0, transform: 'translate3d(0, 16px, 0) scale(0.98)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
        ], { duration: HERO.duration, delay: HERO.from + i * HERO.gap, easing: EXPO, fill: 'backwards' });
        arrivals.add(animation);
        animation.finished.then(() => arrivals.delete(animation), () => {});
      });
      done.then(() => { if (mine === run) finish(); }, () => {});
    };

    // Întoarcerea la scut (numele din colțul paginii): aceeași mișcare, dată înapoi. Pagina se estompează, camera
    // iese prin ușă, ușa se închide, lacătul urcă la loc și scutul se întoarce cu bifa în față.
    const rewind = () => {
      if (active) return;
      active = true;
      busy = true;
      run += 1;
      const mine = run;
      stop(arrivals);
      try { sessionStorage.removeItem('intro'); } catch (error) { /* fără stocare, intrarea apare oricum */ }
      if (reduced) {
        window.scrollTo(0, 0);
        root.classList.add('has-intro');
        busy = false;
        settle();
        return;
      }
      intro.classList.add('is-open', 'is-flat');
      root.classList.add('intro-on', 'has-intro');
      const done = timeline(true, { angle: 0, scale: 1, float: 'none' });
      // După ce pagina s-a stins, o ducem sus, ca la următoarea intrare să pornească de la început.
      after(FADE[1] + 20, mine, () => window.scrollTo({ top: 0, behavior: 'instant' }));
      after(TOTAL - FLIP[0] - FLIP[1], mine, () => intro.classList.remove('is-flat'));
      done.then(() => {
        if (mine !== run) return;
        // Plutirea repornește din mijlocul ei (scutul drept), exact unde l-a lăsat întoarcerea.
        float.style.animation = 'none';
        void float.offsetWidth;
        float.style.animation = '';
        float.style.animationDelay = '-3.5s';
        stop(moves);
        intro.classList.remove('is-open', 'is-flat');
        root.classList.remove('intro-on');
        busy = false;
        settle();
      }, () => {});
    };

    logo.addEventListener('click', open);
    document.getElementById('intro-skip').addEventListener('click', skip);
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape') skip(); });

    // Pe pagina principală, numele din stânga-sus te duce înapoi la scut.
    const brand = document.getElementById('brand');
    if (brand) {
      brand.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        rewind();
      });
    }
  }

  // ---------- Ruth, mascota ----------

  const ruth = document.getElementById('ruth');
  if (ruth) {
    const button = ruth.querySelector('.ruth-button');
    const aurora = document.querySelector('.aurora');
    const wave = document.querySelector('.blush-wave');
    const BLUSH_MS = 4200;
    let blushTimer = null;

    const restart = (element, name) => {
      element.classList.remove(name);
      // Citirea lățimii obligă browserul să observe scoaterea clasei, ca animația să repornească.
      void element.offsetWidth;
      element.classList.add(name);
    };

    button.addEventListener('click', () => {
      ruth.classList.add('is-blushing', 'is-talking');
      restart(aurora, 'is-blush');
      restart(wave, 'is-on');
      clearTimeout(blushTimer);
      blushTimer = setTimeout(() => {
        ruth.classList.remove('is-blushing', 'is-talking');
        aurora.classList.remove('is-blush');
        wave.classList.remove('is-on');
      }, BLUSH_MS);
    });
  }
})();
