const base = '../api/admin.php'
function token(){ return localStorage.getItem('admin_token') || '' }
function saveToken(){ const t = document.getElementById('admin-token').value; localStorage.setItem('admin_token', t); alert('Token kaydedildi'); }
async function api(action, method='GET', body=null){
  const headers = { 'X-Admin-Token': token(), 'Content-Type': 'application/json' }
  const res = await fetch(`${base}?action=${action}`, { method, headers, body: body?JSON.stringify(body):undefined })
  if(!res.ok){ const txt = await res.text().catch(()=> ''); throw new Error(`API error ${res.status}: ${txt}`) }
  const j = await res.json().catch(()=>({}))
  return j.data
}
async function loadUsers(){
  try{
    const list = await api('list_users')
    const tbody = document.getElementById('users-tbody')
    tbody.innerHTML = list.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><input value="${u.email}" onchange="updateUser(${u.id}, this.value, null, null)"/></td>
        <td><input value="${u.name||''}" onchange="updateUser(${u.id}, null, this.value, null)"/></td>
        <td class="muted">${new Date((u.created_at||0)*1000).toLocaleString()}</td>
        <td>
          <input type="password" placeholder="Yeni Şifre" onchange="updateUser(${u.id}, null, null, this.value)"/>
          <button onclick="deleteUser(${u.id})">Sil</button>
        </td>
      </tr>
    `).join('')
  }catch(e){ alert(e.message) }
}
async function createUser(){
  const name = document.getElementById('new-name').value
  const email = document.getElementById('new-email').value
  const pass = document.getElementById('new-pass').value
  try{ await api('create_user','POST',{ name, email, password: pass }); await loadUsers(); }
  catch(e){ if (e.message.includes('409')) alert('E-posta zaten kayıtlı'); else alert(e.message) }
}
async function updateUser(id, email, name, password){
  const payload = { id }
  if (email !== null) payload.email = email
  if (name !== null) payload.name = name
  if (password !== null) payload.password = password
  try{ await api('update_user','POST',payload) }catch(e){ alert(e.message) }
}
async function deleteUser(id){
  if(!confirm('Bu kullanıcı ve tüm verileri silinecek. Emin misiniz?')) return
  try{ await api('delete_user','POST',{ id }); await loadUsers(); }catch(e){ alert(e.message) }
}
window.addEventListener('DOMContentLoaded', () => { const t = token(); if (t) document.getElementById('admin-token').value = t; loadUsers() })
