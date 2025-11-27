const base = '../api/admin.php'
let state = { q:'', limit:50, offset:0, total:0 }
function token(){ return localStorage.getItem('admin_token') || '' }
function saveToken(){ const t = document.getElementById('admin-token').value; localStorage.setItem('admin_token', t); alert('Token kaydedildi'); }
async function api(action, method='GET', body=null, params={}){
  const headers = { 'X-Admin-Token': token(), 'Content-Type': 'application/json' }
  const usp = new URLSearchParams(params)
  const res = await fetch(`${base}?action=${action}&${usp.toString()}`, { method, headers, body: body?JSON.stringify(body):undefined })
  if(!res.ok){ const txt = await res.text().catch(()=> ''); throw new Error(`API error ${res.status}: ${txt}`) }
  const j = await res.json().catch(()=>({}))
  return j.data
}
async function loadUsers(){
  try{
    const data = await api('list_users','GET',null,{ q: state.q, limit: state.limit, offset: state.offset })
    const list = data.items || []
    state.total = data.total || list.length
    const tbody = document.getElementById('users-tbody')
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="muted">Kayıt bulunamadı</td></tr>`; }
    else {
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
    }
    document.getElementById('meta').textContent = `Toplam: ${state.total}`
    const page = Math.floor(state.offset / state.limit) + 1
    const pages = Math.max(1, Math.ceil(state.total / state.limit))
    document.getElementById('page-info').textContent = `Sayfa ${page} / ${pages}`
  }catch(e){ alert(e.message) }
}
async function createUser(){
  const name = document.getElementById('new-name').value
  const email = document.getElementById('new-email').value
  const pass = document.getElementById('new-pass').value
  try{ await api('create_user','POST',{ name, email, password: pass }); refresh(); }
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
  try{ await api('delete_user','POST',{ id }); refresh(); }catch(e){ alert(e.message) }
}
function refresh(){ state.offset = 0; loadUsers() }
function prevPage(){ state.offset = Math.max(0, state.offset - state.limit); loadUsers() }
function nextPage(){ const maxOffset = Math.max(0, (Math.ceil(state.total/state.limit)-1)*state.limit); state.offset = Math.min(maxOffset, state.offset + state.limit); loadUsers() }
function debounce(fn, ms){ let h; return (...args)=>{ clearTimeout(h); h = setTimeout(()=>fn(...args), ms) } }
const onSearch = debounce(v => { state.q = v; refresh() }, 300)
window.addEventListener('DOMContentLoaded', () => {
  const t = token(); if (t) document.getElementById('admin-token').value = t;
  const sizeSel = document.getElementById('page-size'); state.limit = parseInt(sizeSel.value); sizeSel.onchange = ()=>{ state.limit = parseInt(sizeSel.value); refresh() }
  const search = document.getElementById('search'); search.oninput = ()=> onSearch(search.value)
  loadUsers()
})
