const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];

let step = 1;
const labels = ['Choose sources', 'Configure enrichment', 'Set delivery', 'Start scraping'];

function setStep(n) {
  step = Math.max(1, Math.min(4, n));
  qsa('.form-page').forEach((p) => p.classList.toggle('active', +p.dataset.page === step));
  qsa('.step').forEach((b) => {
    const x = +b.dataset.step;
    b.classList.toggle('active', x === step);
    b.classList.toggle('complete', x < step);
    b.querySelector('b').textContent = x < step ? '✓' : x;
  });
  qs('#backBtn').disabled = step === 1;
  qs('#nextBtn').innerHTML = step === 4 ? 'Start scraping <span>↗</span>' : labels[step - 1] + ' <span>→</span>';
}

qsa('.step').forEach((b) => (b.onclick = () => setStep(+b.dataset.step)));
qs('#backBtn').onclick = () => setStep(step - 1);

qs('#nextBtn').onclick = () => {
  if (step < 4) {
    if (step === 1 && (!qs('#industry').value || !qs('#location').value)) {
      toast('Add your target', 'Industry and location are required.');
      return;
    }
    setStep(step + 1);
  } else {
    startJob();
  }
};

qsa('.source').forEach((s) => {
  s.onclick = (e) => {
    if (e.target.tagName !== 'INPUT') s.querySelector('input').checked = !s.querySelector('input').checked;
    s.classList.toggle('checked', s.querySelector('input').checked);
  };
});

qsa('.toggle-stack label').forEach((l) => {
  l.onclick = (e) => {
    if (e.target.tagName !== 'INPUT') l.querySelector('input').checked = !l.querySelector('input').checked;
  };
});

qs('#addCriteria').onclick = () => {
  const list = qs('#criteriaList');
  if (list.children.length >= 6) return toast('Limit reached', 'You can add up to six custom criteria.');
  const n = list.children.length + 1;
  const el = document.createElement('div');
  el.className = 'criterion';
  el.innerHTML = `<span>0${n}</span><input placeholder="Ask a qualification question…"><select><option>Yes / No / Unknown</option></select><button type="button" class="remove">×</button>`;
  list.append(el);
};

qs('#criteriaList').onclick = (e) => {
  if (e.target.classList.contains('remove')) {
    e.target.parentElement.remove();
    qsa('.criterion > span').forEach((x, i) => (x.textContent = String(i + 1).padStart(2, '0')));
  }
};

qs('#regenerate').onclick = () => {
  const i = qs('#industry').value.toLowerCase();
  const l = qs('#location').value.split(',')[0].toLowerCase();
  qs('.query-preview code').textContent = `"${i}" + "${l}" + contact OR email`;
  toast('Query refreshed', 'Search variations updated from your target.');
};

qs('#saveDraft').onclick = () => {
  localStorage.setItem(
    'scrapeLeadsDraft',
    JSON.stringify({
      industry: qs('#industry').value,
      location: qs('#location').value,
      email: qs('#email').value,
      sheet: qs('#sheet').value,
    })
  );
  toast('Draft saved', 'Your configuration is saved in this browser.');
};

function toast(title, msg) {
  const t = qs('#toast');
  t.querySelector('strong').textContent = title;
  t.querySelector('small').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function startJob() {
  if (!qs('#email').checkValidity()) {
    qs('#email').reportValidity();
    return;
  }
  qs('#modalEmail').textContent = qs('#email').value;
  qs('#modalRun').textContent = `${qs('#industry').value} · ${qs('#location').value.split(',')[0]}`;
  qs('#jobModal').classList.add('open');
  qs('#jobModal').setAttribute('aria-hidden', 'false');
  simulateRun();
}

qsa('.modal-close').forEach((b) => (b.onclick = () => qs('#jobModal').classList.remove('open')));

qs('#viewRun').onclick = () => {
  qs('#jobModal').classList.remove('open');
  switchView('runs');
};

function switchView(id) {
  qsa('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  qsa('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === id));
  qs('#viewTitle').textContent = {
    dashboard: 'New lead scrape',
    runs: 'Lead runs',
    integrations: 'Integrations',
    settings: 'Settings',
  }[id];
  scrollTo({ top: 0, behavior: 'smooth' });
}

qsa('.nav-item').forEach((n) => (n.onclick = () => switchView(n.dataset.view)));
qsa('[data-go]').forEach((b) => (b.onclick = () => switchView(b.dataset.go)));
qsa('.download-small').forEach((b) => (b.onclick = downloadCSV));

function downloadCSV() {
  const rows = [
    ['Business', 'Category', 'Location', 'Website', 'Email', 'Email status', 'Phone', 'Decision maker', 'Role', 'Fit score', 'Google Ads', 'Cosmetic dentistry', 'Mobile friendly', 'Source'],
    ['SmileWorks Dental Studio', 'Dentist', 'Bandra West, Mumbai', 'https://example.com', 'hello@example.com', 'Verified', '+91 22 5550 0142', 'Dr. Riya Mehta', 'Owner', '92', 'Yes', 'Yes', 'Yes', 'Google Maps'],
    ['Harbour Dental Care', 'Dental clinic', 'Colaba, Mumbai', 'https://example.org', 'contact@example.org', 'Verified', '+91 22 5550 0188', 'Aman Shah', 'Director', '86', 'Unknown', 'Yes', 'Yes', 'Google Search'],
    ['Pearl & White Clinic', 'Cosmetic dentist', 'Andheri, Mumbai', 'https://example.net', 'care@example.net', 'Risky', '+91 22 5550 0120', 'Dr. Neel Rao', 'Founder', '79', 'No', 'Yes', 'No', 'LinkedIn'],
  ];
  const csv = rows.map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'scrape-leads-demo.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV downloaded', 'A sample lead export was saved to your device.');
}

let timer;
function simulateRun() {
  clearInterval(timer);
  let p = 12;
  let count = 24;
  switchView('runs');
  timer = setInterval(() => {
    p = Math.min(p + Math.ceil(Math.random() * 10), 100);
    count = Math.min(211, count + Math.ceil(Math.random() * 20));
    qs('#runProgress').style.width = p + '%';
    qs('#progressText').textContent = p < 100 ? `Enriching & verifying · ${p}%` : 'Completed · Sheet and CSV ready';
    qs('#leadCount').textContent = count;
    if (p === 100) {
      clearInterval(timer);
      qs('.status.running').textContent = 'Delivered';
      qs('.status.running').className = 'status done';
      toast('Lead run complete', `${count} verified leads are ready.`);
    }
  }, 1200);
}

qs('.mobile-menu').onclick = () => qs('.sidebar').classList.toggle('open');

const draft = JSON.parse(localStorage.getItem('scrapeLeadsDraft') || 'null');
if (draft) {
  Object.entries(draft).forEach(([k, v]) => {
    const el = qs('#' + k);
    if (el) el.value = v;
  });
}