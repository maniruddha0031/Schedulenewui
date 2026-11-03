/* ============================================================
   Eva — AI Chatbot. Ported from the reference build (AI Chatbot.html).
   Kept: the floating bubble, the fullscreen overlay with its top action
   bar (New chat / Favourites / FAQs / Account — the left question
   sidebar it replaced is left disabled in chatbot.css, not deleted),
   favourites, the thumbs-down feedback modal, dark mode, maximize/
   restore, and the Q&A knowledge-base matching engine
   (data/qa-*.js → assets/qa-*.js).
   Dropped: the reference's own multi-store demo switching and its
   "Workflow" module questions/canned responses — neither applies to
   this app's dashboards. In their place, free-text questions that
   don't hit the Q&A database fall back to this app's own live KPI
   numbers (the same facts the previous chatbot answered with).
   ============================================================ */

/* avatar path: set window.EVA_ASSET_BASE before loading (eva-widget.js does) */
const EVA_AVATAR = (window.EVA_ASSET_BASE || "assets/") + "finalchatbotpic.png";

let favourites = [];
try{ favourites = JSON.parse(localStorage.getItem('evaFavourites') || '[]'); }catch(e){ favourites = []; }
let lastUserMessage = '';

const EVA_SECTION_ORDER = [
  'Daily Clock-In & Attendance',
  'Shift Monitoring',
  'Overtime Management',
  'Labor Cost Analysis',
  'Payroll & Exceptions',
  'Analytics & Insights',
  'Recommendation Questions'
];

/* Fallback answers for this dashboard's own live KPI numbers — checked
   after the Q&A database, before the generic "I don't know" message. */
const CB_RULES = [
  { kw:['labor'], reply:'<b>Labor %</b> is currently <b>24.69%</b> (WTD 30.79%), down <b>-11.21%</b> vs last week but up <b>+21.10%</b> vs last year on the Store Health Dashboard.' },
  { kw:['compliance'], reply:'The <b>Compliance Dashboard</b> is at an <b>86%</b> AI Index. Breaks Management is the strongest section (94%); Labor Exceptions is the weakest (55%) — mostly driven by mismatch punches.' },
  { kw:['risk'], reply:'The <b>Risk Dashboard</b> shows Labor Risk at 75%, Inventory Risk at 68%, Compliance Risk at 71%, SCH Risk at 66%, and Sales Risk at 61% — Sales Risk is the category to watch this week.' },
  { kw:['time loss','timeloss','ot loss','overtime'], reply:'<b>OT Loss</b> is at <b>$95.59</b> WTD ($164.94). AI analysis flags <b>Friday</b> as the highest time-loss window this week.' },
  { kw:['dar'], reply:'The <b>DAR Summary</b> is at an 86% AI Index. Transactions are down <b>3%</b> versus target today — Actual Sales are $4,285 (WTD $6,142).' },
  { kw:['sales'], reply:'<b>Net Sales</b> are <b>$8,483.13</b> (WTD $27,784.67), up <b>+110.31%</b> vs last week.' },
  { kw:['food cost'], reply:'<b>Food Cost %</b> is at <b>23.11%</b> (WTD 33.11%), down -10.61% vs last week but up +60.31% vs last year.' },
  { kw:['splh'], reply:'<b>SPLH</b> is currently <b>90.44</b> (WTD $389.84).' },
  { kw:['ai hub','deep dive','root cause'], reply:'The <b>AI Hub</b> tab opens a full root-cause drilldown for your flagged KPIs — drivers, evidence and recommended fixes, all in one place.' },
  { kw:['pulse index','pulse'], reply:'The <b>Pulse Index</b> tab shows your current value vs the median for each key ratio KPI, scoped to All Stores, Corporate or Franchise — click any row for the full band view.' },
  { kw:['hi','hello','hey'], reply:'Hello! Ask me about labor, compliance, risk, time loss, sales, food cost, SPLH, or browse a topic on the left.' }
];
function cbMatch(text){
  const t = text.toLowerCase();
  for(const rule of CB_RULES){
    if(rule.kw.some(k => t.indexOf(k) !== -1)) return rule.reply;
  }
  return null;
}

/* ---------------- Chatbox element refs ---------------- */
const chatbotContainer = document.getElementById('chatbotContainer');
const chatboxOverlay = document.getElementById('chatboxOverlay');
const chatboxBody = document.getElementById('chatboxBody');
const chatboxInput = document.getElementById('chatboxInput');
const chatboxSendBtn = document.getElementById('chatboxSendBtn');
const chatboxClose = document.getElementById('chatboxClose');
const chatboxMaximize = document.getElementById('chatboxMaximize');
const chatbotWidget = document.getElementById('chatbotWidget');

/* Open chatbox — opens as the small widget; Maximize expands it from there
   (matches the reference, and keeps the small-panel slide-up animation from
   running on a full-viewport element, which is what was leaving a gap above
   the fullscreen header when the panel opened straight into maximized). */
if(chatbotContainer){
  chatbotContainer.addEventListener('click', function(){
    chatboxOverlay.classList.add('open');
    chatbotWidget.style.display = 'none';
    chatboxInput.focus();
  });
}

function openEvaChat(){
  if(chatbotContainer) chatbotContainer.click();
}

function closeChatbox(){
  chatboxOverlay.classList.remove('open', 'maximized');
  if(typeof updateEvaVisibility === 'function'){
    const activeTab = document.querySelector('#dashTabBar .view-tab.active');
    updateEvaVisibility(activeTab ? activeTab.dataset.target : null);
  } else {
    chatbotWidget.style.display = 'block';
  }
  const maximizeIcon = chatboxMaximize.querySelector('i');
  maximizeIcon.className = 'bi bi-arrows-angle-expand';
  chatboxMaximize.title = 'Maximize';
}
if(chatboxClose) chatboxClose.addEventListener('click', closeChatbox);

if(chatboxMaximize){
  chatboxMaximize.addEventListener('click', function(){
    const panel = document.getElementById('chatboxPanel');
    chatboxOverlay.classList.toggle('maximized');
    const icon = this.querySelector('i');
    if(chatboxOverlay.classList.contains('maximized')){
      icon.className = 'bi bi-arrows-angle-contract';
      this.title = 'Restore';
      panel.style.animation = 'none';
      panel.offsetHeight;
      panel.style.animation = 'cbxExpand 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
    } else {
      icon.className = 'bi bi-arrows-angle-expand';
      this.title = 'Maximize';
      panel.style.animation = 'none';
      panel.offsetHeight;
      panel.style.animation = 'cbxContract 0.4s cubic-bezier(0.16, 1, 0.3, 1) both';
    }
  });
}

if(chatboxSendBtn) chatboxSendBtn.addEventListener('click', sendUserMessage);
if(chatboxInput) chatboxInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') sendUserMessage(); });

/* ---------------- Q&A knowledge-base matching ----------------
   Scores free text against the Q&A database (assets/qa-*.js) by
   counting matched trigger phrases per entry; returns the highest
   scoring entry, or null if nothing matched. */
function findBestQaMatch(text){
  const lower = text.toLowerCase();
  let best = null, bestScore = 0;
  (window.qaDatabase || []).forEach(entry => {
    let score = 0;
    entry.keywords.forEach(phrase => { if(lower.includes(phrase)) score++; });
    if(score > bestScore){ bestScore = score; best = entry; }
  });
  return best;
}
function renderQaResponse(entry){
  return `<b style="color:#3b82f6;">${entry.icon} ${entry.question}</b><br><br>${entry.body}`;
}
function askQaEntry(id){
  const entry = (window.qaDatabase || []).find(e => e.id === id);
  if(!entry) return;
  appendUserMsg(entry.question);
  showTypingThenCustom(renderQaResponse(entry));
}

/* ---------------- Fullscreen question sidebar ---------------- */
function buildEvaSidebar(){
  const container = document.getElementById('evaSidebarSections');
  if(!container) return;
  const all = window.qaDatabase || [];
  container.innerHTML = EVA_SECTION_ORDER.map(sectionName => {
    const items = all.filter(e => e.section === sectionName).sort((a, b) => a.order - b.order);
    if(!items.length) return '';
    const questionsHtml = items.map(q =>
      `<div class="eva-question-item" data-qa-id="${q.id}">${q.question}</div>`
    ).join('');
    return `
      <div class="eva-section" data-section-name="${sectionName}">
        <div class="eva-section-header">
          <span class="eva-section-name">${sectionName}</span>
          <span class="eva-section-count">${items.length}</span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="eva-section-questions">${questionsHtml}</div>
      </div>`;
  }).join('');
}

const evaNewChatBtn = document.getElementById('evaNewChatBtn');
const evaRailNewChat = document.getElementById('evaRailNewChat');
if(evaNewChatBtn) evaNewChatBtn.addEventListener('click', clearChat);
if(evaRailNewChat) evaRailNewChat.addEventListener('click', clearChat);

function setEvaSidebarCollapsed(collapsed){
  const sb = document.getElementById('evaSidebar');
  if(sb) sb.classList.toggle('collapsed', collapsed);
}
const evaSidebarOpenBtn = document.getElementById('evaSidebarOpenBtn');
const evaSidebarCollapseBtn = document.getElementById('evaSidebarCollapseBtn');
const evaRailSearch = document.getElementById('evaRailSearch');
const evaUserChipCollapsed = document.getElementById('evaUserChipCollapsed');
if(evaSidebarOpenBtn) evaSidebarOpenBtn.addEventListener('click', () => setEvaSidebarCollapsed(false));
if(evaSidebarCollapseBtn) evaSidebarCollapseBtn.addEventListener('click', () => setEvaSidebarCollapsed(true));
if(evaRailSearch) evaRailSearch.addEventListener('click', () => {
  setEvaSidebarCollapsed(false);
  const s = document.getElementById('evaQuestionSearch');
  if(s) s.focus();
});
if(evaUserChipCollapsed) evaUserChipCollapsed.addEventListener('click', () => setEvaSidebarCollapsed(false));

/* User menu + dark mode toggle */
const evaSidebarFooter = document.getElementById('evaSidebarFooter');
const evaUserRow = document.getElementById('evaUserRow');
if(evaUserRow) evaUserRow.addEventListener('click', function(e){
  e.stopPropagation();
  evaSidebarFooter.classList.toggle('menu-open');
});
document.addEventListener('click', function(e){
  if(evaSidebarFooter && !evaSidebarFooter.contains(e.target)) evaSidebarFooter.classList.remove('menu-open');
});
/* Shared by every dark-mode toggle in the widget (sidebar footer menu +
   fullscreen header account popover) so flipping one keeps the other in sync. */
function setDarkMode(isDark){
  chatboxOverlay.classList.toggle('dark-mode', isDark);
  const feedbackOverlay = document.getElementById('evaFeedbackModalOverlay');
  if(feedbackOverlay) feedbackOverlay.classList.toggle('dark-mode', isDark);
  document.querySelectorAll('.eva-dark-mode-toggle').forEach(btn => {
    btn.querySelector('i').className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
    const label = btn.querySelector('.eva-dark-mode-label');
    if(label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
  });
}
document.querySelectorAll('.eva-dark-mode-toggle').forEach(btn => {
  btn.addEventListener('click', function(){
    setDarkMode(!chatboxOverlay.classList.contains('dark-mode'));
    if(evaSidebarFooter) evaSidebarFooter.classList.remove('menu-open');
    if(evaFshUser) evaFshUser.classList.remove('open');
  });
});

/* ---------------- Fullscreen header: New chat / Favourites / FAQs / Account ----------------
   The maximized view's top bar — mirrors the sidebar's own New chat and
   Favourites entry points (so either one works), plus a full FAQ list and
   an account popover that carries the same dark-mode toggle as the sidebar
   footer above. */
const evaFshNewChat = document.getElementById('evaFshNewChat');
if(evaFshNewChat) evaFshNewChat.addEventListener('click', clearChat);

function buildEvaFaqPopup(){
  const container = document.getElementById('evaFaqPopupList');
  if(!container) return;
  const all = window.qaDatabase || [];
  container.innerHTML = EVA_SECTION_ORDER.map(sectionName => {
    const items = all.filter(e => e.section === sectionName).sort((a, b) => a.order - b.order);
    if(!items.length) return '';
    const questionsHtml = items.map(q =>
      `<div class="eva-question-item" data-qa-id="${q.id}">${q.question}</div>`
    ).join('');
    return `
      <div class="eva-section" data-section-name="${sectionName}">
        <div class="eva-section-header">
          <span class="eva-section-name">${sectionName}</span>
          <span class="eva-section-count">${items.length}</span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="eva-section-questions">${questionsHtml}</div>
      </div>`;
  }).join('');
}
const evaFaqWrap = document.getElementById('evaFaqWrap');
const evaFaqBtn = document.getElementById('evaFaqBtn');
const evaFaqSearch = document.getElementById('evaFaqSearch');
if(evaFaqBtn) evaFaqBtn.addEventListener('click', function(e){
  e.stopPropagation();
  buildEvaFaqPopup();
  const opening = evaFaqWrap.classList.toggle('open');
  if(opening && evaFaqSearch) evaFaqSearch.focus();
});
const evaFaqPopupClose = document.getElementById('evaFaqPopupClose');
if(evaFaqPopupClose) evaFaqPopupClose.addEventListener('click', function(e){
  e.stopPropagation();
  evaFaqWrap.classList.remove('open');
});
const evaFaqPopupList = document.getElementById('evaFaqPopupList');
if(evaFaqPopupList) evaFaqPopupList.addEventListener('click', function(e){
  const questionEl = e.target.closest('.eva-question-item');
  if(questionEl){ evaFaqWrap.classList.remove('open'); askQaEntry(questionEl.getAttribute('data-qa-id')); return; }
  const headerEl = e.target.closest('.eva-section-header');
  if(headerEl) headerEl.closest('.eva-section').classList.toggle('open');
});
if(evaFaqSearch) evaFaqSearch.addEventListener('input', function(){
  const term = this.value.trim().toLowerCase();
  document.querySelectorAll('#evaFaqPopupList .eva-section').forEach(section => {
    let visibleCount = 0;
    section.querySelectorAll('.eva-question-item').forEach(item => {
      const matches = !term || item.textContent.toLowerCase().includes(term);
      item.style.display = matches ? '' : 'none';
      if(matches) visibleCount++;
    });
    section.style.display = visibleCount ? '' : 'none';
    section.classList.toggle('open', !!term && visibleCount > 0);
  });
});
document.addEventListener('click', function(e){
  if(evaFaqWrap && !evaFaqWrap.contains(e.target)) evaFaqWrap.classList.remove('open');
});

function buildEvaFavPopup(){
  const container = document.getElementById('evaFavPopupList');
  if(container) container.innerHTML = buildFavQuestionsHtml();
}
const evaFavWrap = document.getElementById('evaFavWrap');
const evaFshFavourites = document.getElementById('evaFshFavourites');
if(evaFshFavourites) evaFshFavourites.addEventListener('click', function(e){
  e.stopPropagation();
  buildEvaFavPopup();
  evaFavWrap.classList.toggle('open');
});
const evaFavPopupClose = document.getElementById('evaFavPopupClose');
if(evaFavPopupClose) evaFavPopupClose.addEventListener('click', function(e){
  e.stopPropagation();
  evaFavWrap.classList.remove('open');
});
const evaFavPopupList = document.getElementById('evaFavPopupList');
if(evaFavPopupList) evaFavPopupList.addEventListener('click', function(e){
  const removeBtn = e.target.closest('[data-remove-fav]');
  if(removeBtn){
    e.stopPropagation();
    const id = removeBtn.getAttribute('data-remove-fav');
    favourites = favourites.filter(f => f.id !== id);
    localStorage.setItem('evaFavourites', JSON.stringify(favourites));
    updateFavBadge();
    buildEvaFavPopup();
    return;
  }
  const favEl = e.target.closest('.eva-fav-item');
  if(favEl){ evaFavWrap.classList.remove('open'); askFavouriteFromSidebar(favEl.getAttribute('data-fav-id')); }
});
document.addEventListener('click', function(e){
  if(evaFavWrap && !evaFavWrap.contains(e.target)) evaFavWrap.classList.remove('open');
});

const evaFshUser = document.getElementById('evaFshUser');
const evaFshAvatarBtn = document.getElementById('evaFshAvatarBtn');
if(evaFshAvatarBtn) evaFshAvatarBtn.addEventListener('click', function(e){
  e.stopPropagation();
  evaFshUser.classList.toggle('open');
});
document.addEventListener('click', function(e){
  if(evaFshUser && !evaFshUser.contains(e.target)) evaFshUser.classList.remove('open');
});

const evaSidebarSections = document.getElementById('evaSidebarSections');
if(evaSidebarSections){
  evaSidebarSections.addEventListener('click', function(e){
    const removeBtn = e.target.closest('[data-remove-fav]');
    if(removeBtn){
      e.stopPropagation();
      const id = removeBtn.getAttribute('data-remove-fav');
      favourites = favourites.filter(f => f.id !== id);
      localStorage.setItem('evaFavourites', JSON.stringify(favourites));
      updateFavBadge();
      showFavouritesInSidebar();
      return;
    }
    const favEl = e.target.closest('.eva-fav-item');
    if(favEl){ askFavouriteFromSidebar(favEl.getAttribute('data-fav-id')); return; }
    const questionEl = e.target.closest('.eva-question-item');
    if(questionEl){ askQaEntry(questionEl.getAttribute('data-qa-id')); return; }
    const headerEl = e.target.closest('.eva-section-header');
    if(headerEl) headerEl.closest('.eva-section').classList.toggle('open');
  });
}

function buildFavQuestionsHtml(){
  if(!favourites.length){
    return `<div class="eva-no-results">No favourite questions yet.<br>Click the star next to any question to save it here.</div>`;
  }
  return favourites.map(fav => `
    <div class="eva-question-item eva-fav-item" data-fav-id="${fav.id}">
      <span class="eva-fav-item-text">${fav.question}</span>
      <i class="bi bi-x-lg eva-fav-item-remove" data-remove-fav="${fav.id}" title="Remove from favourites"></i>
    </div>`).join('');
}

function showFavouritesInSidebar(){
  setEvaSidebarCollapsed(false);
  const container = document.getElementById('evaSidebarSections');
  container.innerHTML = `
    <button class="eva-sidebar-back-btn" id="evaSidebarBackBtn"><i class="bi bi-arrow-left"></i> Back to all questions</button>
    <div class="eva-sidebar-fav-title"><i class="bi bi-star-fill"></i> Favourite Questions (${favourites.length})</div>
    ${buildFavQuestionsHtml()}
  `;
  document.getElementById('evaSidebarBackBtn').addEventListener('click', buildEvaSidebar);
}

function askFavouriteFromSidebar(id){
  const fav = favourites.find(f => f.id === id);
  if(!fav) return;
  appendUserMsg(fav.question);
  showTypingThenCustom(fav.response || 'This saved response is no longer available.');
}

const evaQuestionSearch = document.getElementById('evaQuestionSearch');
if(evaQuestionSearch){
  evaQuestionSearch.addEventListener('input', function(){
    const term = this.value.trim().toLowerCase();
    const sections = document.querySelectorAll('#evaSidebarSections .eva-section');
    sections.forEach(section => {
      let visibleCount = 0;
      section.querySelectorAll('.eva-question-item').forEach(item => {
        const matches = !term || item.textContent.toLowerCase().includes(term);
        item.style.display = matches ? '' : 'none';
        if(matches) visibleCount++;
      });
      section.style.display = visibleCount ? '' : 'none';
      section.classList.toggle('open', !!term && visibleCount > 0);
    });
  });
}

buildEvaSidebar();

/* ---------------- Sending a message ---------------- */
function sendUserMessage(){
  const text = chatboxInput.value.trim();
  if(!text) return;
  chatboxInput.value = '';
  appendUserMsg(text);

  const qaMatch = findBestQaMatch(text);
  if(qaMatch){ showTypingThenCustom(renderQaResponse(qaMatch)); return; }

  const kpiReply = cbMatch(text);
  if(kpiReply){ showTypingThenCustom(kpiReply); return; }

  const lower = text.toLowerCase();
  if(lower.includes('help') || lower === '?'){
    showTypingThenCustom(`<b>I can help you with:</b><br><br>
      • Labor %, Compliance, Risk, Time Loss, DAR, Sales, Food Cost, SPLH<br>
      • Any topic in the sections on the left — attendance, overtime, labor cost, payroll, analytics, recommendations<br><br>
      <b>Try asking:</b> "What's today's labor cost?" or "Show me overtime alerts"`);
  } else {
    showTypingThenCustom(`I don't have a direct answer for that yet — try asking about Labor, Compliance, Risk, Time Loss, Sales, or browse a topic on the left.<br><br><b>Or type "help" for more options!</b>`);
  }
}

function welcomeMessageHtml(){
  return `
    <div class="chat-msg-avatar"><img src="${EVA_AVATAR}" alt="Eva"></div>
    <div class="welcome-bubble">
      <b>Hi, how can I help you with your dashboards?</b>
    </div>
  `;
}

function appendUserMsg(text){
  lastUserMessage = text;
  chatboxBody.classList.add('has-messages');
  document.getElementById('chatboxPanel').classList.add('has-messages');
  const escapedQ = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = 'display:flex; justify-content:flex-end; align-items:center; gap:6px; animation: cbxFadeInMsg 0.3s ease;';
  msgDiv.innerHTML = `
    <button class="fav-question-btn" title="Mark as favourite" onclick="toggleFavourite(this)" data-fav-question="${escapedQ}"><i class="bi bi-star"></i></button>
    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; padding:10px 16px; border-radius:16px 16px 4px 16px; font-size:14px; max-width:80%; line-height:1.5;">${text}</div>`;
  chatboxBody.appendChild(msgDiv);
  scrollToBottom();
}

function showTypingThenCustom(html){
  const typingDiv = appendTyping();
  setTimeout(() => {
    typingDiv.remove();
    appendAIResponse(html);
  }, 900);
}

function appendTyping(){
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `
    <div class="chat-msg-avatar"><img src="${EVA_AVATAR}" alt="Eva"></div>
    <div class="chat-msg-content">
      <div class="ai-typing"><span></span><span></span><span></span></div>
    </div>`;
  chatboxBody.appendChild(div);
  scrollToBottom();
  return div;
}

function appendAIResponse(html){
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const hasTable = html.includes('<table');
  const actionHtml = hasTable ? `
    <div class="export-dropdown">
      <button class="export-trigger" title="Export" onclick="toggleExportMenu(this)"><i class="bi bi-download"></i></button>
      <div class="export-menu">
        <button onclick="exportToPDF(this)"><i class="bi bi-file-pdf"></i> Export PDF</button>
        <button onclick="exportToCSV(this)"><i class="bi bi-file-earmark-spreadsheet"></i> Export CSV</button>
        <button onclick="exportToPNG(this)"><i class="bi bi-file-earmark-image"></i> Export PNG</button>
      </div>
    </div>` : `<button class="copy-btn" title="Copy" onclick="copyResponse(this)"><i class="bi bi-clipboard"></i></button>`;

  div.innerHTML = `
    <div class="chat-msg-avatar"><img src="${EVA_AVATAR}" alt="Eva"></div>
    <div class="chat-msg-content">
      <div class="ai-response-bubble">${html}</div>
      <div class="chat-feedback">
        <button class="thumbs-up" title="Helpful" onclick="toggleFeedback(this)"><i class="bi bi-hand-thumbs-up"></i></button>
        <button class="thumbs-down" title="Not helpful" onclick="handleThumbsDown(this)"><i class="bi bi-hand-thumbs-down"></i></button>
        <span class="feedback-divider"></span>
        ${actionHtml}
      </div>
    </div>`;
  chatboxBody.appendChild(div);
  scrollToBottom();
}

function scrollToBottom(){
  requestAnimationFrame(() => { chatboxBody.scrollTop = chatboxBody.scrollHeight; });
}

/* ---------------- Export / copy ---------------- */
function exportToPDF(button){
  const messageDiv = button.closest('.chat-msg');
  const responseBubble = messageDiv.querySelector('.ai-response-bubble');
  if(!responseBubble) return;

  const element = document.createElement('div');
  element.innerHTML = responseBubble.innerHTML;
  element.style.padding = '20px';
  element.style.fontFamily = 'Arial, sans-serif';
  element.style.fontSize = '12px';

  const opt = {
    margin: 10,
    filename: 'eva-response.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };
  if(window.html2pdf) window.html2pdf().set(opt).from(element).save();

  flashExportSuccess(button);
}

function exportToCSV(button){
  const messageDiv = button.closest('.chat-msg');
  const responseBubble = messageDiv.querySelector('.ai-response-bubble');
  if(!responseBubble) return;
  const table = responseBubble.querySelector('table');
  if(!table) return;

  const csv = [];
  table.querySelectorAll('tr').forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const rowData = Array.from(cols).map(col => {
      let text = col.textContent.trim();
      if(text.includes(',') || text.includes('"') || text.includes('\n')) text = '"' + text.replace(/"/g, '""') + '"';
      return text;
    });
    csv.push(rowData.join(','));
  });

  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'eva-response.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  flashExportSuccess(button);
}

function exportToPNG(button){
  const messageDiv = button.closest('.chat-msg');
  const responseBubble = messageDiv.querySelector('.ai-response-bubble');
  if(!responseBubble || !window.html2canvas) return;

  const menu = button.closest('.export-menu');
  const trigger = button.closest('.export-dropdown').querySelector('.export-trigger');
  if(menu) menu.classList.remove('open');

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;background:#ffffff;padding:24px 28px;border-radius:12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#111827;width:${responseBubble.offsetWidth}px;box-sizing:border-box;`;
  wrapper.innerHTML = responseBubble.innerHTML;
  wrapper.querySelectorAll('*').forEach(el => {
    el.style.color = el.style.color || '#111827';
    el.style.backgroundColor = 'transparent';
  });
  wrapper.querySelectorAll('table').forEach(t => { t.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;'; });
  wrapper.querySelectorAll('th').forEach(th => { th.style.cssText = 'padding:8px 12px;background:#1e40af;color:#ffffff;font-weight:600;border:1px solid #1e40af;text-align:left;'; });
  wrapper.querySelectorAll('tr').forEach((tr, i) => {
    if(i === 0) return;
    tr.querySelectorAll('td').forEach(td => {
      td.style.cssText = `padding:8px 12px;border:1px solid #d1d5db;color:#111827;background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};`;
    });
  });

  document.body.appendChild(wrapper);
  window.html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }).then(canvas => {
    document.body.removeChild(wrapper);
    const link = document.createElement('a');
    link.download = 'eva-response.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    const originalIcon = trigger.innerHTML;
    trigger.innerHTML = '<i class="bi bi-check-lg"></i>';
    trigger.style.color = '#10b981';
    setTimeout(() => { trigger.innerHTML = originalIcon; trigger.style.color = ''; }, 2000);
  }).catch(() => { if(wrapper.parentNode) document.body.removeChild(wrapper); });
}

function flashExportSuccess(button){
  const menu = button.closest('.export-menu');
  const trigger = button.closest('.export-dropdown').querySelector('.export-trigger');
  if(menu) menu.classList.remove('open');
  const originalIcon = trigger.innerHTML;
  trigger.innerHTML = '<i class="bi bi-check-lg"></i>';
  trigger.style.color = '#10b981';
  setTimeout(() => { trigger.innerHTML = originalIcon; trigger.style.color = ''; }, 2000);
}

function copyResponse(button){
  const messageDiv = button.closest('.chat-msg');
  const responseBubble = messageDiv.querySelector('.ai-response-bubble');
  if(!responseBubble) return;
  navigator.clipboard.writeText(responseBubble.textContent.trim()).then(() => {
    const originalIcon = button.innerHTML;
    button.innerHTML = '<i class="bi bi-check-lg"></i>';
    button.style.color = '#10b981';
    setTimeout(() => { button.innerHTML = originalIcon; button.style.color = ''; }, 2000);
  }).catch(err => console.error('Failed to copy:', err));
}

function toggleExportMenu(trigger){
  const menu = trigger.nextElementSibling;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.export-menu.open').forEach(m => m.classList.remove('open'));
  if(!isOpen) menu.classList.add('open');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.export-dropdown')) document.querySelectorAll('.export-menu.open').forEach(m => m.classList.remove('open'));
});

/* ---------------- Thumbs feedback + dislike modal ---------------- */
function toggleFeedback(button){
  const feedbackContainer = button.closest('.chat-feedback');
  const thumbsButtons = feedbackContainer.querySelectorAll('.thumbs-up, .thumbs-down');
  const isActive = button.classList.contains('active');
  thumbsButtons.forEach(btn => {
    btn.classList.remove('active');
    const icon = btn.querySelector('i');
    icon.className = btn.classList.contains('thumbs-up') ? 'bi bi-hand-thumbs-up' : 'bi bi-hand-thumbs-down';
  });
  if(!isActive){
    button.classList.add('active');
    const icon = button.querySelector('i');
    icon.className = button.classList.contains('thumbs-up') ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-down-fill';
  }
}

let evaFeedbackIssue = 'Wrong answer';
function handleThumbsDown(button){
  toggleFeedback(button);
  resetEvaFeedbackModal();
  document.getElementById('evaFeedbackModalOverlay').style.display = 'flex';
}
function resetEvaFeedbackModal(){
  evaFeedbackIssue = 'Wrong answer';
  const notes = document.getElementById('evaFeedbackNotes');
  notes.value = '';
  document.getElementById('evaFeedbackCharCount').textContent = '0 / 255';
  document.querySelectorAll('.eva-feedback-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-issue') === evaFeedbackIssue);
  });
  updateEvaFeedbackNotesState();
  document.getElementById('evaFeedbackStepSelect').style.display = 'block';
  document.getElementById('evaFeedbackStepSuccess').style.display = 'none';
  setEvaFeedbackModalHeader(false);
  const actionBtn = document.getElementById('evaFeedbackActionBtn');
  actionBtn.textContent = 'Send Feedback';
  actionBtn.onclick = sendEvaFeedback;
  updateEvaFeedbackSendState();
}
function setEvaFeedbackModalHeader(success){
  document.getElementById('evaFeedbackModalIcon').innerHTML = success ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-hand-thumbs-down-fill"></i>';
  document.getElementById('evaFeedbackModalTitle').textContent = success ? 'Feedback Received!' : 'What went wrong?';
  document.getElementById('evaFeedbackModalSubtitle').textContent = success ? 'Thank you for helping us improve' : 'Help Eva give better answers';
}
function updateEvaFeedbackNotesState(){
  const isOther = evaFeedbackIssue === 'Something else';
  document.getElementById('evaFeedbackNotesRequired').textContent = isOther ? '(required)' : '(optional)';
  document.getElementById('evaFeedbackNotes').placeholder = isOther ? 'Please describe the issue *' : 'Describe the issue in more detail...';
}
function updateEvaFeedbackSendState(){
  const notesLength = document.getElementById('evaFeedbackNotes').value.trim().length;
  const isOther = evaFeedbackIssue === 'Something else';
  const disabled = isOther && notesLength === 0;
  const actionBtn = document.getElementById('evaFeedbackActionBtn');
  actionBtn.disabled = disabled;
  actionBtn.classList.toggle('disabled', disabled);
}
const evaFeedbackOptions = document.getElementById('evaFeedbackOptions');
if(evaFeedbackOptions){
  evaFeedbackOptions.addEventListener('click', function(e){
    const chip = e.target.closest('.eva-feedback-chip');
    if(!chip) return;
    evaFeedbackIssue = chip.getAttribute('data-issue');
    document.querySelectorAll('.eva-feedback-chip').forEach(c => c.classList.toggle('active', c === chip));
    updateEvaFeedbackNotesState();
    updateEvaFeedbackSendState();
  });
}
const evaFeedbackNotes = document.getElementById('evaFeedbackNotes');
if(evaFeedbackNotes){
  evaFeedbackNotes.addEventListener('input', function(){
    document.getElementById('evaFeedbackCharCount').textContent = `${this.value.length} / 255`;
    updateEvaFeedbackSendState();
  });
}
function sendEvaFeedback(){
  document.getElementById('evaFeedbackStepSelect').style.display = 'none';
  document.getElementById('evaFeedbackStepSuccess').style.display = 'block';
  setEvaFeedbackModalHeader(true);
  const actionBtn = document.getElementById('evaFeedbackActionBtn');
  actionBtn.textContent = 'Close';
  actionBtn.disabled = false;
  actionBtn.classList.remove('disabled');
  actionBtn.onclick = closeEvaFeedbackModal;
}
function closeEvaFeedbackModal(){ document.getElementById('evaFeedbackModalOverlay').style.display = 'none'; }
const evaFeedbackModalCloseBtn = document.getElementById('evaFeedbackModalCloseBtn');
const evaFeedbackModalOverlay = document.getElementById('evaFeedbackModalOverlay');
if(evaFeedbackModalCloseBtn) evaFeedbackModalCloseBtn.addEventListener('click', closeEvaFeedbackModal);
if(evaFeedbackModalOverlay) evaFeedbackModalOverlay.addEventListener('click', function(e){ if(e.target === this) closeEvaFeedbackModal(); });

/* ---------------- Favourites ---------------- */
function toggleFavourite(button){
  const isActive = button.classList.contains('active');
  const question = button.getAttribute('data-fav-question') || 'Saved question';

  let sibling = button.parentElement.nextElementSibling;
  let responseBubble = null;
  while(sibling){
    responseBubble = sibling.querySelector('.ai-response-bubble');
    if(responseBubble) break;
    sibling = sibling.nextElementSibling;
  }

  if(isActive){
    const id = button.getAttribute('data-fav-id');
    favourites = favourites.filter(f => f.id !== id);
    button.removeAttribute('data-fav-id');
    button.classList.remove('active');
    button.querySelector('i').className = 'bi bi-star';
    button.title = 'Mark as favourite';
  } else {
    const isDuplicate = favourites.some(f => f.question.trim().toLowerCase() === question.trim().toLowerCase());
    if(isDuplicate){
      button.style.animation = 'none';
      button.offsetHeight;
      button.style.animation = 'cbxFavShake 0.35s ease';
      return;
    }
    const id = 'fav_' + Date.now();
    button.setAttribute('data-fav-id', id);
    favourites.push({
      id, question,
      response: responseBubble ? responseBubble.innerHTML : '',
      timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    button.classList.add('active');
    button.querySelector('i').className = 'bi bi-star-fill';
    button.title = 'Remove from favourites';
  }

  localStorage.setItem('evaFavourites', JSON.stringify(favourites));
  updateFavBadge();
}

function updateFavBadge(){
  document.querySelectorAll('#chatboxFavourites, .eva-fav-btn').forEach(btn => {
    let badge = btn.querySelector('.fav-count-badge');
    if(favourites.length > 0){
      if(!badge){ badge = document.createElement('span'); badge.className = 'fav-count-badge'; btn.appendChild(badge); }
      badge.textContent = favourites.length > 9 ? '9+' : favourites.length;
    } else if(badge){ badge.remove(); }
  });
}

function buildFavItemsHtml(list){
  if(list.length === 0){
    return `<div class="favourites-empty">
      <i class="bi bi-star" style="font-size:36px; color:#f59e0b; display:block; margin-bottom:12px;"></i>
      No favourite questions yet.<br>
      <span style="font-size:12px;">Click the star on any question to save it here.</span>
    </div>`;
  }
  return list.map(fav => `
    <div class="fav-item" onclick="reaskFavourite('${fav.id}')">
      <div class="fav-item-question"><i class="bi bi-star-fill"></i>${fav.question}</div>
      <div class="fav-item-meta">Saved ${fav.timestamp}</div>
      <button class="fav-item-remove" title="Remove" onclick="removeFavourite(event,'${fav.id}')"><i class="bi bi-x"></i></button>
    </div>`).join('');
}

function showFavouritesPanel(){
  const existing = document.getElementById('favouritesPanel');
  if(existing){ existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'favouritesPanel';
  panel.className = 'favourites-panel';
  panel.innerHTML = `
    <div class="favourites-panel-header">
      <div class="favourites-panel-title"><i class="bi bi-star-fill"></i> Favourite Questions (${favourites.length})</div>
      <button style="width:30px;height:30px;border:none;background:rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;border:1px solid rgba(255,255,255,0.3);transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.background='rgba(255,255,255,0.35)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'" onclick="document.getElementById('favouritesPanel').remove()" title="Close"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="fav-search-wrap">
      <input class="fav-search-input" id="favSearchInput" type="text" placeholder="Search Favourite questions…" oninput="filterFavourites(this.value)" autocomplete="off">
    </div>
    <div class="favourites-body" id="favouritesBody">${buildFavItemsHtml(favourites)}</div>`;

  document.getElementById('chatboxPanel').appendChild(panel);
  setTimeout(() => { const s = document.getElementById('favSearchInput'); if(s) s.focus(); }, 120);
}

function filterFavourites(query){
  const body = document.getElementById('favouritesBody');
  if(!body) return;
  const q = query.trim().toLowerCase();
  const filtered = q ? favourites.filter(f => f.question.toLowerCase().includes(q)) : favourites;
  if(filtered.length === 0 && q){
    body.innerHTML = `<div class="favourites-empty"><i class="bi bi-search" style="font-size:28px;color:#d1d5db;display:block;margin-bottom:10px;"></i>No matches for "<b>${query}</b>"</div>`;
  } else {
    body.innerHTML = buildFavItemsHtml(filtered);
  }
}

function removeFavourite(e, id){
  e.stopPropagation();
  favourites = favourites.filter(f => f.id !== id);
  localStorage.setItem('evaFavourites', JSON.stringify(favourites));
  updateFavBadge();
  const btn = document.querySelector(`.fav-question-btn[data-fav-id="${id}"]`);
  if(btn){
    btn.classList.remove('active');
    btn.querySelector('i').className = 'bi bi-star';
    btn.removeAttribute('data-fav-id');
    btn.title = 'Mark as favourite';
  }
  const searchInput = document.getElementById('favSearchInput');
  const currentQuery = searchInput ? searchInput.value : '';
  const titleEl = document.querySelector('#favouritesPanel .favourites-panel-title');
  if(titleEl) titleEl.innerHTML = `<i class="bi bi-star-fill"></i> Favourite Questions (${favourites.length})`;
  filterFavourites(currentQuery);
}

function reaskFavourite(id){
  const fav = favourites.find(f => f.id === id);
  if(!fav) return;
  document.getElementById('favouritesPanel').remove();
  appendUserMsg(fav.question);
  showTypingThenCustom(fav.response || 'This saved response is no longer available.');
}

updateFavBadge();

function clearChat(){
  const fp = document.getElementById('favouritesPanel');
  if(fp) fp.remove();
  lastUserMessage = '';
  chatboxBody.classList.remove('has-messages');
  document.getElementById('chatboxPanel').classList.remove('has-messages');
  chatboxBody.innerHTML = `<div class="chat-msg" id="welcome-msg">${welcomeMessageHtml()}</div>`;

  const btn = document.getElementById('chatboxClearChat');
  if(btn){
    const icon = btn.querySelector('i');
    icon.className = 'bi bi-check-lg';
    btn.style.color = '#10b981';
    setTimeout(() => { icon.className = 'bi bi-arrow-counterclockwise'; btn.style.color = ''; }, 1200);
  }
}

/* ---------------- Idle nudge — "Ask Eva" ----------------
   If the user takes no click action for CB_IDLE_MS, a small popup
   appears near the top-right inviting them to ask Eva for help.
   Resets on every click; re-appears after another full idle period
   if the chatbox is still closed. ---------------------------------- */
const CB_IDLE_MS = 10000;
const CB_SNOOZE_KEY = 'aidash_eva_nudge_snooze_until';
let cbIdleTimer = null;

function cbInjectIdleNudge(){
  if(document.getElementById('cb-idle-nudge')) return;
  const div = document.createElement('div');
  div.id = 'cb-idle-nudge';
  div.innerHTML =
    '<button class="cb-nudge-close" onclick="cbToggleNudgeSnoozeMenu(event)" title="Dismiss">&times;</button>' +
    '<div id="cb-nudge-snooze-menu" class="cb-nudge-snooze-menu hidden">' +
      '<button type="button" class="cb-nudge-snooze-opt" onclick="cbSnoozeNudge(event,30)">Don\'t show me for next 30 mins</button>' +
      '<button type="button" class="cb-nudge-snooze-opt" onclick="cbSnoozeNudgeForToday(event)">Don\'t show me again today</button>' +
    '</div>' +
    '<div class="cb-nudge-icon"><i data-lucide="sparkles"></i></div>' +
    '<div class="cb-nudge-text">Stuck with something or want to deep dive? <span class="cb-nudge-ask" onclick="cbAskEvaFromNudge()">Ask Eva</span></div>';
  document.body.appendChild(div);
  if(window.lucide) lucide.createIcons();
}
function cbNudgeSnoozedNow(){
  let until = 0;
  try{ until = parseInt(localStorage.getItem(CB_SNOOZE_KEY), 10) || 0; }catch(e){}
  return Date.now() < until;
}
function cbShowIdleNudge(){
  if(cbNudgeSnoozedNow()){ cbResetIdleTimer(); return; }
  if(chatboxOverlay && chatboxOverlay.classList.contains('open')){ cbResetIdleTimer(); return; }
  const activeTab = document.querySelector('#dashTabBar .view-tab.active');
  if(activeTab && activeTab.dataset.target==='aihub'){ cbResetIdleTimer(); return; }
  const nudge = document.getElementById('cb-idle-nudge');
  if(nudge) nudge.classList.add('show');
}
function cbHideIdleNudge(){
  const nudge = document.getElementById('cb-idle-nudge');
  if(nudge) nudge.classList.remove('show');
  cbHideNudgeSnoozeMenu();
}
function cbToggleNudgeSnoozeMenu(e){
  if(e) e.stopPropagation();
  const menu = document.getElementById('cb-nudge-snooze-menu');
  if(menu) menu.classList.toggle('hidden');
}
function cbHideNudgeSnoozeMenu(){
  const menu = document.getElementById('cb-nudge-snooze-menu');
  if(menu) menu.classList.add('hidden');
}
function cbSnoozeNudge(e, minutes){
  if(e) e.stopPropagation();
  try{ localStorage.setItem(CB_SNOOZE_KEY, String(Date.now() + minutes*60*1000)); }catch(err){}
  cbHideIdleNudge();
  cbResetIdleTimer();
}
function cbSnoozeNudgeForToday(e){
  if(e) e.stopPropagation();
  const end = new Date();
  end.setHours(23,59,59,999);
  try{ localStorage.setItem(CB_SNOOZE_KEY, String(end.getTime())); }catch(err){}
  cbHideIdleNudge();
  cbResetIdleTimer();
}
function cbAskEvaFromNudge(){
  cbHideIdleNudge();
  if(!chatboxOverlay || !chatboxOverlay.classList.contains('open')) openEvaChat();
}
function cbResetIdleTimer(){
  if(cbIdleTimer) clearTimeout(cbIdleTimer);
  cbIdleTimer = setTimeout(cbShowIdleNudge, CB_IDLE_MS);
}
document.addEventListener('click', function(){
  cbHideIdleNudge();
  cbResetIdleTimer();
});

document.addEventListener('DOMContentLoaded', function(){
  if(window.lucide) lucide.createIcons();
  cbInjectIdleNudge();
  cbResetIdleTimer();
});
