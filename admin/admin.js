const base = '../api/admin.php'
let state = { q:'', limit:50, offset:0, total:0 }
function creds(){ return { user: sessionStorage.getItem('admin_user') || '', pass: sessionStorage.getItem('admin_pass') || '' } }
function ensureAuth(){ const c = creds(); if (!c.user || !c.pass) { location.href = './login.html' } }
function logout(){ sessionStorage.removeItem('admin_user'); sessionStorage.removeItem('admin_pass'); location.href = './login.html' }
async function api(action, method='GET', body=null, params={}){
  const c = creds();
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Basic '+btoa(`${c.user}:${c.pass}`) }
  const usp = new URLSearchParams(params)
  const res = await fetch(`${base}?action=${action}&${usp.toString()}`, { method, headers, body: body?JSON.stringify(body):undefined })
  if(!res.ok){ if (res.status === 401) { location.href = './login.html'; return {}; } const txt = await res.text().catch(()=> ''); throw new Error(`API error ${res.status}: ${txt}`) }
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
  ensureAuth()
  const c = creds(); const ud = document.getElementById('admin-user-display'); if (ud) ud.textContent = c.user || ''
  const lb = document.getElementById('logout-btn'); if (lb) lb.onclick = logout
  const sizeSel = document.getElementById('page-size'); state.limit = parseInt(sizeSel.value); sizeSel.onchange = ()=>{ state.limit = parseInt(sizeSel.value); refresh() }
  const search = document.getElementById('search'); search.oninput = ()=> onSearch(search.value)
  loadUsers(); loadDbInfo()
})

async function loadDbInfo(){
  try{
    const info = await api('db_info')
    const tbody = document.getElementById('db-info')
    const sizeKB = ((info.size||0)/1024).toFixed(1)
    const mtime = info.mtime ? new Date(info.mtime*1000).toLocaleString() : '-'
    tbody.innerHTML = `
      <tr><td class="muted">Yol</td><td>${info.path}</td></tr>
      <tr><td class="muted">Var mı?</td><td>${info.exists ? 'Evet' : 'Hayır'}</td></tr>
      <tr><td class="muted">Boyut</td><td>${sizeKB} KB</td></tr>
      <tr><td class="muted">Değiştirme</td><td>${mtime}</td></tr>
      <tr><td class="muted">Tablolar</td><td>${(info.tables||[]).join(', ')}</td></tr>
      <tr><td class="muted">Kayıt Sayıları</td><td>
        users=${info.counts?.users||0}, sessions=${info.counts?.sessions||0}, progress=${info.counts?.progress||0}, user_stats=${info.counts?.user_stats||0}, exam_history=${info.counts?.exam_history||0}
      </td></tr>
    `
  }catch(e){ document.getElementById('db-info').innerHTML = `<tr><td colspan="2" class="muted">${e.message}</td></tr>` }
}
