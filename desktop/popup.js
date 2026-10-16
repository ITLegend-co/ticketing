window.mtPopup.onData(notices => {
  document.getElementById('count').textContent = String(notices.length);
  const root = document.getElementById('updates');
  root.replaceChildren();
  for (const notice of notices) {
    const card = document.createElement('article');
    const title = document.createElement('h2'); title.textContent = notice.title;
    const body = document.createElement('p'); body.textContent = notice.body;
    const actions = document.createElement('div'); actions.className = 'actions';
    const open = document.createElement('button'); open.className = 'open'; open.textContent = 'Open ticket';
    open.onclick = () => window.mtPopup.open(notice.ticketId);
    const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss';
    dismiss.onclick = () => window.mtPopup.dismiss(notice.ticketId);
    actions.append(open, dismiss); card.append(title, body, actions); root.append(card);
  }
});
