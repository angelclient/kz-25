import { firebaseConfig } from './firebase-config.js';

// Firebase SDK (v9 modular, CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  RecaptchaVerifier, signInWithPhoneNumber,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, getDocs, where, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// UI refs
const qs = s => document.querySelector(s);
const messagesEl = qs('#messages');
const textEl = qs('#text');
const sendBtn = qs('#sendBtn');
const fileInp = qs('#fileInp');
const enableSoundBtn = qs('#enableSound');
const notifyAudio = qs('#notify');
const themeTgl = qs('#themeTgl');

const emailInput = qs('#email');
const passInput = qs('#password');
const emailSignup = qs('#emailSignup');
const emailLogin = qs('#emailLogin');
const googleBtn = qs('#googleBtn');
const phoneInput = qs('#phone');
const sendCodeBtn = qs('#sendCode');
const smsCodeInput = qs('#smsCode');
const verifyCodeBtn = qs('#verifyCode');

const profilePane = qs('#profilePane');
const authPane = qs('#authPane');
const signOutBtn = qs('#signOutBtn');
const helloText = qs('#helloText');
const helloMail = qs('#helloMail');
const profileAva = qs('#profileAva');
const avaBtn = qs('#avaBtn');
const avaFile = qs('#avaFile');

const exportBtn = qs('#exportBtn');
const clearLocalBtn = qs('#clearLocalBtn');
const activeMeta = qs('#activeMeta');

// Firestore messages
const messagesRef = collection(db, 'messages');
const messagesQuery = query(messagesRef, orderBy('ts'), limit(300));

let unsubMessages = null;
let currentUser = null;
let confirmationResult = null;
let soundEnabled = false;

// THEME
const applyTheme = () => document.body.classList.toggle('light', !!themeTgl.checked);
themeTgl.addEventListener('change', applyTheme);
applyTheme();

// AUTH
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (user){
    // show profile pane
    authPane.classList.add('hidden');
    profilePane.classList.remove('hidden');
    helloText.textContent = `👋 Привіт, ${displayNameOf(user)}`;
    helloMail.textContent = user.email || user.phoneNumber || user.uid;
    setAva(profileAva, user);

    subscribeMessages();
  } else {
    // show auth pane
    profilePane.classList.add('hidden');
    authPane.classList.remove('hidden');
    messagesEl.innerHTML = '';
    unsubscribeMessages();
  }
});

signOutBtn.addEventListener('click', async () => { await signOut(auth); });

// email/pass
emailSignup.addEventListener('click', async ()=>{
  const email=(emailInput.value||'').trim(), pass=(passInput.value||'').trim();
  if(!email||!pass) return alert('Вкажіть email і пароль');
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const name = email.split('@')[0];
    await updateProfile(cred.user, { displayName: name });
  }catch(e){ alert('Реєстрація: '+e.message); console.error(e); }
});
emailLogin.addEventListener('click', async ()=>{
  const email=(emailInput.value||'').trim(), pass=(passInput.value||'').trim();
  if(!email||!pass) return alert('Вкажіть email і пароль');
  try{ await signInWithEmailAndPassword(auth, email, pass); }
  catch(e){ alert('Вхід: '+e.message); console.error(e); }
});

// google
googleBtn.addEventListener('click', async ()=>{
  try{ await signInWithPopup(auth, provider); }
  catch(e){ alert('Google: '+e.message); console.error(e); }
});

// phone
const recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size:'invisible' }, auth);
sendCodeBtn.addEventListener('click', async ()=>{
  const phone=(phoneInput.value||'').trim();
  if(!phone) return alert('Вкажіть номер');
  try{
    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    alert('Код відправлено. Перевір SMS.');
  }catch(e){ alert('SMS: '+e.message); console.error(e); }
});
verifyCodeBtn.addEventListener('click', async ()=>{
  if(!confirmationResult) return alert('Спочатку надішліть код');
  const code=(smsCodeInput.value||'').trim();
  try{ await confirmationResult.confirm(code); }
  catch(e){ alert('Код невірний: '+e.message); console.error(e); }
});

// messages
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function displayNameOf(u){ return u?.displayName || u?.phoneNumber || u?.email?.split('@')[0] || 'Anon'; }
function setAva(imgEl, user){
  if(user?.photoURL){ imgEl.src = user.photoURL; imgEl.alt='avatar'; }
  else { imgEl.removeAttribute('src'); imgEl.alt = (displayNameOf(user)[0]||'U').toUpperCase(); imgEl.style.background='#334155'; }
}

function bubbleHtml(data, mine){
  const name = mine? 'Ви' : escapeHtml(data.name||'Користувач');
  const text = escapeHtml(data.text||'');
  const time = data.ts?.toDate ? data.ts.toDate() : new Date();
  const tstr = time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const img = data.img ? `<img class="content" src="${data.img}" alt="img">` : '';
  const ava = data.photoURL ? `<img class="ava-sm" src="${data.photoURL}" alt="a">` : `<div class="ava-sm"></div>`;
  const actions = mine ? `<div class="actions">
      <button class="icon-btn edit-btn" title="Редагувати">✏️</button>
      <button class="icon-btn del-btn" title="Видалити">🗑️</button>
    </div>` : '';
  return `
    <div class="msg ${mine?'me':'them'}" data-id="${data.id||''}">
      ${ava}
      <div>
        <div class="bubble">
          <div class="name">${name}</div>
          <div class="text">${text}</div>
          ${img}
          <div class="meta"><span>${tstr}</span></div>
        </div>
        ${actions}
      </div>
    </div>`;
}

function renderChange(change){
  if(change.type==='added'){
    const data = change.doc.data(); data.id = change.doc.id;
    const mine = currentUser && data.uid===currentUser.uid;
    const wrap = document.createElement('div');
    wrap.innerHTML = bubbleHtml(data, mine);
    const el = wrap.firstElementChild;
    attachMsgHandlers(el, data);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (soundEnabled && (!currentUser || data.uid !== currentUser.uid)){
      try { notifyAudio.currentTime=0; notifyAudio.play(); } catch {}
    }
  }
  if(change.type==='modified'){
    const data = change.doc.data(); data.id = change.doc.id;
    const el = messagesEl.querySelector(`.msg[data-id="${data.id}"]`);
    if(el){
      const mine = currentUser && data.uid===currentUser.uid;
      const wrap = document.createElement('div');
      wrap.innerHTML = bubbleHtml(data, mine);
      const fresh = wrap.firstElementChild;
      attachMsgHandlers(fresh, data);
      el.replaceWith(fresh);
    }
  }
  if(change.type==='removed'){
    const id = change.doc.id;
    const el = messagesEl.querySelector(`.msg[data-id="${id}"]`);
    if(el) el.remove();
  }
}

function subscribeMessages(){
  if (unsubMessages) return;
  unsubMessages = onSnapshot(messagesQuery, (snap)=>{
    snap.docChanges().forEach(renderChange);
    activeMeta.textContent = `${snap.size} повідомлень • онлайн`;
  });
}
function unsubscribeMessages(){ if(unsubMessages){unsubMessages(); unsubMessages=null;} }

async function sendText(text){
  const t=(text||'').trim(); if(!t) return;
  if(!currentUser) return alert('Спочатку увійдіть');
  await addDoc(messagesRef, {
    text: t,
    uid: currentUser.uid,
    name: displayNameOf(currentUser),
    photoURL: currentUser.photoURL || '',
    ts: serverTimestamp()
  });
}

// send
sendBtn.addEventListener('click', async ()=>{
  const v=textEl.value; textEl.value=''; await sendText(v); textEl.focus();
});
textEl.addEventListener('keydown', (e)=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBtn.click(); }
});

// image as dataURL (demo)
fileInp.addEventListener('change', (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=async ()=>{
    if(!currentUser) return alert('Спочатку увійдіть');
    await addDoc(messagesRef, {
      text:'', img:r.result,
      uid: currentUser.uid,
      name: displayNameOf(currentUser),
      photoURL: currentUser.photoURL || '',
      ts: serverTimestamp()
    });
  };
  r.readAsDataURL(f); fileInp.value='';
});

// sound
enableSoundBtn.addEventListener('click', async ()=>{
  try{ await notifyAudio.play(); notifyAudio.pause(); notifyAudio.currentTime=0; soundEnabled=true; enableSoundBtn.textContent='Звук увімкнено'; }
  catch{ alert('Клікніть ще раз, щоб дозволити звук'); }
});

// export / clear local
exportBtn.addEventListener('click', async ()=>{
  // Simple export: last 300 msgs snapshot (already in UI)
  alert('Експорт: копіювання з Firestore зроби через Firebase Console (цей демо не тягне весь архів).');
});
clearLocalBtn.addEventListener('click', ()=>{
  localStorage.clear(); alert('Локальні дані очищені (налаштування теми, тощо).');
});

// msg actions: edit/delete
function attachMsgHandlers(el, data){
  const isMine = currentUser && data.uid===currentUser.uid;
  if(!isMine) return;

  // dblclick to edit
  const bubbleText = el.querySelector('.text');
  el.addEventListener('dblclick', ()=>{
    const old = bubbleText.textContent;
    const input = document.createElement('textarea');
    input.value = old;
    input.style.width = '100%';
    input.style.minHeight = '38px';
    bubbleText.replaceWith(input);
    input.focus();

    const save = async ()=>{
      const val = (input.value||'').trim();
      const ref = doc(db, 'messages', data.id);
      await updateDoc(ref, { text: val });
    };
    const cancel = ()=>{ input.replaceWith(bubbleText); };

    input.addEventListener('keydown', async (e)=>{
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); await save(); }
      if(e.key==='Escape'){ e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', save);
  });

  // delete button
  const delBtn = el.querySelector('.del-btn');
  if(delBtn){
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Видалити повідомлення?')) return;
      await deleteDoc(doc(db, 'messages', data.id));
    });
  }
}

// AVATAR upload + update old messages
avaBtn.addEventListener('click', ()=> avaFile.click());
avaFile.addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  if(!currentUser) return alert('Спочатку увійдіть');

  try{
    const path = `avatars/${currentUser.uid}.jpg`;
    const r = sRef(storage, path);
    await uploadBytes(r, f);
    const url = await getDownloadURL(r);

    await updateProfile(currentUser, { photoURL: url });
    setAva(profileAva, currentUser);

    // batch update all user messages' photoURL
    const q = query(messagesRef, where('uid','==', currentUser.uid));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let cnt = 0;
    snap.forEach(d=>{
      batch.update(doc(db,'messages', d.id), { photoURL: url });
      cnt++;
      // Firestore batch limit is 500; in demo ok
    });
    if(cnt>0) await batch.commit();
    alert('Аватар оновлено' + (cnt? `, оновлено повідомлень: ${cnt}`:''));
  }catch(e){
    alert('Помилка завантаження аватара: '+e.message);
    console.error(e);
  }finally{
    avaFile.value='';
  }
});

// shortcuts
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
    const s=document.getElementById('search'); if(s){e.preventDefault(); s.focus();}
  }
});
// ... 🔹 (весь твій існуючий код залишається як є)

// ===== MOBILE MENU =====
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.querySelector(".sidebar");

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Закрити меню, якщо натиснув поза ним
document.addEventListener("click", (e) => {
  if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
    sidebar.classList.remove("open");
  }
});
