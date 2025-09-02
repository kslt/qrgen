const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

async function createLink() {
  const destination = document.getElementById('new-destination').value;

  const res = await fetch('/api/links/create', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ destination })
  });

  const data = await res.json();
  if (res.ok) {
    loadLinks();
    document.getElementById('new-destination').value = '';
  } else {
    alert(data.message || 'Något gick fel');
  }
}

async function loadLinks() {
  const res = await fetch('/api/links/my', {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  const links = await res.json();
  const container = document.getElementById('links');
  container.innerHTML = '';

  for (const link of links) {
    const slug = link.slug;
    const qrUrl = `${location.origin}/l/${slug}`;

    const qrImage = await fetch(`/api/links/create`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ destination: link.destination }) // detta för QR generering, eller spara bilden i databasen senare
    }).then(res => res.json()).then(data => data.qr_image);

    const div = document.createElement('div');
    div.className = 'link-card';
    div.innerHTML = `
      <strong>${slug}</strong><br>
      <a href="${qrUrl}" target="_blank">${qrUrl}</a><br>
      <img src="${qrImage}" alt="QR"><br>
      <input type="text" value="${link.destination}" id="edit-${slug}">
      <button onclick="updateLink('${slug}')">Uppdatera</button>
      <button onclick="deleteLink('${slug}')">Ta bort</button>
    `;
    container.appendChild(div);
  }
}

async function updateLink(slug) {
  const destination = document.getElementById(`edit-${slug}`).value;

  const res = await fetch(`/api/links/${slug}`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ destination })
  });

  if (res.ok) loadLinks();
  else alert('Kunde inte uppdatera');
}

async function deleteLink(slug) {
  const res = await fetch(`/api/links/${slug}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });

  if (res.ok) loadLinks();
  else alert('Kunde inte ta bort');
}

loadLinks();
