(function () {
'use strict';
const root = document.getElementById('business-page');
if (!root) return;
root.querySelectorAll('.ktb-audience-panel').forEach(panel => {
  panel.dataset.tabLabel = panel.getAttribute('aria-labelledby');
  panel.querySelector('h3').id = panel.id + '-heading';
});
const audienceTabs = [...root.querySelectorAll('.ktb-audience-tabs [role="tab"]')];
const audienceSelect = root.querySelector('#audience-select');
const audienceMobile = window.matchMedia('(max-width: 700px)');
function updateAudienceLayout() {
  root.querySelectorAll('.ktb-audience-panel').forEach((panel) => {
    panel.querySelector('.ktb-audience-more').open = !audienceMobile.matches;
    panel.setAttribute('role', audienceMobile.matches ? 'region' : 'tabpanel');
    panel.setAttribute('aria-labelledby', audienceMobile.matches ? panel.querySelector('h3').id : panel.dataset.tabLabel);
  });
}
updateAudienceLayout();
audienceMobile.addEventListener('change', updateAudienceLayout);
audienceSelect.addEventListener('change', () => {
  selectAudience(audienceTabs.find(tab => tab.id === audienceSelect.value));
});
// Målgruppelinks vælger indhold uden at være ankre til en sektion.
const audienceLinks = {
  boligforeninger: 'housing', virksomheder: 'business', butik: 'shops',
  kaeder: 'chains', ejendomsadministratorer: 'administrators',
  udlejere: 'owners', ejendomsmaeglere: 'agents'
};
const audienceAliases = { butikker: 'butik', virksomhed: 'virksomheder',
  'kæder': 'kaeder', investorer: 'udlejere', 'ejendomsmæglere': 'ejendomsmaeglere' };
function audienceFromHash() {
  let key;
  try { key = decodeURIComponent(location.hash.slice(1)).toLowerCase(); }
  catch (_) { return null; }
  key = audienceAliases[key] || key;
  const id = audienceLinks[key];
  return id ? audienceTabs.find(tab => tab.id === 'tab-' + id) : null;
}
function applyAudienceHash() {
  const tab = audienceFromHash();
  if (tab) selectAudience(tab, false);
  return !!tab;
}
window.addEventListener('hashchange', applyAudienceHash);
const hasInitialAudience = applyAudienceHash();
if (hasInitialAudience) {
  history.scrollRestoration = 'manual';
  const startAtTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  startAtTop();
  window.addEventListener('pageshow', () => requestAnimationFrame(startAtTop));
}
function selectAudience(tab, updateUrl = true) {
  if (!tab) return;
  audienceSelect.value = tab.id;
  if (updateUrl) {
    const key = Object.keys(audienceLinks).find(key => 'tab-' + audienceLinks[key] === tab.id);
    if (key) history.replaceState(history.state, '', location.pathname + location.search + '#' + key);
  }
  if (tab.getAttribute('aria-selected') === 'true') return;
  root.querySelectorAll('.ktb-audience-panel').forEach((panel) => {
    const video = panel.querySelector('video');
    video.pause();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
    video.controls = false;
    panel.querySelector('.ktb-audience-play').hidden = false;
    panel.querySelector('.ktb-audience-video-error').hidden = true;
    panel.querySelector('.ktb-audience-more').open = !audienceMobile.matches;
    panel.hidden = panel.id !== tab.getAttribute('aria-controls');
  });
  audienceTabs.forEach((item) => {
    item.setAttribute('aria-selected', String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  });
}
audienceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectAudience(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % audienceTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + audienceTabs.length) % audienceTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = audienceTabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      audienceTabs[next].focus();
    }
  });
});
root.querySelectorAll('.ktb-audience-play').forEach((button) => {
  button.addEventListener('click', async () => {
    const panel = button.closest('.ktb-audience-panel');
    const video = panel.querySelector('video');
    video.src = video.dataset.src;
    video.controls = true;
    button.hidden = true;
    try {
      await video.play();
      if (!panel.hidden) video.focus();
    } catch (error) {
      if (panel.hidden) return;
      button.hidden = false;
      video.controls = false;
      const message = panel.querySelector('.ktb-audience-video-error');
      message.textContent = 'Videoen kunne ikke starte. Prøv igen.';
      message.hidden = false;
    }
  });
});

})();
