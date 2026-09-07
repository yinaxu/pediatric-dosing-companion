/* Pediatric Dosing Companion. Calculator logic. */
(function(){
  "use strict";

  // ---------- unit toggle ----------
  let weightUnit = 'kg';
  document.querySelectorAll('.seg button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      weightUnit = btn.dataset.unit;
      render();
    });
  });

  const weightInput = document.getElementById('weightInput');
  const ageYears = document.getElementById('ageYears');
  const ageMonths = document.getElementById('ageMonths');
  let isDefault = true;
  [weightInput, ageYears, ageMonths].forEach(el => el.addEventListener('input', () => { isDefault = false; render(); }));

  // ---------- install as an app (Add to Home Screen) ----------
  // Wrapped in try/catch and guarded on every element: this feature must
  // never be able to block the calculator below from rendering.
  try {
  (function setupInstall(){
    const banner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('installDismiss');
    const modalBackdrop = document.getElementById('installModalBackdrop');
    const modalClose = document.getElementById('installModalClose');
    const stepsList = document.getElementById('installSteps');
    if (!banner || !installBtn || !dismissBtn || !modalBackdrop || !modalClose || !stepsList) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone){
      return; // already installed, nothing to prompt
    }
    if (sessionStorage.getItem('installBannerDismissed') === '1'){
      return; // person already said no thanks this session
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      banner.hidden = false;
    });

    // iOS never fires beforeinstallprompt, so show the banner right away
    // with manual steps instead of waiting for a browser event that won't come.
    if (isIOS){
      banner.hidden = false;
    }

    function stepsFor(){
      if (isIOS){
        return [
          'Tap the Share icon (the square with an arrow pointing up) in Safari’s toolbar.',
          'Scroll down and tap "Add to Home Screen."',
          'Tap "Add" in the top right corner.'
        ];
      }
      if (isAndroid){
        return [
          'Tap the menu icon (⋮) in the top right of Chrome.',
          'Tap "Add to Home screen" or "Install app."',
          'Tap "Add" or "Install" to confirm.'
        ];
      }
      return [
        'Open this page on your phone.',
        'In Safari or Chrome, look for "Add to Home Screen" or "Install" in the share or browser menu.',
        'Confirm, and the icon will appear on your home screen.'
      ];
    }

    function openInstructions(){
      stepsList.innerHTML = stepsFor().map(s => '<li>' + s + '</li>').join('');
      modalBackdrop.hidden = false;
    }

    installBtn.addEventListener('click', async () => {
      if (deferredPrompt){
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        banner.hidden = true;
      } else {
        openInstructions();
      }
    });

    dismissBtn.addEventListener('click', () => {
      banner.hidden = true;
      sessionStorage.setItem('installBannerDismissed', '1');
    });

    modalClose.addEventListener('click', () => { modalBackdrop.hidden = true; });
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) modalBackdrop.hidden = true;
    });
  })();
  } catch (err) {
    // Never let the install-banner feature take the whole page down.
  }

  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // offline install still works without this; it just won't cache for offline use
      });
    });
  }

  // ---------- helpers ----------
  function round(n, dp){
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  }
  // round to a practical liquid-measuring volume
  function roundMl(ml){
    if (ml <= 0) return 0;
    if (ml < 2) return round(ml, 2);      // syringe, fine gradation
    if (ml < 10) return round(ml * 2, 0) / 2; // nearest 0.5 mL
    return round(ml, 0);                  // nearest 1 mL
  }
  function fmt(n){
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(n < 10 ? 2 : 1).replace(/0$/,'').replace(/\.$/,'');
  }

  const FREQ_LABEL = { 1:'once daily', 2:'BID', 3:'TID', 4:'QID' };
  function maxLabel(mg){
    return mg >= 1000 ? (round(mg/1000,2)) + ' g/dose max' : mg + ' mg/dose max';
  }

  // ---------- drug data ----------
  // Each antibiotic: dose ranges in mg/kg/day, divided across freqOptions.
  // Concentrations in mg per 5 mL.
  const ANTIBIOTICS = [
    {
      id:'amox', name:'Amoxicillin', generic:'amoxicillin',
      concentrations:[125,200,250,400],
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:25, mgKgDayHigh:45, freqOptions:[2,3], maxDosePerDose:1000, maxDosePerDay:2000 },
        { tier:'high', label:'High dose (AOM / resistant strains)', mgKgDayLow:80, mgKgDayHigh:90, freqOptions:[2], maxDosePerDose:1000, maxDosePerDay:2000 },
      ],
      adult:'250–500 mg TID or 500–875 mg BID (up to 1 g BID/TID for high-dose indications)',
      note:'High-dose regimen (80–90 mg/kg/day) is preferred for acute otitis media and sinusitis in areas with resistant S. pneumoniae; dose BID only.'
    },
    {
      id:'augmentin', name:'Augmentin', generic:'amoxicillin/clavulanate, dosed on the amoxicillin component',
      concentrations:[
        {label:'125 mg/5 mL (4:1)', mg:125, freqHint:'pairs with TID'},
        {label:'200 mg/5 mL (7:1)', mg:200, freqHint:'pairs with BID'},
        {label:'250 mg/5 mL (4:1)', mg:250, freqHint:'pairs with TID'},
        {label:'400 mg/5 mL (7:1)', mg:400, freqHint:'pairs with BID'},
        {label:'600 mg/5 mL ES (14:1)', mg:600, freqHint:'high-dose, BID only'},
      ],
      customConc:true,
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:25, mgKgDayHigh:45, freqOptions:[2,3], maxDosePerDose:875, maxDosePerDay:1750 },
        { tier:'high', label:'High dose (use ES-600, 14:1)', mgKgDayLow:80, mgKgDayHigh:90, freqOptions:[2], maxDosePerDose:1000, maxDosePerDay:2000, requiresConc:600 },
      ],
      adult:'500/125 mg TID, 875/125 mg BID, or 250/125 mg TID',
      note:'Prefer higher amoxicillin:clavulanate ratios (7:1, 14:1) at higher doses to limit clavulanate-related GI upset (target ≤10 mg/kg/day clavulanate).'
    },
    {
      id:'cephalexin', name:'Cephalexin', generic:'cephalexin',
      concentrations:[125,250],
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:25, mgKgDayHigh:50, freqOptions:[2,3,4], maxDosePerDose:1000, maxDosePerDay:4000 },
        { tier:'high', label:'High dose (SSTI / bone-joint)', mgKgDayLow:75, mgKgDayHigh:100, freqOptions:[4], maxDosePerDose:1000, maxDosePerDay:4000 },
      ],
      adult:'250–500 mg QID (BID/TID acceptable for some indications)',
      note:'QID dosing is most reliable for higher-severity infections; BID/TID options are commonly used for uncomplicated pharyngitis.'
    },
    {
      id:'penvk', name:'Penicillin VK', generic:'penicillin V potassium',
      concentrations:[125,250],
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:25, mgKgDayHigh:50, freqOptions:[2,3,4], maxDosePerDose:500, maxDosePerDay:2000 },
        { tier:'high', label:'Higher-intensity dosing', mgKgDayLow:50, mgKgDayHigh:75, freqOptions:[4], maxDosePerDose:500, maxDosePerDay:3000 },
      ],
      adult:'250–500 mg QID (or BID–TID for streptococcal pharyngitis)',
      note:'For strep pharyngitis, weight-band dosing is common in practice: 250 mg BID–TID under ~27 kg, 500 mg BID–TID at or above ~27 kg.'
    },
    {
      id:'cefdinir', name:'Cefdinir', generic:'cefdinir',
      concentrations:[125,250],
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:14, mgKgDayHigh:14, freqOptions:[1,2], maxDosePerDose:600, maxDosePerDay:600 },
      ],
      adult:'300 mg BID or 600 mg once daily',
      note:'Once-daily dosing supports adherence and is a common alternative for penicillin-allergic patients (cross-reactivity with penicillins is low). Iron and antacids reduce absorption, so space doses by 2 hours.'
    },
    {
      id:'cefixime', name:'Cefixime', generic:'cefixime',
      concentrations:[100,200,500],
      regimens:[
        { tier:'low', label:'Standard dose', mgKgDayLow:8, mgKgDayHigh:8, freqOptions:[1,2], maxDosePerDose:400, maxDosePerDay:400 },
      ],
      adult:'400 mg once daily (or 200 mg BID)',
      note:'A single 400 mg dose is used for uncomplicated gonorrhea per CDC guidance. Rising E. coli resistance makes culture-directed therapy preferable for UTIs when possible.'
    },
    {
      id:'clindamycin', name:'Clindamycin', generic:'clindamycin (oral solution)',
      concentrations:[75],
      regimens:[
        { tier:'low', label:'Mild–moderate infections', mgKgDayLow:10, mgKgDayHigh:20, freqOptions:[3,4], maxDosePerDose:300, maxDosePerDay:900 },
        { tier:'high', label:'Severe infections (e.g., MRSA SSTI)', mgKgDayLow:20, mgKgDayHigh:40, freqOptions:[3,4], maxDosePerDose:450, maxDosePerDay:1800 },
      ],
      adult:'150–450 mg q6–8h, max 1.8 g/day',
      note:'The taste is famously bitter, so give it with a strongly flavored food or drink right before dosing. Reserve the higher end for confirmed or suspected MRSA skin and soft-tissue infections. This isn\'t a first-line agent for routine indications.'
    },
    {
      id:'tmpsmx', name:'Trimethoprim-Sulfamethoxazole', generic:'TMP-SMX (Bactrim, Septra), dosed on the trimethoprim component',
      concentrations:[{label:'40 mg TMP/5 mL (200 mg SMX/5 mL)', mg:40}],
      customConc:true,
      regimens:[
        { tier:'low', label:'Standard dose (otitis media, UTI)', mgKgDayLow:8, mgKgDayHigh:10, freqOptions:[2], maxDosePerDose:160, maxDosePerDay:320 },
        { tier:'high', label:'Higher-intensity (skin/soft tissue, MRSA)', mgKgDayLow:10, mgKgDayHigh:20, freqOptions:[2], maxDosePerDose:320, maxDosePerDay:640 },
      ],
      adult:'1 DS tablet (160/800 mg) BID; up to 2 DS tablets BID for severe MRSA skin infections',
      note:'All doses and the concentration above are expressed as the trimethoprim (TMP) component. Avoid under 2 months of age; use caution with sulfa allergy or G6PD deficiency.'
    },
  ];

  const AZITHRO = {
    id:'azithro', name:'Azithromycin', generic:'azithromycin',
    concentrations:[100,200],
    adult:'500 mg on day 1, then 250 mg once daily on days 2–5',
    note:'The 5-day taper is standard for AOM, pharyngitis, and community-acquired pneumonia. A 3-day once-daily course is an accepted alternative for some indications.'
  };

  const OTC_WEIGHT = [
    {
      id:'apap', name:'Acetaminophen', generic:'acetaminophen (Tylenol)', class:'analgesic/antipyretic',
      concentrations:[160],
      regimens:[
        { tier:'low', label:'Low end', mgKgDoseLow:10, mgKgDoseHigh:10, every:'q4–6h', maxDosePerDose:1000, maxDosePerDay:75, perKgDay:true },
        { tier:'high', label:'High end', mgKgDoseLow:15, mgKgDoseHigh:15, every:'q4–6h', maxDosePerDose:1000, maxDosePerDay:75, perKgDay:true },
      ],
      adult:'325–1000 mg q4–6h, max 3000–4000 mg/24h',
      note:'Max 5 doses or 75 mg/kg/24h (whichever is lower), not to exceed adult daily ceiling. Confirm no other acetaminophen-containing products are in use.'
    },
    {
      id:'ibu', name:'Ibuprofen', generic:'ibuprofen (Motrin, Advil)', class:'NSAID',
      concentrations:[100],
      infantDrops:'Infant drops 50 mg/1.25 mL also available for younger infants (≥6 months).',
      regimens:[
        { tier:'low', label:'Low end', mgKgDoseLow:5, mgKgDoseHigh:5, every:'q6–8h', maxDosePerDose:400, maxDosePerDay:40, perKgDay:false },
        { tier:'high', label:'High end', mgKgDoseLow:10, mgKgDoseHigh:10, every:'q6–8h', maxDosePerDose:400, maxDosePerDay:40, perKgDay:false },
      ],
      adult:'200–400 mg q6–8h, max 1200 mg/24h over the counter, or up to 3200 mg/24h under prescriber guidance',
      note:'Only for infants ≥6 months. Max 40 mg/kg/24h, not to exceed 1200 mg/24h OTC. Take with food if GI upset occurs.'
    },
  ];

  const OTC_AGE = [
    {
      id:'cetirizine', name:'Cetirizine', generic:'cetirizine (Zyrtec)', class:'2nd-gen antihistamine',
      concentration:'5 mg/5 mL syrup',
      tiers:[
        {label:'6–11 months', minM:6, maxM:11, low:'2.5 mg once daily', high:'2.5 mg once daily', note:'off-label; discuss with prescriber'},
        {label:'12–23 months', minM:12, maxM:23, low:'2.5 mg once daily', high:'2.5 mg q12h (max 5 mg/day)'},
        {label:'2–5 years', minM:24, maxM:71, low:'2.5 mg once daily', high:'5 mg once daily'},
        {label:'≥6 years', minM:72, maxM:Infinity, low:'5 mg once daily', high:'10 mg once daily'},
      ],
      adult:'10 mg once daily',
      note:'FDA labeling begins at 2 years; 6–23 month dosing reflects common pediatric references and should be confirmed with the prescriber.'
    },
    {
      id:'loratadine', name:'Loratadine', generic:'loratadine (Claritin)', class:'2nd-gen antihistamine',
      concentration:'5 mg/5 mL syrup',
      tiers:[
        {label:'2–5 years', minM:24, maxM:71, low:'5 mg once daily', high:'5 mg once daily'},
        {label:'≥6 years', minM:72, maxM:Infinity, low:'10 mg once daily', high:'10 mg once daily'},
      ],
      adult:'10 mg once daily',
      note:'Not established for routine use under 2 years; dosing does not scale with weight above the 2-year threshold.'
    },
  ];

  // ---------- rendering ----------
  const abxGrid = document.getElementById('abxGrid');
  const otcGrid = document.getElementById('otcGrid');
  const derivedLine = document.getElementById('derivedLine');
  const adultFlag = document.getElementById('adultFlag');
  const exampleHint = document.getElementById('exampleHint');

  function getWeightKg(){
    const raw = parseFloat(weightInput.value);
    if (!raw || raw <= 0) return null;
    return weightUnit === 'lb' ? raw / 2.20462 : raw;
  }
  function getAgeMonths(){
    const y = parseInt(ageYears.value, 10) || 0;
    const m = parseInt(ageMonths.value, 10) || 0;
    if (!ageYears.value && !ageMonths.value) return null;
    return y * 12 + m;
  }

  function doseLineHTML(freqLabel, low, high, unit, capped){
    const cappedClass = capped ? ' capped' : '';
    const amtText = (low === high)
      ? fmt(low) + ' ' + unit
      : fmt(low) + '–' + fmt(high) + ' ' + unit;
    return '<div class="dose-line'+cappedClass+'"><span class="freq">'+freqLabel+'</span><span class="amt">'+amtText+(capped?' <small>(cap)</small>':'')+'</span></div>';
  }

  function renderAntibiotic(drug, weightKg){
    const capNotes = [];
    let bodyHTML = '';

    drug.regimens.forEach(reg => {
      const maxHTML = reg.maxDosePerDose ? ' <span class="max-badge">'+maxLabel(reg.maxDosePerDose)+'</span>' : '';
      let regHTML = '<div class="regimen"><div class="regimen-head '+reg.tier+'"><span>'+reg.label+'</span><span class="mgkg">'+reg.mgKgDayLow+'–'+reg.mgKgDayHigh+' mg/kg/day'+maxHTML+'</span></div>';
      reg.freqOptions.forEach(freq => {
        if (weightKg == null){
          regHTML += '<div class="dose-line"><span class="freq">'+FREQ_LABEL[freq]+'</span><span class="amt">—</span></div>';
          return;
        }
        let dayLow = reg.mgKgDayLow * weightKg;
        let dayHigh = reg.mgKgDayHigh * weightKg;
        let capped = false;
        if (reg.maxDosePerDay && (dayLow > reg.maxDosePerDay || dayHigh > reg.maxDosePerDay)){
          dayLow = Math.min(dayLow, reg.maxDosePerDay);
          dayHigh = Math.min(dayHigh, reg.maxDosePerDay);
          capped = true;
        }
        let doseLow = dayLow / freq;
        let doseHigh = dayHigh / freq;
        if (reg.maxDosePerDose && (doseLow > reg.maxDosePerDose || doseHigh > reg.maxDosePerDose)){
          doseLow = Math.min(doseLow, reg.maxDosePerDose);
          doseHigh = Math.min(doseHigh, reg.maxDosePerDose);
          capped = true;
        }
        doseLow = round(doseLow, 0);
        doseHigh = round(doseHigh, 0);
        regHTML += doseLineHTML(FREQ_LABEL[freq], doseLow, doseHigh, 'mg', capped);

        // mL for each concentration
        let concList = drug.customConc ? drug.concentrations : drug.concentrations.map(mg => ({mg, label: mg+' mg/5 mL'}));
        if (reg.requiresConc){
          concList = concList.filter(c => c.mg === reg.requiresConc);
        }
        concList.forEach(c => {
          const mlLow = roundMl((doseLow / c.mg) * 5);
          const mlHigh = roundMl((doseHigh / c.mg) * 5);
          regHTML += '<div class="dose-line" style="padding-left:22px;font-size:12.5px;color:var(--ink-soft)"><span class="freq">'+ (c.label||c.mg+' mg/5 mL') +'</span><span class="amt mono">'+ (mlLow===mlHigh? fmt(mlLow) : fmt(mlLow)+'–'+fmt(mlHigh)) +' mL</span></div>';
        });
        if (capped) capNotes.push(reg.label + ' capped at adult ceiling for this weight');
      });
      regHTML += '</div>';
      bodyHTML += regHTML;
    });

    const uniqueCapNotes = [...new Set(capNotes)];
    const capHTML = uniqueCapNotes.length ? '<div class="cap-note">⚠ '+uniqueCapNotes.join('; ')+'</div>' : '';

    const concPills = (drug.customConc ? drug.concentrations.map(c=>c.label) : drug.concentrations.map(mg=>mg+' mg/5 mL'))
      .map(l => '<span class="conc-pill">'+l+'</span>').join('');

    return '<div class="card" data-id="'+drug.id+'">'
      +'<div class="card-head"><div><h3>'+drug.name+'</h3><div class="generic">'+drug.generic+'</div></div><span class="class-tag abx">Rx antibiotic</span></div>'
      + bodyHTML + capHTML
      +'<div class="conc-row">'+concPills+'</div>'
      +'<div class="adult-line"><b>Adult:</b> '+drug.adult+'</div>'
      +'<div class="note">'+drug.note+'</div>'
      +'</div>';
  }

  function renderAzithro(weightKg){
    const d = AZITHRO;
    let body;
    if (weightKg == null){
      body = '<div class="regimen"><div class="regimen-head low"><span>5-day taper</span><span class="mgkg">10 → 5 mg/kg/day <span class="max-badge">500 mg/dose max</span></span></div>'
        + '<div class="dose-line"><span class="freq">Day 1</span><span class="amt">—</span></div>'
        + '<div class="dose-line"><span class="freq">Days 2–5</span><span class="amt">—</span></div></div>';
    } else {
      let day1Raw = 10*weightKg, day1 = round(Math.min(day1Raw, 500), 0), day1Capped = day1Raw > 500;
      let day2Raw = 5*weightKg, day2to5 = round(Math.min(day2Raw, 250), 0), day2Capped = day2Raw > 250;
      let altRaw = 10*weightKg, alt3day = round(Math.min(altRaw, 500), 0), altCapped = altRaw > 500;
      const mlFor = (mg, conc) => roundMl((mg/conc)*5);
      body = '<div class="regimen"><div class="regimen-head low"><span>5-day taper (standard)</span><span class="mgkg">10 → 5 mg/kg/day <span class="max-badge">500 mg/dose max</span></span></div>'
        + '<div class="dose-line'+(day1Capped?' capped':'')+'"><span class="freq">Day 1</span><span class="amt">'+day1+' mg'+(day1Capped?' <small>(cap)</small>':'')+'</span></div>'
        + d.concentrations.map(c=>'<div class="dose-line" style="padding-left:22px;font-size:12.5px;color:var(--ink-soft)"><span class="freq">'+c+' mg/5 mL</span><span class="amt mono">'+mlFor(day1,c)+' mL</span></div>').join('')
        + '<div class="dose-line'+(day2Capped?' capped':'')+'"><span class="freq">Days 2–5</span><span class="amt">'+day2to5+' mg'+(day2Capped?' <small>(cap)</small>':'')+'</span></div>'
        + d.concentrations.map(c=>'<div class="dose-line" style="padding-left:22px;font-size:12.5px;color:var(--ink-soft)"><span class="freq">'+c+' mg/5 mL</span><span class="amt mono">'+mlFor(day2to5,c)+' mL</span></div>').join('')
        + '</div>'
        + '<div class="regimen"><div class="regimen-head high"><span>3-day alternative</span><span class="mgkg">10 mg/kg/day × 3 days <span class="max-badge">500 mg/dose max</span></span></div>'
        + '<div class="dose-line'+(altCapped?' capped':'')+'"><span class="freq">Once daily</span><span class="amt">'+alt3day+' mg'+(altCapped?' <small>(cap)</small>':'')+'</span></div>'
        + d.concentrations.map(c=>'<div class="dose-line" style="padding-left:22px;font-size:12.5px;color:var(--ink-soft)"><span class="freq">'+c+' mg/5 mL</span><span class="amt mono">'+mlFor(alt3day,c)+' mL</span></div>').join('')
        + '</div>';
    }
    const concPills = d.concentrations.map(mg=>'<span class="conc-pill">'+mg+' mg/5 mL</span>').join('');
    return '<div class="card" data-id="'+d.id+'">'
      +'<div class="card-head"><div><h3>'+d.name+'</h3><div class="generic">'+d.generic+'</div></div><span class="class-tag abx">Rx antibiotic</span></div>'
      + body
      +'<div class="conc-row">'+concPills+'</div>'
      +'<div class="adult-line"><b>Adult:</b> '+d.adult+'</div>'
      +'<div class="note">'+d.note+'</div>'
      +'</div>';
  }

  function renderOtcWeight(drug, weightKg){
    let body = '';
    let capNotes = [];
    drug.regimens.forEach(reg => {
      const maxHTML = reg.maxDosePerDose ? ' <span class="max-badge">'+maxLabel(reg.maxDosePerDose)+'</span>' : '';
      let regHTML = '<div class="regimen"><div class="regimen-head '+reg.tier+'"><span>'+reg.label+'</span><span class="mgkg">'+reg.mgKgDoseLow+' mg/kg/dose, '+reg.every+maxHTML+'</span></div>';
      if (weightKg == null){
        regHTML += '<div class="dose-line"><span class="freq">'+reg.every+'</span><span class="amt">—</span></div>';
      } else {
        let dose = reg.mgKgDoseLow * weightKg;
        let capped = false;
        if (reg.maxDosePerDose && dose > reg.maxDosePerDose){ dose = reg.maxDosePerDose; capped = true; }
        dose = round(dose, 0);
        regHTML += doseLineHTML(reg.every, dose, dose, 'mg', capped);
        drug.concentrations.forEach(c => {
          const ml = roundMl((dose / c) * 5);
          regHTML += '<div class="dose-line" style="padding-left:22px;font-size:12.5px;color:var(--ink-soft)"><span class="freq">'+c+' mg/5 mL</span><span class="amt mono">'+fmt(ml)+' mL</span></div>';
        });
        if (capped) capNotes.push(reg.label+' capped at max single dose');
      }
      regHTML += '</div>';
      body += regHTML;
    });
    const uniqueCapNotes = [...new Set(capNotes)];
    const capHTML = uniqueCapNotes.length ? '<div class="cap-note">⚠ '+uniqueCapNotes.join('; ')+'</div>' : '';
    const concPills = drug.concentrations.map(mg=>'<span class="conc-pill">'+mg+' mg/5 mL</span>').join('');
    return '<div class="card" data-id="'+drug.id+'">'
      +'<div class="card-head"><div><h3>'+drug.name+'</h3><div class="generic">'+drug.generic+'</div></div><span class="class-tag otc">OTC · '+drug.class+'</span></div>'
      + body + capHTML
      +'<div class="conc-row">'+concPills+'</div>'
      + (drug.infantDrops ? '<div class="note">'+drug.infantDrops+'</div>' : '')
      +'<div class="adult-line"><b>Adult:</b> '+drug.adult+'</div>'
      +'<div class="note">'+drug.note+'</div>'
      +'</div>';
  }

  function renderOtcAge(drug, ageM){
    let tierRows;
    if (ageM == null){
      tierRows = drug.tiers.map(t => '<div class="dose-line"><span class="freq">'+t.label+'</span><span class="amt">'+t.low+(t.low!==t.high? ' – '+t.high : '')+'</span></div>').join('');
    } else {
      tierRows = drug.tiers.map(t => {
        const matches = ageM >= t.minM && ageM <= t.maxM;
        const style = matches ? 'style="background:var(--accent-soft);border-radius:8px;margin:0 -4px;padding:8px 12px 8px 16px;"' : '';
        return '<div class="dose-line" '+style+'><span class="freq">'+t.label+(t.note?' <em style=\'font-style:normal;color:var(--ink-soft)\'>('+t.note+')</em>':'')+'</span><span class="amt">'+t.low+(t.low!==t.high? ' → up to '+t.high : '')+'</span></div>';
      }).join('');
    }
    return '<div class="card" data-id="'+drug.id+'">'
      +'<div class="card-head"><div><h3>'+drug.name+'</h3><div class="generic">'+drug.generic+'</div></div><span class="class-tag otc">OTC · '+drug.class+'</span></div>'
      +'<div class="regimen"><div class="regimen-head low"><span>Age-tiered dosing</span><span class="mgkg">'+drug.concentration+'</span></div>'+tierRows+'</div>'
      +'<div class="adult-line"><b>Adult:</b> '+drug.adult+'</div>'
      +'<div class="note">'+drug.note+'</div>'
      +'</div>';
  }

  // ---------- "See what you need" picker ----------
  // Selecting a medication pulls it into its own box up top. Everything
  // else stays listed further down the page, nothing is ever hidden.
  const ABX_IDS = ANTIBIOTICS.map(d => ({id:d.id, name:d.name})).concat([{id:AZITHRO.id, name:AZITHRO.name}]);
  const OTC_IDS = OTC_WEIGHT.map(d => ({id:d.id, name:d.name})).concat(OTC_AGE.map(d => ({id:d.id, name:d.name})));
  let selectedAgents = new Set();

  function buildFilterChips(){
    const chipRowAbx = document.getElementById('chipRowAbx');
    const chipRowOtc = document.getElementById('chipRowOtc');
    function makeChip(item){
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = item.name;
      c.dataset.id = item.id;
      c.addEventListener('click', () => {
        if (selectedAgents.has(item.id)) selectedAgents.delete(item.id); else selectedAgents.add(item.id);
        syncChips();
        render();
      });
      return c;
    }
    ABX_IDS.forEach(item => chipRowAbx.appendChild(makeChip(item)));
    OTC_IDS.forEach(item => chipRowOtc.appendChild(makeChip(item)));
    syncChips();
  }
  function syncChips(){
    document.querySelectorAll('#chipRowAbx .chip, #chipRowOtc .chip').forEach(c => {
      c.classList.toggle('selected', selectedAgents.has(c.dataset.id));
    });
  }
  document.getElementById('filterReset').addEventListener('click', () => {
    selectedAgents = new Set();
    syncChips();
    render();
  });
  buildFilterChips();

  const selectionBox = document.getElementById('selectionBox');
  const selectionGrid = document.getElementById('selectionGrid');

  function render(){
    const weightKg = getWeightKg();
    const ageM = getAgeMonths();

    // derived line
    let parts = [];
    if (weightKg != null){
      const kg = round(weightKg,1);
      const lb = round(weightKg*2.20462,1);
      parts.push('Weight: <b>'+fmt(kg)+' kg</b> · <b>'+fmt(lb)+' lb</b>');
    }
    if (ageM != null){
      const y = Math.floor(ageM/12), m = ageM%12;
      parts.push('Age: <b>'+(y?y+'y ':'')+m+'mo</b> ('+ageM+' months total)');
    }
    derivedLine.innerHTML = parts.join(' &nbsp;·&nbsp; ') || 'Enter a weight to calculate doses.';
    exampleHint.style.display = isDefault ? 'block' : 'none';

    const isAdultRange = (weightKg != null && weightKg >= 40) || (ageM != null && ageM >= 144);
    adultFlag.style.display = isAdultRange ? 'flex' : 'none';

    const abxAll = ANTIBIOTICS.map(d => ({ id:d.id, html: renderAntibiotic(d, weightKg) }))
      .concat([{ id:AZITHRO.id, html: renderAzithro(weightKg) }]);
    const otcAll = OTC_WEIGHT.map(d => ({ id:d.id, html: renderOtcWeight(d, weightKg) }))
      .concat(OTC_AGE.map(d => ({ id:d.id, html: renderOtcAge(d, ageM) })));

    const selectedItems = abxAll.concat(otcAll).filter(x => selectedAgents.has(x.id));
    const remainingAbx = abxAll.filter(x => !selectedAgents.has(x.id));
    const remainingOtc = otcAll.filter(x => !selectedAgents.has(x.id));

    selectionBox.hidden = selectedItems.length === 0;
    if (selectedItems.length){
      selectionGrid.innerHTML = selectedItems.map(x => x.html).join('');
    }

    abxGrid.innerHTML = remainingAbx.length
      ? remainingAbx.map(x => x.html).join('')
      : '<p class="selection-empty">Every antibiotic is in your selection above.</p>';
    otcGrid.innerHTML = remainingOtc.length
      ? remainingOtc.map(x => x.html).join('')
      : '<p class="selection-empty">Every OTC medication is in your selection above.</p>';
  }

  render();
})();
