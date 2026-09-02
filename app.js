const SB_URL = 'https://jzipkujsmlrckzbpjwys.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6aXBrdWpzbWxyY2t6YnBqd3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDY3MTIsImV4cCI6MjA5NzAyMjcxMn0.rSWJinsJelhRYUtC9E7uMHMqgdFvSFVlI7UeqWT0qOQ';
const ADMIN_PASS_HASH = 'd99c76b0d56a2a1f48ad86ed7db001e4f6b142a54bfe36def517e9fa7af8159c';
const ADMIN_EMAIL = 'eslam.antar142@gmail.com'; // إيميل حساب الأدمن الحقيقي في Supabase Auth
let adminAccessToken = null;  // التوكن الحقيقي بعد تسجيل دخول الأدمن — ده اللي بيثبت هويته للسيرفر
let adminRefreshToken = null;


function escapeHtml(str) {
  if(str === null || str === undefined) return '';
  var s = String(str);
  s = s.replace(/&/g, '&amp;');
  s = s.replace(/\x3C/g, '&lt;');
  s = s.replace(/\x3E/g, '&gt;');
  s = s.replace(/\x22/g, '&quot;');
  s = s.replace(/\x27/g, '&#39;');
  return s;
}

// بيتأكد إن أي لينك جاي من المستخدم (فيديو، سوشيال ميديا، خريطة) بيبدأ بنوع آمن بس
// وبيرفض javascript: وأي حاجة تانية ممكن تنفّذ كود لو حد ضغط على اللينك
function safeUrl(u) {
  if(!u) return '';
  var s = String(u).trim();
  if(/^(https?:|tel:|mailto:)/i.test(s)) return s;
  return '';
}
const ADMIN_WA = '201080150801';

async function hashPass(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

const SECURITY_QUESTIONS = [
  'ما اسم أول مدرسة التحقت بها؟',
  'ما اسم والدتك؟',
  'ما هو لقبك من صغرك؟',
  'ما اسم أقرب صديق ليك في الطفولة؟',
  'ما اسم الشارع اللي اتربيت فيه؟'
];

// ============ نظام تسجيل المستخدمين (موبايل+باسورد أو جيميل) ============
const GOOGLE_CLIENT_ID = '1075657280150-b7l2nqp8ui28kipq01p9m02u5mgu6tum.apps.googleusercontent.com';

async function sbRPC(fn, params) {
  const res = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+(adminAccessToken || SB_KEY)},
    body: JSON.stringify(params)
  });
  let data = null;
  try { data = await res.json(); } catch(e) {}
  if(!res.ok) {
    const msg = (data && (data.message || data.hint || data.details)) || 'server_error';
    throw new Error(msg);
  }
  return data;
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('hamoul_user') || 'null'); } catch(e) { return null; }
}
function setCurrentUser(u) {
  try { localStorage.setItem('hamoul_user', JSON.stringify(u)); } catch(e) {}
}
function logoutUser() {
  localStorage.removeItem('hamoul_user');
  showToast('تم تسجيل الخروج');
  const el = document.getElementById('acctStatusBox');
  if(el) renderAcctStatusBox();
  updateNavAddVisibility();
}
function isOwnerOf(item) {
  const u = getCurrentUser();
  return !!(u && item && item.owner_id && item.owner_id === u.id);
}

// بيفتح نافذة تسجيل الدخول وبيرجع الـ user بعد ما يسجل — بيستخدم قبل أي عملية إضافة
let _authResolve = null;
function requireLogin() {
  const u = getCurrentUser();
  if(u) return Promise.resolve(u);
  return new Promise(function(resolve) {
    _authResolve = resolve;
    openAuthModal();
  });
}

function openAuthModal() {
  closeAuthModal();
  const overlay = document.createElement('div');
  overlay.id = 'authModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:16px;max-width:380px;width:100%;padding:20px;max-height:90vh;overflow-y:auto;font-family:Cairo,sans-serif;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<div style="font-size:16px;font-weight:900;">🔐 سجّل عشان تكمل</div>' +
        '<button onclick="closeAuthModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gray);">✕</button>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:14px;background:#f3f4f6;border-radius:10px;padding:4px;">' +
        '<button id="authTabLogin" onclick="switchAuthTab(\'login\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:white;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;">تسجيل الدخول</button>' +
        '<button id="authTabRegister" onclick="switchAuthTab(\'register\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:transparent;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;color:var(--gray);">حساب جديد</button>' +
      '</div>' +
      '<div id="authTabContent"></div>' +
      '<div style="text-align:center;margin:14px 0 10px;color:var(--gray);font-size:12px;position:relative;">' +
        '<span style="background:white;padding:0 10px;position:relative;z-index:1;">أو</span>' +
        '<div style="position:absolute;top:50%;right:0;left:0;height:1px;background:var(--border);"></div>' +
      '</div>' +
      '<div id="googleSignInBtn" style="display:flex;justify-content:center;min-height:40px;"></div>' +
    '</div>';
  document.body.appendChild(overlay);
  switchAuthTab('login');
  renderGoogleButton();
}

function closeAuthModal() {
  const el = document.getElementById('authModalOverlay');
  if(el) el.remove();
}

// نافذة موحّدة لعرض كلمة السر الجديدة بعد الاسترجاع التلقائي
function showNewPasswordModal(newPassword, subtitle) {
  var overlay = document.createElement('div');
  overlay.id = 'newPassModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:26px 22px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:36px;margin-bottom:10px;">🔑</div>' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:4px;">اتعملت كلمة سر جديدة!</div>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:16px;">' + (subtitle||'') + '</div>' +
      '<div style="background:#f0fdf4;border:2px dashed #16a34a;border-radius:12px;padding:14px;margin-bottom:14px;">' +
        '<div id="newPassText" dir="ltr" style="font-size:22px;font-weight:900;letter-spacing:2px;color:#166534;">' + escapeHtml(newPassword) + '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:#b91c1c;margin-bottom:16px;">⚠️ احفظها الآن، مش هتقدر تشوفها تاني</div>' +
      '<button onclick="navigator.clipboard.writeText(\'' + newPassword + '\').then(function(){showToast(\'✅ اتنسخت\')})" style="width:100%;background:#16a34a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px;">📋 نسخ كلمة السر</button>' +
      '<button onclick="document.getElementById(\'newPassModal\').remove()" style="width:100%;background:#f3f4f6;color:#666;border:none;padding:11px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">تمام، حفظتها</button>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function forgotUserPassword() {
  var phoneInput = document.getElementById('authPhone');
  var phone = phoneInput ? phoneInput.value.trim() : '';
  if(!phone) { showToast('اكتب رقم موبايلك الأول فوق', 'error'); return; }
  try {
    var question = await sbRPC('get_security_question_user', {p_phone: phone});
    if(!question) {
      // حساب قديم مفيهوش سؤال أمان — نرجع للطريقة اليدوية القديمة عن طريق الأدمن
      var msg = 'السلام عليكم، نسيت كلمة سر حسابي في دليل الحامول. رقم موبايلي: ' + phone;
      window.open('https://wa.me/' + ADMIN_WA + '?text=' + encodeURIComponent(msg), '_blank');
      showToast('حسابك قديم ومفيهوش سؤال أمان — هيتواصل معاك الأدمن', 'error');
      return;
    }
    var answer = prompt(question);
    if(answer === null) return;
    if(!answer.trim()) { showToast('لازم تكتب إجابة', 'error'); return; }
    var answerHash = await hashPass(answer.trim().toLowerCase());
    var rows = await sbRPC('self_forgot_password_user', {p_phone: phone, p_answer_hash: answerHash});
    var r = (rows && rows[0]) || {};
    if(!r.success) {
      if(r.out_status === 'WRONG_ANSWER') showToast('❌ الإجابة مش صح', 'error');
      else showToast('حصل خطأ، حاول تاني', 'error');
      return;
    }
    closeAuthModal();
    showNewPasswordModal(r.new_password, 'استخدمها لتسجيل الدخول بدل كلمة السر القديمة');
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
  }
}

function switchAuthTab(tab) {
  const lb = document.getElementById('authTabLogin'), rb = document.getElementById('authTabRegister');
  lb.style.background = tab==='login' ? 'white' : 'transparent';
  lb.style.color = tab==='login' ? 'var(--dark)' : 'var(--gray)';
  rb.style.background = tab==='register' ? 'white' : 'transparent';
  rb.style.color = tab==='register' ? 'var(--dark)' : 'var(--gray)';
  const c = document.getElementById('authTabContent');
  if(tab === 'login') {
    c.innerHTML =
      '<input id="authPhone" type="tel" placeholder="رقم الموبايل" dir="ltr" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<input id="authPass" type="password" placeholder="كلمة المرور" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<button id="authSubmitBtn" onclick="submitLogin()" style="width:100%;background:var(--primary);color:white;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">دخول</button>' +
      '<a href="javascript:void(0)" onclick="forgotUserPassword()" style="display:block;text-align:center;margin-top:12px;font-size:12px;color:#0369a1;text-decoration:underline;">نسيت كلمة السر؟</a>';
  } else {
    c.innerHTML =
      '<input id="authName" type="text" placeholder="الاسم" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<input id="authPhone" type="tel" placeholder="رقم الموبايل" dir="ltr" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<input id="authPass" type="password" placeholder="كلمة مرور (6 أرقام/حروف على الأقل)" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<select id="authSecQ" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">' +
        SECURITY_QUESTIONS.map(function(q){return '<option value="'+escapeHtml(q)+'">'+escapeHtml(q)+'</option>';}).join('') +
      '</select>' +
      '<input id="authSecA" type="text" placeholder="إجابتك على السؤال" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;">' +
      '<div style="font-size:10.5px;color:#0369a1;background:#eff6ff;border-radius:8px;padding:8px 10px;margin-bottom:10px;line-height:1.6;">💡 لو نسيت كلمة السر بعدين، هنسألك السؤال ده بدل ما تضطر تكلمنا — اكتب إجابة تفتكرها كويس ومتنساهاش</div>' +
      '<button id="authSubmitBtn" onclick="submitRegister()" style="width:100%;background:var(--green);color:white;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">إنشاء حساب</button>';
  }
}

function _genToken() {
  return 'tok_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function authInsert(body) {
  const res = await fetch(SB_URL + '/rest/v1/auth_inbox', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'apikey':SB_KEY,
      'Authorization':'Bearer '+SB_KEY,
      'Prefer':'return=representation'
    },
    body: JSON.stringify(body)
  });
  if(!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}
// اسم بديل للعمليات الآمنة العامة (تعديل/حذف)
const secureOp = authInsert;

async function submitLogin() {
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value;
  if(!phone || !pass) { showToast('اكتب رقم الموبايل وكلمة المرور', 'error'); return; }
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true; btn.textContent = 'جاري الدخول...';
  try {
    const hash = await hashPass(pass);
    const rows = await sbRPC('auth_login', {p_phone:phone, p_hash:hash});
    const r = (rows && rows[0]) || {};
    if(r.out_status !== 'ok') {
      if(r.out_message === 'TOO_MANY_ATTEMPTS') showToast('⏳ حاولت كتير غلط، استنى شوية وجرب تاني بعد ربع ساعة', 'error');
      else showToast('❌ رقم الموبايل أو كلمة المرور غلط', 'error');
      btn.disabled=false; btn.textContent='دخول'; return;
    }
    finishAuth({id:r.out_user_id, name:r.out_name, phone, token:r.out_token});
  } catch(e) {
    showToast('❌ حصل خطأ، حاول تاني', 'error');
    btn.disabled = false; btn.textContent = 'دخول';
  }
}

async function submitRegister() {
  const name = document.getElementById('authName').value.trim();
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value;
  const secQ = document.getElementById('authSecQ')?.value || '';
  const secA = document.getElementById('authSecA')?.value.trim() || '';
  if(!name) { showToast('اكتب الاسم', 'error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)) { showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  if(!pass || pass.length < 6) { showToast('كلمة المرور لازم 6 على الأقل', 'error'); return; }
  if(!secA) { showToast('اكتب إجابة سؤال الأمان — هتحتاجها لو نسيت كلمة السر', 'error'); return; }
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true; btn.textContent = 'جاري التسجيل...';
  try {
    const hash = await hashPass(pass);
    const rows = await sbRPC('auth_register', {p_name:name, p_phone:phone, p_hash:hash});
    const r = (rows && rows[0]) || {};
    if(r.out_status !== 'ok') {
      if((r.out_message||'') === 'PHONE_EXISTS') showToast('❌ الرقم ده مسجل قبل كده — جرب تسجيل الدخول', 'error');
      else showToast('❌ حصل خطأ، حاول تاني', 'error');
      btn.disabled = false; btn.textContent = 'إنشاء حساب';
      return;
    }
    try {
      const answerHash = await hashPass(secA.toLowerCase());
      await sbRPC('set_security_question_user', {p_token: r.out_token, p_question: secQ, p_answer_hash: answerHash});
    } catch(e2) {}
    // علّم إنه حساب جديد لسه اتعمل، عشان لو جاي من زرار "+" العام في الأسفل نوديه للرئيسية بدل ما نفتحله فورم إضافة موضوع على طول
    window._justRegisteredNow = true;
    finishAuth({id:r.out_user_id, name:r.out_name || name, phone, token:r.out_token});
  } catch(e) {
    showToast('❌ حصل خطأ، حاول تاني', 'error');
    btn.disabled = false; btn.textContent = 'إنشاء حساب';
  }
}

function renderGoogleButton() {
  const wrap = document.getElementById('googleSignInBtn');
  if(!wrap) return;
  if(GOOGLE_CLIENT_ID === 'GOOGLE_CLIENT_ID_PLACEHOLDER') {
    wrap.innerHTML = '<div style="font-size:11px;color:var(--gray);text-align:center;">التسجيل بالجيميل هيتفعّل قريب</div>';
    return;
  }
  function render() {
    try {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      google.accounts.id.renderButton(wrap, { theme:'outline', size:'large', text:'continue_with', locale:'ar', width:280 });
    } catch(e) {}
  }
  if(window.google && window.google.accounts) render();
  else {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = render;
    document.head.appendChild(s);
  }
}

async function handleGoogleCredential(response) {
  try {
    const res = await fetch(SB_URL + '/functions/v1/verify-google-login', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY},
      body: JSON.stringify({credential: response.credential})
    });
    const rows = await res.json();
    if(!res.ok || !rows || !rows[0]) throw new Error((rows && rows.error) || 'فشل التحقق');
    const u = rows[0];
    finishAuth({id:u.id, name:u.name, email:u.email||'', phone:u.phone||'', token:u.token});
  } catch(e) {
    showToast('❌ حصل خطأ في تسجيل الجيميل', 'error');
  }
}

function finishAuth(user) {
  setCurrentUser(user);
  closeAuthModal();
  showToast('✅ أهلاً ' + user.name + '!');
  renderAcctStatusBox();
  checkPhoneRequired();
  updateNavAddVisibility();
  if(_authResolve) { const r = _authResolve; _authResolve = null; r(user); }
}

// ===== طلب رقم الموبايل ممن سجّل بالجيميل (مفيش رقم موبايل من جوجل) — إجباري لاستكمال التسجيل =====
function checkPhoneRequired() {
  var u = getCurrentUser();
  if(u && !u.phone) showCollectPhoneModal();
}

function showCollectPhoneModal() {
  if(document.getElementById('collectPhoneOverlay')) return;
  document.body.style.overflow = 'hidden';
  var overlay = document.createElement('div');
  overlay.id = 'collectPhoneOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">📱</div>' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:6px;">استكمال التسجيل</div>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:14px;">لازم تكتب رقم موبايلك عشان تقدر تكمل استخدام الموقع</div>' +
      '<input id="cph_phone" type="tel" placeholder="رقم موبايلك (01xxxxxxxxx)" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:14px;text-align:center;">' +
      '<button onclick="submitCollectPhone()" style="width:100%;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">حفظ</button>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function submitCollectPhone() {
  var phone = document.getElementById('cph_phone').value.trim();
  if(!phone || !/^01[0-9]{9}$/.test(phone)) { showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  var u = getCurrentUser();
  if(!u) return;
  try {
    await sbRPC('secure_update_user_phone', {p_token: u.token, p_phone: phone});
    u.phone = phone;
    setCurrentUser(u);
    var o = document.getElementById('collectPhoneOverlay');
    if(o) o.remove();
    document.body.style.overflow = '';
    showToast('✅ تم حفظ رقم موبايلك');
  } catch(e) {
    if(String(e.message||'').indexOf('PHONE_EXISTS') !== -1) showToast('الرقم ده مسجل بحساب تاني', 'error');
    else showToast('حصل خطأ، حاول تاني', 'error');
  }
}

function renderAcctStatusBox() {
  const box = document.getElementById('acctStatusBox');
  if(!box) return;
  const u = getCurrentUser();
  if(u) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;">' +
        '<div style="width:38px;height:38px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">👤</div>' +
        '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + escapeHtml(u.name) + '</div><div style="font-size:11px;color:var(--gray);">' + (u.phone || u.email || '') + '</div></div>' +
        '<button onclick="logoutUser()" style="background:#fee2e2;color:#dc2626;border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">خروج</button>' +
      '</div>';
  } else {
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;">' +
        '<div style="width:38px;height:38px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">🔐</div>' +
        '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">مش مسجل دخول</div><div style="font-size:11px;color:var(--gray);">سجل عشان تقدر تضيف إعلانات ومواضيع</div></div>' +
        '<button onclick="openAuthModal()" style="background:var(--primary);color:white;border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">دخول</button>' +
      '</div>';
  }
}

// CATEGORIES DEFINITION
// ===== مجتمع المدرسين: قائمة المواد الدراسية منظمة بالمرحلة والشعبة =====
const TEACHER_SUBJECT_GROUPS = [
  { id:'primary', label:'الابتدائية', icon:'🟢', subjects:['لغة عربية','رياضيات','لغة إنجليزية','دراسات اجتماعية','علوم','تربية دينية','ICT (تكنولوجيا المعلومات)','تربية فنية / موسيقى','مدرس متابعة / تأسيس عام'] },
  { id:'prep', label:'الإعدادية', icon:'🟡', subjects:['لغة عربية','رياضيات (جبر وهندسة)','لغة إنجليزية','علوم','دراسات اجتماعية (تاريخ وجغرافيا)','تربية دينية','حاسب آلي وتكنولوجيا','تربية فنية','لغة أجنبية ثانية (فرنساوي/ألماني)'] },
  { id:'sec_shared', label:'الثانوي — مشترك (كل الشعب)', icon:'🔵', subjects:['لغة عربية','لغة إنجليزية','لغة ثانية (فرنساوي/ألماني/إيطالي/إسباني)','تربية دينية'] },
  { id:'sec_science', label:'الثانوي — علمي علوم', icon:'🔵', subjects:['أحياء','كيمياء','فيزياء'] },
  { id:'sec_math', label:'الثانوي — علمي رياضة', icon:'🔵', subjects:['رياضيات بحتة (تفاضل وتكامل، جبر وهندسة فراغية)','رياضيات تطبيقية (استاتيكا وديناميكا)','فيزياء','كيمياء'] },
  { id:'sec_literary', label:'الثانوي — أدبي', icon:'🔵', subjects:['تاريخ','جغرافيا','علم نفس واجتماع','فلسفة ومنطق'] },
];
// أنواع تانية غير المواد الدراسية (تفضل زي ما هي، مش جزء من نظام اختيار المواد)
const TEACHER_OTHER_TYPES = ['سنتر تعليمي','تحفيظ قرآن','روضة وحضانة','كورسات لغات','كورسات كمبيوتر','دروس برمجة','تأهيل وتدريب مهني','فصل دراسي خاص','دروس أونلاين','تعليم ذوي الاحتياجات الخاصة','مطلوب مدرس','أخرى'];

const CATEGORIES = [
  { id:'jobs', name:'وظائف', icon:'💼', color:'#e8f5ee', subs:[], children: [
    { id:'jobs_vacancy', name:'وظيفة شاغرة', icon:'🏢', color:'#e8f5ee', subs:[
      {name:'عام — كل الوظائف الشاغرة', icon:'🔍'},
      {name:'عيادات وصيدليات', icon:'🏥'},
      {name:'محلات وتجارة', icon:'🛒'},
      {name:'مطاعم وكافيهات', icon:'🍕'},
      {name:'تعليم ومدارس', icon:'📚'},
      {name:'سواقين ونقل', icon:'🚗'},
      {name:'بناء وتشطيب', icon:'🏗️'},
      {name:'صيانة وحرفيين', icon:'🔧'},
      {name:'محاسبة وإدارة', icon:'💼'},
      {name:'مبيعات وتسويق', icon:'📣'},
      {name:'حراسة وأمن', icon:'🔒'},
      {name:'تمريض ورعاية', icon:'💉'},
      {name:'أخرى', icon:'📋'},
    ]},
    { id:'jobs_seeker', name:'باحث عن عمل', icon:'🙋', color:'#eff6ff', subs:[
      {name:'عام — كل طلبات العمل', icon:'🔍'},
      {name:'عيادات وصيدليات', icon:'🏥'},
      {name:'محلات وتجارة', icon:'🛒'},
      {name:'تعليم ومدارس', icon:'📚'},
      {name:'سواقين ونقل', icon:'🚗'},
      {name:'بناء وتشطيب', icon:'🏗️'},
      {name:'صيانة وحرفيين', icon:'🔧'},
      {name:'محاسبة وإدارة', icon:'💼'},
      {name:'مبيعات وتسويق', icon:'📣'},
      {name:'أخرى', icon:'📋'},
    ]},
  ]},
  { id:'online',     name:'البيع أونلاين',      icon:'🛍️', color:'#ede9fe', subs:['ملابس حريمي','ملابس رجالي','ملابس أطفال','أحذية وشنط','مستحضرات تجميل وعناية','عطور','إكسسوارات وهدايا','موبايلات وإلكترونيات','سماعات وإكسسوار تقني','ساعات','أدوات منزلية','مفروشات','ديكور مناسبات','ألعاب أطفال','كتب ومستلزمات مدرسية','أغذية وحلويات هوم ميد','مخبوزات وكيك','ألبان وأجبان بلدي (لبن، قشطة، جبنة)','لحوم ومجمدات','بيع طيور وبط وفراخ','أنابيب بوتاجاز','عسل ومنتجات طبيعية','مكملات غذائية','أدوات رياضية','حرف يدوية هاند ميد','نباتات وبذور','حيوانات أليفة ومستلزماتها','أخرى'] },
  { id:'doctors',    name:'أطباء',              icon:'🩺', color:'#fee2e2', subs:['أسنان','عظام','أطفال وحديثي الولادة','نساء وتوليد','باطنة والجهاز الهضمي','عيون','أنف وأذن وحنجرة','قلب وأوعية دموية','جلدية','مخ وأعصاب','جراحة عامة','صدر','مسالك بولية','أورام','علاج طبيعي','تغذية علاجية','عام'] },
  { id:'vet', name:'بيطري ومستلزمات', icon:'🐾', color:'#dcfce7', subs:[], children: [
    { id:'vet_medical', name:'طب وصيدليات', icon:'💉', color:'#dcfce7', subs:[
      {name:'طبيب بيطري', icon:'🩺'},
      {name:'صيدلية بيطرية', icon:'💊'},
    ]},
    { id:'vet_supplies', name:'أدوات ومستلزمات', icon:'🎾', color:'#fef3c7', subs:[
      {name:'أكل ومستلزمات حيوانات أليفة', icon:'🍖'},
      {name:'أقفاص وتربية طيور', icon:'🦜'},
      {name:'إكسسوارات وأدوات استحمام وتربية', icon:'🧴'},
    ]},
    { id:'vet_breeders', name:'مربي حيوانات وطيور', icon:'🐕', color:'#fce7f3', subs:[
      {name:'مربي حمام زينة', icon:'🕊️'},
      {name:'مربي مواشي (كلاب، قطط، طيور)', icon:'🐈'},
      {name:'مزارع دواجن', icon:'🐔'},
    ]},
  ]},
  { id:'medservices',name:'خدمات طبية',         icon:'🏥', color:'#fee2e2', subs:['صيدليات','معامل تحاليل','مراكز أشعة','مراكز تخاطب','مستلزمات طبية','معامل نظارات','تمريض منزلي','الطب التكميلي'] },
  { id:'teachers_hub', name:'مجتمع المدرسين', icon:'👨‍🏫', color:'#ede9fe', subs:[], children: [
    ...TEACHER_SUBJECT_GROUPS.map(g => ({ id:'th_'+g.id, name:g.label, icon:g.icon, color:'#ede9fe', subs: g.subjects.map(s=>({name:s, icon:g.icon})) })),
    { id:'th_other', name:'أنواع تانية', icon:'🏫', color:'#ede9fe', subs: TEACHER_OTHER_TYPES.map(s=>({name:s, icon:'🏫'})) },
  ] },
  { id:'realestate', name:'عقارات', icon:'🏠', color:'#dbeafe', subs:[], children: [
    { id:'re_rent', name:'إيجار', icon:'🔑', color:'#dbeafe', subs:[
      {name:'شقق للإيجار', icon:'🏠'},
      {name:'غرف للإيجار', icon:'🚪'},
      {name:'محلات للإيجار', icon:'🏪'},
      {name:'مكاتب للإيجار', icon:'🏢'},
      {name:'مخازن للإيجار', icon:'📦'},
      {name:'أراضي للإيجار', icon:'🌿'},
    ]},
    { id:'re_sale', name:'بيع', icon:'💰', color:'#dcfce7', subs:[
      {name:'شقق للبيع', icon:'🏠'},
      {name:'بيوت للبيع', icon:'🏡'},
      {name:'فيلات للبيع', icon:'🏘️'},
      {name:'محلات للبيع', icon:'🏪'},
      {name:'أراضي للبيع', icon:'🌿'},
      {name:'مخازن للبيع', icon:'📦'},
    ]},
    { id:'re_wanted', name:'مطلوب', icon:'🔍', color:'#fef9c3', subs:[
      {name:'شقق مطلوبة', icon:'🏠'},
      {name:'بيوت مطلوبة', icon:'🏡'},
      {name:'محلات مطلوبة', icon:'🏪'},
      {name:'أراضي مطلوبة', icon:'🌿'},
    ]},
  ]},
  { id:'news',       name:'أخبار ومناقشات الحامول',         icon:'📰', color:'#e0f2fe', subs:[] },
  { id:'home',       name:'طلبات المنزل',        icon:'🛒', color:'#dcfce7', subs:['ماركت','عطارة','خضار وفاكهة','مقلة وتسالي','حلويات','مخبوزات','شوايات سمك','فراخ وطيور','لحوم','فسيخ ورنجة','مستحضرات تجميل'] },
  { id:'lost',       name:'مفقودات',            icon:'🔎', color:'#fff7ed', subs:['أوراق وبطاقات','مفاتيح','محفظة / أموال','إلكترونيات','حيوانات أليفة','أخرى'] },
  { id:'deaths',     name:'وفيات الحامول',      icon:'🕌', color:'#f1f5f9', children:[
      { id:'deaths_announce', name:'نعي ووفيات', icon:'🕌' },
      { id:'deaths_memorial', name:'توثيق الراحلين', icon:'🕯️' }
    ] },
  { id:'used_market', name:'سوق المستعمل والاستبدال', icon:'🔄', color:'#fef3c7', subs:['موبايلات وأجهزة','أثاث وديكور','ملابس مستعملة','كتب ومستلزمات دراسية','أجهزة كهربائية','عفش كامل','سيارات وتكاتك','أدوات ومعدات','العاب أطفال','أخرى'] },
  { id:'food', name:'مطاعم وكافيهات', icon:'🍕', color:'#fef9c3', subs:[], children: [
    { id:'food_rest', name:'مطاعم', icon:'🍽️', color:'#fef9c3', subs:[
      {name:'مطاعم بروست', icon:'🍗'},
      {name:'مطاعم مشويات', icon:'🥩'},
      {name:'مطاعم فول وطعمية', icon:'🫘'},
      {name:'مطاعم كشري', icon:'🍜'},
      {name:'مطاعم بيتزا وكريب', icon:'🍕'},
      {name:'مطاعم شاورما', icon:'🌯'},
      {name:'مطاعم سمك', icon:'🐟'},
      {name:'مطاعم وجبات سريعة', icon:'🍔'},
      {name:'مطاعم مأكولات شعبية', icon:'🥘'},
      {name:'حلويات ومخبوزات', icon:'🍰'},
      {name:'عصائر ومشروبات', icon:'🥤'},
      {name:'أخرى', icon:'🍽️'},
    ]},
    { id:'food_cafe', name:'كافيهات', icon:'☕', color:'#fef3c7', subs:[
      {name:'كافيهات قهوة', icon:'☕'},
      {name:'كافيهات مشروبات', icon:'🧃'},
      {name:'كافيهات متكاملة', icon:'🏠'},
    ]},
  ]},
  { id:'marriage',      name:'بيت الحلال',           icon:'💍', color:'#fce7f3', subs:[] },
  { id:'furniture',  name:'أدوات منزلية',        icon:'🛋️', color:'#dbeafe', subs:['أثاث','مطابخ ألوميتال','تكييفات','أدوات منزلية','ستائر ومفروشات','أنتيكات ونجف','سجاد','فلاتر مياه','قطع غيار أدوات كهربائية'] },
  { id:'fashion',    name:'محلات ملابس',               icon:'👗', color:'#fce7f3', subs:['سنتر متكامل','حريمي','رجالي وشبابي','أطفال','ملابس داخلية','ملابس رياضية'] },
  { id:'shoes',      name:'محلات أحذية وأكسسوارات',   icon:'👟', color:'#fce7f3', subs:['أحذية','أكسسوارات وهدايا'] },
  { id:'cars',       name:'سيارات وتكاتك',       icon:'🚗', color:'#f1f5f9', subs:['إيجار سيارات','مغسلة سيارات','صيانة وزيت','تروسيكل','🛺 اطلب توكتوك','توصيل أطفال (مدارس)','نقل عفش','دليفري','سواقين'] },
  { id:'cars_market', name:'سوق السيارات والتكاتك', icon:'🚙', color:'#e0f2fe', subs:['معارض بيع سيارات','معارض بيع تكاتك','قطع غيار سيارات','قطع غيار تكاتك','ميكانيكا وصيانة سيارات','كهرباء وتكييف سيارات','عفشة ودوكو سيارات'] },
  { id:'charity', name:'قسم الخير والتبرعات', icon:'🤍', color:'#f0fdf4', subs:['ملابس وأدوات منزلية','أثاث وعفش','كتب ومستلزمات دراسية','أجهزة وموبايلات','طعام وغذاء','مساعدة مادية','تبرع بدم','غير ذلك'] },
  { id:'sports', name:'رياضة', icon:'⚽', color:'#dcfce7', subs:['صالات جيم','كرة قدم','أكاديمية فنون قتالية','ألعاب رياضية — مستلزمات وبيع','ملاعب رياضية','نوادي وملاعب خماسية (نجيل صناعي)','سباحة','دراجات'] },
  { id:'fun',        name:'ترفيه',                icon:'🎡', color:'#ffe4e6', subs:['ملاهي وألعاب أطفال','بلايستيشن وألعاب','مراكز تنمية مهارات وأنشطة شبابية'] },
  { id:'pets_market', name:'بيع حيوانات', icon:'🐶', color:'#fef9c3', subs:['كلاب','قطط','طيور وحمام','فراخ وبط ودواجن','أرانب','حيوانات أخرى'] },
  { id:'offices', name:'مكاتب وخدمات مهنية', icon:'🗂️', color:'#e0e7ff', subs:[], children: [
    { id:'offices_legal', name:'قانونية وقضائية', icon:'⚖️', color:'#e0e7ff', subs:[
      {name:'محاماة واستشارات قانونية', icon:'👨‍⚖️'},
      {name:'توثيق وشهر عقاري', icon:'📜'},
      {name:'تحكيم دولي وتسوية منازعات', icon:'🤝'},
    ]},
    { id:'offices_finance', name:'محاسبية ومالية وضريبية', icon:'💰', color:'#dcfce7', subs:[
      {name:'محاسب قانوني ومراجع حسابات', icon:'🧮'},
      {name:'تخليص ضرائب ومبيعات', icon:'🧾'},
      {name:'تأسيس شركات ودراسات جدوى', icon:'🏢'},
      {name:'مراجعة حسابات مخازن ومستودعات', icon:'📦'},
    ]},
    { id:'offices_travel', name:'سفر وسياحة وتأشيرات', icon:'✈️', color:'#dbeafe', subs:[
      {name:'سفر وسياحة وحج وعمرة', icon:'🕋'},
      {name:'استخراج تأشيرات وجوازات سفر', icon:'🛂'},
      {name:'حجز رحلات سياحية داخلية وخارجية', icon:'🧳'},
    ]},
    { id:'offices_engineering', name:'هندسية واستشارية', icon:'📐', color:'#fef3c7', subs:[
      {name:'هندسة وتصميم معماري وإنشائي', icon:'🏛️'},
      {name:'استشارات هندسية ومقاولات عامة', icon:'👷'},
      {name:'مساحة وهندسة مدنية', icon:'📏'},
      {name:'تصميم ديكور وتشطيبات داخلية', icon:'🛋️'},
    ]},
    { id:'offices_admin', name:'خدمات إدارية وحكومية', icon:'📋', color:'#fce7f3', subs:[
      {name:'تخليص جمركي واستيراد وتصدير', icon:'🚢'},
      {name:'خدمات عامة وتخليص أوراق حكومية', icon:'🏛️'},
      {name:'ترجمة معتمدة', icon:'🌐'},
      {name:'إدخال بيانات وطباعة وأبحاث', icon:'🖨️'},
      {name:'عقارية وإدارية (إدارة أملاك)', icon:'🏠'},
    ]},
  ]},
  { id:'salon',      name:'صالونات وتجميل',      icon:'💇', color:'#fce7f3', subs:['حلاق رجالي','ميكب آرتيست','بيوتي سنتر','صالون حريمي'] },
  { id:'market_prices', name:'أسعار السوق',        icon:'🛒', color:'#fef9c3', subs:['خضار وفاكهة','سمك','فراخ وطيور','لحوم','بيض ومنتجات ألبان','بقوليات وحبوب'] },
  { id:'gold',       name:'محلات الدهب',          icon:'💍', color:'#fef9c3', subs:['دهب','فضة','مشغولات ذهبية','إصلاح مجوهرات','شراء دهب قديم'] },
  { id:'building',   name:'بناء وتشطيب',         icon:'🏗️', color:'#fef3c7', subs:['بناء','محارة','سيراميك','رخام','جبس','عزل','مقاولات عامة'] },
  { id:'crafts', name:'صيانة وحرفيين', icon:'🔧', color:'#ffedd5', subs:[], children: [
    { id:'crafts_maintenance', name:'صيانة وحرفيين', icon:'🔧', color:'#ffedd5', subs:[
      {name:'كهرباء', icon:'⚡'},
      {name:'سباكة', icon:'🚿'},
      {name:'نجارة', icon:'🪚'},
      {name:'نقاشة', icon:'🎨'},
      {name:'حدادة وألوميتال', icon:'🔩'},
      {name:'صيانة أجهزة', icon:'📺'},
      {name:'صيانة تكييف', icon:'❄️'},
      {name:'حرفيين عامة', icon:'🛠️'},
      {name:'خياط حريمي', icon:'🪡'},
      {name:'خياط رجالي', icon:'🧵'},
      {name:'مقاولي بناء وهدم', icon:'🏗️'},
      {name:'محارة وبياض', icon:'🧱'},
      {name:'أعمال سيراميك وبورسلين', icon:'🀄'},
      {name:'أعمال جبس بورد وسقف معلق', icon:'🏠'},
      {name:'تركيب واجهات زجاج وكوريتاكين', icon:'🪟'},
      {name:'أعمال رخام وجرانيت', icon:'⬜'},
      {name:'نجار مسلح (صب وأسقف خرسانية)', icon:'🧊'},
      {name:'عزل أسطح وفوم', icon:'🌂'},
      {name:'ترميمات عامة وهدم', icon:'🔨'},
      {name:'تركيب كاميرات مراقبة وأنظمة حماية', icon:'📹'},
      {name:'حداد مسلح ومقاول حديد', icon:'⚙️'},
      {name:'فني دش وريسيفر', icon:'📡'},
      {name:'صيانة موبايل ولابتوب', icon:'📱'},
      {name:'تركيب ورق حائط وثري دي', icon:'🖼️'},
      {name:'صيانة دفايات وسخانات مركزية', icon:'🔥'},
      {name:'صيانة فلاتر مياه ومنقيات', icon:'💧'},
      {name:'فني ستائر ومفروشات', icon:'🪡'},
      {name:'صيانة مصاعد وأسانسير', icon:'🛗'},
      {name:'مقاول ترامب وكريتال', icon:'🚪'},
      {name:'نقاش ومزخرف واجهات', icon:'✨'},
      {name:'صيانة ماكينات خياطة', icon:'🧵'},
      {name:'مصلح مفاتيح وكوالين', icon:'🔑'},
      {name:'صيانة موازين ومقاييس رقمية', icon:'⚖️'},
      {name:'صنايعي بلاط موزاييك وقرمد', icon:'🧱'},
      {name:'فني مظلات وبرجولات حدائق', icon:'🌳'},
      {name:'فني شفاطات ومداخن مطاعم', icon:'🍳'},
      {name:'فني شبكات غاز طبيعي', icon:'🔥'},
      {name:'منجد أفرنجي وبلدي', icon:'🛋️'},
      {name:'نجار موبيليا وأبواب', icon:'🚪'},
    ]},
    { id:'crafts_cleaning', name:'تنظيف', icon:'🧹', color:'#e0f2fe', subs:[
      {name:'تنظيف بيوت', icon:'🏠'},
      {name:'تنظيف محلات', icon:'🏪'},
      {name:'تنظيف سجاد وموكيت', icon:'🧺'},
      {name:'تنظيف خزانات مياه', icon:'💧'},
      {name:'تنظيف واجهات', icon:'🏢'},
      {name:'تعقيم ورش مبيدات', icon:'🧴'},
    ]},
    { id:'crafts_moving', name:'نقل عفش', icon:'🚚', color:'#fef3c7', subs:[
      {name:'ونش رفع عفش هيدروليك (أونسا)', icon:'🏗️'},
      {name:'رجالة نقل عفش', icon:'💪'},
      {name:'سيارات نقل عفش مغلقة (دينا / جامبو)', icon:'🚛'},
    ]},

  ]},
  { id:'tech',       name:'أجهزة إلكترونية',    icon:'📱', color:'#dbeafe', subs:['موبايل وأكسسوار','كمبيوتر ومستلزماته','كاميرات مراقبة وأنظمة'] },
  { id:'events',     name:'أفراح ومناسبات',      icon:'🎉', color:'#fef9c3', subs:['قاعات أفراح','أتيليه','بدل مناسبات','أستوديوهات','صالون رجالي','شيف المناسبات'] },
  { id:'ads',        name:'دعاية وإعلان',        icon:'📣', color:'#dbeafe', subs:['تصميم جرافيك','طباعة','لافتات وإعلانات','سوشيال ميديا'] },
  { id:'agri',       name:'محاصيل وأعلاف',       icon:'🌾', color:'#dcfce7', subs:['محاصيل زراعية','أعلاف'] },
  { id:'emergency',     name:'أرقام الطوارئ',         icon:'🚨', color:'#fee2e2', subs:[] },
  { id:'transport_news', name:'موقف الحامول كفرالشيخ',  icon:'🚌', color:'#f0fdf4', subs:[] },
  { id:'prayer',        name:'مواقيت الصلاة',       icon:'🕌', color:'#e0f2fe', subs:[] },
];

let allAds = [];

// حل جذري: منع أي دالة من تسجيل صفحة جديدة في تاريخ المتصفح وهي بترجع لصفحة سابقة
// (كان ده سبب رجوع زرار الموبايل للصفحة الرئيسية بدل القسم — كل دالة كانت بتسجل نفسها تاني وقت الرجوع فبتلخبط الترتيب)
(function(){
  var _origPushState = history.pushState.bind(history);
  history.pushState = function(state, title, url) {
    if(window._restoringFromDetail) return; // إحنا بنرجع لصفحة سابقة — مفيش داعي نسجلها تاني
    return _origPushState(state, title, url);
  };
})();
let isAdmin = false;

// ===== منطق انتهاء صلاحية إعلانات الوظائف (30 يوم) =====
const JOB_AD_EXPIRY_DAYS = 30;
function isAdExpired(ad) {
  if(!ad || ad.category !== 'jobs' || !ad.created_at) return false;
  var ageMs = Date.now() - new Date(ad.created_at).getTime();
  return ageMs > JOB_AD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}
let slideIdx = 0;
let slideTimer;

const paidBanners = [
  // البانرات دلوقتي بتجي من Supabase — شوف loadHomeBanners()
];

// SUPABASE
async function sbFetch(method, path, body=null) {
  const opts = {
    method,
    headers: {
      'Content-Type':'application/json',
      'apikey':SB_KEY,
      // لو الأدمن مسجّل دخول بحساب حقيقي، ابعت توكنه (مش مفتاح anon العام)
      // عشان السيرفر يقدر يتأكد فعلاً إنه هو، مش أي حد بس فتح الكونسول
      'Authorization':'Bearer '+(adminAccessToken || SB_KEY),
      'Cache-Control':'no-cache'
    }
  };
  if(body) opts.body = JSON.stringify(body);
  if(method==='POST' || method==='PATCH' || method==='DELETE') opts.headers['Prefer'] = 'return=minimal';
  const res = await fetch(SB_URL+'/rest/v1/'+path, opts);
  if(method==='GET') return res.json();
  if(!res.ok) { const err = await res.text(); throw new Error(err); }
  return res;
}

// LOAD ADS
async function loadAds() {
  try {
    const rawAds = await sbFetch('GET','ads?select=*&order=created_at.desc') || [];
    allAds = rawAds.filter(a => a.status !== 'deleted');
    updateCatCounts();
  } catch(e) { console.error(e); }
}

// UPDATE CATEGORY COUNTS
function updateCatCounts() {
  CATEGORIES.forEach(cat => {
    const approved = allAds.filter(a => a.status==='approved' && a.category===cat.id && !isAdExpired(a));
    const el = document.getElementById('count_'+cat.id);
    if(el && approved.length > 0) {
      el.textContent = approved.length;
      el.classList.add('show');
    }
  });
  // تحديث شريط الإحصائيات
  const totalApproved = allAds.filter(a=>a.status==='approved').length;
  const statAds = document.getElementById('statAds');
  const statCats = document.getElementById('statCats');
  if(statAds) statAds.textContent = totalApproved + '+';
  if(statCats) statCats.textContent = CATEGORIES.length;
}

// BUILD CATEGORIES GRID
function buildCatsGrid() {
  const grid = document.getElementById('catsGrid');
  // Skeleton أولاً
  grid.innerHTML = Array(8).fill(`
    <div class="skel-card" style="min-height:70px;display:flex;align-items:center;gap:12px;">
      <div class="skeleton skel-line medium" style="flex:1;height:16px;"></div>
      <div class="skeleton" style="width:52px;height:52px;border-radius:14px;flex-shrink:0;"></div>
    </div>`).join('');
  // بعدين الكروت الحقيقية
  setTimeout(() => {
    grid.innerHTML = CATEGORIES.map(cat => `
      <div class="cat-card" onclick="openCategory('${cat.id}')">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-icon-wrap" style="background:${cat.color}">${cat.icon}</div>
        <span class="cat-count" id="count_${cat.id}">0</span>
      </div>
    `).join('');
  }, 100);
}

// OPEN CATEGORY → show children, subs, or ads
function openCategory(catId) {
  if(catId === 'daily_tips') { showTipsPage(); return; }
  if(catId === 'community') { showCommunityPage(); return; }
  if(catId === 'doctors') { showDoctorsHub(); return; }
  if(catId === 'charity') { showCharityPage(); return; }
  if(catId === 'teachers' || catId === 'teachers_hub') { showTeachersHub(); return; }
  if(catId === 'borsa') { showBorsaPage(); return; }
  if(catId === 'emergency') { showEmergencyPage(); return; }
  if(catId === 'news') { showNewsPage(); return; }
  if(catId === 'transport_news') { showTransportPage(); return; }
  if(catId === 'market_prices') { showMarketPrices(); return; }
  if(catId === 'prayer') { showPrayerTimes(); return; }
  if(catId === 'marriage') { showMarriagePage(); return; }
  const cat = CATEGORIES.find(c => c.id === catId);
  if(!cat) return;
  if(cat.children && cat.children.length > 0) {
    showChildrenPage(cat);
  } else if(cat.subs && cat.subs.length > 0) {
    showSubsPage(cat);
  } else {
    showAdsPage(cat, null);
  }
}

// صفحة الـ children (المستوى الثاني)
function showChildrenPage(cat) {
  sessionStorage.setItem('dynState', JSON.stringify({type:'children', catId:cat.id}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>${cat.icon} ${cat.name}</span>
      <span></span>
    </div>
    <div id="catBanner"></div>
    ${cat.id === 'food' ? `
    <div style="background:linear-gradient(135deg,#fef9c3,#fef08a);padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #fde047;">
      <span style="font-size:26px;flex-shrink:0;">🍽️</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:900;color:#854d0e;">عندك مطعم أو كافيه في الحامول؟</div>
        <div style="font-size:12px;color:#713f12;margin-top:2px;line-height:1.5;">أضف إعلانك مجانًا واظهر لآلاف العملاء اللي بيدوروا على أكل كل يوم</div>
      </div>
    </div>` : ''}
    <div class="dyn-content" style="padding:12px;">
      <div class="cats-grid">
        ${cat.children.map(child => `
          <div class="cat-card" onclick="openChildCategory('${cat.id}','${child.id}')">
            <div class="cat-name">${child.name}</div>
            <div class="cat-icon-wrap" style="background:${child.color||cat.color};font-size:30px;">${child.icon}</div>
          </div>`).join('')}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(cat.id, null);
}

function openChildCategory(parentId, childId) {
  const parent = CATEGORIES.find(c => c.id === parentId);
  const child = parent?.children?.find(c => c.id === childId);
  if(!child) return;
  if(child.subs && child.subs.length > 0) {
    showSubsPageV2(parent, child);
  } else {
    showAdsPage({...child, id:parentId}, child.name);
  }
}

// صفحة التخصصات (المستوى الثالث) مع أيقونات
function showSubsPageV2(parent, child) {
  sessionStorage.setItem('dynState', JSON.stringify({type:'subs2', catId:parent.id, childId:child.id}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="showChildrenPage(CATEGORIES.find(c=>c.id==='${parent.id}'))">←</button>
      <span>${child.icon} ${child.name}</span>
      <span></span>
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" style="padding:12px;">
      <div class="cats-grid">
        ${child.subs.map(sub => `
          <div class="cat-card" onclick="showAdsPageV2('${parent.id}','${child.id}','${sub.name}')">
            <div class="cat-name">${sub.name}</div>
            <div class="cat-icon-wrap" style="background:${child.color||parent.color};font-size:30px;">${sub.icon}</div>
          </div>`).join('')}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(parent.id, null);
}

// الفئات المتفرعة (children) اللي بتتوجه لنظام المعارض
var NESTED_SHOP_CHILDREN = ['food_rest', 'food_cafe', 'crafts_maintenance', 'crafts_cleaning', 'crafts_moving', 'vet_medical', 'vet_supplies', 'vet_breeders', 'offices_legal', 'offices_finance', 'offices_travel', 'offices_engineering', 'offices_admin'];

function showAdsPageV2(parentId, childId, subName) {
  // فئات متفرعة معينة (مطاعم/كافيهات/صيانة وحرفيين/تنظيف) → نظام المعارض
  if(NESTED_SHOP_CHILDREN.indexOf(childId) !== -1 && subName && !subName.startsWith('عام —')) {
    showShopsPage(subName, childId);
    return;
  }
  const parent = CATEGORIES.find(c => c.id === parentId);
  const child = parent?.children?.find(c => c.id === childId);
  if(!parent) return;

  const isGeneral = subName.startsWith('عام —');

  const ads = allAds.filter(a => {
    if(a.status !== 'approved' && !isAdmin) return false;
    if(a.category !== parentId) return false;
    if(!isAdmin && isAdExpired(a)) return false;
    if(isGeneral) {
      return a.subcategory?.startsWith(child?.name + ' —') || a.subcategory === child?.name || false;
    }
    // match exact: "وظيفة شاغرة — محلات وتجارة" OR just "وظيفة شاغرة"
    return a.subcategory === (child?.name + ' — ' + subName)
        || a.subcategory === child?.name
        || a.subcategory === subName;
  });

  sessionStorage.setItem('dynState', JSON.stringify({type:'ads2', catId:parentId, childId, subName}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="showSubsPageV2(CATEGORIES.find(c=>c.id==='${parentId}'),CATEGORIES.find(c=>c.id==='${parentId}')?.children?.find(c=>c.id==='${childId}'))">←</button>
      <span>${child?.icon||''} ${subName}</span>
      <button class="dyn-search-btn" onclick="toggleDynSearch()">🔍</button>
    </div>
    <div class="dyn-search-bar" id="dynSearchBar" style="display:none;">
      <input type="text" id="dynSearchInput" placeholder="ابحث..." oninput="filterAdsV2('${parentId}','${childId}','${subName}')">
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" id="adsContent">
      ${renderAdsList(ads, parent)}
    </div>
    <button class="fab-add" onclick="openAddModal('${parentId}','${child?.name} — ${subName}')">+</button>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(parentId);
}

function filterAdsV2(parentId, childId, subName) {
  const q = document.getElementById('dynSearchInput')?.value.toLowerCase();
  const parent = CATEGORIES.find(c=>c.id===parentId);
  const child = parent?.children?.find(c=>c.id===childId);
  const ads = allAds.filter(a => {
    if(a.status !== 'approved' && !isAdmin) return false;
    if(a.category !== parentId) return false;
    if(!isAdmin && isAdExpired(a)) return false;
    if(subName && a.subcategory !== `${child?.name} — ${subName}`) return false;
    if(q && !(a.title||'').toLowerCase().includes(q) && !(a.description||'').toLowerCase().includes(q)) return false;
    return true;
  });
  document.getElementById('adsContent').innerHTML = renderAdsList(ads, parent);
}

// ======= SUBS PAGE =======
function showSubsPage(cat) {
  sessionStorage.setItem('dynState', JSON.stringify({type:'subs', catId:cat.id}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>${cat.icon} ${cat.name}</span>
      <button class="dyn-search-btn" onclick="toggleDynSearch()">🔍</button>
    </div>
    <div class="dyn-search-bar" id="dynSearchBar" style="display:none;">
      <input type="text" id="dynSearchInput" placeholder="ابحث في ${cat.name}..." oninput="filterSubs('${cat.id}')">
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content">
      <div class="cats-grid" id="subsGrid">
        ${cat.subs.map(sub => `
          <div class="cat-card" data-catid="${cat.id}" data-sub="${sub.replace(/"/g,'&quot;')}" onclick="var el=this;showAdsPage(CATEGORIES.find(c=>c.id===el.dataset.catid),el.dataset.sub)">
            <div class="cat-name">${sub}</div>
            <div class="cat-icon-wrap" style="background:${cat.color}">${cat.icon}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(cat.id, null);
}

function filterSubs(catId) {
  const q = document.getElementById('dynSearchInput').value.toLowerCase();
  const cat = CATEGORIES.find(c => c.id === catId);
  const grid = document.getElementById('subsGrid');
  const filtered = cat.subs.filter(s => s.includes(q));
  grid.innerHTML = filtered.map(sub => `
    <div class="cat-card" onclick="showAdsPage(CATEGORIES.find(c=>c.id==='${catId}'),'${sub}')">
      <div class="cat-name">${sub}</div>
      <div class="cat-icon-wrap" style="background:${cat.color}">${cat.icon}</div>
    </div>
  `).join('');
}

// أقسام سوق المستعمل اللي بقت فيها محلات ثابتة (مش بيع قطعة واحدة) — بتتوجه لنظام المعارض
var USED_MARKET_SHOP_SUBS = ['أثاث وديكور', 'أجهزة كهربائية', 'عفش كامل'];

// ======= ADS PAGE =======
async function showAdsPage(cat, sub) {
  // أقسام المعارض (البيع أونلاين + سوق السيارات + الملابس + ...) → روح لصفحة المعارض
  if((cat.id === 'online' || cat.id === 'cars_market' || cat.id === 'fashion' || cat.id === 'shoes' || cat.id === 'furniture' || cat.id === 'home' || cat.id === 'tech' || cat.id === 'agri' || cat.id === 'events' || cat.id === 'ads' || cat.id === 'medservices' || cat.id === 'sports' || cat.id === 'salon' || cat.id === 'gold' || cat.id === 'building' || cat.id === 'fun' || (cat.id === 'used_market' && USED_MARKET_SHOP_SUBS.indexOf(sub) !== -1)) && sub) {
    showShopsPage(sub, cat.id);
    return;
  }
  // حفظ الصفحة الحالية كـ parent عشان زرار الرجوع
  const _restoring = window._restoringFromDetail;
  if(!_restoring){
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) {
      try {
        const cs = JSON.parse(currentState);
        if(cs.type !== 'ads') sessionStorage.setItem('parentDynState', currentState);
      } catch(e) {}
    }
  }
  sessionStorage.setItem('dynState', JSON.stringify({type:'ads', catId:cat.id, sub:sub||''}));
  if(!_restoring){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const page = document.getElementById('dynamicPage');
  const title = sub ? sub : cat.name;
  // جلب أحدث الإعلانات من Supabase دايمًا
  await loadAds();
  const ads = allAds.filter(a => {
    if(a.status !== 'approved' && !isAdmin) return false;
    if(a.category !== cat.id) return false;
    if(!isAdmin && isAdExpired(a)) return false;
    if(sub && a.subcategory !== sub) return false;
    return true;
  });

  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="${cat.id === 'deaths' ? `showChildrenPage(CATEGORIES.find(c=>c.id==='deaths'))` : (cat.subs && cat.subs.length > 0 ? `showSubsPage(CATEGORIES.find(c=>c.id==='${cat.id}'))` : 'hideDynPage()')}">←</button>
      <span>${cat.icon} ${title}</span>
      <button class="dyn-search-btn" onclick="toggleDynSearch()">🔍</button>
    </div>
    <div class="dyn-search-bar" id="dynSearchBar" style="display:none;">
      <input type="text" id="dynSearchInput" placeholder="ابحث في ${title}..." oninput="filterAds('${cat.id}','${sub||''}')">
    </div>
    <div id="catBanner"></div>
    ${cat.id === 'lost' ? `
    <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border-bottom:1px solid #fdba74;padding:14px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:26px;flex-shrink:0;">🔎</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:900;color:#9a3412;">فقدت حاجة؟ ولا لقيت حاجة؟</div>
        <div style="font-size:12px;color:#7c2d12;margin-top:2px;line-height:1.5;">أضف إعلان دلوقتي — ربما تجد من عثر عليه بين أهالي الحامول</div>
      </div>
      <button onclick="openAddModal('lost','${sub||''}')" style="background:#ea580c;color:white;border:none;padding:8px 14px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0;">+ أضف</button>
    </div>` : ''}
    <div class="dyn-content" id="adsContent" style="padding:${['online','used_market'].includes(cat.id)?'12px':'0 0 16px'};">
      ${['online','used_market'].includes(cat.id) ? renderShopGrid(ads, cat) : renderAdsList(ads, cat, sub||'')}
    </div>
    <button class="fab-add" onclick="openAddModal('${cat.id}','${sub||''}')">+</button>
  `;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(cat.id, sub || null);
}

// ======= نظام المعارض (البيع أونلاين) =======

// يحدد القسم اللي التصنيف ده تابع له (online / cars_market)
function getShopCatId(subcategory) {
  const carsCat = CATEGORIES.find(c => c.id === 'cars_market');
  if(carsCat && carsCat.subs && carsCat.subs.indexOf(subcategory) !== -1) return 'cars_market';
  const fashionCat = CATEGORIES.find(c => c.id === 'fashion');
  if(fashionCat && fashionCat.subs && fashionCat.subs.indexOf(subcategory) !== -1) return 'fashion';
  const shoesCat = CATEGORIES.find(c => c.id === 'shoes');
  if(shoesCat && shoesCat.subs && shoesCat.subs.indexOf(subcategory) !== -1) return 'shoes';
  const furnitureCat = CATEGORIES.find(c => c.id === 'furniture');
  if(furnitureCat && furnitureCat.subs && furnitureCat.subs.indexOf(subcategory) !== -1) return 'furniture';
  const homeCat = CATEGORIES.find(c => c.id === 'home');
  if(homeCat && homeCat.subs && homeCat.subs.indexOf(subcategory) !== -1) return 'home';
  const techCat = CATEGORIES.find(c => c.id === 'tech');
  if(techCat && techCat.subs && techCat.subs.indexOf(subcategory) !== -1) return 'tech';
  const agriCat = CATEGORIES.find(c => c.id === 'agri');
  if(agriCat && agriCat.subs && agriCat.subs.indexOf(subcategory) !== -1) return 'agri';
  const eventsCat = CATEGORIES.find(c => c.id === 'events');
  if(eventsCat && eventsCat.subs && eventsCat.subs.indexOf(subcategory) !== -1) return 'events';
  const adsCat = CATEGORIES.find(c => c.id === 'ads');
  if(adsCat && adsCat.subs && adsCat.subs.indexOf(subcategory) !== -1) return 'ads';
  const medCat = CATEGORIES.find(c => c.id === 'medservices');
  if(medCat && medCat.subs && medCat.subs.indexOf(subcategory) !== -1) return 'medservices';
  if(typeof USED_MARKET_SHOP_SUBS !== 'undefined' && USED_MARKET_SHOP_SUBS.indexOf(subcategory) !== -1) return 'used_market';
  if(typeof NESTED_SHOP_CHILDREN !== 'undefined') {
    for(var nci=0; nci<NESTED_SHOP_CHILDREN.length; nci++) {
      var ncId = NESTED_SHOP_CHILDREN[nci];
      var ncParent = CATEGORIES.find(function(c){ return (c.children||[]).some(function(ch){ return ch.id === ncId; }); });
      var ncChild = ncParent ? (ncParent.children||[]).find(function(ch){ return ch.id === ncId; }) : null;
      if(ncChild && ncChild.subs && ncChild.subs.some(function(s){ return s.name === subcategory; })) return ncId;
    }
  }
  const sportsCat = CATEGORIES.find(c => c.id === 'sports');
  if(sportsCat && sportsCat.subs && sportsCat.subs.indexOf(subcategory) !== -1) return 'sports';
  const salonCat = CATEGORIES.find(c => c.id === 'salon');
  if(salonCat && salonCat.subs && salonCat.subs.indexOf(subcategory) !== -1) return 'salon';
  const goldCat = CATEGORIES.find(c => c.id === 'gold');
  if(goldCat && goldCat.subs && goldCat.subs.indexOf(subcategory) !== -1) return 'gold';
  const buildingCat = CATEGORIES.find(c => c.id === 'building');
  if(buildingCat && buildingCat.subs && buildingCat.subs.indexOf(subcategory) !== -1) return 'building';
  return 'online';
}

async function showShopsPage(subcategory, catId) {
  catId = catId || 'online';
  const isNestedChild = (typeof NESTED_SHOP_CHILDREN !== 'undefined' && NESTED_SHOP_CHILDREN.indexOf(catId) !== -1);
  const nestedParentId = isNestedChild ? CATEGORIES.find(c => (c.children||[]).some(ch => ch.id === catId))?.id : null;
  const shopCat = isNestedChild
    ? ((CATEGORIES.find(c=>c.id===nestedParentId)||{}).children||[]).find(c=>c.id===catId) || {icon:'🔧', color:'#ffedd5', name:''}
    : (CATEGORIES.find(c=>c.id===catId) || {icon:'🛍️', color:'#ede9fe', name:''});
  sessionStorage.setItem('dynState', JSON.stringify({type:'shops', sub:subcategory, catId:catId}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const onlineCat = shopCat;

  page.innerHTML =
    '<div class="dyn-header">' +
      '<button class="dyn-back" onclick="' + (isNestedChild ? 'showSubsPageV2(CATEGORIES.find(c=>c.id===\''+nestedParentId+'\'),CATEGORIES.find(c=>c.id===\''+nestedParentId+'\')?.children?.find(c=>c.id===\''+catId+'\'))' : 'showSubsPage(CATEGORIES.find(c=>c.id===\'' + catId + '\'))') + '">←</button>' +
      '<span>' + shopCat.icon + ' ' + subcategory + '</span>' +
      '<span></span>' +
    '</div>' +
    '<div id="catBanner"></div>' +
    '<div class="dyn-content" id="shopsContent" style="padding:14px 12px 80px;">' +
      '<div style="text-align:center;padding:40px;color:var(--gray);">⏳ جاري التحميل...</div>' +
    '</div>' +
    '<button onclick="showShopRegister(\'' + subcategory + '\',\'' + catId + '\')" style="position:fixed;bottom:20px;left:20px;background:#7c3aed;color:white;border:none;padding:14px 20px;border-radius:14px;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.4);z-index:100;">🏪 سجّل نشاطك</button>';

  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner(catId, subcategory);

  // جيب المعارض المعتمدة في هذا التصنيف — المثبّت أولاً ثم الأقدم فالأحدث
  let traders = await sbFetch('GET', 'shop_traders?subcategory=eq.'+encodeURIComponent(subcategory)+'&status=eq.approved&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&order=created_at.asc') || [];

  // fallback: لو مفيش نتيجة بالمطابقة التامة، نجيب كل معارض القسم المعتمدة ونفلتر يدويًا
  // (بيمسك أي اختلاف بسيط في التخزين زي مسافات زيادة)
  if(!traders.length) {
    try {
      const allApproved = await sbFetch('GET', 'shop_traders?status=eq.approved&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&order=created_at.desc&limit=500') || [];
      const norm = function(s){ return (s||'').replace(/\s+/g,' ').trim(); };
      const target = norm(subcategory);
      traders = allApproved.filter(function(t){ return norm(t.subcategory) === target; });
    } catch(e) { console.warn('fallback shops fetch failed', e); }
  }

  const content = document.getElementById('shopsContent');
  if(!content) return;

  if(!traders.length) {
    content.innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:var(--gray);">' +
        '<div style="font-size:56px;margin-bottom:12px;">🏪</div>' +
        '<p style="font-size:15px;font-weight:700;">مفيش معارض في ' + subcategory + ' لحد دلوقتي</p>' +
        '<p style="font-size:13px;margin-top:6px;">كن أول من يفتح معرضه!</p>' +
      '</div>';
    return;
  }

  // رتّب: المثبّت أولاً (الأعلى pin_order)، وبعده الترتيب اليدوي (sort_order)، وبعده الأقدم فالأحدث
  traders.sort(function(a,b){
    var pa = a.pin_order || 0, pb = b.pin_order || 0;
    if(pa !== pb) return pb - pa; // المثبّت أولاً
    var sa = a.sort_order || 0, sb = b.sort_order || 0;
    if(sa !== sb) return sb - sa; // الترتيب اليدوي
    return new Date(a.created_at) - new Date(b.created_at); // الأقدم فوق
  });

  var _isShopAdmin = (typeof isAdmin !== 'undefined' && isAdmin);

  // عرض كروت المعارض
  content.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
    traders.map(function(t, idx) {
      var pinned = t.pin_order && t.pin_order > 0;
      return '<div style="background:white;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;position:relative;' + (pinned?'border:2px solid #f59e0b;':'') + '">' +
        (pinned ? '<div style="position:absolute;top:6px;right:6px;background:#f59e0b;color:white;font-size:10px;font-weight:900;padding:2px 8px;border-radius:20px;z-index:2;">📌 مثبّت</div>' : '') +
        (_isShopAdmin ? '<button onclick="event.stopPropagation();togglePinShop(\''+t.id+'\','+(pinned?0:1)+',\''+subcategory.replace(/'/g,"")+'\',\''+catId+'\')" style="position:absolute;top:6px;left:6px;background:'+(pinned?'#dc2626':'#7c3aed')+';color:white;border:none;font-size:11px;padding:3px 8px;border-radius:20px;cursor:pointer;z-index:3;">'+(pinned?'إلغاء التثبيت':'📌 ثبّت')+'</button>' : '') +
        (_isShopAdmin ? '<div style="position:absolute;bottom:6px;left:6px;display:flex;gap:4px;z-index:3;">' +
          (idx > 0 ? '<button onclick="event.stopPropagation();moveShopOrder(\''+t.id+'\',\'up\',\''+subcategory.replace(/'/g,"")+'\',\''+catId+'\')" style="background:#334155;color:white;border:none;width:24px;height:24px;border-radius:8px;cursor:pointer;font-size:12px;">⬆️</button>' : '') +
          (idx < traders.length - 1 ? '<button onclick="event.stopPropagation();moveShopOrder(\''+t.id+'\',\'down\',\''+subcategory.replace(/'/g,"")+'\',\''+catId+'\')" style="background:#334155;color:white;border:none;width:24px;height:24px;border-radius:8px;cursor:pointer;font-size:12px;">⬇️</button>' : '') +
        '</div>' : '') +
        '<div onclick="openShop(\'' + t.id + '\')" style="cursor:pointer;">' +
        (t.logo_url ?
          '<img src="' + t.logo_url + '" loading="lazy" style="width:100%;height:100px;object-fit:cover;" onerror="this.style.display=\'none\'">' :
          '<div style="width:100%;height:100px;background:' + onlineCat.color + ';display:flex;align-items:center;justify-content:center;font-size:36px;">' + shopCat.icon + '</div>') +
        '<div style="padding:10px;">' +
          '<div style="font-size:13px;font-weight:900;color:#1e293b;">' + escapeHtml(t.shop_name) + '</div>' +
          (t.description ? '<div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.5;">' + escapeHtml(t.description.substring(0,50)) + (t.description.length>50?'...':'') + '</div>' : '') +
          '<div style="font-size:10px;color:#94a3b8;margin-top:4px;">📦 معرض ' + subcategory + '</div>' +
        '</div>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    // زرار تسجيل الدخول لو عنده معرض بالفعل
    '<div style="text-align:center;padding:20px 0;">' +
      '<button onclick="showShopLogin(\'' + subcategory + '\')" style="background:none;border:1px solid #e5e7eb;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;color:#64748b;cursor:pointer;">عندك معرض بالفعل؟ سجّل دخول</button>' +
    '</div>';
}

// تكبير صورة المعرض
function zoomShopImage(src) {
  var m = document.createElement('div');
  m.id = 'shopZoomOverlay';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;cursor:pointer;';
  m.onclick = function(){ history.back(); };
  m.innerHTML = '<img src="'+src+'" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;">';
  document.body.appendChild(m);
  try{ history.pushState({zoomImg:1},''); }catch(e){}
}

// تثبيت / إلغاء تثبيت معرض (للأدمن)
async function togglePinShop(traderId, pinVal, subcategory, catId) {
  try {
    await sbFetch('PATCH', 'shop_traders?id=eq.'+traderId, { pin_order: pinVal ? Date.now() : 0 });
    showToast(pinVal ? '📌 تم تثبيت المعرض في الأعلى' : 'تم إلغاء التثبيت');
    showShopsPage(subcategory, catId);
  } catch(e) {
    showToast('⚠️ حصل خطأ — تأكد إنك شغّلت SQL عمود pin_order', 'error');
    console.error('pin error:', e);
  }
}

// نقل معرض مكان لأعلى/لأسفل بين باقي المعارض (للأدمن)
async function moveShopOrder(traderId, direction, subcategory, catId) {
  try {
    let traders = await sbFetch('GET', 'shop_traders?subcategory=eq.'+encodeURIComponent(subcategory)+'&status=eq.approved&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&order=created_at.asc') || [];
    traders.sort(function(a,b){
      var pa = a.pin_order || 0, pb = b.pin_order || 0;
      if(pa !== pb) return pb - pa;
      var sa = a.sort_order || 0, sb = b.sort_order || 0;
      if(sa !== sb) return sb - sa;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    var idx = traders.findIndex(function(t){ return t.id === traderId; });
    if(idx === -1) return;
    var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if(swapIdx < 0 || swapIdx >= traders.length) return;
    var tmp = traders[idx]; traders[idx] = traders[swapIdx]; traders[swapIdx] = tmp;
    var n = traders.length;
    await Promise.all(traders.map(function(t, i){
      return sbFetch('PATCH', 'shop_traders?id=eq.'+t.id, { sort_order: n - i });
    }));
    showToast('✅ تم تغيير ترتيب المعرض');
    showShopsPage(subcategory, catId);
  } catch(e) {
    showToast('⚠️ حصل خطأ — تأكد إنك شغّلت SQL عمود sort_order', 'error');
    console.error('move shop order error:', e);
  }
}

// نقل إعلان مكان لأعلى/لأسفل بين إعلانات نفس القسم (للأدمن) — شغال في كل أقسام الموقع
async function moveAdOrder(adId, direction, catId, sub) {
  try {
    await loadAds();
    let list = allAds.filter(function(a){
      if(a.status !== 'approved' && !isAdmin) return false;
      if(a.category !== catId) return false;
      if(!isAdmin && isAdExpired(a)) return false;
      if(sub && a.subcategory !== sub) return false;
      return true;
    });
    list.sort(function(a,b){
      if((b.is_sponsored?1:0) !== (a.is_sponsored?1:0)) return (b.is_sponsored?1:0)-(a.is_sponsored?1:0);
      if((b.is_offer?1:0) !== (a.is_offer?1:0)) return (b.is_offer?1:0)-(a.is_offer?1:0);
      var so = (b.sponsored_order||0) - (a.sponsored_order||0);
      if(so !== 0) return so;
      return (b.sort_order||0) - (a.sort_order||0);
    });
    var idx = list.findIndex(function(a){ return a.id === adId; });
    if(idx === -1) return;
    var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if(swapIdx < 0 || swapIdx >= list.length) return;
    var tmp = list[idx]; list[idx] = list[swapIdx]; list[swapIdx] = tmp;
    var n = list.length;
    await Promise.all(list.map(function(a, i){
      return sbFetch('PATCH', 'ads?id=eq.'+a.id, { sort_order: n - i });
    }));
    showToast('✅ تم تغيير الترتيب');
    await loadAds();
    filterAds(catId, sub);
  } catch(e) {
    showToast('⚠️ حصل خطأ — تأكد إنك شغّلت SQL عمود sort_order في جدول ads', 'error');
    console.error('move ad order error:', e);
  }
}

async function openShop(traderId) {
  sessionStorage.setItem('dynState', JSON.stringify({type:'shop_detail', traderId}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray);">⏳ جاري تحميل المعرض...</div>';

  const [traderArr, sections, products] = await Promise.all([
    sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [],
    sbFetch('GET', 'shop_sections?trader_id=eq.'+traderId+'&order=sort_order.asc') || [],
    sbFetch('GET', 'shop_products?trader_id=eq.'+traderId+'&order=created_at.desc') || [],
  ]);
  const trader = traderArr && traderArr[0];
  if(!trader || trader.status === 'deleted') {
    page.innerHTML = '<div class="dyn-header"><button class="dyn-back" onclick="hideDynPage()">←</button><span>🏪 المعرض</span><span></span></div>' +
      '<div style="text-align:center;padding:60px 20px;color:var(--gray);"><div style="font-size:44px;margin-bottom:12px;">🚫</div><p style="font-size:14px;font-weight:700;">المعرض ده مش موجود دلوقتي</p></div>';
    return;
  }
  try { sbFetch('POST', 'shop_stats', {trader_id: traderId, event_type: 'view'}); } catch(e) {}
  const visibleProducts = products.filter(function(p){ return p.is_active !== false; });

  // هل الزائر هو صاحب المعرض؟ (بيتحقق من localStorage)
  var myShopPhone = localStorage.getItem('my_shop_phone_'+traderId);
  var isOwner = !!myShopPhone;

  // التصميم الاحترافي بقى معيار موحّد لكل أقسام المعارض
  var useProDesign = true;
  var waLink = 'https://wa.me/20'+(trader.phone.charAt(0)==='0'?trader.phone.slice(1):trader.phone)+'?text='+encodeURIComponent('مرحباً، أنا من دليل الحامول وعايز أعرف أكتر عن اللي عندكم في '+trader.subcategory);

  var socialAndGalleryHtml =
    (trader.social_links && trader.social_links.length ?
      '<div style="background:white;padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;' + (useProDesign ? '' : 'border-bottom:1px solid var(--border);') + '">' +
        trader.social_links.map(function(l){
          var ic = l.type==='facebook'?'📘 فيسبوك':l.type==='youtube'?'▶️ يوتيوب':l.type==='tiktok'?'🎵 تيك توك':'🔗 رابط';
          var bg = l.type==='facebook'?'#e8f0fb':l.type==='youtube'?'#fee2e2':'#f1f5f9';
          var col = l.type==='facebook'?'#1877f2':l.type==='youtube'?'#dc2626':'#334155';
          return '<a href="'+escapeHtml(safeUrl(l.url))+'" target="_blank" style="background:'+bg+';color:'+col+';padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none;">'+ic+'</a>';
        }).join('') +
      '</div>'
    : '') +
    (trader.gallery_images && trader.gallery_images.length ?
      '<div style="background:white;padding:12px 16px;' + (useProDesign ? '' : 'border-bottom:1px solid var(--border);') + '">' +
        '<div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:8px;">' + ((getShopCatId(trader.subcategory) === 'food_rest' || getShopCatId(trader.subcategory) === 'food_cafe') ? '📷 المنيو والصور' : getShopCatId(trader.subcategory) === 'gold' ? '📷 صور توضيحية للمشغولات' : '📷 صور من المعرض') + '</div>' +
        '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">' +
          trader.gallery_images.map(function(img){
            return '<img src="'+img+'" loading="lazy" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:pointer;" onclick="zoomShopImage(\''+img+'\')">';
          }).join('') +
        '</div>' +
      '</div>'
    : '');

  var proHeaderHtml =
    '<div style="background:linear-gradient(135deg,#1e293b,#334155);height:70px;"></div>' +
    '<div style="background:white;margin:-40px 14px 0;border-radius:18px;box-shadow:0 6px 22px rgba(0,0,0,.12);padding:16px;position:relative;">' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">' +
        (trader.logo_url ?
          '<img src="'+trader.logo_url+'" style="width:72px;height:72px;border-radius:16px;object-fit:cover;flex-shrink:0;cursor:pointer;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.15);" onclick="zoomShopImage(\''+trader.logo_url+'\')">' :
          '<div style="width:72px;height:72px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.15);">🏪</div>') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:19px;font-weight:900;color:#0f172a;line-height:1.3;">' + escapeHtml(trader.shop_name) + '</div>' +
          '<div style="display:inline-block;background:#f5f3ff;color:#7c3aed;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;margin-top:6px;">📦 ' + escapeHtml(trader.subcategory) + '</div>' +
        '</div>' +
      '</div>' +
      (trader.description ?
        '<div style="font-size:13.5px;color:#334155;line-height:1.8;background:#f8fafc;border-radius:12px;padding:12px 14px;margin-bottom:12px;">' + escapeHtml(trader.description) + '</div>'
      : '') +
      (trader.address || trader.phone ?
        '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">' +
          (trader.phone ? '<a href="tel:'+trader.phone+'" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#1e293b;font-size:13px;font-weight:700;"><span style="font-size:16px;">📞</span><span dir="ltr">'+trader.phone+'</span></a>' : '') +
          (trader.address ? '<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1e293b;"><span style="font-size:16px;">📍</span><span style="flex:1;">'+escapeHtml(trader.address)+(trader.map_url ? ' — <a href="'+escapeHtml(safeUrl(trader.map_url))+'" target="_blank" style="color:#0369a1;">🗺️ الخريطة</a>' : '')+'</span></div>' : '') +
          (trader.opening_hours ? '<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1e293b;"><span style="font-size:16px;">🕐</span>'+escapeHtml(trader.opening_hours)+'</div>' : '') +
          (trader.delivery_available ? '<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:'+(trader.delivery_available==='متاح'?'#16a34a':'#dc2626')+';"><span style="font-size:16px;">🛵</span>التوصيل: '+escapeHtml(trader.delivery_available)+'</div>' : '') +
        '</div>'
      : '') +
      '<div style="display:flex;gap:8px;">' +
        '<a href="'+waLink+'" target="_blank" style="flex:1;background:#25D366;color:white;padding:12px;border-radius:12px;text-decoration:none;font-size:13.5px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px;">💬 تواصل واتساب</a>' +
        (isOwner ? '<button onclick="openShopOwnerPanel(\'' + traderId + '\')" style="background:#f1f5f9;color:#334155;border:none;padding:12px 16px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;">➕ إضافة منتج وتعديل</button>' : '') +
      '</div>' +
    '</div>' +
    '<div style="height:12px;"></div>' +
    socialAndGalleryHtml;

  var classicHeaderHtml =
    '<div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:16px;color:white;display:flex;align-items:center;gap:12px;">' +
      (trader.logo_url ? '<img src="'+trader.logo_url+'" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;cursor:pointer;" onclick="zoomShopImage(\''+trader.logo_url+'\')">' : '<div style="width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">🏪</div>') +
      '<div style="flex:1;">' +
        '<div style="font-size:17px;font-weight:900;">' + escapeHtml(trader.shop_name) + '</div>' +
        (trader.description ? '<div style="font-size:12px;opacity:.85;margin-top:3px;">' + escapeHtml(trader.description) + '</div>' : '') +
        '<div style="font-size:11px;opacity:.7;margin-top:2px;">📦 ' + trader.subcategory + '</div>' +
      '</div>' +
      '<a href="'+waLink+'" target="_blank" style="background:#25D366;color:white;padding:8px 12px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">💬</a>' +
    '</div>' +
    (trader.address || trader.map_url ?
      '<div style="background:white;margin:0;padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:18px;">📍</span>' +
        '<div style="flex:1;">' +
          (trader.address ? '<div style="font-size:12px;font-weight:700;color:#1e293b;">' + escapeHtml(trader.address) + '</div>' : '') +
          (trader.map_url ? '<a href="'+escapeHtml(safeUrl(trader.map_url))+'" target="_blank" style="font-size:11px;color:#0369a1;text-decoration:none;font-weight:700;">🗺️ عرض على الخريطة</a>' : '') +
        '</div>' +
      '</div>'
    : '') +
    (trader.opening_hours || trader.delivery_available ?
      '<div style="background:white;margin:0;padding:10px 16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:6px;">' +
        (trader.opening_hours ? '<div style="display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:#1e293b;"><span style="font-size:16px;">🕐</span>' + escapeHtml(trader.opening_hours) + '</div>' : '') +
        (trader.delivery_available ? '<div style="display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:'+(trader.delivery_available==='متاح'?'#16a34a':'#dc2626')+';"><span style="font-size:16px;">🛵</span>التوصيل: ' + escapeHtml(trader.delivery_available) + '</div>' : '') +
      '</div>'
    : '') +
    socialAndGalleryHtml;

  page.innerHTML =
    '<div class="dyn-header">' +
      '<button class="dyn-back" onclick="showShopsPage(\'' + trader.subcategory + '\',\'' + getShopCatId(trader.subcategory) + '\')">←</button>' +
      '<span>🏪 ' + escapeHtml(trader.shop_name) + '</span>' +
      (isOwner && !useProDesign ? '<button onclick="openShopOwnerPanel(\'' + traderId + '\')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:5px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">➕ إضافة وتعديل</button>' : '<button onclick="shareShop(\'' + traderId + '\')" style="background:rgba(255,255,255,.2);color:white;border:none;width:30px;height:30px;border-radius:8px;font-size:14px;cursor:pointer;">🔗</button>') +
    '</div>' +
    '<div class="dyn-content" id="shopContent" style="padding:0 0 80px;">' +
      (useProDesign ? proHeaderHtml : classicHeaderHtml) +
      '<div style="padding:12px 12px 0;">' +
      renderShopProductsBySection(sections, visibleProducts, trader, useProDesign) +
      '<div id="shopCommentsSection" style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          '<div style="font-size:15px;font-weight:900;color:#1e293b;">💬 آراء وتقييمات</div>' +
          '<div id="shopAvgRating" style="font-size:13px;color:#f59e0b;font-weight:700;"></div>' +
        '</div>' +
        '<div id="shopCommentsList"><div style="text-align:center;color:var(--gray);font-size:13px;padding:10px;">⏳ جاري التحميل...</div></div>' +
        '<div style="background:#f8fafc;border-radius:12px;padding:12px;margin-top:12px;">' +
          '<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:6px;">قيّم تجربتك:</div>' +
          '<div id="shopStarPicker" style="display:flex;gap:4px;margin-bottom:10px;direction:ltr;justify-content:flex-end;">' +
            [1,2,3,4,5].map(function(n){ return '<span onclick="setShopStar('+n+')" data-star="'+n+'" style="font-size:28px;cursor:pointer;color:#d1d5db;transition:.15s;">★</span>'; }).join('') +
          '</div>' +
          '<input type="hidden" id="shopStarValue" value="0">' +
          '<div style="display:flex;gap:6px;">' +
            '<input id="shopCommentInput" type="text" placeholder="اكتب رأيك (اختياري)..." style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;">' +
            '<button onclick="submitShopComment(\'' + traderId + '\')" style="background:#7c3aed;color:white;border:none;padding:10px 16px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">إرسال</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>' +
    '</div>' +
    // زرار "إدارة معرضي" لو ما كانش مسجل دخول بعد
    (!isOwner ? '<button onclick="showShopLoginForId(\'' + traderId + '\',\'' + trader.subcategory + '\')" style="position:fixed;bottom:20px;left:20px;background:#7c3aed;color:white;border:none;padding:12px 16px;border-radius:12px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.4);z-index:100;">🔑 إدارة معرضي</button>' : '');
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadShopComments(traderId);
}

// ===== كومنتات وتقييمات المعرض =====
function setShopStar(n) {
  document.getElementById('shopStarValue').value = n;
  var picker = document.getElementById('shopStarPicker');
  if(picker) {
    picker.querySelectorAll('[data-star]').forEach(function(s){
      s.style.color = parseInt(s.getAttribute('data-star')) <= n ? '#f59e0b' : '#d1d5db';
    });
  }
}

function renderStars(rating) {
  rating = Math.round(rating || 0);
  var s = '';
  for(var i=1;i<=5;i++){ s += '<span style="color:'+(i<=rating?'#f59e0b':'#d1d5db')+';">★</span>'; }
  return '<span style="font-size:13px;">'+s+'</span>';
}

async function loadShopComments(traderId) {
  var list = document.getElementById('shopCommentsList');
  if(!list) return;
  var comments = [];
  try {
    comments = await sbFetch('GET', 'shop_comments?trader_id=eq.'+traderId+'&order=created_at.desc&limit=50') || [];
  } catch(e) { comments = []; }

  var isOwner = !!localStorage.getItem('my_shop_phone_'+traderId);

  // احسب متوسط التقييم
  var rated = comments.filter(function(c){ return c.rating && c.rating > 0; });
  var avgEl = document.getElementById('shopAvgRating');
  if(avgEl) {
    if(rated.length) {
      var sum = rated.reduce(function(a,c){ return a + c.rating; }, 0);
      var avg = (sum / rated.length).toFixed(1);
      avgEl.innerHTML = renderStars(avg) + ' ' + avg + ' <span style="color:#94a3b8;font-weight:400;">(' + rated.length + ' تقييم)</span>';
    } else {
      avgEl.innerHTML = '';
    }
  }

  if(!comments.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--gray);font-size:13px;padding:14px;">مفيش تقييمات لسه — كن أول من يكتب رأيه 👇</div>';
    return;
  }
  list.innerHTML = comments.map(function(c){
    var d = '';
    try { d = new Date(c.created_at).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}); } catch(e){}
    return '<div style="background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<span style="font-size:12px;font-weight:900;color:#7c3aed;">' + escapeHtml(c.author_name||'زائر') + (c.rating ? ' ' + renderStars(c.rating) : '') + '</span>' +
        '<span style="font-size:10px;color:#94a3b8;">' + d + '</span>' +
      '</div>' +
      (c.body ? '<div style="font-size:13px;color:#374151;line-height:1.6;">' + escapeHtml(c.body) + '</div>' : '') +
      (c.reply ? '<div style="background:#f5f3ff;border-radius:8px;padding:8px 10px;margin-top:8px;border-right:3px solid #7c3aed;"><div style="font-size:11px;font-weight:900;color:#6d28d9;margin-bottom:2px;">🏪 رد صاحب المعرض</div><div style="font-size:12.5px;color:#4c1d95;line-height:1.6;">' + escapeHtml(c.reply) + '</div></div>' : (isOwner ? '<div style="margin-top:8px;"><button onclick="showShopReplyBox(\''+c.id+'\')" id="shopReplyBtn_'+c.id+'" style="background:#f5f3ff;color:#6d28d9;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">↩️ رد</button><div id="shopReplyBox_'+c.id+'" style="display:none;margin-top:6px;"><textarea id="shopReplyText_'+c.id+'" rows="2" placeholder="اكتب ردك..." style="width:100%;padding:8px 10px;border:1.5px solid #ddd6fe;border-radius:8px;font-family:Cairo,sans-serif;font-size:12.5px;margin-bottom:6px;resize:none;box-sizing:border-box;"></textarea><button onclick="submitShopCommentReply(\''+c.id+'\',\''+traderId+'\')" style="width:100%;background:#7c3aed;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">إرسال الرد</button></div></div>' : '')) +
    '</div>';
  }).join('');
}

function showShopReplyBox(commentId) {
  var box = document.getElementById('shopReplyBox_'+commentId);
  var btn = document.getElementById('shopReplyBtn_'+commentId);
  if(box) box.style.display = 'block';
  if(btn) btn.style.display = 'none';
  var ta = document.getElementById('shopReplyText_'+commentId);
  if(ta) ta.focus();
}

async function submitShopCommentReply(commentId, traderId) {
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  if(!phone || !passHash) { showToast('سجّل دخولك لمعرضك الأول', 'error'); return; }
  var text = document.getElementById('shopReplyText_'+commentId)?.value.trim();
  if(!text) { showToast('اكتب الرد الأول', 'error'); return; }
  try {
    await sbRPC('secure_reply_to_shop_comment', {p_phone: phone, p_password_hash: passHash, p_comment_id: commentId, p_reply: text});
    showToast('✅ اتبعت ردك');
    loadShopComments(traderId);
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
  }
}

async function submitShopComment(traderId) {
  var input = document.getElementById('shopCommentInput');
  if(!input) return;
  var body = input.value.trim();
  var rating = parseInt(document.getElementById('shopStarValue').value) || 0;
  if(!rating && !body) { showToast('اختار نجوم أو اكتب رأيك الأول', 'error'); return; }
  var user = getCurrentUser();
  var authorName = (user && user.name) ? user.name : 'زائر';
  input.disabled = true;
  try {
    await sbFetch('POST', 'shop_comments', {
      trader_id: traderId,
      author_name: authorName,
      body: body || null,
      rating: rating || null
    });
    input.value = '';
    setShopStar(0);
    showToast('✅ تم إرسال تقييمك، شكرًا 🌟');
    loadShopComments(traderId);
  } catch(e) {
    showToast('⚠️ تعذّر الإرسال — حاول تاني', 'error');
    console.error('shop comment error:', e);
  }
  input.disabled = false;
}

function renderShopProductsBySection(sections, products, trader, compactEmptyState) {
  if(!products.length) {
    // مفيش منتجات — الصفحة تفضل دليل مفيد للزبون (معلومات المحل فوق ظاهرة)
    if(compactEmptyState) {
      // التصميم الاحترافي أصلاً بيعرض اسم المحل ووصفه وزرار واتساب فوق — ملهوش داعي نكررهم هنا
      return '<div style="text-align:center;padding:24px 16px;color:#94a3b8;">' +
        '<div style="font-size:32px;margin-bottom:8px;">📦</div>' +
        '<p style="font-size:13px;font-weight:700;">لسه مفيش حاجة مضافة</p>' +
        '</div>';
    }
    var waLink = '';
    if(trader && trader.phone) {
      var waPhone = '20'+(trader.phone.charAt(0)==='0'?trader.phone.slice(1):trader.phone);
      waLink = '<a href="https://wa.me/'+waPhone+'?text='+encodeURIComponent('مرحباً، شفت نشاطكم في دليل الحامول وعايز أستفسر')+'" target="_blank" style="display:block;background:#25D366;color:white;padding:13px;border-radius:12px;text-align:center;text-decoration:none;font-size:14px;font-weight:900;margin-top:14px;">💬 تواصل واتساب</a>';
    }
    return '<div style="text-align:center;padding:30px 16px;">' +
      '<div style="font-size:44px;margin-bottom:10px;">🏪</div>' +
      '<p style="font-size:15px;font-weight:900;color:#1e293b;margin-bottom:6px;">' + (trader ? escapeHtml(trader.shop_name) : 'المحل') + '</p>' +
      '<p style="font-size:13px;color:#64748b;line-height:1.7;">للتواصل والاستفسار، كلّمهم مباشرة على واتساب 👇</p>' +
      waLink +
      '</div>';
  }

  // منتجات من غير قسم
  var unsectioned = products.filter(function(p){ return !p.section_id; });
  var html = '';

  if(sections && sections.length) {
    sections.forEach(function(sec) {
      var secProducts = products.filter(function(p){ return p.section_id === sec.id; });
      if(!secProducts.length) return;
      html += '<div onclick="openShopSection(\''+sec.id+'\',\''+escapeHtml(sec.name)+'\');" style="font-size:14px;font-weight:900;margin:14px 0 8px;padding:8px 12px;background:#f8fafc;border-radius:10px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;border:1px solid #e5e7eb;">' +
        '<span>📁 ' + escapeHtml(sec.name) + '</span>' +
        '<span style="font-size:12px;color:#7c3aed;font-weight:700;">' + secProducts.length + ' منتج ←</span>' +
      '</div>';
      html += renderProductsGrid(secProducts);
    });
  }

  if(unsectioned.length) {
    if(sections && sections.length) html += '<div style="font-size:14px;font-weight:900;margin:14px 0 8px;padding-right:4px;color:#1e293b;">📦 منتجات أخرى</div>';
    html += renderProductsGrid(unsectioned);
  }

  return html || '<div style="text-align:center;padding:40px;color:var(--gray);">مفيش منتجات</div>';
}

function renderProductsGrid(products) {
  return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px;">' +
    products.map(function(p) {
      var imgs = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
      var imgHtml = '';
      if(imgs.length > 1) {
        // سلايدر بسيط للصور المتعددة
        var pid = 'prod_'+p.id.replace(/-/g,'').substr(0,8);
        imgHtml = '<div style="position:relative;overflow:hidden;height:120px;">' +
          imgs.map(function(src, i){ return '<img src="'+src+'" loading="lazy" data-idx="'+i+'" data-pid="'+pid+'" style="width:100%;height:120px;object-fit:cover;position:'+(i===0?'relative':'absolute')+';top:0;left:0;display:'+(i===0?'block':'none')+'" onerror="this.style.display=\'none\'">'; }).join('') +
          '<div style="position:absolute;bottom:4px;right:0;left:0;display:flex;justify-content:center;gap:3px;">' +
            imgs.map(function(_,i){ return '<div style="width:5px;height:5px;border-radius:50%;background:'+(i===0?'white':'rgba(255,255,255,.5)') +'" data-dot="'+pid+'-'+i+'"></div>'; }).join('') +
          '</div>' +
          (imgs.length > 1 ? '<div onclick="nextProdImg(\''+pid+'\','+imgs.length+')" style="position:absolute;top:50%;right:4px;transform:translateY(-50%);background:rgba(0,0,0,.4);color:white;border:none;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;">❯</div>' : '') +
        '</div>';
      } else if(imgs.length === 1) {
        imgHtml = '<img src="'+imgs[0]+'" loading="lazy" style="width:100%;height:120px;object-fit:cover;" onerror="this.style.display=\'none\'">';
      } else {
        imgHtml = '<div style="width:100%;height:80px;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:28px;">🛍️</div>';
      }

      // وسائل التواصل
      var linksHtml = '';
      if(p.links && p.links.length) {
        linksHtml = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">' +
          p.links.map(function(l){ return '<a href="'+escapeHtml(safeUrl(l.url))+'" target="_blank" style="background:#f0f9ff;color:#0369a1;padding:3px 7px;border-radius:6px;font-size:10px;text-decoration:none;font-weight:700;">'+(l.icon||'🔗')+' '+escapeHtml(l.label||'لينك')+'</a>'; }).join('') +
        '</div>';
      }

      return '<div onclick="openShopProduct(\''+p.id+'\')" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);cursor:pointer;">' +
        imgHtml +
        '<div style="padding:8px;">' +
          '<div style="font-size:13px;font-weight:700;line-height:1.4;">' + escapeHtml(p.title) + '</div>' +
          (p.price ? '<div style="font-size:14px;font-weight:900;color:#7c3aed;margin-top:3px;">' + parseFloat(p.price).toLocaleString() + ' ج</div>' : '<div style="font-size:11px;font-weight:700;color:#16a34a;margin-top:3px;">💬 السعر عند التواصل</div>') +
          (p.description ? '<div style="font-size:11px;color:#64748b;margin-top:2px;line-height:1.4;">' + escapeHtml(p.description.substring(0,40)) + (p.description.length>40?'...':'') + '</div>' : '') +
          ((p.stock === 0 || p.stock === '0') ? '<div style="font-size:10px;color:#dc2626;font-weight:700;margin-top:3px;">🔴 نفدت الكمية</div>' : (p.stock ? '<div style="font-size:10px;color:#94a3b8;margin-top:3px;">📦 متاح: ' + p.stock + '</div>' : '')) +
          linksHtml +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function nextProdImg(pid, total) {
  var imgs = document.querySelectorAll('[data-pid="'+pid+'"]');
  var current = 0;
  imgs.forEach(function(img, i){ if(img.style.display !== 'none') current = i; });
  imgs.forEach(function(img){ img.style.display='none'; });
  var next = (current + 1) % total;
  if(imgs[next]) imgs[next].style.display = 'block';
  // حدّث النقاط
  for(var i=0; i<total; i++) {
    var dot = document.querySelector('[data-dot="'+pid+'-'+i+'"]');
    if(dot) dot.style.background = i===next ? 'white' : 'rgba(255,255,255,.5)';
  }
}

// دخول من داخل صفحة المعرض نفسه
function showShopLoginForId(traderId, subcategory) {
  var overlay = document.createElement('div');
  overlay.id = 'shopLoginOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🔑</div>' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;">دخول لإدارة نشاطك</div>' +
      '<input id="sl_phone" type="tel" placeholder="رقم موبايلك" dir="ltr" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:8px;text-align:center;">' +
      '<input id="sl_pass" type="password" placeholder="كلمة السر" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:14px;text-align:center;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="doShopLoginForId(\'' + traderId + '\',\'' + subcategory + '\')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">دخول</button>' +
        '<button onclick="document.getElementById(\'shopLoginOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
      '<a href="javascript:void(0)" onclick="forgotShopTraderPassword()" style="display:block;margin-top:14px;font-size:12px;color:#0369a1;text-decoration:underline;">نسيت كلمة السر؟</a>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function doShopLoginForId(traderId, subcategory) {
  var phone = document.getElementById('sl_phone').value.trim();
  var pass = document.getElementById('sl_pass').value.trim();
  if(!phone || !pass){ showToast('اكتب الموبايل وكلمة السر', 'error'); return; }
  var passHash = await hashPass(pass);
  var rows;
  try {
    rows = await sbRPC('shop_trader_login_by_id', {p_trader_id: traderId, p_phone: phone, p_password_hash: passHash}) || [];
  } catch(e) {
    if(String(e.message||'') === 'TOO_MANY_ATTEMPTS') showToast('⏳ حاولت كتير غلط، استنى ربع ساعة وجرب تاني', 'error');
    else showToast('خطأ في الدخول', 'error');
    return;
  }
  if(!rows.length){ showToast('الموبايل أو كلمة السر غلط ❌', 'error'); return; }
  var trader = rows[0];
  // احفظ في localStorage عشان يبقى الزر ظاهر في المرات الجاية
  localStorage.setItem('my_shop_phone_'+traderId, phone);
  localStorage.setItem('my_shop_pass_'+traderId, passHash);
  document.getElementById('shopLoginOverlay').remove();
  showShopDashboard(trader);
}

async function openShopOwnerPanel(traderId) {
  var rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  if(!rows.length) return;
  showShopDashboard(rows[0]);
}

// ===== تسجيل تاجر جديد =====
function showShopRegister(subcategory, catId) {
  var overlay = document.createElement('div');
  overlay.id = 'shopRegOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;">' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:4px;text-align:center;">🏪 سجّل نشاطك في ' + subcategory + '</div>' +
      '<div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:16px;">بياناتك بتترّاجع من الأدمن قبل ما تظهر للناس</div>' +
      '<input id="sr_name" type="text" placeholder="اسم النشاط أو الجهة" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="sr_phone" type="tel" placeholder="رقم موبايلك" dir="ltr" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="sr_pass" type="password" placeholder="كلمة سر للدخول لصفحتك (6 أحرف/أرقام على الأقل)" autocomplete="new-password" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<select id="sr_secq" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;background:white;">' +
        SECURITY_QUESTIONS.map(function(q){return '<option value="'+escapeHtml(q)+'">'+escapeHtml(q)+'</option>';}).join('') +
      '</select>' +
      '<input id="sr_seca" type="text" placeholder="إجابتك على السؤال" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:6px;">' +
      '<div style="font-size:10.5px;color:#0369a1;background:#eff6ff;border-radius:8px;padding:8px 10px;margin-bottom:8px;line-height:1.6;">💡 لو نسيت كلمة السر بعدين، هنسألك السؤال ده بدل ما تضطر تكلمنا — اكتب إجابة تفتكرها كويس ومتنساهاش</div>' +
      '<textarea id="sr_desc" placeholder="وصف مختصر عن نشاطك (اختياري)" rows="2" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;resize:none;"></textarea>' +
      '<input id="sr_address" type="text" placeholder="العنوان (مثال: شارع الشهداء، الحامول)" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="sr_mapurl" type="url" placeholder="رابط الخريطة من Google Maps (اختياري)" dir="ltr" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      (catId === 'food_rest' || catId === 'food_cafe' ?
        '<div style="background:#fef9c3;border-radius:10px;padding:10px;margin-bottom:8px;">' +
          '<div style="font-size:11px;color:#713f12;font-weight:700;margin-bottom:6px;">🍽️ بيانات المطعم</div>' +
          '<input id="sr_hours" type="text" placeholder="مواعيد العمل (مثال: يوميًا من 12 ظهرًا لـ 2 فجرًا)" style="width:100%;padding:9px;border:1.5px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;background:white;">' +
          '<select id="sr_delivery" style="width:100%;padding:9px;border:1.5px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;background:white;">' +
            '<option value="">-- التوصيل متاح؟ --</option>' +
            '<option value="متاح">🛵 متاح</option>' +
            '<option value="غير متاح">🚫 غير متاح — استلام بس</option>' +
          '</select>' +
        '</div>'
      : '') +
      '<div style="background:#f8fafc;border-radius:10px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:6px;">🔗 روابط السوشيال (اختياري)</div>' +
        '<input id="sr_facebook" type="url" placeholder="رابط صفحة فيسبوك" dir="ltr" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;">' +
        '<input id="sr_youtube" type="url" placeholder="رابط قناة يوتيوب" dir="ltr" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;">' +
        '<input id="sr_tiktok" type="url" placeholder="رابط تيك توك" dir="ltr" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">' +
      '</div>' +
      '<label style="display:flex;align-items:center;justify-content:center;gap:8px;background:#f5f3ff;color:#7c3aed;padding:11px;border-radius:10px;cursor:pointer;border:1.5px dashed #7c3aed;font-weight:700;font-size:13px;margin-bottom:6px;">' +
        '🖼️ صورة بوستر / لوجو المعرض (اختياري)' +
        '<input type="file" id="sr_logo" accept="image/*" style="display:none;" onchange="previewShopLogo(this)">' +
      '</label>' +
      '<div id="sr_logo_preview" style="margin-bottom:10px;"></div>' +
      '<label style="display:flex;align-items:center;justify-content:center;gap:8px;background:#eff6ff;color:#2563eb;padding:11px;border-radius:10px;cursor:pointer;border:1.5px dashed #2563eb;font-weight:700;font-size:13px;margin-bottom:6px;">' +
        ((catId === 'food_rest' || catId === 'food_cafe') ?
          '📷 صور المنيو والأكل (حتى 10 صور — ارفع صور المنيو أو أطباقك هنا لو مش عايز تضيف كل صنف منتج لوحده)' :
        catId === 'gold' ?
          '📷 صور توضيحية للمشغولات (حتى 10 صور — تظهر حتى لو ماحطتش منتجات)' :
          '📷 صور توضيحية للمعرض (حتى 10 صور — تظهر حتى لو ماحطتش منتجات)') +
        '<input type="file" id="sr_gallery" accept="image/*" multiple style="display:none;" onchange="previewShopGallery(this)">' +
      '</label>' +
      '<div id="sr_gallery_preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button id="shopRegSubmitBtn" onclick="submitShopRegister(\'' + subcategory + '\',\'' + (catId || '') + '\')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✅ سجّل معرضي</button>' +
        '<button onclick="document.getElementById(\'shopRegOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function updateShopLogo(input, traderId, subcategory) {
  if(!input.files[0]) return;
  showToast('⏳ جاري رفع البوستر...');
  var url = await uploadImage(input.files[0]);
  if(!url) { showToast('فشل رفع الصورة', 'error'); return; }
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_update_shop_logo', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_logo_url: url});
  } catch(e) { showToast('❌ حصل خطأ في حفظ الصورة', 'error'); return; }
  showToast('✅ تم تحديث بوستر المعرض!');
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

async function addShopGalleryImages(input, traderId) {
  if(!input.files.length) return;
  try {
    var rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
    var trader = rows[0];
    if(!trader) return;
    var current = trader.gallery_images || [];
    var remaining = 10 - current.length;
    if(remaining <= 0) { showToast('وصلت للحد الأقصى (10 صور)', 'error'); return; }
    var files = Array.from(input.files).slice(0, remaining);
    showToast('⏳ جاري رفع الصور...');
    var newUrls = [];
    for(var i=0; i<files.length; i++) {
      var url = await uploadImage(files[i]);
      if(url) newUrls.push(url);
    }
    var updated = current.concat(newUrls);
    var ownerPhone = localStorage.getItem('my_shop_phone_'+traderId);
    var ownerPassHash = localStorage.getItem('my_shop_pass_'+traderId);
    await sbRPC('secure_update_shop_gallery', {p_phone: ownerPhone, p_password_hash: ownerPassHash, p_trader_id: traderId, p_gallery_images: updated});
    showToast('✅ تم إضافة الصور');
    var overlay = document.getElementById('shopDashOverlay');
    if(overlay) overlay.remove();
    sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows2){ if(rows2&&rows2[0]) showShopDashboard(rows2[0]); });
  } catch(e) {
    showToast('⚠️ حصل خطأ — تأكد إنك شغّلت SQL عمود gallery_images', 'error');
    console.error('gallery add error:', e);
  }
}

async function removeShopGalleryImage(traderId, index) {
  try {
    var rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
    var trader = rows[0];
    if(!trader) return;
    var current = trader.gallery_images || [];
    current.splice(index, 1);
    var ownerPhone2 = localStorage.getItem('my_shop_phone_'+traderId);
    var ownerPassHash2 = localStorage.getItem('my_shop_pass_'+traderId);
    await sbRPC('secure_update_shop_gallery', {p_phone: ownerPhone2, p_password_hash: ownerPassHash2, p_trader_id: traderId, p_gallery_images: current});
    showToast('✅ تم حذف الصورة');
    var overlay = document.getElementById('shopDashOverlay');
    if(overlay) overlay.remove();
    sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows2){ if(rows2&&rows2[0]) showShopDashboard(rows2[0]); });
  } catch(e) {
    showToast('⚠️ حصل خطأ في حذف الصورة', 'error');
    console.error('gallery remove error:', e);
  }
}

// ===== تعديل بيانات المحل (لصاحب المعرض) =====
async function showShopEditForm(traderId) {
  var rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  var trader = rows[0];
  if(!trader) return;
  var fb = (trader.social_links||[]).find(function(l){return l.type==='facebook';});
  var yt = (trader.social_links||[]).find(function(l){return l.type==='youtube';});
  var tt = (trader.social_links||[]).find(function(l){return l.type==='tiktok';});
  var overlay = document.createElement('div');
  overlay.id = 'shopEditOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:10020;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;">' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:14px;text-align:center;">✏️ تعديل بيانات المحل</div>' +
      '<input id="se_name" type="text" value="'+escapeHtml(trader.shop_name||'')+'" placeholder="اسم النشاط أو الجهة" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="se_phone" type="tel" value="'+escapeHtml(trader.phone||'')+'" dir="ltr" placeholder="رقم موبايلك" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<textarea id="se_desc" placeholder="وصف مختصر عن نشاطك" rows="2" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;resize:none;">'+escapeHtml(trader.description||'')+'</textarea>' +
      '<input id="se_address" type="text" value="'+escapeHtml(trader.address||'')+'" placeholder="العنوان" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="se_mapurl" type="url" value="'+escapeHtml(trader.map_url||'')+'" dir="ltr" placeholder="رابط الخريطة من Google Maps" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      (getShopCatId(trader.subcategory) === 'food_rest' || getShopCatId(trader.subcategory) === 'food_cafe' ?
        '<div style="background:#fef9c3;border-radius:10px;padding:10px;margin-bottom:8px;">' +
          '<div style="font-size:11px;color:#713f12;font-weight:700;margin-bottom:6px;">🍽️ بيانات المطعم</div>' +
          '<input id="se_hours" type="text" value="'+escapeHtml(trader.opening_hours||'')+'" placeholder="مواعيد العمل" style="width:100%;padding:9px;border:1.5px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;background:white;">' +
          '<select id="se_delivery" style="width:100%;padding:9px;border:1.5px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;background:white;">' +
            '<option value="" '+(!trader.delivery_available?'selected':'')+'>-- التوصيل متاح؟ --</option>' +
            '<option value="متاح" '+(trader.delivery_available==='متاح'?'selected':'')+'>🛵 متاح</option>' +
            '<option value="غير متاح" '+(trader.delivery_available==='غير متاح'?'selected':'')+'>🚫 غير متاح — استلام بس</option>' +
          '</select>' +
        '</div>'
      : '') +
      '<div style="background:#f8fafc;border-radius:10px;padding:10px;margin-bottom:12px;">' +
        '<div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:6px;">🔗 روابط السوشيال</div>' +
        '<input id="se_facebook" type="url" value="'+escapeHtml(fb?fb.url:'')+'" dir="ltr" placeholder="رابط صفحة فيسبوك" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;">' +
        '<input id="se_youtube" type="url" value="'+escapeHtml(yt?yt.url:'')+'" dir="ltr" placeholder="رابط قناة يوتيوب" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;margin-bottom:6px;">' +
        '<input id="se_tiktok" type="url" value="'+escapeHtml(tt?tt.url:'')+'" dir="ltr" placeholder="رابط تيك توك" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="submitShopEdit(\''+traderId+'\')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✅ حفظ التعديلات</button>' +
        '<button onclick="document.getElementById(\'shopEditOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function submitShopEdit(traderId) {
  var name = document.getElementById('se_name').value.trim();
  var phone = document.getElementById('se_phone').value.trim();
  var desc = document.getElementById('se_desc').value.trim();
  var address = document.getElementById('se_address').value.trim();
  var mapurl = document.getElementById('se_mapurl').value.trim();
  var openingHours = document.getElementById('se_hours') ? document.getElementById('se_hours').value.trim() : null;
  var deliveryAvailable = document.getElementById('se_delivery') ? document.getElementById('se_delivery').value.trim() : null;
  if(!name){ showToast('اكتب اسم النشاط', 'error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)){ showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  var fbLink = document.getElementById('se_facebook').value.trim();
  var ytLink = document.getElementById('se_youtube').value.trim();
  var ttLink = document.getElementById('se_tiktok').value.trim();
  var socialLinks = [];
  if(fbLink) socialLinks.push({type:'facebook', url:fbLink});
  if(ytLink) socialLinks.push({type:'youtube', url:ytLink});
  if(ttLink) socialLinks.push({type:'tiktok', url:ttLink});
  try {
    var ownerPhone3 = localStorage.getItem('my_shop_phone_'+traderId);
    var ownerPassHash3 = localStorage.getItem('my_shop_pass_'+traderId);
    await sbRPC('secure_update_shop_info', {
      p_phone: ownerPhone3, p_password_hash: ownerPassHash3, p_trader_id: traderId,
      p_shop_name: name,
      p_phone_new: phone,
      p_description: desc || null,
      p_address: address || null,
      p_map_url: mapurl || null,
      p_opening_hours: openingHours || null,
      p_delivery_available: deliveryAvailable || null,
      p_social_links: socialLinks.length ? socialLinks : null
    });
    showToast('✅ تم حفظ التعديلات');
    var editOverlay = document.getElementById('shopEditOverlay');
    if(editOverlay) editOverlay.remove();
    var dashOverlay = document.getElementById('shopDashOverlay');
    if(dashOverlay) dashOverlay.remove();
    sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
  } catch(e) {
    showToast('⚠️ حصل خطأ في الحفظ — جرب تاني', 'error');
    console.error('shop edit error:', e);
  }
}

// حذف المعرض نهائيًا (من طرف صاحب المعرض)
async function deleteMyShop(traderId) {
  if(!confirm('متأكد إنك عايز تحذف المعرض نهائيًا؟ الخطوة دي مش هترجع.')) return;
  if(!confirm('تأكيد أخير: هيتم حذف المعرض وكل منتجاته من دليل الحامول نهائيًا.')) return;
  try {
    var ownerPhone4 = localStorage.getItem('my_shop_phone_'+traderId);
    var ownerPassHash4 = localStorage.getItem('my_shop_pass_'+traderId);
    await sbRPC('secure_delete_shop_trader', {p_phone: ownerPhone4, p_password_hash: ownerPassHash4, p_trader_id: traderId});
    localStorage.removeItem('my_shop_phone_'+traderId);
    showToast('✅ تم حذف المعرض');
    var dashOverlay = document.getElementById('shopDashOverlay');
    if(dashOverlay) dashOverlay.remove();
    hideDynPage();
  } catch(e) {
    showToast('⚠️ حصل خطأ في الحذف — جرب تاني', 'error');
    console.error('delete my shop error:', e);
  }
}

function previewShopLogo(input) {
  var preview = document.getElementById('sr_logo_preview');
  if(!preview || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    preview.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:120px;object-fit:cover;border-radius:10px;border:2px solid #7c3aed;">';
  };
  reader.readAsDataURL(input.files[0]);
}

function previewShopGallery(input) {
  var preview = document.getElementById('sr_gallery_preview');
  if(!preview) return;
  var files = Array.from(input.files).slice(0, 10);
  preview.innerHTML = '';
  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:2px solid #2563eb;';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
  if(input.files.length > 10) showToast('هيتم رفع أول 10 صور بس', 'error');
}

var _shopRegisterInProgress = false;
async function submitShopRegister(subcategory, catId) {
  // منع الإرسال المتكرر: لو حد دوس على الزرار أكتر من مرة (ضغط مزدوج، أو نت بطيء وهو مستني) يتجاهل أي محاولة تانية لحد ما الأولى تخلص
  if(_shopRegisterInProgress) return;
  _shopRegisterInProgress = true;
  var _submitBtn = document.getElementById('shopRegSubmitBtn');
  var _submitBtnOriginalText = _submitBtn ? _submitBtn.innerHTML : '';
  if(_submitBtn) { _submitBtn.disabled = true; _submitBtn.style.opacity = '0.6'; _submitBtn.style.cursor = 'not-allowed'; _submitBtn.innerHTML = '⏳ جاري التسجيل...'; }
  try {
    await _doSubmitShopRegister(subcategory, catId);
  } finally {
    _shopRegisterInProgress = false;
    if(_submitBtn) { _submitBtn.disabled = false; _submitBtn.style.opacity = '1'; _submitBtn.style.cursor = 'pointer'; _submitBtn.innerHTML = _submitBtnOriginalText; }
  }
}
async function _doSubmitShopRegister(subcategory, catId) {
  var name = document.getElementById('sr_name').value.trim();
  var phone = document.getElementById('sr_phone').value.trim();
  var pass = document.getElementById('sr_pass').value.trim();
  var desc = document.getElementById('sr_desc').value.trim();
  if(!name){ showToast('اكتب اسم النشاط', 'error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)){ showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  if(!pass || pass.length < 6){ showToast('كلمة السر لازم تكون 6 أحرف على الأقل', 'error'); return; }

  // تحقق إن الموبايل مش مسجل قبل كده في نفس القسم
  var existing = await sbFetch('GET', 'shop_traders?phone=eq.'+encodeURIComponent(phone)+'&subcategory=eq.'+encodeURIComponent(subcategory)+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  if(existing.length){
    var exTrader = existing[0];
    if(confirm('الرقم ده عنده نشاط مسجل بالفعل في "' + subcategory + '" (' + (exTrader.shop_name||'') + ').\n\n' + (exTrader.status==='pending' ? 'النشاط لسه تحت المراجعة من الأدمن.' : 'النشاط معتمد وظاهر.') + '\n\nتحب تدخل على صفحتك؟')) {
      document.getElementById('shopRegOverlay').remove();
      openShop(exTrader.id);
    }
    return;
  }

  var address = document.getElementById('sr_address').value.trim();
  var mapurl = document.getElementById('sr_mapurl').value.trim();
  var openingHours = document.getElementById('sr_hours') ? document.getElementById('sr_hours').value.trim() : '';
  var deliveryAvailable = document.getElementById('sr_delivery') ? document.getElementById('sr_delivery').value.trim() : '';
  var fbLink = document.getElementById('sr_facebook') ? document.getElementById('sr_facebook').value.trim() : '';
  var ytLink = document.getElementById('sr_youtube') ? document.getElementById('sr_youtube').value.trim() : '';
  var ttLink = document.getElementById('sr_tiktok') ? document.getElementById('sr_tiktok').value.trim() : '';
  var socialLinks = [];
  if(fbLink) socialLinks.push({type:'facebook', url:fbLink});
  if(ytLink) socialLinks.push({type:'youtube', url:ytLink});
  if(ttLink) socialLinks.push({type:'tiktok', url:ttLink});
  var logoFile = document.getElementById('sr_logo') ? document.getElementById('sr_logo').files[0] : null;
  var logoUrl = null;
  if(logoFile) {
    showToast('⏳ جاري رفع الصورة...');
    try {
      logoUrl = await uploadImage(logoFile);
    } catch(imgErr) {
      console.warn('logo upload failed, continuing without it:', imgErr);
      showToast('⚠️ تعذّر رفع الصورة — هنكمّل التسجيل بدونها');
      logoUrl = null;
    }
  }
  var galleryFiles = document.getElementById('sr_gallery') ? Array.from(document.getElementById('sr_gallery').files).slice(0, 10) : [];
  var galleryUrls = [];
  if(galleryFiles.length) {
    showToast('⏳ جاري رفع الصور التوضيحية...');
    for(var g=0; g<galleryFiles.length; g++) {
      try {
        var gUrl = await uploadImage(galleryFiles[g]);
        if(gUrl) galleryUrls.push(gUrl);
      } catch(gErr) {
        console.warn('gallery image upload failed:', gErr);
      }
    }
  }
  var passHash = await hashPass(pass);
  var secQ = document.getElementById('sr_secq') ? document.getElementById('sr_secq').value : '';
  var secA = document.getElementById('sr_seca') ? document.getElementById('sr_seca').value.trim() : '';
  var secAHash = secA ? await hashPass(secA.toLowerCase()) : null;
  var shopData = {
    subcategory: subcategory,
    shop_name: name,
    phone: phone,
    password_hash: passHash,
    security_question: secQ || null,
    security_answer_hash: secAHash,
    description: desc,
    address: address || null,
    map_url: mapurl || null,
    opening_hours: openingHours || null,
    delivery_available: deliveryAvailable || null,
    logo_url: logoUrl || null,
    gallery_images: galleryUrls.length ? galleryUrls : null,
    social_links: socialLinks.length ? socialLinks : null,
    status: 'pending'
  };

  // دالة تسجيل بترجّع الصف المحفوظ فعليًا (return=representation)
  async function insertTrader(payload) {
    var res = await fetch(SB_URL + '/rest/v1/shop_traders?select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok) { throw new Error(await res.text()); }
    return res.json();
  }

  var newTrader = null;
  var savedOk = false;
  try {
    // نحاول نحفظ مع كل الأعمدة (category + social_links)
    newTrader = await insertTrader(Object.assign({category: catId || getShopCatId(subcategory)}, shopData));
    savedOk = true;
  } catch(err) {
    console.warn('register with all columns failed, retrying with fewer:', err);
    // نحاول من غير الأعمدة الاختيارية الجديدة (لو لسه مش موجودة في الداتابيز)
    try {
      var basicData = Object.assign({}, shopData);
      delete basicData.social_links;
      newTrader = await insertTrader(Object.assign({category: catId || getShopCatId(subcategory)}, basicData));
      savedOk = true;
    } catch(err2) {
      // آخر محاولة: من غير category ولا social_links
      try {
        var basicData2 = Object.assign({}, shopData);
        delete basicData2.social_links;
        newTrader = await insertTrader(basicData2);
        savedOk = true;
      } catch(err3) {
        showToast('⚠️ حصل خطأ في التسجيل — تأكد من الاتصال وحاول تاني', 'error');
        console.error('Shop register error:', err3);
        return;
      }
    }
  }

  if(!savedOk) {
    showToast('⚠️ تعذّر حفظ المعرض — جرّب تاني بعد شوية', 'error');
    return;
  }

  // احفظ بيانات الدخول في الجهاز عشان ما يكتبهاش تاني
  if(newTrader && newTrader[0]) {
    localStorage.setItem('my_shop_phone_'+newTrader[0].id, phone);
    localStorage.setItem('my_shop_pass_'+newTrader[0].id, passHash);
  }

  document.getElementById('shopRegOverlay').remove();
  showShopRegSuccessModal();
}

// ===== رسالة تأكيد واضحة بعد تسجيل معرض جديد =====
function showShopRegSuccessModal() {
  let modal = document.getElementById('submitSuccessModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'submitSuccessModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;max-width:380px;width:100%;padding:26px 22px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      <div style="font-size:16px;font-weight:900;color:#7c3aed;margin-bottom:8px;">تم استلام تسجيلك!</div>
      <div style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:18px;">هيراجعه المشرف وعادةً بيظهر خلال ساعة تقريبًا في أوقات النهار.</div>
      <button onclick="document.getElementById('submitSuccessModal').remove()" style="width:100%;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">تمام 👍</button>
    </div>`;
}

// ===== دخول تاجر موجود =====
function showShopLogin(subcategory) {
  var overlay = document.createElement('div');
  overlay.id = 'shopLoginOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🏪</div>' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:14px;">دخول لنشاطك في ' + subcategory + '</div>' +
      '<input id="sl_phone" type="tel" placeholder="رقم موبايلك" dir="ltr" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:8px;text-align:center;">' +
      '<input id="sl_pass" type="password" placeholder="كلمة السر" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:14px;text-align:center;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="doShopLogin(\'' + subcategory + '\')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">دخول</button>' +
        '<button onclick="document.getElementById(\'shopLoginOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
      '<a href="javascript:void(0)" onclick="forgotShopTraderPassword()" style="display:block;margin-top:14px;font-size:12px;color:#0369a1;text-decoration:underline;">نسيت كلمة السر؟</a>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function forgotShopTraderPassword() {
  var phoneInput = document.getElementById('sl_phone');
  var phone = phoneInput ? phoneInput.value.trim() : '';
  if(!phone) { showToast('اكتب رقم موبايلك الأول فوق', 'error'); return; }
  try {
    var question = await sbRPC('get_security_question_shop_trader', {p_phone: phone});
    if(!question) {
      var msg = 'السلام عليكم، نسيت كلمة سر حسابي كصاحب نشاط في دليل الحامول. رقم موبايلي: ' + phone;
      window.open('https://wa.me/' + ADMIN_WA + '?text=' + encodeURIComponent(msg), '_blank');
      showToast('حسابك مفيهوش سؤال أمان محدد — هيتواصل معاك الأدمن', 'error');
      return;
    }
    var answer = prompt(question);
    if(answer === null) return;
    if(!answer.trim()) { showToast('لازم تكتب إجابة', 'error'); return; }
    var answerHash = await hashPass(answer.trim().toLowerCase());
    var rows = await sbRPC('self_forgot_password_shop_trader', {p_phone: phone, p_answer_hash: answerHash});
    var r = (rows && rows[0]) || {};
    if(!r.success) {
      if(r.out_status === 'WRONG_ANSWER') showToast('❌ الإجابة مش صح', 'error');
      else showToast('حصل خطأ، حاول تاني', 'error');
      return;
    }
    var overlay = document.getElementById('shopLoginOverlay');
    if(overlay) overlay.remove();
    var subtitle = r.shops_count > 1 ? 'هتفتح بيها كل معارضك (' + r.shops_count + ') برقم الموبايل ده' : 'استخدمها لتسجيل الدخول لمعرضك';
    showNewPasswordModal(r.new_password, subtitle);
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
  }
}

async function doShopLogin(subcategory) {
  var phone = document.getElementById('sl_phone').value.trim();
  var pass = document.getElementById('sl_pass').value.trim();
  if(!phone || !pass){ showToast('اكتب الموبايل وكلمة السر', 'error'); return; }
  var passHash = await hashPass(pass);
  var rows;
  try {
    rows = await sbRPC('shop_trader_login', {p_phone: phone, p_password_hash: passHash, p_subcategory: subcategory}) || [];
  } catch(e) {
    if(String(e.message||'') === 'TOO_MANY_ATTEMPTS') showToast('⏳ حاولت كتير غلط، استنى ربع ساعة وجرب تاني', 'error');
    else showToast('خطأ في الدخول', 'error');
    return;
  }
  if(!rows.length){ showToast('الموبايل أو كلمة السر غلط ❌', 'error'); return; }
  var trader = rows[0];
  localStorage.setItem('my_shop_phone_'+trader.id, phone);
  localStorage.setItem('my_shop_pass_'+trader.id, passHash);
  document.getElementById('shopLoginOverlay').remove();
  if(trader.status === 'pending'){ showToast('⏳ نشاطك لسه تحت المراجعة', 'error'); return; }
  openShop(trader.id);
}

// ===== تغيير كلمة السر (لصاحب المعرض) =====
function showChangeShopPasswordForm(traderId) {
  var overlay = document.createElement('div');
  overlay.id = 'shopPassChangeOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:10020;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🔒</div>' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;">غيّر كلمة السر</div>' +
      '<input id="cp_old" type="password" placeholder="كلمة السر الحالية" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:8px;text-align:center;">' +
      '<input id="cp_new" type="password" placeholder="كلمة السر الجديدة (6 حروف/أرقام على الأقل)" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:8px;text-align:center;">' +
      '<input id="cp_confirm" type="password" placeholder="أكّد كلمة السر الجديدة" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:14px;text-align:center;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="submitChangeShopPassword(\''+traderId+'\')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">حفظ</button>' +
        '<button onclick="document.getElementById(\'shopPassChangeOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function submitChangeShopPassword(traderId) {
  var oldPass = document.getElementById('cp_old').value.trim();
  var newPass = document.getElementById('cp_new').value.trim();
  var confirmPass = document.getElementById('cp_confirm').value.trim();
  if(!oldPass || !newPass || !confirmPass){ showToast('املأ كل الحقول', 'error'); return; }
  if(newPass.length < 6){ showToast('كلمة السر الجديدة لازم تكون 6 حروف/أرقام على الأقل', 'error'); return; }
  if(newPass !== confirmPass){ showToast('كلمة السر الجديدة غير متطابقة', 'error'); return; }
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  try {
    var oldHash = await hashPass(oldPass);
    var newHash = await hashPass(newPass);
    await sbRPC('secure_change_shop_trader_password', {p_phone: phone, p_old_password_hash: oldHash, p_trader_id: traderId, p_new_password_hash: newHash});
    localStorage.setItem('my_shop_pass_'+traderId, newHash);
    var o = document.getElementById('shopPassChangeOverlay');
    if(o) o.remove();
    showToast('✅ تم تغيير كلمة السر');
  } catch(e) { showToast('كلمة السر الحالية غلط أو حصل خطأ ❌', 'error'); }
}

function shopTraderLogout(traderId) {
  localStorage.removeItem('my_shop_phone_'+traderId);
  localStorage.removeItem('my_shop_pass_'+traderId);
  var o = document.getElementById('shopDashOverlay');
  if(o) o.remove();
  showToast('تم تسجيل الخروج');
  openShop(traderId);
}

// ===== لوحة تحكم التاجر =====
async function showShopDashboard(trader) {
  var sections = await sbFetch('GET', 'shop_sections?trader_id=eq.'+trader.id+'&order=sort_order.asc') || [];
  var products = await sbFetch('GET', 'shop_products?trader_id=eq.'+trader.id+'&order=created_at.desc') || [];
  var broadcasts = await sbFetch('GET', 'broadcasts?order=created_at.desc&limit=3').catch(function(){return [];}) || [];
  var dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts')||'[]'); } catch(e) {}
  broadcasts = broadcasts.filter(function(b){ return dismissed.indexOf(b.id) === -1; });

  var lastSeenComments = trader.last_comments_seen_at || '1970-01-01';
  var newComments = await sbFetch('GET', 'shop_comments?trader_id=eq.'+trader.id+'&created_at=gt.'+encodeURIComponent(lastSeenComments)+'&order=created_at.desc&limit=10').catch(function(){return [];}) || [];

  var totalProducts = products.length;
  var outOfStockCount = products.filter(function(p){ return p.stock === 0 || p.stock === '0'; }).length;

  var overlay = document.createElement('div');
  overlay.id = 'shopDashOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:9999;overflow-y:auto;';
  overlay.innerHTML =
    '<div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:14px 16px;display:flex;align-items:center;gap:10px;color:white;">' +
      '<button onclick="document.getElementById(\'shopDashOverlay\').remove();openShop(\''+trader.id+'\')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">✕ خروج</button>' +
      '<div style="flex:1;text-align:center;font-size:15px;font-weight:900;">لوحة تحكم ' + escapeHtml(trader.shop_name) + '</div>' +
      '<button onclick="showShopsPage(\'' + trader.subcategory + '\',\'' + getShopCatId(trader.subcategory) + '\')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">👁️ شوف</button>' +
    '</div>' +
    (broadcasts.length ? broadcasts.map(function(b){
      return '<div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:12px 16px;display:flex;gap:10px;align-items:flex-start;">' +
        '<div style="font-size:18px;">📣</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:900;color:#92400e;">' + escapeHtml(b.title) + '</div>' +
          (b.body ? '<div style="font-size:12px;color:#78350f;margin-top:2px;line-height:1.6;">' + escapeHtml(b.body) + '</div>' : '') +
        '</div>' +
        '<button onclick="dismissBroadcast(\'' + b.id + '\',this)" style="background:none;border:none;color:#92400e;font-size:16px;cursor:pointer;flex-shrink:0;">×</button>' +
      '</div>';
    }).join('') : '') +
    (newComments.length ?
      '<div style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:12px 16px;">' +
        '<div style="font-size:13px;font-weight:900;color:#1e40af;margin-bottom:8px;">💬 ' + newComments.length + ' كومنت/تقييم جديد على محلك</div>' +
        newComments.map(function(c){
          var d = ''; try { d = new Date(c.created_at).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}); } catch(e){}
          return '<div style="background:white;border-radius:8px;padding:8px 10px;margin-bottom:6px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">' +
              '<span style="font-size:12px;font-weight:800;color:#1e3a8a;">' + escapeHtml(c.author_name||'زائر') + (c.rating ? ' ' + '⭐'.repeat(c.rating) : '') + '</span>' +
              '<span style="font-size:10px;color:#94a3b8;">' + d + '</span>' +
            '</div>' +
            (c.body ? '<div style="font-size:12px;color:#334155;">' + escapeHtml(c.body) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>'
    : '') +
    
    // بوستر المعرض مع زرار تغيير
    '<div style="position:relative;">' +
      (trader.logo_url ?
        '<img src="'+trader.logo_url+'" style="width:100%;height:140px;object-fit:cover;">' :
        '<div style="width:100%;height:100px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);display:flex;align-items:center;justify-content:center;font-size:36px;">🏪</div>'
      ) +
      '<label style="position:absolute;bottom:8px;left:8px;background:rgba(124,58,237,.9);color:white;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🖼️ تغيير صورة الغلاف<input type="file" accept="image/*" style="display:none;" onchange="updateShopLogo(this,\''+trader.id+'\',\''+trader.subcategory+'\')"></label>' +
    '</div>' +
    '<div style="padding:14px 12px 80px;" id="dashContent">' +
      // بيانات المحل: تعديل وحذف
      '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">' +
        '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">⚙️ بيانات المحل</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="showShopEditForm(\''+trader.id+'\')" style="flex:1;background:#eff6ff;color:#2563eb;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">✏️ تعديل البيانات</button>' +
          '<button onclick="deleteMyShop(\''+trader.id+'\')" style="flex:1;background:#fee2e2;color:#dc2626;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">🗑️ حذف المعرض نهائيًا</button>' +
        '</div>' +
        '<button onclick="showChangeShopPasswordForm(\''+trader.id+'\')" style="width:100%;margin-top:8px;background:#f8fafc;color:#475569;border:1px solid var(--border);padding:9px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔒 غيّر كلمة السر</button>' +
        '<button onclick="shopTraderLogout(\''+trader.id+'\')" style="width:100%;margin-top:8px;background:#fee2e2;color:#dc2626;border:none;padding:9px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🚪 تسجيل الخروج من حساب النشاط</button>' +
      '</div>' +
      // صور توضيحية للمعرض
      '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">' +
        '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">' + ((getShopCatId(trader.subcategory) === 'food_rest' || getShopCatId(trader.subcategory) === 'food_cafe') ? '📷 صور المنيو والأكل' : getShopCatId(trader.subcategory) === 'gold' ? '📷 صور توضيحية للمشغولات' : '📷 صور توضيحية للمعرض') + ' (' + ((trader.gallery_images||[]).length) + '/10)</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">' + ((getShopCatId(trader.subcategory) === 'food_rest' || getShopCatId(trader.subcategory) === 'food_cafe') ? 'ارفع صور المنيو أو أطباقك هنا — بديل سريع لو مش عايز تضيف كل صنف منتج لوحده' : getShopCatId(trader.subcategory) === 'gold' ? 'ارفع صور توضيحية للمشغولات والتصميمات المتاحة عندك' : 'بتظهر لزبائنك حتى لو لسه مضفتش منتجات') + '</div>' +
        '<div id="dashGalleryList" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">' +
          (trader.gallery_images||[]).map(function(img, gi){
            return '<div style="position:relative;">' +
              '<img src="'+img+'" style="width:64px;height:64px;object-fit:cover;border-radius:8px;">' +
              '<button onclick="removeShopGalleryImage(\''+trader.id+'\','+gi+')" style="position:absolute;top:-6px;left:-6px;background:#dc2626;color:white;border:none;width:20px;height:20px;border-radius:50%;font-size:11px;cursor:pointer;line-height:1;">×</button>' +
            '</div>';
          }).join('') +
        '</div>' +
        ((trader.gallery_images||[]).length < 10 ?
          '<label style="display:flex;align-items:center;justify-content:center;gap:8px;background:#eff6ff;color:#2563eb;padding:10px;border-radius:10px;cursor:pointer;border:1.5px dashed #2563eb;font-weight:700;font-size:12px;">' +
            '+ أضف صور (حتى ' + (10 - (trader.gallery_images||[]).length) + ' كمان)' +
            '<input type="file" accept="image/*" multiple style="display:none;" onchange="addShopGalleryImages(this,\''+trader.id+'\')">' +
          '</label>' : '') +
      '</div>' +
      // إحصائيات سريعة
      '<div style="display:flex;gap:10px;margin-bottom:12px;">' +
        '<div style="flex:1;background:#f5f3ff;border-radius:12px;padding:12px;text-align:center;border:1px solid #ddd6fe;">' +
          '<div style="font-size:20px;font-weight:900;color:#7c3aed;">' + totalProducts + '</div>' +
          '<div style="font-size:11px;color:#6d28d9;font-weight:700;">📦 إجمالي المنتجات</div>' +
        '</div>' +
        '<div style="flex:1;background:#fef2f2;border-radius:12px;padding:12px;text-align:center;border:1px solid #fecaca;">' +
          '<div style="font-size:20px;font-weight:900;color:#dc2626;">' + outOfStockCount + '</div>' +
          '<div style="font-size:11px;color:#b91c1c;font-weight:700;">⚠️ نفدت كميته</div>' +
        '</div>' +
      '</div>' +
      // أقسام المعرض
      '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<div style="font-size:14px;font-weight:900;">📁 أقسام نشاطك</div>' +
          '<button onclick="showAddSection(\'' + trader.id + '\')" style="background:#7c3aed;color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ قسم</button>' +
        '</div>' +
        (sections.length ?
          '<div id="sectionsList" style="font-size:11px;">' +
          '<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">↕️ اسحب وأفلت لترتيب الأقسام</div>' +
          sections.map(function(s){ return '<div class="sec-drag-row" draggable="true" data-sid="'+s.id+'" ondragstart="secDragStart(event)" ondragover="secDragOver(event)" ondrop="secDrop(event,\''+trader.id+'\')" ondragend="secDragEnd(event)" style="display:flex;align-items:center;gap:8px;padding:8px;background:#f8fafc;border-radius:8px;margin-bottom:6px;cursor:grab;">' +
            '<span style="color:#c7c7c7;font-size:16px;">⠿</span>' +
            '<div style="flex:1;font-size:13px;font-weight:700;">📁 ' + escapeHtml(s.name) + '</div>' +
            '<span style="font-size:11px;color:#94a3b8;">' + products.filter(function(p){return p.section_id===s.id;}).length + ' منتج</span>' +
            '<button data-sid="'+s.id+'" onclick="deleteShopSection(this.dataset.sid,\''+trader.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">حذف</button>' +
          '</div>'; }).join('') + '</div>' :
          '<p style="font-size:12px;color:#94a3b8;">مفيش أقسام لحد دلوقتي</p>'
        ) +
      '</div>' +
      // إضافة منتج
      '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">' +
        '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">➕ أضف منتج جديد</div>' +
        (sections.length ? '<select id="dp_section" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;"><option value="">— بدون قسم —</option>' + sections.map(function(s){ return '<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>'; }).join('') + '</select>' : '') +
        '<input id="dp_title" type="text" placeholder="اسم المنتج" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
        (getShopCatId(trader.subcategory) === 'gold' ?
          '<div style="background:#fef9c3;border-radius:10px;padding:10px;margin-bottom:8px;font-size:11.5px;color:#713f12;line-height:1.7;">💡 <b>سعر الدهب بيتغيّر يوميًا</b> — سيب خانة السعر فاضية والزبون هيكلّمك واتساب يسأل عن السعر بوزن اليوم. لو حبيت تحط سعر، اكتب في اسم المنتج أو الوصف "السعر حسب وزن اليوم" بدل رقم ثابت.</div>' : '') +
        '<input id="dp_price" type="number" min="0" step="0.01" placeholder="' + (getShopCatId(trader.subcategory) === 'gold' ? 'السعر (اختياري — سيبه فاضي لو بيتغيّر يوميًا)' : 'السعر (جنيه)') + '" oninput="if(this.value<0)this.value=0;" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
        '<input id="dp_stock" type="number" min="0" step="1" placeholder="الكمية المتاحة" oninput="if(this.value<0)this.value=0;" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
        '<div style="margin-bottom:8px;">' +
          '<label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">حالة المنتج</label>' +
          '<select id="dp_active" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;background:white;">' +
            '<option value="true">🟢 متوفر</option>' +
            '<option value="false">🔴 غير متوفر</option>' +
          '</select>' +
        '</div>' +
        '<textarea id="dp_desc" placeholder="وصف المنتج (اختياري)" rows="2" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;resize:none;"></textarea>' +
        '<!-- صور المنتج - حتى 5 صور -->' +
        '<label style="display:flex;align-items:center;justify-content:center;gap:8px;background:#f0fdf4;color:#16a34a;padding:11px;border-radius:10px;cursor:pointer;border:1.5px dashed #16a34a;font-weight:700;font-size:13px;margin-bottom:8px;">' +
          '📷 صور المنتج (حتى 5 صور)' +
          '<input type="file" id="dp_imgs" accept="image/*" multiple style="display:none;" onchange="previewDashImgs(this)">' +
        '</label>' +
        '<div id="dp_imgs_preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>' +
        '<!-- وسائل التواصل -->' +
        '<div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">📱 وسائل التواصل (واتساب / فيسبوك / تيك توك / موقع...)</div>' +
        '<div id="dp_links_wrap">' + renderLinkRow() + '</div>' +
        '<button onclick="addLinkRow()" style="background:#f3f4f6;color:#64748b;border:none;padding:7px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;margin-bottom:10px;">+ أضف وسيلة تواصل</button>' +
        '<button id="dpSubmitBtn" onclick="submitShopProduct(\'' + trader.id + '\')" style="width:100%;background:#16a34a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✅ أضف المنتج</button>' +
      '</div>' +
      // المنتجات الحالية
      '<div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);">' +
        '<div style="font-size:14px;font-weight:900;margin-bottom:6px;">📦 منتجاتك (' + products.length + ')</div>' +
        (products.length ? '<div style="font-size:10.5px;color:#94a3b8;background:#f8fafc;border-radius:8px;padding:7px 10px;margin-bottom:10px;line-height:1.7;">⭐ = ضيفه للعروض (هيظهر في تاب "العروض" بالرئيسية) &nbsp;•&nbsp; ❌ = ده عرض حاليًا، دوس تلغيه</div>' : '') +
        (products.length ?
          '<div>' + products.map(function(p){
            var active = p.is_active !== false;
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:8px;margin-bottom:6px;opacity:'+(active?'1':'.6')+';">' +
            (p.image_url ? '<img src="'+p.image_url+'" style="width:44px;height:44px;border-radius:8px;object-fit:cover;">' : '<div style="width:44px;height:44px;border-radius:8px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">🛍️</div>') +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(p.title) + (active?'':' <span style="background:#fee2e2;color:#dc2626;font-size:9px;font-weight:900;padding:1px 6px;border-radius:20px;">تم البيع</span>') + '</div>' +
              (p.price ? '<div style="font-size:12px;color:#7c3aed;font-weight:700;">' + parseFloat(p.price).toLocaleString() + ' ج</div>' : '') +
              (p.stock === 0 || p.stock === '0' ? '<div style="font-size:10px;color:#dc2626;font-weight:700;">نفدت الكمية</div>' : '') +
            '</div>' +
            // سويتش تم البيع
            '<label style="position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0;cursor:pointer;" title="'+(active?'المنتج معروض للبيع — اضغط لو اتباع':'تم البيع (مخفي عن العملاء) — اضغط لإرجاعه')+'">' +
              '<input type="checkbox" data-pid="'+p.id+'" onchange="toggleProductActive(this,\''+trader.id+'\')" '+(active?'checked':'')+' style="opacity:0;width:0;height:0;">' +
              '<span style="position:absolute;inset:0;background:'+(active?'#16a34a':'#dc2626')+';border-radius:22px;transition:.2s;"></span>' +
              '<span style="position:absolute;height:16px;width:16px;left:'+(active?'3px':'19px')+';top:3px;background:white;border-radius:50%;transition:.2s;"></span>' +
            '</label>' +
            '<button data-pid="'+p.id+'" onclick="toggleProductOffer(this.dataset.pid,\''+trader.id+'\',' + (!p.is_offer) + ')" style="background:'+(p.is_offer?'#fee2e2':'#fff7ed')+';color:'+(p.is_offer?'var(--red)':'var(--orange)')+';border:none;padding:5px 8px;border-radius:8px;font-size:12px;cursor:pointer;flex-shrink:0;" title="'+(p.is_offer?'إلغاء من العروض':'إضافة للعروض')+'">'+(p.is_offer?'❌':'⭐')+'</button>' +
            '<button data-pid="'+p.id+'" onclick="editShopProduct(this.dataset.pid,\''+trader.id+'\')" style="background:#eff6ff;color:#1d4ed8;border:none;padding:5px 8px;border-radius:8px;font-size:12px;cursor:pointer;flex-shrink:0;">✏️</button>' +
            '<button data-pid="'+p.id+'" onclick="deleteShopProduct(this.dataset.pid,\''+trader.id+'\')" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 10px;border-radius:8px;font-size:12px;cursor:pointer;flex-shrink:0;">🗑️</button>' +
          '</div>'; }).join('') + '</div>' :
          '<p style="font-size:12px;color:#94a3b8;">مفيش منتجات لحد دلوقتي</p>'
        ) +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  if(newComments.length) {
    var myPhone = localStorage.getItem('my_shop_phone_'+trader.id);
    var myPassHash = localStorage.getItem('my_shop_pass_'+trader.id);
    sbRPC('secure_ack_shop_comments', {p_phone: myPhone, p_password_hash: myPassHash, p_trader_id: trader.id}).catch(function(){});
  }
}

function showAddSection(traderId) {
  var name = prompt('اسم القسم الجديد (مثال: هدوم شتوي):');
  if(!name || !name.trim()) return;
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  sbRPC('secure_insert_shop_section', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_name: name.trim()}).then(function() {
    showToast('✅ تم إضافة القسم');
    // refresh dashboard
    var overlay = document.getElementById('shopDashOverlay');
    if(overlay) overlay.remove();
    sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
  }).catch(function(e) {
    showToast('❌ حصل خطأ في إضافة القسم', 'error');
  });
}

async function deleteShopSection(sectionId, traderId) {
  if(!confirm('مسح القسم ده وكل منتجاته؟')) return;
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_delete_shop_section', {p_phone: phone, p_password_hash: passHash, p_section_id: sectionId});
  } catch(e) { showToast('❌ حصل خطأ في حذف القسم', 'error'); return; }
  showToast('تم حذف القسم');
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

function previewDashImg(input) {
  var preview = document.getElementById('dp_img_preview');
  if(!preview || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    preview.innerHTML = '<img src="'+e.target.result+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;">';
  };
  reader.readAsDataURL(input.files[0]);
}

function previewDashImgs(input) {
  var preview = document.getElementById('dp_imgs_preview');
  if(!preview) return;
  var files = Array.from(input.files).slice(0, 5);
  preview.innerHTML = '';
  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #16a34a;';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
  if(input.files.length > 5) showToast('هيتم رفع أول 5 صور بس', 'error');
}

// ===== وسائل التواصل (منصات) =====
var LINK_PLATFORMS = {
  whatsapp:  {icon:'💬', label:'واتساب'},
  facebook:  {icon:'📘', label:'فيسبوك'},
  tiktok:    {icon:'🎵', label:'تيك توك'},
  instagram: {icon:'📸', label:'انستجرام'},
  website:   {icon:'🔗', label:'موقع / لينك'}
};

function renderLinkRow(platform, url) {
  platform = platform || 'whatsapp';
  url = url || '';
  return '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">' +
    '<select class="dp_link_platform" style="width:118px;flex-shrink:0;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;background:white;">' +
      Object.keys(LINK_PLATFORMS).map(function(key){ var o=LINK_PLATFORMS[key]; return '<option value="'+key+'"'+(key===platform?' selected':'')+'>'+o.icon+' '+o.label+'</option>'; }).join('') +
    '</select>' +
    '<input class="dp_link_input" type="url" value="'+escapeHtml(url)+'" placeholder="https://..." dir="ltr" style="flex:1;padding:9px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">' +
    '<button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2;color:#dc2626;border:none;padding:7px 10px;border-radius:8px;font-size:14px;cursor:pointer;flex-shrink:0;">×</button>' +
  '</div>';
}

function addLinkRow() {
  var wrap = document.getElementById('dp_links_wrap');
  if(!wrap) return;
  var rows = wrap.querySelectorAll('.dp_link_input').length;
  if(rows >= 5) { showToast('حد أقصى 5 وسائل تواصل', 'error'); return; }
  var temp = document.createElement('div');
  temp.innerHTML = renderLinkRow();
  wrap.appendChild(temp.firstChild);
}

async function submitShopProduct(traderId) {
  var btn = document.getElementById('dpSubmitBtn');
  if(btn && btn.disabled) return; // منع الضغط مرتين وهي لسه شغالة
  var title = document.getElementById('dp_title').value.trim();
  var price = document.getElementById('dp_price').value.trim();
  var stock = document.getElementById('dp_stock').value.trim();
  var desc = document.getElementById('dp_desc').value.trim();
  var activeEl = document.getElementById('dp_active');
  var isActive = activeEl ? activeEl.value !== 'false' : true;
  var secEl = document.getElementById('dp_section');
  var sectionId = secEl ? secEl.value : '';
  var imgFiles = Array.from((document.getElementById('dp_imgs') || {files:[]}).files).slice(0, 5);
  if(!title){ showToast('اكتب اسم المنتج', 'error'); return; }
  if(price && parseFloat(price) < 0){ showToast('السعر مينفعش يكون رقم سالب', 'error'); return; }
  if(stock && parseInt(stock) < 0){ showToast('الكمية مينفعش تكون رقم سالب', 'error'); return; }

  if(btn) { btn.disabled = true; btn.style.opacity = '.6'; btn.style.cursor = 'not-allowed'; btn.textContent = '⏳ جاري الحفظ...'; }

  // جمع وسائل التواصل
  var links = [];
  var linkRows = document.querySelectorAll('#dp_links_wrap > div');
  linkRows.forEach(function(row){
    var sel = row.querySelector('.dp_link_platform');
    var inp = row.querySelector('.dp_link_input');
    var url = inp ? inp.value.trim() : '';
    if(url) {
      var platform = sel ? sel.value : 'website';
      var meta = LINK_PLATFORMS[platform] || LINK_PLATFORMS.website;
      links.push({url: url, label: meta.label, icon: meta.icon, platform: platform});
    }
  });

  // رفع الصور
  var imageUrls = [];
  if(imgFiles.length) {
    showToast('⏳ جاري رفع الصور...');
    if(btn) btn.textContent = '⏳ جاري رفع الصور...';
    for(var j=0; j<imgFiles.length; j++) {
      var url = await uploadImage(imgFiles[j]);
      if(url) imageUrls.push(url);
    }
  }

  if(btn) btn.textContent = '⏳ جاري الحفظ...';
  var myPhone = localStorage.getItem('my_shop_phone_'+traderId);
  var myPassHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_insert_shop_product', {
      p_phone: myPhone, p_password_hash: myPassHash, p_trader_id: traderId, p_section_id: sectionId || null,
      p_title: title,
      p_price: price ? parseFloat(price) : null,
      p_stock: stock ? parseInt(stock) : null,
      p_is_active: isActive,
      p_description: desc || null,
      p_image_url: imageUrls[0] || null,  // الصورة الأولى كصورة رئيسية
      p_images: imageUrls,
      p_links: links
    });
  } catch(e) {
    showToast('❌ حصل خطأ في إضافة المنتج', 'error');
    if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; btn.textContent = '✅ أضف المنتج'; }
    return;
  }

  showToast('✅ تم إضافة المنتج!');
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

async function deleteShopProduct(productId, traderId) {
  if(!confirm('مسح المنتج ده؟')) return;
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_delete_shop_product', {p_phone: phone, p_password_hash: passHash, p_product_id: productId});
  } catch(e) { showToast('❌ حصل خطأ في حذف المنتج', 'error'); return; }
  showToast('تم حذف المنتج');
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

// ===== تعديل منتج (السعر / الكمية / الاسم / الحالة) بدون حذف =====
async function editShopProduct(productId, traderId) {
  var rows = await sbFetch('GET', 'shop_products?id=eq.'+productId+'&limit=1') || [];
  var p = rows[0];
  if(!p) { showToast('مش لاقي المنتج', 'error'); return; }
  var overlay = document.createElement('div');
  overlay.id = 'editProdOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;text-align:center;">✏️ تعديل المنتج</div>' +
      '<input id="ep_title" type="text" value="'+escapeHtml(p.title||'')+'" placeholder="اسم المنتج" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ep_price" type="number" min="0" step="0.01" value="'+(p.price!=null?p.price:'')+'" placeholder="السعر (جنيه)" oninput="if(this.value<0)this.value=0;" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ep_stock" type="number" min="0" step="1" value="'+(p.stock!=null?p.stock:'')+'" placeholder="الكمية المتاحة" oninput="if(this.value<0)this.value=0;" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<div style="margin-bottom:10px;">' +
        '<label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">حالة المنتج</label>' +
        '<select id="ep_active" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;background:white;">' +
          '<option value="true"'+(p.is_active!==false?' selected':'')+'>🟢 معروض للبيع</option>' +
          '<option value="false"'+(p.is_active===false?' selected':'')+'>🔴 تم البيع (مخفي)</option>' +
        '</select>' +
      '</div>' +
      '<textarea id="ep_desc" placeholder="وصف المنتج (اختياري)" rows="2" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;resize:none;">'+escapeHtml(p.description||'')+'</textarea>' +
      // الصور الحالية
      '<div style="margin-bottom:10px;">' +
        '<label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:6px;">📷 صور المنتج</label>' +
        '<div id="ep_current_imgs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
          (function(){
            var imgs = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
            return imgs.map(function(src,i){
              return '<div style="position:relative;width:64px;height:64px;" data-imgsrc="'+encodeURIComponent(src)+'">' +
                '<img src="'+src+'" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;">' +
                '<button onclick="this.parentNode.remove()" style="position:absolute;top:-6px;left:-6px;background:#dc2626;color:white;border:none;width:20px;height:20px;border-radius:50%;font-size:11px;cursor:pointer;line-height:1;">✕</button>' +
              '</div>';
            }).join('');
          })() +
        '</div>' +
        '<label style="display:block;border:2px dashed #86efac;border-radius:10px;padding:10px;text-align:center;color:#16a34a;font-size:12px;font-weight:700;cursor:pointer;background:#f0fdf4;">' +
          '📷 إضافة صور جديدة' +
          '<input id="ep_new_imgs" type="file" accept="image/*" multiple onchange="previewEpNewImgs(this)" style="display:none;">' +
        '</label>' +
        '<div id="ep_new_imgs_preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="saveEditedProduct(\''+productId+'\',\''+traderId+'\')" style="flex:1;background:#16a34a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 حفظ التعديلات</button>' +
        '<button onclick="document.getElementById(\'editProdOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function saveEditedProduct(productId, traderId) {
  var title = document.getElementById('ep_title').value.trim();
  var price = document.getElementById('ep_price').value;
  var stock = document.getElementById('ep_stock').value;
  var active = document.getElementById('ep_active').value !== 'false';
  var desc = document.getElementById('ep_desc').value.trim();
  if(!title) { showToast('اكتب اسم المنتج', 'error'); return; }
  if(price !== '' && parseFloat(price) < 0) { showToast('السعر مينفعش يكون رقم سالب', 'error'); return; }
  if(stock !== '' && parseInt(stock) < 0) { showToast('الكمية مينفعش تكون رقم سالب', 'error'); return; }

  // اجمع الصور الحالية اللي متشالتش
  var keptImgs = [];
  var curWrap = document.getElementById('ep_current_imgs');
  if(curWrap) {
    curWrap.querySelectorAll('[data-imgsrc]').forEach(function(el){
      keptImgs.push(decodeURIComponent(el.getAttribute('data-imgsrc')));
    });
  }
  // ارفع الصور الجديدة
  var newFilesInput = document.getElementById('ep_new_imgs');
  if(newFilesInput && newFilesInput.files && newFilesInput.files.length) {
    showToast('⏳ جاري رفع الصور...');
    for(var i=0; i<newFilesInput.files.length; i++) {
      try {
        var url = await uploadImage(newFilesInput.files[i]);
        if(url) keptImgs.push(url);
      } catch(imgErr) { console.warn('image upload failed', imgErr); }
    }
  }

  var ownerPhone = localStorage.getItem('my_shop_phone_'+traderId);
  var ownerPassHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_update_shop_product', {
      p_phone: ownerPhone, p_password_hash: ownerPassHash, p_product_id: productId,
      p_title: title,
      p_price: price !== '' ? parseFloat(price) : null,
      p_stock: stock !== '' ? parseInt(stock) : null,
      p_is_active: active,
      p_description: desc || null,
      p_image_url: keptImgs.length ? keptImgs[0] : null,
      p_images: keptImgs.length ? keptImgs : null
    });
  } catch(e) { showToast('حصل خطأ في الحفظ', 'error'); return; }
  showToast('✅ تم حفظ التعديلات!');
  var eo = document.getElementById('editProdOverlay'); if(eo) eo.remove();
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

// معاينة الصور الجديدة في تعديل المنتج
function previewEpNewImgs(input) {
  var prev = document.getElementById('ep_new_imgs_preview');
  if(!prev) return;
  prev.innerHTML = '';
  if(!input.files) return;
  for(var i=0; i<input.files.length; i++) {
    var reader = new FileReader();
    (function(r){
      r.onload = function(e){
        var img = document.createElement('img');
        img.src = e.target.result;
        img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #86efac;';
        prev.appendChild(img);
      };
    })(reader);
    reader.readAsDataURL(input.files[i]);
  }
}

// ===== سويتش إخفاء/إظهار منتج =====
async function toggleProductActive(checkbox, traderId) {
  var pid = checkbox.dataset.pid;
  var newState = checkbox.checked;
  checkbox.disabled = true;
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_toggle_shop_product_active', {p_phone: phone, p_password_hash: passHash, p_product_id: pid, p_is_active: newState});
    showToast(newState ? '✅ المنتج رجع معروض للبيع' : '🔴 تم تعليم المنتج كـ"تم البيع"');
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
    checkbox.checked = !newState;
    checkbox.disabled = false;
    return;
  }
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

async function toggleProductOffer(pid, traderId, newState) {
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try {
    await sbRPC('secure_toggle_shop_product_offer', {p_phone: phone, p_password_hash: passHash, p_product_id: pid, p_is_offer: newState});
    showToast(newState ? '⭐ اتضاف المنتج للعروض!' : 'تم إلغاء المنتج من العروض');
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
    return;
  }
  var overlay = document.getElementById('shopDashOverlay');
  if(overlay) overlay.remove();
  sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1').then(function(rows){ if(rows&&rows[0]) showShopDashboard(rows[0]); });
}

// ===== سحب وإفلات لترتيب الأقسام =====
var secDragSrc = null;
function secDragStart(e) {
  secDragSrc = e.currentTarget;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', e.currentTarget.dataset.sid); } catch(err){}
  e.currentTarget.style.opacity = '.4';
}
function secDragOver(e) {
  e.preventDefault();
  var target = e.currentTarget;
  if(!secDragSrc || target === secDragSrc) return;
  var list = target.parentNode;
  var rect = target.getBoundingClientRect();
  var placeAfter = (e.clientY - rect.top) / rect.height > 0.5;
  list.insertBefore(secDragSrc, placeAfter ? target.nextSibling : target);
}
function secDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  secDragSrc = null;
}
async function secDrop(e, traderId) {
  e.preventDefault();
  var list = document.getElementById('sectionsList');
  if(!list) return;
  var rows = list.querySelectorAll('.sec-drag-row');
  var phone = localStorage.getItem('my_shop_phone_'+traderId);
  var passHash = localStorage.getItem('my_shop_pass_'+traderId);
  var updates = [];
  rows.forEach(function(row, idx){
    updates.push(sbRPC('secure_reorder_shop_section', {p_phone: phone, p_password_hash: passHash, p_section_id: row.dataset.sid, p_sort_order: idx}));
  });
  try { await Promise.all(updates); showToast('✅ اتغير ترتيب الأقسام'); } catch(err) { showToast('حصل خطأ في الترتيب', 'error'); }
}

async function openShopSection(sectionId, sectionName) {
  // جيب كل منتجات القسم ده
  var rawProducts = await sbFetch('GET', 'shop_products?section_id=eq.'+sectionId+'&order=created_at.desc') || [];
  var products = rawProducts.filter(function(p){ return p.is_active !== false; });
  var secInfo = await sbFetch('GET', 'shop_sections?id=eq.'+sectionId+'&limit=1') || [];

  var overlay = document.createElement('div');
  overlay.id = 'sectionDetailOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#f8fafc;z-index:9998;overflow-y:auto;';

  overlay.innerHTML =
    '<div style="background:#7c3aed;padding:12px 16px;display:flex;align-items:center;gap:10px;color:white;position:sticky;top:0;z-index:10;">' +
      '<button onclick="document.getElementById(\'sectionDetailOverlay\').remove()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">←</button>' +
      '<div style="flex:1;text-align:center;font-size:15px;font-weight:900;">📁 ' + escapeHtml(sectionName) + '</div>' +
      '<span style="font-size:12px;opacity:.8;">' + products.length + ' منتج</span>' +
    '</div>' +
    '<div style="padding:12px 12px 80px;">' +
      (products.length ?
        renderProductsGrid(products) :
        '<div style="text-align:center;padding:60px 20px;color:#94a3b8;"><div style="font-size:40px;margin-bottom:10px;">📦</div><p>مفيش منتجات في هذا القسم</p></div>'
      ) +
    '</div>';

  document.body.appendChild(overlay);
}

async function shareShop(traderId) {
  var traderArr = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  var trader = traderArr && traderArr[0];
  if(!trader) { showToast('حصل خطأ، حاول تاني', 'error'); return; }

  var link = SHARE_FN_BASE + '/shop/' + encodeURIComponent(traderId);
  var txt = '🏪 ' + trader.shop_name +
            (trader.description ? '\n' + trader.description : '') +
            '\n📦 ' + trader.subcategory +
            '\nعلى دليل الحامول\n\n🔗 ' + link;

  var modal = document.getElementById('shareShopModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'shareShopModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10005;display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div style="background:white;border-radius:18px 18px 0 0;max-width:480px;width:100%;padding:18px;">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;">🔗 شارك ' + escapeHtml(trader.shop_name) + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<a href="https://wa.me/?text=' + encodeURIComponent(txt) + '" target="_blank" onclick="document.getElementById(\'shareShopModal\').remove()" style="flex:1;background:#e8f5ee;color:#1a7a4a;padding:12px;border-radius:10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;">💬 واتساب</a>' +
        '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link) + '" target="_blank" onclick="document.getElementById(\'shareShopModal\').remove()" style="flex:1;background:#e8f0fb;color:#1877f2;padding:12px;border-radius:10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;">📘 فيسبوك</a>' +
        '<button onclick="navigator.clipboard.writeText(\'' + link + '\').then(function(){showToast(\'✅ اتنسخ اللينك\');});document.getElementById(\'shareShopModal\').remove();" style="flex:1;background:#f3f4f6;color:#374151;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🔗 نسخ</button>' +
      '</div>' +
      '<button onclick="document.getElementById(\'shareShopModal\').remove()" style="width:100%;background:#f3f4f6;color:#666;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
    '</div>';
}

async function shareShopProduct(productId) {
  var prodArr = await sbFetch('GET', 'shop_products?id=eq.'+productId+'&limit=1') || [];
  var p = prodArr && prodArr[0];
  if(!p) { showToast('حصل خطأ، حاول تاني', 'error'); return; }
  var traderArr = await sbFetch('GET', 'shop_traders?id=eq.'+p.trader_id+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  var trader = traderArr && traderArr[0];

  var link = SHARE_FN_BASE + '/product/' + encodeURIComponent(productId);
  var txt = '🛍️ ' + p.title + (p.price ? '\nالسعر: ' + parseFloat(p.price).toLocaleString() + ' جنيه' : '') +
            (trader ? '\nمن معرض: ' + trader.shop_name : '') +
            '\nعلى دليل الحامول\n\n🔗 ' + link;

  var modal = document.getElementById('shareProdModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'shareProdModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10005;display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div style="background:white;border-radius:18px 18px 0 0;max-width:480px;width:100%;padding:18px;">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;">🔗 شارك المنتج</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<a href="https://wa.me/?text=' + encodeURIComponent(txt) + '" target="_blank" onclick="document.getElementById(\'shareProdModal\').remove()" style="flex:1;background:#e8f5ee;color:#1a7a4a;padding:12px;border-radius:10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;">💬 واتساب</a>' +
        '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link) + '" target="_blank" onclick="document.getElementById(\'shareProdModal\').remove()" style="flex:1;background:#e8f0fb;color:#1877f2;padding:12px;border-radius:10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;">📘 فيسبوك</a>' +
        '<button onclick="navigator.clipboard.writeText(\'' + link + '\').then(function(){showToast(\'✅ اتنسخ اللينك\');});document.getElementById(\'shareProdModal\').remove();" style="flex:1;background:#f3f4f6;color:#374151;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🔗 نسخ</button>' +
      '</div>' +
      '<button onclick="document.getElementById(\'shareProdModal\').remove()" style="width:100%;background:#f3f4f6;color:#666;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
    '</div>';
}

async function openShopProduct(productId) {
  // جيب بيانات المنتج والتاجر
  var prodArr = await sbFetch('GET', 'shop_products?id=eq.'+productId+'&limit=1') || [];
  var p = prodArr && prodArr[0];
  if(!p) return;

  var traderArr = await sbFetch('GET', 'shop_traders?id=eq.'+p.trader_id+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1') || [];
  var trader = traderArr && traderArr[0];

  var imgs = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);

  var overlay = document.createElement('div');
  overlay.id = 'productDetailOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:9999;overflow-y:auto;';
  try{history.pushState({dyn:1},'');}catch(e){}

  // سلايدر الصور
  var sliderHtml = '';
  if(imgs.length) {
    sliderHtml =
      '<div style="position:relative;background:#f8fafc;">' +
        '<div id="pd_imgs" style="overflow:hidden;">' +
          imgs.map(function(src, i){
            return '<img src="'+src+'" style="width:100%;max-height:320px;object-fit:cover;display:'+(i===0?'block':'none')+'" data-pidx="'+i+'">';
          }).join('') +
        '</div>' +
        (imgs.length > 1 ?
          '<div style="display:flex;justify-content:center;gap:6px;padding:8px 0;position:absolute;bottom:0;left:0;right:0;">' +
            imgs.map(function(_,i){ return '<div class="pd_dot" onclick="switchProdDetailImg('+i+')" style="width:7px;height:7px;border-radius:50%;background:'+(i===0?'#7c3aed':'#d1d5db')+';cursor:pointer;"></div>'; }).join('') +
          '</div>' +
          '<button onclick="switchProdDetailImg(-1)" style="position:absolute;top:50%;right:12px;transform:translateY(-50%);background:rgba(0,0,0,.4);color:white;border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">❯</button>' +
          '<button onclick="switchProdDetailImg(1)" style="position:absolute;top:50%;left:12px;transform:translateY(-50%);background:rgba(0,0,0,.4);color:white;border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">❮</button>'
        : '') +
      '</div>';
  } else {
    sliderHtml = '<div style="height:200px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:48px;">🛍️</div>';
  }

  // وسائل التواصل
  var linksHtml = '';
  if(p.links && p.links.length) {
    linksHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
      p.links.map(function(l){
        var icon = l.icon || (l.url.includes('wa.me')||l.url.includes('whatsapp') ? '💬' :
                   l.url.includes('facebook')||l.url.includes('fb.') ? '📘' :
                   l.url.includes('tiktok') ? '🎵' :
                   l.url.includes('instagram') ? '📸' : '🔗');
        return '<a href="'+escapeHtml(safeUrl(l.url))+'" target="_blank" style="flex:1;min-width:120px;background:#f0fdf4;color:#16a34a;padding:10px;border-radius:10px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;border:1px solid #bbf7d0;">'+icon+' '+escapeHtml(l.label||'لينك')+'</a>';
      }).join('') +
    '</div>';
  }

  overlay.innerHTML =
    '<div style="background:#7c3aed;padding:12px 16px;display:flex;align-items:center;gap:10px;color:white;position:sticky;top:0;z-index:10;">' +
      '<button onclick="document.getElementById(\'productDetailOverlay\').remove()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">←</button>' +
      '<div style="flex:1;text-align:center;font-size:15px;font-weight:900;">' + escapeHtml(p.title) + '</div>' +
      '<button onclick="shareShopProduct(\'' + productId + '\')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">🔗 شارك</button>' +
    '</div>' +
    sliderHtml +
    '<div style="padding:16px;">' +
      '<div style="font-size:20px;font-weight:900;margin-bottom:4px;">' + escapeHtml(p.title) + '</div>' +
      (p.price ? '<div style="font-size:24px;font-weight:900;color:#7c3aed;margin-bottom:10px;">' + parseFloat(p.price).toLocaleString() + ' جنيه</div>' : '') +
      ((p.stock === 0 || p.stock === '0') ? '<div style="background:#fee2e2;color:#dc2626;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:700;display:inline-block;margin-bottom:10px;">🔴 نفدت الكمية حاليًا</div>' : (p.stock ? '<div style="background:#f0fdf4;color:#16a34a;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:700;display:inline-block;margin-bottom:10px;">📦 متاح: ' + p.stock + ' قطعة</div>' : '')) +
      (p.description ? '<div style="font-size:14px;color:#374151;line-height:1.8;margin-bottom:12px;">' + escapeHtml(p.description) + '</div>' : '') +
      linksHtml +
      (trader ?
        '<div style="background:#f8fafc;border-radius:12px;padding:12px;margin-top:14px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="font-size:24px;">🏪</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:13px;font-weight:900;">' + escapeHtml(trader.shop_name) + '</div>' +
              '<div style="font-size:11px;color:#64748b;">' + trader.subcategory + '</div>' +
              (trader.address ? '<div style="font-size:11px;color:#64748b;margin-top:2px;line-height:1.6;">📍 ' + escapeHtml(trader.address) + '</div>' : '') +
            '</div>' +
          '</div>' +
          (function(){
            var waPhone = '20'+(trader.phone.charAt(0)==='0'?trader.phone.slice(1):trader.phone);
            var waMsg = 'مرحباً، أنا من دليل الحامول 🛍️%0Aعايز أستفسر عن: *'+p.title+'*'+(p.price?'%0Aالسعر المعروض: '+parseFloat(p.price).toLocaleString()+' جنيه':'')+'%0Aمن معرض: '+trader.shop_name;
            return '<a href="https://wa.me/'+waPhone+'?text='+waMsg+'" target="_blank" style="display:block;width:100%;background:#25D366;color:white;padding:13px;border-radius:12px;text-align:center;text-decoration:none;font-size:14px;font-weight:900;margin-top:10px;box-sizing:border-box;">💬 تواصل واتساب بشأن هذا المنتج</a>';
          })() +
        '</div>'
      : '') +
      (trader && trader.map_url ?
        '<a href="'+escapeHtml(safeUrl(trader.map_url))+'" target="_blank" style="display:block;width:100%;margin-top:10px;background:#0369a1;color:white;padding:12px;border-radius:12px;text-align:center;text-decoration:none;font-size:14px;font-weight:900;">🗺️ عرض موقع المعرض على الخريطة</a>'
      : '') +
    '</div>';

  document.body.appendChild(overlay);
  window._pdImgIdx = 0;
  window._pdImgTotal = imgs.length;
}

function switchProdDetailImg(dir) {
  var total = window._pdImgTotal || 1;
  if(dir === -1 || dir === 1) {
    window._pdImgIdx = ((window._pdImgIdx || 0) + dir + total) % total;
  } else {
    window._pdImgIdx = dir; // ضغط على نقطة معينة
  }
  var idx = window._pdImgIdx;
  document.querySelectorAll('#pd_imgs img').forEach(function(img, i){
    img.style.display = i === idx ? 'block' : 'none';
  });
  document.querySelectorAll('.pd_dot').forEach(function(dot, i){
    dot.style.background = i === idx ? '#7c3aed' : '#d1d5db';
  });
}

function renderShopGrid(ads, cat) {
  if(!ads.length) return '<div style="text-align:center;padding:60px 20px;color:var(--gray);"><div style="font-size:48px;margin-bottom:12px;">🛍️</div><p style="font-size:15px;font-weight:700;">مفيش منتجات هنا دلوقتي</p><p style="font-size:13px;margin-top:6px;">كن أول من يضيف منتج!</p></div>';
  const sorted = [...ads].sort((a,b) => (b.sponsored_order||0)-(a.sponsored_order||0));
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 0;">' +
    sorted.map(function(ad) {
      var phone = ad.phone||'';
      if(phone.startsWith('01')) phone = '20'+phone.substring(1);
      var waMsg = encodeURIComponent('أهلاً، أنا مهتم بـ ' + ad.title + (ad.price?' بسعر '+ad.price+' جنيه':'') + ' على دليل الحامول');
      var waUrl = phone ? 'https://wa.me/'+phone+'?text='+waMsg : '#';
      return '<div onclick="openAdDetails(\'' + ad.id + '\')" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer;position:relative;">' +
        (ad.is_sponsored ? '<div style="position:absolute;top:6px;right:6px;background:#7c3aed;color:white;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:900;z-index:1;">ممول</div>' : '') +
        (ad.image_url ? '<img src="'+escapeHtml(safeUrl(ad.image_url))+'" style="width:100%;height:130px;object-fit:cover;display:block;">' :
          '<div style="width:100%;height:130px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:40px;">🛍️</div>') +
        '<div style="padding:8px;">' +
        '<div style="font-size:12px;font-weight:800;color:#1e293b;margin-bottom:4px;line-height:1.3;">' + escapeHtml(ad.title||'') + '</div>' +
        (ad.condition ? '<div style="font-size:10px;color:#64748b;margin-bottom:4px;">' + escapeHtml(ad.condition) + (ad.color?' · 🎨 '+escapeHtml(ad.color):'') + '</div>' : (ad.color ? '<div style="font-size:10px;color:#64748b;margin-bottom:4px;">🎨 '+escapeHtml(ad.color)+'</div>' : '')) +
        (ad.warranty ? '<div style="font-size:10px;color:#166534;margin-bottom:4px;">🛡️ '+escapeHtml(ad.warranty)+'</div>' : '') +
        (ad.price ? '<div style="font-size:16px;font-weight:900;color:#16a34a;margin-bottom:6px;">' + ad.price.toLocaleString('ar-EG') + ' <span style="font-size:11px;">جنيه</span></div>' :
          '<div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:6px;">تواصل للسعر</div>') +
        (ad.quantity ? '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">📦 متاح: '+escapeHtml(ad.quantity)+'</div>' : '') +
        '<a href="' + waUrl + '" target="_blank" onclick="event.stopPropagation();trackStat(\'' + ad.id + '\',\'whatsapp\')" style="display:block;background:#25D366;color:white;border-radius:8px;padding:6px;text-align:center;font-size:12px;font-weight:900;text-decoration:none;">🛒 اطلب دلوقتي</a>' +
        '</div></div>';
    }).join('') + '</div>';
}

function renderAdsList(ads, cat, sub) {
  if(!ads.length) return '<div style="text-align:center;padding:60px 20px;color:var(--gray);"><div style="font-size:48px;margin-bottom:12px;">' + cat.icon + '</div><p style="font-size:15px;font-weight:700;">مفيش إعلانات هنا دلوقتي</p><p style="font-size:13px;margin-top:6px;">كن أول من يضيف إعلان!</p></div>';

  const sorted = cat.id === 'deaths'
    ? [...ads].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) // الوفيات: الأحدث فوق دايمًا، من غير أي ترتيب تاني
    : [...ads].sort((a,b) => {
    if(b.is_sponsored !== a.is_sponsored) return (b.is_sponsored?1:0) - (a.is_sponsored?1:0);
    if(b.is_offer !== a.is_offer) return (b.is_offer?1:0) - (a.is_offer?1:0);
    const so = (b.sponsored_order||0) - (a.sponsored_order||0);
    if(so !== 0) return so;
    return (b.sort_order||0) - (a.sort_order||0);
  });

  return sorted.map((ad, adIdx) => {
    const cardBg = adIdx % 2 === 0 ? 'white' : '#f0f9ff';
    let phone = ad.phone || '';
    if(phone.startsWith('01')) phone = '20' + phone.substring(1);
    const waMsg = encodeURIComponent('أهلاً، أنا مهتم بإعلانك (' + ad.title + ') على دليل الحامول');
    const waUrl = phone ? 'https://wa.me/' + phone + '?text=' + waMsg : '#';
    const date = new Date(ad.created_at).toLocaleDateString('ar-EG');
    const shareMsg = encodeURIComponent('🏪 ' + ad.title + '\n' + (ad.description ? ad.description.substring(0,100) + '...' : '') + '\n\n📲 دليل الحامول: https://souqelhamoul.com');
    const favBg = isFav(ad.id) ? '#fee2e2' : '#f3f4f6';
    const favColor = isFav(ad.id) ? '#dc2626' : '#aaa';
    const adminBtn = isAdmin ? '<button class="btn-del" onclick="deleteAdAdmin(\'' + ad.id + '\')">🗑️</button>' : '';
    const imgHtml = ad.image_url ? '<img src="' + escapeHtml(safeUrl(ad.image_url)) + '" class="ad-img" loading="lazy" onerror="this.style.display=\'none\'" onclick="openAdDetails(\'' + ad.id + '\')">' : '';
    const addrHtml = ad.address ? '<div style="font-size:12px;color:var(--gray);margin-bottom:6px;">📍 ' + escapeHtml(ad.address) + '</div>' : '';
    const subHtml = ad.subcategory ? '<span class="ad-sub-badge">' + escapeHtml(ad.subcategory) + '</span>' : '';
    const salaryHtml = ad.salary ? '<div style="font-size:13px;font-weight:800;color:#1d4ed8;margin-bottom:6px;">💰 ' + escapeHtml(ad.salary) + '</div>' : '';
    const jobStatusHtml = ad.job_status ? '<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">📌 ' + escapeHtml(ad.job_status) + '</div>' : '';
    const lostModeHtml = ad.category === 'lost' ? '<div style="font-size:11px;font-weight:900;color:' + (ad.lost_mode==='found'?'#166534':'#dc2626') + ';margin-bottom:6px;">' + (ad.lost_mode==='found'?'🙂 لقيت حاجة':'😟 فقدت حاجة') + '</div>' : '';
    const rewardHtml = ad.reward ? '<div style="font-size:12px;font-weight:800;color:#c2410c;background:#fff7ed;display:inline-block;padding:2px 10px;border-radius:20px;margin-bottom:6px;">🎁 مكافأة: ' + escapeHtml(ad.reward) + '</div>' : '';
    const funeralHtml = ad.funeral_info ? '<div style="font-size:12px;color:#334155;margin-bottom:4px;">🕌 ' + escapeHtml(ad.funeral_info) + '</div>' : '';
    const condolenceHtml = ad.condolence_info ? '<div style="font-size:12px;color:#334155;margin-bottom:6px;">🤲 ' + escapeHtml(ad.condolence_info) + '</div>' : '';
    const deathDateHtml = ad.death_date ? '<div style="font-size:12px;color:#64748b;margin-bottom:6px;">📅 ' + formatDeathDate(ad.death_date) + '</div>' : '';
    const foodInfoHtml = (ad.opening_hours || ad.delivery) ? '<div style="font-size:12px;color:#854d0e;margin-bottom:6px;">' + (ad.opening_hours?'🕐 '+escapeHtml(ad.opening_hours):'') + (ad.opening_hours&&ad.delivery?' · ':'') + (ad.delivery==='متاح'?'🛵 توصيل متاح':ad.delivery==='غير متاح'?'🚫 بدون توصيل':'') + '</div>' : '';

    const moveBtns = isAdmin ? '<div style="display:flex;gap:3px;">' +
        (adIdx > 0 ? '<button onclick="moveAdOrder(\''+ad.id+'\',\'up\',\''+cat.id+'\',\''+(sub||'').replace(/'/g,"")+'\')" style="background:#334155;color:white;border:none;width:26px;height:26px;border-radius:50%;font-size:12px;cursor:pointer;">⬆️</button>' : '') +
        (adIdx < sorted.length - 1 ? '<button onclick="moveAdOrder(\''+ad.id+'\',\'down\',\''+cat.id+'\',\''+(sub||'').replace(/'/g,"")+'\')" style="background:#334155;color:white;border:none;width:26px;height:26px;border-radius:50%;font-size:12px;cursor:pointer;">⬇️</button>' : '') +
      '</div>' : '';

    const actionBtns = moveBtns + '<button onclick="toggleFav(\'' + ad.id + '\')" style="background:' + favBg + ';color:' + favColor + ';border:none;width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;" id="fav_' + ad.id + '">❤️</button>' +
      '<a href="https://wa.me/?text=' + shareMsg + '" target="_blank" style="background:#dcfce7;color:#166534;border:none;width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;">🔗</a>' +
      adminBtn +
      '<button class="btn-details" onclick="openAdDetails(\'' + ad.id + '\')">التفاصيل</button>' +
      '<a href="' + waUrl + '" target="_blank" class="btn-wa" onclick="trackStat(\'' + ad.id + '\',\'whatsapp\')">💬 واتساب</a>';

    if(ad.is_sponsored) {
      const imgSponsored = ad.image_url ? '<img src="' + escapeHtml(safeUrl(ad.image_url)) + '" class="ad-img" loading="lazy" onerror="this.style.display=\'none\'" onclick="openAdDetails(\'' + ad.id + '\')" style="border-bottom:2px solid #7c3aed;">' : '';
      return '<div class="ad-card" style="border:2px solid #7c3aed;background:linear-gradient(135deg,#faf5ff,#fff);position:relative;overflow:visible;">' +
        '<div style="position:absolute;top:-1px;right:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;padding:3px 14px;border-radius:0 0 10px 10px;font-size:11px;font-weight:900;">📢 إعلان ممول</div>' +
        imgSponsored +
        '<div class="ad-body" style="padding-top:' + (ad.image_url ? '10px' : '22px') + ';">' +
        '<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:4px;">' + cat.icon + ' ' + cat.name + (ad.subcategory ? ' ← ' + escapeHtml(ad.subcategory) : '') + '</div>' +
        '<div class="ad-title" onclick="openAdDetails(\'' + ad.id + '\')" style="color:#4c1d95;">' + escapeHtml(ad.title||'') + '</div>' +
        addrHtml +
        '<div class="ad-desc">' + escapeHtml(ad.description||'') + '</div>' +
        '<div class="ad-footer"><span class="ad-date">' + date + '</span><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' + actionBtns + '</div></div>' +
        '</div></div>';
    }

    if(ad.is_offer) {
      const imgOffer = ad.image_url ? '<img src="' + escapeHtml(safeUrl(ad.image_url)) + '" class="ad-img" loading="lazy" onerror="this.style.display=\'none\'" onclick="openAdDetails(\'' + ad.id + '\')" style="border-bottom:2px solid #f59e0b;">' : '';
      return '<div class="ad-card" style="border:2px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fff);position:relative;overflow:visible;">' +
        '<div style="position:absolute;top:-1px;right:12px;background:#f59e0b;color:white;padding:3px 12px;border-radius:0 0 8px 8px;font-size:11px;font-weight:900;">⭐ إعلان مميز</div>' +
        imgOffer +
        '<div class="ad-body" style="padding-top:' + (ad.image_url ? '10px' : '18px') + ';">' +
        '<div style="font-size:11px;color:#92400e;font-weight:700;margin-bottom:4px;">' + cat.icon + ' ' + cat.name + (ad.subcategory ? ' ← ' + escapeHtml(ad.subcategory) : '') + '</div>' +
        '<div class="ad-title" onclick="openAdDetails(\'' + ad.id + '\')" style="color:#92400e;">' + escapeHtml(ad.title||'') + '</div>' +
        addrHtml +
        '<div class="ad-desc">' + escapeHtml(ad.description||'') + '</div>' +
        '<div class="ad-footer"><span class="ad-date">' + date + '</span><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' + actionBtns + '</div></div>' +
        '</div></div>';
    }

    return '<div class="ad-card" style="background:' + cardBg + ';">' +
      imgHtml +
      '<div class="ad-body">' +
      '<div class="ad-title" onclick="openAdDetails(\'' + ad.id + '\')">' + escapeHtml(ad.title||'') + '</div>' +
      subHtml +
      salaryHtml +
      jobStatusHtml +
      lostModeHtml +
      rewardHtml +
      deathDateHtml +
      foodInfoHtml +
      funeralHtml +
      condolenceHtml +
      addrHtml +
      '<div class="ad-desc">' + escapeHtml(ad.description||'') + '</div>' +
      renderVideoLinks(ad.video_links) +
      '<div class="ad-footer"><span class="ad-date">' + date + '</span><div style="display:flex;gap:6px;align-items:center;">' + actionBtns + '</div></div>' +
      '</div></div>';
  }).join('');
}
function filterAds(catId, sub) {
  const q = document.getElementById('dynSearchInput').value.toLowerCase();
  const cat = CATEGORIES.find(c => c.id === catId);
  let ads = allAds.filter(a => {
    if(a.status !== 'approved' && !isAdmin) return false;
    if(a.category !== catId) return false;
    if(!isAdmin && isAdExpired(a)) return false;
    if(sub && a.subcategory !== sub) return false;
    if(q && !(a.title||'').toLowerCase().includes(q) && !(a.description||'').toLowerCase().includes(q)) return false;
    return true;
  });
  document.getElementById('adsContent').innerHTML = renderAdsList(ads, cat, sub||'');
}

// SHARE FUNCTIONS
function getShareText(adId) {
  const ad = allAds.find(a => a.id === adId);
  if(!ad) return '';
  const cat = CATEGORIES.find(c => c.id === ad.category) || {icon:'📋', name:'عام'};
  return `${cat.icon} ${cat.name}${ad.subcategory?' — '+ad.subcategory:''}\n\n📌 ${ad.title}\n${ad.description?'📝 '+ad.description+'\n':''}📞 ${ad.phone}\n\n🔗 دليل الحامول — souqelhamoul.com`;
}

function formatDeathDate(dateStr) {
  if(!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('ar-EG', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  } catch(e) { return dateStr; }
}

function shareAdWA(adId) {
  trackStat(adId, 'share_wa');
  const ad = allAds.find(a => a.id === adId);
  const cat = ad ? (CATEGORIES.find(c => c.id === ad.category) || {icon:'📋', name:'عام'}) : {icon:'📋', name:'عام'};
  const link = `${SHARE_FN_BASE}/ad/${encodeURIComponent(adId)}`;
  let text;
  if(ad && ad.category === 'deaths' && ad.subcategory !== 'توثيق الراحلين') {
    text = `🕌 إنا لله وإنا إليه راجعون\n\nانتقل إلى رحمة الله تعالى: ${ad.title}\n` +
      (ad.death_date ? `\n📅 ${formatDeathDate(ad.death_date)}` : '') +
      (ad.funeral_info ? `\n⚰️ الجنازة: ${ad.funeral_info}` : '') +
      (ad.condolence_info ? `\n🤲 العزاء: ${ad.condolence_info}` : '') +
      (ad.description ? `\n\n📝 ${ad.description}` : '') +
      `\n\n${ad.phone ? '📞 '+ad.phone+'\n' : ''}🔗 ${link}`;
  } else if(ad && ad.category === 'deaths' && ad.subcategory === 'توثيق الراحلين') {
    text = `🕯️ في ذكرى الفقيد: ${ad.title}\n` +
      (ad.death_date ? `\n📅 تاريخ الوفاة: ${formatDeathDate(ad.death_date)}` : '') +
      (ad.description ? `\n\n📝 ${ad.description}` : '') +
      `\n\n🔗 ${link}`;
  } else {
    text = ad
      ? `${cat.icon} ${cat.name}${ad.subcategory?' — '+ad.subcategory:''}\n\n📌 ${ad.title}\n${ad.description?'📝 '+ad.description+'\n':''}📞 ${ad.phone}\n\n🔗 ${link}`
      : `🔗 ${link}`;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareAdFB(adId) {
  trackStat(adId, 'share_fb');
  const url = encodeURIComponent(`${SHARE_FN_BASE}/ad/${encodeURIComponent(adId)}`);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function copyAdShareLink(adId) {
  const link = `${SHARE_FN_BASE}/ad/${encodeURIComponent(adId)}`;
  const doToast = () => showToast('✅ اتنسخ الرابط! الصقه بنفسك في فيسبوك عشان تطلع الصورة صح');
  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(doToast).catch(()=>fallbackCopy(link, doToast));
  } else {
    fallbackCopy(link, doToast);
  }
}

function copyAdLink(adId) {
  const link = `${SHARE_FN_BASE}/ad/${encodeURIComponent(adId)}`;
  const doToast = () => showToast('✅ اتنسخ الرابط! الصقه في فيسبوك عشان تطلع الصورة صح');
  if(navigator.clipboard) {
    navigator.clipboard.writeText(link).then(doToast);
  } else {
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ اتنسخ الرابط!');
  }
  trackStat(adId, 'share_copy');
}
async function trackStat(adId, eventType) {
  try {
    await fetch(SB_URL+'/rest/v1/ad_stats', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},
      body: JSON.stringify({ad_id:adId, event_type:eventType})
    });
  } catch(e) {}
}

function buildAdDetailHeader(cat, adId, isFavFn) {
  var favBtn = isFavFn(adId) ? '❤️' : '🤍';
  return '<button onclick="history.back()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-size:16px;cursor:pointer;">←</button>' +
    '<span style="color:white;font-size:14px;font-weight:700;">' + cat.icon + ' ' + cat.name + '</span>' +
    '<button id="detFavBtn" onclick="toggleFav(\'' + adId + '\');this.textContent=isFav(\'' + adId + '\')?String.fromCodePoint(0x2764)+String.fromCodePoint(0xFE0F):String.fromCodePoint(0x1F90D);" style="background:transparent;border:none;font-size:22px;cursor:pointer;">' + favBtn + '</button>';
}

function goBackFromAdDetail() {
  window._adDetailOpen = false;
  var page = document.getElementById('dynamicPage');

  var parentState = sessionStorage.getItem('adDetailParent');
  sessionStorage.removeItem('adDetailParent');

  if(parentState) {
    try {
      var ps = JSON.parse(parentState);
      window._restoringFromDetail = true;
      if(ps.type === 'ads') {
        var cat = CATEGORIES.find(function(c){ return c.id === ps.catId; });
        if(cat) { showAdsPage(cat, ps.sub || null); window._restoringFromDetail = false; return; }
      } else if(ps.type === 'ads2') {
        if(ps.catId && ps.childId && ps.subName) { showAdsPageV2(ps.catId, ps.childId, ps.subName); window._restoringFromDetail = false; return; }
      } else if(ps.type === 'subs') {
        var cat2 = CATEGORIES.find(function(c){ return c.id === ps.catId; });
        if(cat2) { showSubsPage(cat2); window._restoringFromDetail = false; return; }
      } else if(ps.type === 'subs2') {
        var parent = CATEGORIES.find(function(c){ return c.id === ps.catId; });
        var child = parent && parent.children ? parent.children.find(function(c){ return c.id === ps.childId; }) : null;
        if(parent && child) { showSubsPageV2(parent, child); window._restoringFromDetail = false; return; }
      } else if(ps.type === 'children') {
        var cat3 = CATEGORIES.find(function(c){ return c.id === ps.catId; });
        if(cat3) { showChildrenPage(cat3); window._restoringFromDetail = false; return; }
      } else if(ps.type === 'shops') {
        showShopsPage(ps.sub, ps.catId || getShopCatId(ps.sub));
        window._restoringFromDetail = false;
        return;
      } else {
        restoreDynState(ps); // بتظبط الـ flag لوحدها وترجعه false في الآخر
        return;
      }
      window._restoringFromDetail = false;
    } catch(e) { window._restoringFromDetail = false; }
  }
  hideDynPage();
}

function handleAdDetailScroll(el) {
  var imgWrap = document.getElementById('adImgWrap');
  var stickyHeader = document.getElementById('adStickyHeader');
  var mainHeader = document.getElementById('adDetailHeader');
  if(!stickyHeader) return;
  var imgHeight = imgWrap ? imgWrap.offsetHeight : 0;
  var scrolled = el.scrollTop > imgHeight - 10;
  stickyHeader.style.display = scrolled ? 'flex' : 'none';
  if(mainHeader) mainHeader.style.display = scrolled ? 'none' : 'flex';
}

async function openAdDetails(adId) {
  trackStat(adId, 'view');
  const ad = allAds.find(a => a.id === adId);
  if(!ad) return;
  const cat = CATEGORIES.find(c => c.id === ad.category) || {icon:'📋', name:''};
  let phone = ad.phone || '';
  if(phone.startsWith('01')) phone = '20'+phone.substring(1);
  const waMsg = encodeURIComponent(`أهلاً، أنا مهتم بإعلانك (${ad.title}) على دليل الحامول`);

  // احفظ الصفحة الحالية كـ parent عشان زرار الرجوع يرجعلها
  // بس مش لو إحنا بنرجع من التفاصيل (عشان ما نعملش loop)
  if(!window._restoringFromDetail) {
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) {
      try {
        sessionStorage.setItem('adDetailParent', currentState);
      } catch(e) {}
    }
  }
  window._restoringFromDetail = false;
  window._adDetailOpen = true;
  sessionStorage.setItem('dynState', JSON.stringify({type:'ad_detail', adId}));
  try{history.pushState({dyn:1,detail:1},'');}catch(e){}

  // جلب الإحصائيات
  let views = 0, waClicks = 0;
  try {
    const stats = await sbFetch('GET', `ad_stats?ad_id=eq.${adId}&select=event_type`);
    if(stats) { views = stats.filter(s=>s.event_type==='view').length; waClicks = stats.filter(s=>s.event_type==='whatsapp').length; }
  } catch(e) {}

  // جلب الصور — مع fallback أقوى
  let images = [];
  try {
    const imgs = await sbFetch('GET', `ad_images?ad_id=eq.${adId}&select=image_url&order=created_at.asc`);
    images = (imgs || []).filter(i => i.image_url);
  } catch(e) {}
  // لو مفيش صور في ad_images، استخدم image_url من الإعلان نفسه
  if(!images.length && ad.image_url) images = [{image_url: ad.image_url}];
  // لو لسه مفيش، جرب تجيب من allAds
  if(!images.length) {
    var adFromAll = allAds.find(function(a){ return a.id === adId; });
    if(adFromAll && adFromAll.image_url) images = [{image_url: adFromAll.image_url}];
  }

  let imgSlider = '';
  if(images.length >= 1) {
    imgSlider = `<div style="position:relative;background:#111;overflow:hidden;">
      <div id="detSliderWrap" style="display:flex;transition:transform .4s;">
        ${images.map(img=>`<img src="${img.image_url}" style="min-width:100%;max-height:260px;object-fit:contain;display:block;cursor:zoom-in;" onclick="zoomImg(${JSON.stringify(img.image_url)})">`).join('')}
      </div>
      ${images.length > 1 ? `<button onclick="detSlide(-1)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);color:white;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:20px;">›</button>
        <button onclick="detSlide(1)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);color:white;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:20px;">‹</button>
        <div style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);color:white;padding:3px 12px;border-radius:20px;font-size:12px;" id="detImgCount">1 / ${images.length}</div>` : ''}
      <div style="position:absolute;bottom:10px;left:10px;display:flex;gap:6px;">
        <button onclick="zoomImg(detCurrentImgUrl())" style="background:rgba(0,0,0,.6);color:white;border:none;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;">🔍</button>
        <a id="detDownloadBtn" href="${images[0]?.image_url||'#'}" download target="_blank" style="background:rgba(0,0,0,.6);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:16px;">⬇️</a>
      </div>
    </div>`;
  }

  const page = document.getElementById('dynamicPage');
  page.innerHTML = '';

  // هيكل الصفحة: header ثابت + scroll area تأخد الباقي
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // ===== header ثابت =====
  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;background:var(--primary);display:flex;align-items:center;justify-content:space-between;padding:12px 16px;';
  hdr.innerHTML = buildAdDetailHeader(cat, adId, isFav);
  wrapper.appendChild(hdr);

  // ===== scroll area =====
  var scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;';

  // ===== الصور =====
  if(imgSlider) {
    var imgDiv = document.createElement('div');
    imgDiv.innerHTML = imgSlider;
    scrollArea.appendChild(imgDiv);
  }

  // ===== المحتوى =====
  var contentDiv = document.createElement('div');
  contentDiv.style.cssText = 'padding:16px;padding-bottom:120px;';
  contentDiv.innerHTML = (function() { return `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <span style="background:var(--primary-light);color:var(--primary);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${cat.icon} ${cat.name}</span>
          ${ad.subcategory?`<span style="background:#f3f4f6;color:#555;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${ad.subcategory}</span>`:''}
          ${ad.is_offer?`<span style="background:#fff7ed;color:var(--orange);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">⭐ عرض مميز</span>`:''}
        </div>
        <h2 style="font-size:18px;font-weight:900;margin-bottom:8px;line-height:1.4;">${escapeHtml(ad.title)||''}</h2>
        <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--gray);">👁️ ${views} مشاهدة</span>
          <span style="font-size:12px;color:var(--gray);">📞 ${waClicks} تواصل</span>
          <span style="font-size:12px;color:var(--gray);">📅 ${new Date(ad.created_at).toLocaleDateString('ar-EG')}</span>
        </div>
        ${(ad.phone||ad.address||ad.subcategory||ad.salary||ad.job_status||ad.consultation_price||ad.reward||ad.category==='lost'||ad.funeral_info||ad.condolence_info||ad.relation||ad.death_date||ad.condition||ad.color||ad.warranty||ad.quantity||ad.opening_hours||ad.delivery)?`<div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:13px;font-weight:900;">ℹ️ معلومات عن النشاط</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${ad.subcategory?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:10px;"><span style="font-size:18px;">🏷️</span><div><div style="font-size:11px;color:#94a3b8;">التخصص</div><div style="font-size:13px;font-weight:700;">${ad.subcategory}</div></div></div>`:''}
            ${ad.consultation_price?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#fef2f2;border-radius:10px;"><span style="font-size:18px;">🩺</span><div><div style="font-size:11px;color:#94a3b8;">سعر الكشف</div><div style="font-size:13px;font-weight:700;color:#991b1b;">${ad.consultation_price} جنيه</div></div></div>`:''}
            ${ad.salary?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#eff6ff;border-radius:10px;"><span style="font-size:18px;">💰</span><div><div style="font-size:11px;color:#94a3b8;">الراتب</div><div style="font-size:13px;font-weight:700;color:#1d4ed8;">${ad.salary}</div></div></div>`:''}
            ${ad.job_status?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:10px;"><span style="font-size:18px;">📌</span><div><div style="font-size:11px;color:#94a3b8;">الحالة</div><div style="font-size:13px;font-weight:700;color:#166534;">${ad.job_status}</div></div></div>`:''}
            ${ad.category==='lost'?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:${ad.lost_mode==='found'?'#f0fdf4':'#fef2f2'};border-radius:10px;"><span style="font-size:18px;">${ad.lost_mode==='found'?'🙂':'😟'}</span><div><div style="font-size:11px;color:#94a3b8;">النوع</div><div style="font-size:13px;font-weight:700;color:${ad.lost_mode==='found'?'#166534':'#dc2626'};">${ad.lost_mode==='found'?'لقيت حاجة':'فقدت حاجة'}</div></div></div>`:''}
            ${ad.reward?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#fff7ed;border-radius:10px;"><span style="font-size:18px;">🎁</span><div><div style="font-size:11px;color:#94a3b8;">مكافأة</div><div style="font-size:13px;font-weight:700;color:#c2410c;">${ad.reward}</div></div></div>`:''}
            ${ad.funeral_info?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f1f5f9;border-radius:10px;"><span style="font-size:18px;">🕌</span><div><div style="font-size:11px;color:#94a3b8;">موعد ومكان الجنازة</div><div style="font-size:13px;font-weight:700;color:#334155;">${ad.funeral_info}</div></div></div>`:''}
            ${ad.condolence_info?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f1f5f9;border-radius:10px;"><span style="font-size:18px;">🤲</span><div><div style="font-size:11px;color:#94a3b8;">مكان العزاء</div><div style="font-size:13px;font-weight:700;color:#334155;">${ad.condolence_info}</div></div></div>`:''}
            ${ad.condition?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:10px;"><span style="font-size:18px;">🏷️</span><div><div style="font-size:11px;color:#94a3b8;">حالة المنتج</div><div style="font-size:13px;font-weight:700;color:#166534;">${ad.condition}</div></div></div>`:''}
            ${ad.color?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:10px;"><span style="font-size:18px;">🎨</span><div><div style="font-size:11px;color:#94a3b8;">اللون</div><div style="font-size:13px;font-weight:700;color:#166534;">${ad.color}</div></div></div>`:''}
            ${ad.warranty?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:10px;"><span style="font-size:18px;">🛡️</span><div><div style="font-size:11px;color:#94a3b8;">الضمان</div><div style="font-size:13px;font-weight:700;color:#166534;">${ad.warranty}</div></div></div>`:''}
            ${ad.quantity?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:10px;"><span style="font-size:18px;">📦</span><div><div style="font-size:11px;color:#94a3b8;">الكمية المتاحة</div><div style="font-size:13px;font-weight:700;color:#166534;">${ad.quantity}</div></div></div>`:''}
            ${ad.relation?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f1f5f9;border-radius:10px;"><span style="font-size:18px;">👤</span><div><div style="font-size:11px;color:#94a3b8;">صلة القرابة</div><div style="font-size:13px;font-weight:700;color:#334155;">${ad.relation}</div></div></div>`:''}
            ${ad.death_date?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f1f5f9;border-radius:10px;"><span style="font-size:18px;">📅</span><div><div style="font-size:11px;color:#94a3b8;">تاريخ الوفاة</div><div style="font-size:13px;font-weight:700;color:#334155;">${formatDeathDate(ad.death_date)}</div></div></div>`:''}
            ${ad.opening_hours?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#fef9c3;border-radius:10px;"><span style="font-size:18px;">🕐</span><div><div style="font-size:11px;color:#94a3b8;">مواعيد العمل</div><div style="font-size:13px;font-weight:700;color:#854d0e;">${escapeHtml(ad.opening_hours)}</div></div></div>`:''}
            ${ad.delivery?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#fef9c3;border-radius:10px;"><span style="font-size:18px;">🛵</span><div><div style="font-size:11px;color:#94a3b8;">التوصيل</div><div style="font-size:13px;font-weight:700;color:#854d0e;">${escapeHtml(ad.delivery)}</div></div></div>`:''}
            ${ad.address?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:10px;cursor:pointer;" onclick="safeUrl(ad.location_url)?window.open(fixMapUrl(ad.location_url),'_blank'):null"><span style="font-size:18px;">📍</span><div><div style="font-size:11px;color:#94a3b8;">العنوان</div><div style="font-size:13px;font-weight:700;">${escapeHtml(ad.address)}</div></div></div>`:''}
            ${ad.phone?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:10px;"><span style="font-size:18px;">📞</span><div><div style="font-size:11px;color:#94a3b8;">التليفون</div><div style="font-size:13px;font-weight:700;" dir="ltr">${escapeHtml(ad.phone)}</div></div></div>`:''}
            ${ad.phone2?`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:10px;"><span style="font-size:18px;">📱</span><div><div style="font-size:11px;color:#94a3b8;">رقم ثاني</div><div style="font-size:13px;font-weight:700;" dir="ltr">${escapeHtml(ad.phone2)}</div></div></div>`:''}
          </div>
        </div>`:''}
        ${ad.description?(()=>{
          // حول النص لـ bullets لو فيه أسطر أو نقاط
          // تقسيم النص لـ bullets — بـ سطر جديد أو نقطة أو فاصلة في النص الطويل
          var rawLines = ad.description.split(/\n|•|\r/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length>2; });
          // لو السطور أكتر من 1 — استخدمها مباشرة
          // لو سطر واحد طويل (أكتر من 80 حرف) — حاول تقسمه على الفواصل والكلمات الرابطة
          var lines = rawLines;
          if(rawLines.length === 1 && rawLines[0].length > 80) {
            lines = rawLines[0].split(/(?<=\s)(?:متابعة|علاج|فحص|توفر|يوجد|إجراء|تقديم|عمل|أحدث|خدمة)|(?:،|,)(?=\s)/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length>3; });
            if(lines.length < 2) lines = rawLines; // لو فشل التقسيم، ارجع للنص الأصلي
          }
          const isList = lines.length > 1;
          const bodyHtml = isList
            ? '<ul style="list-style:none;padding:0;margin:0;">'+lines.map(function(l){ return '<li style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid #f8fafc;font-size:13px;line-height:1.7;"><span style="color:var(--primary);font-size:12px;flex-shrink:0;margin-top:4px;">■</span><span>'+escapeHtml(l)+'</span></li>'; }).join('')+'</ul>'
            : '<p style="font-size:14px;line-height:1.9;margin:0;">'+escapeHtml(ad.description)+'</p>';
          return '<div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:10px;">📋 التفاصيل</div>'+bodyHtml+'</div>';
        })():''}
        ${ad.address?`<div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="font-size:24px;">📍</span><div><div style="font-size:12px;color:var(--gray);font-weight:700;">العنوان</div><div style="font-size:13px;font-weight:600;">${escapeHtml(ad.address)}</div></div></div>`:''}
        <div id="videoLinksSection"></div>
        <div id="reviewsContainer" style="margin-bottom:12px;"></div>
        <div id="similarAdsContainer" style="margin-bottom:12px;"></div>

        <div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:10px;">📤 شارك الإعلان</div>
          <div style="display:flex;gap:8px;">
            <button onclick="shareAdWA('${adId}')" style="flex:1;background:#e8f5ee;color:#1a7a4a;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💬 واتساب</button>
            <button onclick="shareAdFB('${adId}')" style="flex:1;background:#e8f0fb;color:#1877f2;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📘 فيسبوك</button>
            <button onclick="copyAdLink('${adId}')" style="flex:1;background:#f3f4f6;color:var(--dark);border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔗 نسخ</button>
          </div>
        </div>
        ${isAdmin?`<div style="display:flex;gap:8px;">
          <button onclick="toggleOffer('${adId}',${!ad.is_offer});hideDynPage();" style="flex:1;background:${ad.is_offer?'#fee2e2':'#fff7ed'};color:${ad.is_offer?'var(--red)':'var(--orange)'};border:2px solid ${ad.is_offer?'#fca5a5':'#fed7aa'};padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${ad.is_offer?'❌ إلغاء من العروض':'⭐ إضافة للعروض'}</button>
          <button onclick="toggleSponsored('${adId}',${!ad.is_sponsored});hideDynPage();" style="flex:1;background:${ad.is_sponsored?'#ede9fe':'#f5f3ff'};color:${ad.is_sponsored?'#dc2626':'#7c3aed'};border:2px solid ${ad.is_sponsored?'#c4b5fd':'#ddd6fe'};padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${ad.is_sponsored?'❌ إلغاء الممول':'📢 إعلان ممول'}</button>
          <button onclick="if(confirm('تأكيد الحذف؟')){deleteAdAdmin('${adId}');hideDynPage();}" style="background:#fee2e2;color:var(--red);border:none;padding:10px 16px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🗑️ حذف</button>
        </div>`:''}
        ${isOwnerOf(ad)?`<div style="padding:0 16px 8px;display:flex;gap:8px;">
          <button onclick="openEditAd('${adId}')" style="flex:1;background:#eff6ff;color:#2563eb;border:2px solid #bfdbfe;padding:11px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✏️ تعديل الإعلان</button>
          <button onclick="if(confirm('متأكد إنك عايز تحذف الإعلان؟')){deleteMyAd('${adId}');}" style="background:#fee2e2;color:var(--red);border:2px solid #fca5a5;padding:11px 16px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🗑️</button>
        </div>`:''}
        ${isOwnerOf(ad)?`<div style="padding:0 16px 12px;">
          <button onclick="toggleMyAdOffer('${adId}',${!ad.is_offer})" style="width:100%;background:${ad.is_offer?'#fee2e2':'#fff7ed'};color:${ad.is_offer?'var(--red)':'var(--orange)'};border:2px solid ${ad.is_offer?'#fca5a5':'#fed7aa'};padding:11px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${ad.is_offer?'❌ إلغاء من العروض':'⭐ إضافة إعلاني للعروض'}</button>
          <div style="font-size:10.5px;color:#94a3b8;text-align:center;margin-top:5px;line-height:1.6;">⭐ = تمييز الإعلان كـ"عرض" — هيظهر في تاب "العروض" بالصفحة الرئيسية عشان يشوفه أكبر عدد من الناس</div>
        </div>`:''}
      </div>
    </div>
    <div style="position:fixed;bottom:0;left:0;right:0;background:white;padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;z-index:50;box-shadow:0 -2px 10px rgba(0,0,0,.08);">
      <a href="https://wa.me/${phone}?text=${waMsg}" target="_blank" onclick="trackStat('${adId}','whatsapp')"
         style="flex:2;display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;padding:13px;border-radius:12px;font-size:14px;font-weight:900;text-decoration:none;">
        📞 تواصل على واتساب
      </a>
      ${ad.phone2?`<a href="https://wa.me/${ad.phone2.startsWith('0')?'20'+ad.phone2.substring(1):ad.phone2}?text=${waMsg}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#128C7E;color:white;padding:13px;border-radius:12px;font-size:12px;font-weight:700;text-decoration:none;">📱 رقم 2</a>`:''}
      ${ad.location_url?`<a href="${escapeHtml(safeUrl(fixMapUrl(ad.location_url)))}" target="_blank" onclick="trackStat('${adId}','map')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#4285f4;color:white;padding:13px;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;">🗺️ خريطة</a>`:''}
    </div>`;
  })();
  scrollArea.appendChild(contentDiv);
  wrapper.appendChild(scrollArea);
  page.appendChild(wrapper);

  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  // زرار فركة كعب في المطاعم والكافيهات
  var isFood = ad.category && (ad.category.indexOf('food') !== -1 || (ad.subcategory && ad.subcategory.indexOf('food') !== -1));
  var isDoctor = ad.category && (ad.category === 'doctors' || ad.category === 'medservices' || (ad.subcategory && (ad.subcategory === 'doctors' || ad.subcategory === 'medservices')));
  var isHome = ad.category === 'home' || ad.category === 'furniture' || ad.category === 'tech' || ad.category === 'used_market' || ad.category === 'fashion' || ad.category === 'shoes' || ad.category === 'cars_market';
  if(isFood || isDoctor || isHome) {
    var farketLabel = (ad.category === 'doctors') ? '🏥 احجز الآن من فركة كعب — أسهل وأسرع!' : (ad.category === 'home' || ad.category === 'furniture' || ad.category === 'fashion' || ad.category === 'shoes') ? '🛒 اطلب من فركة كعب — أسهل وأسرع!' : (ad.category === 'used_market') ? '📦 محتاج توصيل؟ اطلب فركة كعب! 🛵' : '🛵 اطلب الآن من فركة كعب — أسهل وأسرع!';
    var farketMsg = encodeURIComponent('السلام عليكم فركة كعب 🛵' + ' - أنا شايف إعلان: ' + ad.title + ' - وعايز أطلب منكم');
    var farketBtn = document.createElement('div');
    farketBtn.style.cssText = 'padding:0 16px 80px;';
    farketBtn.innerHTML = '<a href="https://wa.me/201014185158?text=' + farketMsg + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#ff6b35,#f7931e);color:white;padding:13px;border-radius:12px;font-size:14px;font-weight:900;text-decoration:none;margin-top:12px;">' + farketLabel + '</a>';
    scrollArea.appendChild(farketBtn);
  }
  window._detSlideIdx = 0;
  window._detSlideTotal = images.length;
  window._detImages = images;

  // عرض روابط الفيديو بشكل منفصل عشان يشتغل على الموبايل
  const videoSec = document.getElementById('videoLinksSection');
  if(videoSec && ad.video_links) {
    try {
      const vids = JSON.parse(ad.video_links);
      if(vids.length > 0) {
        let html = '<div style="background:white;border-radius:14px;padding:14px;border:1px solid var(--border);margin-bottom:12px;">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:10px;">🎥 روابط الفيديو</div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        vids.forEach(function(v) {
          html += '<a href="' + escapeHtml(safeUrl(v)) + '" target="_blank" style="display:flex;align-items:center;gap:8px;background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:10px;padding:10px 14px;text-decoration:none;font-size:13px;font-weight:700;">';
          html += getVideoIcon(v) + ' ' + getVideoDomain(v);
          html += '</a>';
        });
        html += '</div></div>';
        videoSec.innerHTML = html;
      }
    } catch(e) { console.warn('video_links parse error:', e); }
  }
  // تحميل التقييمات
  setTimeout(() => loadReviews(adId), 100);
  setTimeout(() => loadSimilarAds(adId, ad.category, ad.subcategory), 200);
  // تحديث SEO ديناميكي
  document.title = `${ad.title} — دليل الحامول`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', ad.description||ad.title);
}


function detSlide(dir) {
  let idx = (window._detSlideIdx || 0) + dir;
  const total = window._detSlideTotal || 1;
  if(idx < 0) idx = total-1;
  if(idx >= total) idx = 0;
  window._detSlideIdx = idx;
  const wrap = document.getElementById('detSliderWrap');
  const counter = document.getElementById('detImgCount');
  const dlBtn = document.getElementById('detDownloadBtn');
  if(wrap) wrap.style.transform = `translateX(${idx*100}%)`;
  if(counter) counter.textContent = `${idx+1} / ${total}`;
  // تحديث رابط الداونلود
  if(dlBtn && window._detImages) dlBtn.href = window._detImages[idx]?.image_url || '#';
}

function detCurrentImgUrl() {
  const idx = window._detSlideIdx || 0;
  return window._detImages?.[idx]?.image_url || '';
}

// ZOOM
function zoomImg(url) {
  if(!url) return;
  const overlay = document.createElement('div');
  overlay.id = 'adZoomOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  overlay.innerHTML = `
    <img src="${url}" style="max-width:95vw;max-height:95vh;object-fit:contain;">
    <div style="position:absolute;top:12px;right:12px;display:flex;gap:8px;">
      <a href="${url}" download target="_blank" style="background:rgba(255,255,255,.2);color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:18px;" onclick="event.stopPropagation()">⬇️</a>
      <button onclick="event.stopPropagation();history.back()" style="background:rgba(255,255,255,.2);color:white;border:none;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;">✕</button>
    </div>`;
  overlay.addEventListener('click', () => history.back());
  document.body.appendChild(overlay);
  try{ history.pushState({zoomImg:1},''); }catch(e){}
}

function closeDetails() { document.getElementById('detailsModal').classList.remove('active'); }

// DYNAMIC PAGE CONTROLS
function hideDynPage() {
  // تحقق لو في صفحة أب نرجعلها
  const parentState = sessionStorage.getItem('parentDynState');
  if(parentState) {
    try {
      const ps = JSON.parse(parentState);
      sessionStorage.removeItem('parentDynState');
      restoreDynState(ps);
      return;
    } catch(e) {}
  }
  document.getElementById('dynamicPage').classList.remove('active');
  document.body.style.overflow = '';
  sessionStorage.removeItem('dynState');
  document.title = 'سوق ودليل الحامول — وظائف، عقارات، أطباء وخدمات في مركز الحامول';
}

function restoreDynState(state) {
  if(!state) return;
  window._restoringFromDetail = true;
  if(state.type === 'subs') {
    const cat = CATEGORIES.find(c => c.id === state.catId);
    if(cat) showSubsPage(cat);
  } else if(state.type === 'children') {
    const cat = CATEGORIES.find(c => c.id === state.catId);
    if(cat) showChildrenPage(cat);
  } else if(state.type === 'ads') {
    const cat = CATEGORIES.find(c => c.id === state.catId);
    if(cat) showAdsPage(cat, state.sub || null);
  } else if(state.type === 'subs2') {
    const parent = CATEGORIES.find(c => c.id === state.catId);
    const child = parent?.children?.find(c => c.id === state.childId);
    if(parent && child) showSubsPageV2(parent, child);
  } else if(state.type === 'ads2') {
    if(state.catId && state.childId && state.subName) showAdsPageV2(state.catId, state.childId, state.subName);
  } else if(state.type === 'shops') {
    if(state.sub) showShopsPage(state.sub, state.catId || getShopCatId(state.sub));
  } else if(state.type === 'teacherSub') {
    if(state.sub) showTeacherAds(state.sub);
  } else if(state.type === 'teacherStage') {
    if(state.stageId) showTeacherStage(state.stageId);
  } else if(state.type === 'teacherSecondary') {
    showTeacherSecondary();
  } else if(state.type === 'teacherOtherTypes') {
    showTeacherOtherTypes();
  } else if(state.type === 'teachers_hub') {
    showTeachersHub();
  } else if(state.type === 'weather') {
    showWeatherPage();
  } else if(state.type === 'prayer') {
    showPrayerTimes();
  } else if(state.type === 'doctors') {
    showDoctorsHub();
  } else if(state.type === 'docSub') {
    if(state.sub) showDoctorAds(state.sub);
  } else if(state.type === 'charity') {
    showCharityPage();
  } else if(state.type === 'charityOrgs') {
    showCharityOrgs();
  } else if(state.type === 'charityOrgAds') {
    if(state.sub) showCharityOrgAds(state.sub);
  } else if(state.type === 'charitySub') {
    if(state.sub) showCharityAds(state.sub);
  } else if(state.type === 'more') {
    showMore();
  } else if(state.type === 'about') {
    showAbout();
  } else if(state.type === 'advertise') {
    showAdvertisePage();
  } else {
    document.getElementById('dynamicPage').classList.remove('active');
    document.body.style.overflow = '';
    sessionStorage.removeItem('dynState');
  }
  window._restoringFromDetail = false; // شبكة أمان — لو الدالة المستهدفة معملتش reset بنفسها
}

function toggleDynSearch() {
  const bar = document.getElementById('dynSearchBar');
  if(!bar) return;
  bar.style.display = bar.style.display === 'none' ? 'block' : 'none';
  if(bar.style.display === 'block') bar.querySelector('input').focus();
}

// DELETE AD (ADMIN)
async function deleteAdAdmin(id) {
  if(!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
  try {
    // نستخدم PATCH بدل DELETE عشان يشتغل على الموبايل
    const adRef = allAds.find(a => a.id === id);
    await sbFetch('PATCH', `ads?id=eq.${id}`, {status: 'deleted'});
    try { await sbRPC('admin_log_deletion', {p_table_name: 'ads', p_record_id: id, p_item_label: (adRef && adRef.title) || ''}); } catch(e) {}
    showToast('تم الحذف 🗑️');
    allAds = allAds.filter(a => a.id !== id);
    loadAds();
    try {
      const state = JSON.parse(sessionStorage.getItem('dynState') || '{}');
      if(state.type === 'admin') {
        setTimeout(function(){ showAdminPanel(state.tab || 'pending'); }, 300);
      } else if(state.type === 'doctors' || state.type === 'docSub') {
        setTimeout(function(){ showDoctorsHub(); }, 300);
      } else if(state.type === 'cat') {
        setTimeout(function(){ showCat(state.catId); }, 300);
      } else if(state.type === 'sub') {
        setTimeout(function(){ showSub(state.catId, state.sub); }, 300);
      } else {
        const page = document.getElementById('dynamicPage');
        if(page && page.classList.contains('active')) page.classList.remove('active');
      }
    } catch(e2) {}
  } catch(e) {
    showToast('❌ خطأ في الحذف: ' + (e.message||'').slice(0,40), 'error');
  }
}

// ADD FORM AS FULL PAGE
let addCatId = '', addSubId = '';

// ===== تعديل الإعلان =====
function openEditAd(adId) {
  const ad = allAds.find(a => a.id === adId);
  if(!ad) { showToast('مش لاقي الإعلان', 'error'); return; }
  
  addCatId = ad.category || '';
  addSubId = ad.subcategory || '';
  addSelectedFiles = [];
  
  sessionStorage.setItem('dynState', JSON.stringify({type:'edit', adId}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  
  // نفس فورم الإضافة بس بنملأه ببيانات الإعلان
  // بننادي الفورم مباشرة (المستخدم مسجّل بالفعل لأن زرار التعديل ظهرله)
  openAddModalForm(ad.category || '', ad.subcategory || '', true);
  
  // بعد ما الفورم يفتح نملأه بالبيانات
  setTimeout(function() {
    // العنوان
    var fName = document.getElementById('fTitle');
    if(fName) fName.value = ad.title || '';
    
    // الوصف
    var fDesc = document.getElementById('fDesc');
    if(fDesc) fDesc.value = ad.description || '';
    
    // التليفون
    var fPhone = document.getElementById('fPhone');
    if(fPhone) fPhone.value = ad.phone || '';
    var fPhone2 = document.getElementById('fPhone2');
    if(fPhone2) fPhone2.value = ad.phone2 || '';
    if(ad.phone2) {
      var f2Toggle = document.getElementById('fPhone2Toggle');
      var f2Wrap = document.getElementById('fPhone2Wrap');
      if(f2Toggle) f2Toggle.style.display = 'none';
      if(f2Wrap) f2Wrap.style.display = 'block';
    }
    
    // الموقع (العنوان النصي)
    var fLocation = document.getElementById('fAddress');
    if(fLocation) fLocation.value = ad.location || '';
    
    // رابط الخريطة
    var fMapUrl = document.getElementById('fLocation');
    if(fMapUrl) fMapUrl.value = ad.location_url || '';
    
    // السعر
    var fPrice = document.getElementById('fPrice');
    if(fPrice) fPrice.value = ad.price || '';
    var fPriceOnRequest = document.getElementById('fPriceOnRequest');
    if(fPriceOnRequest) {
      fPriceOnRequest.checked = !!ad.price_on_request;
      if(fPrice) fPrice.disabled = !!ad.price_on_request;
    }

    // بيانات المنتج (الكمية، الحالة، اللون، الضمان) — لسوق المستعمل والمعارض
    var fQty = document.getElementById('fQty');
    if(fQty) fQty.value = ad.quantity != null ? ad.quantity : '';
    var fCondition = document.getElementById('fCondition');
    if(fCondition) fCondition.value = ad.condition || '';
    var fColor = document.getElementById('fColor');
    if(fColor) fColor.value = ad.color || '';
    var fWarranty = document.getElementById('fWarranty');
    if(fWarranty) fWarranty.value = ad.warranty || '';

    // بيانات الوظيفة (الراتب والحالة)
    var fSalary = document.getElementById('fSalary');
    if(fSalary) fSalary.value = ad.salary || '';
    var fJobStatus = document.getElementById('fJobStatus');
    if(fJobStatus) fJobStatus.value = ad.job_status || '';
    var fConsultPrice = document.getElementById('fConsultPrice');
    if(fConsultPrice) fConsultPrice.value = ad.consultation_price || '';

    // بيانات المفقودات (النوع والمكافأة)
    if(document.getElementById('fLostMode')) setLostMode(ad.lost_mode || 'lost');
    var fHasReward = document.getElementById('fHasReward');
    if(fHasReward) {
      fHasReward.checked = !!ad.reward;
      var fRewardAmountWrap = document.getElementById('fRewardAmountWrap');
      if(fRewardAmountWrap) fRewardAmountWrap.style.display = ad.reward ? 'block' : 'none';
    }
    var fRewardAmount = document.getElementById('fRewardAmount');
    if(fRewardAmount) fRewardAmount.value = ad.reward || '';

    // بيانات الوفيات
    var fFuneralInfo = document.getElementById('fFuneralInfo');
    if(fFuneralInfo) fFuneralInfo.value = ad.funeral_info || '';
    var fCondolenceInfo = document.getElementById('fCondolenceInfo');
    if(fCondolenceInfo) fCondolenceInfo.value = ad.condolence_info || '';
    var fRelation = document.getElementById('fRelation');
    if(fRelation) fRelation.value = ad.relation || '';
    var fDeathDate = document.getElementById('fDeathDate');
    if(fDeathDate) fDeathDate.value = ad.death_date || '';
    var fOpeningHours = document.getElementById('fOpeningHours');
    if(fOpeningHours) fOpeningHours.value = ad.opening_hours || '';
    var fDelivery = document.getElementById('fDelivery');
    if(fDelivery) fDelivery.value = ad.delivery || '';
    
    // روابط الفيديو
    fillVideoLinks(ad.video_links);
    
    // القسم والتخصص
    var fCat = document.getElementById('fCat');
    if(fCat && ad.category) { fCat.value = ad.category; updateFSub(); }
    setTimeout(function() {
      var fSub = document.getElementById('fSub');
      if(fSub && ad.subcategory) fSub.value = ad.subcategory;
      updateDescPlaceholder();
      updateJobsUI();
      updateLostUI();
      updateDeathsUI();
      updateDoctorUI();
    }, 100);
    
    // تغيير العنوان والزرار للتعديل
    var header = document.querySelector('.dyn-header span:nth-child(2)');
    if(header) header.textContent = '✏️ تعديل الإعلان';
    
    var submitBtn = document.getElementById('fSubmit');
    if(submitBtn) {
      submitBtn.textContent = '💾 حفظ التعديلات';
      submitBtn.onclick = function() { submitEditAd(adId); };
    }
    
    // إخفاء رسالة المراجعة
    var reviewMsg = submitBtn ? submitBtn.previousElementSibling : null;
    if(reviewMsg) reviewMsg.style.display = 'none';

    // عرض الصورة الحالية لو موجودة
    if(ad.image_url) {
      var imgSection = document.getElementById('fImagesSection') || document.querySelector('[id*="ImgSection"]');
      var prevDiv = document.getElementById('currentImgPreview');
      if(prevDiv) {
        prevDiv.style.cssText = 'margin-bottom:10px;padding:10px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;';
        prevDiv.innerHTML = '<div style="font-size:11px;color:#166534;font-weight:700;margin-bottom:6px;">📷 الصورة الحالية — ستبقى كما هي إن لم تختر صورة جديدة</div><img src="'+ad.image_url+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;" onerror="this.parentElement.style.display:none">';
      }
    }

  }, 150);
}

async function submitEditAd(adId) {
  const btn = document.getElementById('fSubmit');
  if(btn) { btn.textContent = 'جاري الحفظ...'; btn.disabled = true; }
  
  try {
    const title = document.getElementById('fTitle')?.value.trim();
    const desc = document.getElementById('fDesc')?.value.trim();
    const phone = document.getElementById('fPhone')?.value.trim();
    const phone2 = (document.getElementById('fPhone2')?.value || '').trim();
    const location = document.getElementById('fAddress')?.value.trim();
    const locationUrl = document.getElementById('fLocation')?.value.trim();
    const priceOnRequest = document.getElementById('fPriceOnRequest')?.checked || false;
    const price = priceOnRequest ? '' : document.getElementById('fPrice')?.value.trim();
    const cat = document.getElementById('fCat')?.value;
    const sub = document.getElementById('fSub')?.value;
    const salary = document.getElementById('fSalary')?.value.trim();
    const jobStatus = document.getElementById('fJobStatus')?.value;
    
    if(!title) { showToast('اكتب العنوان', 'error'); if(btn){btn.textContent='💾 حفظ التعديلات';btn.disabled=false;} return; }
    
    const curUser = getCurrentUser();
    if(!curUser) { showToast('لازم تسجل الدخول الأول', 'error'); if(btn){btn.textContent='💾 حفظ التعديلات';btn.disabled=false;} return; }

    const updateData = {
      title,
      description: desc || null,
      phone: phone || null,
      phone2: phone2 || null,
      location: location || null,
      location_url: locationUrl || null,
      price: price || null,
      category: cat || null,
      subcategory: sub || null,
      salary: cat === 'jobs' ? (salary || null) : null,
      job_status: cat === 'jobs' ? (jobStatus || null) : null,
    };
    
    // لو في صور جديدة
    let newImages = null;
    let imgUploadFailed = false;
    if(addSelectedFiles.length > 0) {
      const urls = [];
      for(const file of addSelectedFiles) {
        try { const url = await uploadImage(file); urls.push(url); }
        catch(e) { imgUploadFailed = true; console.error('upload image failed:', e.message||e); showToast('⚠️ فشل رفع صورة: ' + (e.message||'').slice(0,60), 'error'); }
      }
      if(urls.length > 0) newImages = urls;
    }
    
    // التعديل بيعدي على معالج آمن في السيرفر بيتأكد إنك صاحب الإعلان فعلاً قبل الحفظ
    try {
      await sbRPC('secure_update_ad', {
        p_token: curUser.token, p_ad_id: adId,
        p_title: updateData.title, p_description: updateData.description,
        p_phone: updateData.phone, p_phone2: updateData.phone2,
        p_location: updateData.location, p_location_url: updateData.location_url,
        p_price: updateData.price, p_category: updateData.category, p_subcategory: updateData.subcategory,
        p_images: null,
        p_image_url: (newImages && newImages.length) ? newImages[0] : null
      });
    } catch(rrErr) {
      const rm = (rrErr.message||'');
      const m = rm.indexOf('NOT_OWNER') !== -1 ? 'الإعلان ده مش بتاعك' : rm.indexOf('INVALID_SESSION') !== -1 ? 'سجل دخولك تاني' : 'حصل خطأ';
      showToast('❌ ' + m, 'error');
      if(btn){btn.textContent='💾 حفظ التعديلات';btn.disabled=false;} return;
    }
    // تحديث جدول الصور المتعددة (لو فيه صور جديدة)
    if(newImages && newImages.length) {
      try {
        await sbRPC('secure_update_ad_images', {p_token: curUser.token, p_ad_id: adId, p_image_urls: newImages});
        showToast('✅ تم تحديث الصور');
      } catch(imgSaveErr) {
        console.error('image save to ads failed:', imgSaveErr.message||imgSaveErr);
        showToast('⚠️ فشل حفظ الصورة الرئيسية: ' + (imgSaveErr.message||'').slice(0,60), 'error');
      }
    }

    // تحديث روابط الفيديو
    try {
      const vids = getVideoLinks();
      await sbFetch('PATCH', `ads?id=eq.${adId}`, {video_links: vids.length > 0 ? JSON.stringify(vids) : null});
    } catch(e){ console.error('video_links save failed:', e.message || e); showToast('⚠️ الإعلان اتحفظ بس الفيديو مش', 'error'); }

    // تحديث الراتب وحالة الباحث عن عمل (لأقسام الوظائف فقط)
    if(cat === 'jobs') {
      try {
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {salary: salary || null, job_status: jobStatus || null});
      } catch(e){ console.error('salary/job_status save failed:', e.message || e); }
    }

    // تحديث سعر الكشف (لقسم الأطباء فقط)
    if(cat === 'doctors') {
      try {
        const consultPrice = document.getElementById('fConsultPrice')?.value.trim() || null;
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {consultation_price: consultPrice});
      } catch(e){ console.error('consultation_price save failed:', e.message || e); }
    }

    // تحديث نوع المفقود والمكافأة (لقسم المفقودات فقط)
    if(cat === 'lost') {
      try {
        const lostMode = document.getElementById('fLostMode')?.value || 'lost';
        const reward = document.getElementById('fHasReward')?.checked ? (document.getElementById('fRewardAmount')?.value.trim() || null) : null;
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {lost_mode: lostMode, reward: reward});
      } catch(e){ console.error('lost_mode/reward save failed:', e.message || e); }
    }

    // تحديث بيانات الجنازة والعزاء (لنعي ووفيات بس، مش توثيق الراحلين)
    if(cat === 'deaths' && getDeathsMode() === 'announce') {
      try {
        const funeralInfo = document.getElementById('fFuneralInfo')?.value.trim() || null;
        const condolenceInfo = document.getElementById('fCondolenceInfo')?.value.trim() || null;
        const relation = document.getElementById('fRelation')?.value || null;
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {funeral_info: funeralInfo, condolence_info: condolenceInfo, relation: relation});
      } catch(e){ console.error('funeral/condolence save failed:', e.message || e); }
    }

    // تحديث تاريخ الوفاة (وفيات الحامول وتوثيق الراحلين مع بعض)
    if(cat === 'deaths') {
      try {
        const deathDate = document.getElementById('fDeathDate')?.value || null;
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {death_date: deathDate});
      } catch(e){ console.error('death_date save failed:', e.message || e); }
    }

    // تحديث مواعيد العمل والتوصيل (مطاعم وكافيهات فقط)
    if(cat === 'food') {
      try {
        const openingHours = document.getElementById('fOpeningHours')?.value.trim() || null;
        const delivery = document.getElementById('fDelivery')?.value || null;
        await sbFetch('PATCH', `ads?id=eq.${adId}`, {opening_hours: openingHours, delivery: delivery});
      } catch(e){ console.error('opening_hours/delivery save failed:', e.message || e); }
    }

    // تحديث "تواصل للسعر" (لأقسام سوق المستعمل والمعارض)
    try {
      await sbFetch('PATCH', `ads?id=eq.${adId}`, {price_on_request: priceOnRequest});
    } catch(e){ console.error('price_on_request save failed:', e.message || e); }

    // تحديث بيانات المنتج (الكمية، الحالة، اللون، الضمان)
    try {
      const qtyVal = document.getElementById('fQty')?.value;
      const conditionVal = document.getElementById('fCondition')?.value || null;
      const colorVal = document.getElementById('fColor')?.value.trim() || null;
      const warrantyVal = document.getElementById('fWarranty')?.value.trim() || null;
      await sbFetch('PATCH', `ads?id=eq.${adId}`, {
        quantity: qtyVal ? parseInt(qtyVal) : null,
        condition: conditionVal,
        color: colorVal,
        warranty: warrantyVal
      });
    } catch(e){ console.error('product fields save failed:', e.message || e); }
    
    // تحديث allAds
    const idx = allAds.findIndex(a => a.id === adId);
    if(idx !== -1) allAds[idx] = {...allAds[idx], ...updateData, ...(newImages?{image_url:newImages[0], images:newImages}:{})};
    
    showToast('✅ تم التعديل بنجاح!');
    hideDynPage();
    loadAds();
    
  } catch(e) {
    showToast('❌ خطأ في التعديل، حاول تاني', 'error');
    if(btn) { btn.textContent = '💾 حفظ التعديلات'; btn.disabled = false; }
  }
}

// حذف إعلان بمعرفة صاحبه — بيتأكد من الملكية جوه قاعدة البيانات
async function deleteMyAd(adId) {
  const curUser = getCurrentUser();
  if(!curUser) { showToast('لازم تسجل الدخول', 'error'); return; }
  try {
    await sbRPC('secure_delete_ad', {p_token: curUser.token, p_ad_id: adId});
    showToast('🗑️ تم حذف الإعلان');
    hideDynPage();
    loadAds();
  } catch(e) {
    const m = (e.message||'').indexOf('NOT_OWNER')!==-1 ? 'الإعلان ده مش بتاعك' : 'حصل خطأ في الحذف';
    showToast('❌ ' + m, 'error');
  }
}

function openAddModal(catId='', sub='') {
  // زرار "+" العام في الشريط السفلي بقى بس لتسجيل حساب جديد — مش لإضافة مواضيع
  if(!catId) {
    if(getCurrentUser()) { updateNavAddVisibility(); return; }
    requireLogin().then(function(){
      window._justRegisteredNow = false;
      updateNavAddVisibility();
    });
    return;
  }
  requireLogin().then(function(){
    window._justRegisteredNow = false;
    openAddModalForm(catId, sub);
  });
}

// يخفي زرار "+" العام من الشريط السفلي لو المستخدم عامل حساب بالفعل (مبقاش له لازمة بعد التسجيل)
function updateNavAddVisibility() {
  try {
    var el = document.querySelector('.nav-add');
    if(el) el.style.display = getCurrentUser() ? 'none' : 'flex';
  } catch(e) {}
  refreshNotifBadge();
}

// ============ نظام الإشعارات ============
function getMyTraderSessions() {
  var sessions = [];
  try {
    for(var i=0; i<localStorage.length; i++) {
      var key = localStorage.key(i);
      var m = key && key.match(/^my_shop_phone_(.+)$/);
      if(m) {
        var traderId = m[1];
        var phone = localStorage.getItem(key);
        var passHash = localStorage.getItem('my_shop_pass_'+traderId);
        if(phone && passHash) sessions.push({traderId: traderId, phone: phone, passHash: passHash});
      }
    }
  } catch(e) {}
  return sessions;
}

async function getTraderNewCommentsCount(traderId) {
  try {
    var rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=last_comments_seen_at&limit=1');
    var lastSeen = (rows && rows[0] && rows[0].last_comments_seen_at) || '1970-01-01';
    var comments = await sbFetch('GET', 'shop_comments?trader_id=eq.'+traderId+'&created_at=gt.'+encodeURIComponent(lastSeen)+'&select=id');
    return (comments || []).length;
  } catch(e) { return 0; }
}

async function refreshNotifBadge() {
  const btn = document.getElementById('notifBellBtn');
  const badge = document.getElementById('notifBadge');
  const u = getCurrentUser();
  const traderSessions = getMyTraderSessions();
  if(!(u && u.token) && !traderSessions.length) { if(btn) btn.style.display = 'none'; return; }
  if(btn) btn.style.display = 'flex';
  let count = 0;
  try {
    if(u && u.token) count += await sbRPC('get_unread_notifications_count', {p_token: u.token});
    for(const s of traderSessions) count += await getTraderNewCommentsCount(s.traderId);
  } catch(e) {}
  if(badge) {
    if(count > 0) { badge.style.display = 'flex'; badge.textContent = count > 99 ? '99+' : count; }
    else { badge.style.display = 'none'; }
  }
}

if(!window._notifPollStarted) {
  window._notifPollStarted = true;
  setInterval(refreshNotifBadge, 30000);
}

// بيدوس فعليًا على نفس زرار "←" الموجود فوق في الصفحة الحالية — عشان يشتغل بنفس الطريقة المضمونة بالظبط
// (window._restoringFromDetail=true بيمنع الصفحة اللي بنرجعلها من تسجيل نفسها في التاريخ من جديد، عشان رصيد الرجوع مايتراكمش)
function clickRealBackButton() {
  var realBackBtn = document.querySelector('#dynamicPage .dyn-back');
  window._restoringFromDetail = true;
  if(realBackBtn) { realBackBtn.click(); }
  else { hideDynPage(); }
  window._restoringFromDetail = false;
}

async function openNotificationsPanel() {
  const u = getCurrentUser();
  const traderSessions = getMyTraderSessions();
  if(!(u && u.token) && !traderSessions.length) { showToast('سجّل دخولك الأول', 'error'); return; }
  let existing = document.getElementById('notifModal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'notifModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;width:100%;max-width:480px;max-height:80vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee;">
        <strong style="font-size:16px;">🔔 الإشعارات</strong>
        <div style="display:flex;gap:10px;align-items:center;">
          <button onclick="markAllNotifsRead()" style="background:none;border:none;color:#0f766e;font-size:12px;font-weight:700;cursor:pointer;">تعليم الكل كمقروء</button>
          <button onclick="document.getElementById('notifModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
        </div>
      </div>
      <div id="notifList" style="overflow-y:auto;padding:8px;">
        <div style="text-align:center;color:#999;padding:30px;">جاري التحميل...</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target === modal) modal.remove(); });
  loadNotificationsList();
}

async function loadNotificationsList() {
  const list = document.getElementById('notifList');
  if(!list) return;
  const u = getCurrentUser();
  const traderSessions = getMyTraderSessions();
  try {
    let notifs = [];
    if(u && u.token) {
      notifs = await sbRPC('get_my_notifications', {p_token: u.token});
      sbRPC('ack_broadcasts', {p_token: u.token}).then(refreshNotifBadge).catch(()=>{});
    }
    let traderItems = [];
    for(const s of traderSessions) {
      try {
        const rows = await sbFetch('GET', 'shop_traders?id=eq.'+s.traderId+'&select=shop_name,last_comments_seen_at&limit=1');
        const trader = rows && rows[0]; if(!trader) continue;
        const lastSeen = trader.last_comments_seen_at || '1970-01-01';
        const comments = await sbFetch('GET', 'shop_comments?trader_id=eq.'+s.traderId+'&created_at=gt.'+encodeURIComponent(lastSeen)+'&order=created_at.desc&limit=10');
        (comments||[]).forEach(c => traderItems.push({
          id: c.id, type: 'shop_comment',
          title: '💬 كومنت جديد على ' + trader.shop_name,
          body: (c.author_name||'زائر') + (c.rating ? ' ' + '⭐'.repeat(c.rating) : '') + (c.body ? ': ' + c.body : ''),
          created_at: c.created_at, is_read: false, _traderId: s.traderId
        }));
      } catch(e) {}
    }
    const all = (notifs||[]).concat(traderItems).sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    if(!all.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">مفيش إشعارات لسه</div>';
      return;
    }
    list.innerHTML = all.map(n => {
      let d = '';
      try { d = new Date(n.created_at).toLocaleDateString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){}
      const clickArg = n.type === 'shop_comment'
        ? `handleTraderNotifClick('${n._traderId}')`
        : `handleNotifClick('${n.id}','${n.link_type||''}','${n.link_id||''}')`;
      return `<div onclick="${clickArg}"
                style="padding:12px;border-radius:10px;margin-bottom:6px;cursor:pointer;background:${n.is_read?'#fff':'#f0fdfa'};border:1px solid ${n.is_read?'#eee':'#99f6e4'};">
        <div style="font-weight:800;font-size:13px;color:#111;margin-bottom:3px;">${!n.is_read?'🟢 ':''}${escapeHtml(n.title)}</div>
        <div style="font-size:12.5px;color:#444;line-height:1.6;">${escapeHtml(n.body||'')}</div>
        <div style="font-size:10px;color:#999;margin-top:4px;">${d}</div>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">تعذّر تحميل الإشعارات</div>';
  }
}

async function handleTraderNotifClick(traderId) {
  const modal = document.getElementById('notifModal');
  if(modal) modal.remove();
  const phone = localStorage.getItem('my_shop_phone_'+traderId);
  const passHash = localStorage.getItem('my_shop_pass_'+traderId);
  try { await sbRPC('secure_ack_shop_comments', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId}); } catch(e) {}
  refreshNotifBadge();
  try {
    const rows = await sbFetch('GET', 'shop_traders?id=eq.'+traderId+'&select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&limit=1');
    if(rows && rows[0]) showShopDashboard(rows[0]);
  } catch(e) {}
}

async function handleNotifClick(notifId, linkType, linkId) {
  const u = getCurrentUser();
  try { await sbRPC('mark_notification_read', {p_token: u.token, p_notification_id: notifId}); } catch(e) {}
  refreshNotifBadge();
  const modal = document.getElementById('notifModal');
  if(modal) modal.remove();
  if(linkType === 'ad' && linkId) { try { openAdDetails(linkId); } catch(e) {} }
  else if(linkType === 'post' && linkId) { try { loadPostDetail(linkId); } catch(e) {} }
}

async function markAllNotifsRead() {
  const u = getCurrentUser();
  if(!u || !u.token) return;
  try {
    await sbRPC('mark_all_notifications_read', {p_token: u.token});
    refreshNotifBadge();
    loadNotificationsList();
  } catch(e) {}
}

function dismissBroadcast(id, btn) {
  var dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts')||'[]'); } catch(e) {}
  if(dismissed.indexOf(id) === -1) dismissed.push(id);
  try { localStorage.setItem('dismissed_broadcasts', JSON.stringify(dismissed.slice(-50))); } catch(e) {}
  var row = btn.parentElement;
  if(row) row.remove();
}

async function sendAdminBroadcast() {
  const title = document.getElementById('bcTitle')?.value.trim();
  const body = document.getElementById('bcBody')?.value.trim();
  if(!title) { showToast('اكتب عنوان الرسالة', 'error'); return; }
  const btn = document.getElementById('bcSendBtn');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...'; }
  try {
    await sbRPC('admin_send_broadcast', {p_title: title, p_body: body || null});
    showToast('✅ اتبعتت الرسالة للجميع');
    document.getElementById('bcTitle').value = '';
    document.getElementById('bcBody').value = '';
  } catch(e) {
    showToast('❌ حصل خطأ في الإرسال', 'error');
  }
  if(btn) { btn.disabled = false; btn.textContent = '📣 إرسال للجميع'; }
}

// الأقسام دي "معارض" فقط — أصحابها لازم يسجلوا نشاطهم بزرار "سجّل نشاطك" مش عن طريق فورم الإعلان العادي
// (لو اتضاف إعلان عادي في الأقسام دي مش هيظهر أبدًا للزوار لأن صفحة العرض بتقرا من جدول المعارض بس)
const SHOP_ONLY_CAT_IDS = ['online','cars_market','fashion','shoes','furniture','home','tech','agri','events','ads','medservices','sports','salon','gold','building','fun'];
// "بيت الحلال" نظام مستقل بجدول بيانات خاص بيه (marriage_profiles) — التسجيل فيه لازم يكون من فورمه وزراره الخاص بس
const STANDALONE_FORM_CAT_IDS = ['marriage'];

function openAddModalForm(catId='', sub='', isEdit=false) {
  // لو حد وصل بلينك قديم أو زرار قديم لقسم من أقسام المعارض، حوّله لصفحة تسجيل النشاط بدل الفورم العادي
  // (ما ينفعش يمنع فتح فورم تعديل إعلان قديم مسجل أصلاً في قسم زي ده)
  if(!isEdit && SHOP_ONLY_CAT_IDS.indexOf(catId) !== -1) {
    hideDynPage();
    showToast('🏪 القسم ده للمعارض بس — سجّل نشاطك من زرار "سجّل نشاطك"');
    const cat = CATEGORIES.find(c => c.id === catId);
    if(cat) showSubsPage(cat);
    return;
  }
  if(!isEdit && catId === 'marriage') {
    hideDynPage();
    showToast('💍 بيت الحلال ليه فورم تسجيل خاص بيه — سجّل من زرار "سجّل" جوه القسم');
    showMarriagePage();
    return;
  }
  addCatId = catId; addSubId = sub;
  addSelectedFiles = [];
  const currentDynState = sessionStorage.getItem('dynState');
  if(currentDynState) sessionStorage.setItem('parentDynState', currentDynState);
  sessionStorage.setItem('dynState', JSON.stringify({type:'add', catId, sub}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>📢 إضافة إعلان جديد</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px;">

      <!-- خطوة 1: القسم -->
      <div style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;color:var(--primary);margin-bottom:12px;">1️⃣ اختر القسم والتخصص</div>
        <div class="fg" style="margin-bottom:10px;">
          <label>القسم *</label>
          <select id="fCat" onchange="updateFSub()" style="font-size:14px;">
            ${CATEGORIES.filter(c=>SHOP_ONLY_CAT_IDS.indexOf(c.id)===-1 && STANDALONE_FORM_CAT_IDS.indexOf(c.id)===-1).map(c=>`<option value="${c.id}" ${c.id===catId?'selected':''}>${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="fg" id="fSubWrap" style="margin-bottom:0;">
          <label id="fSubLabel">التخصص</label>
          <select id="fSub" onchange="updateTitlePlaceholder();updateDescPlaceholder();updateJobsUI();updateLostUI();updateDeathsUI();updateDoctorUI();" style="font-size:14px;"></select>
        </div>
        <div onclick="hideDynPage();showHome();" style="margin-top:10px;background:#f5f3ff;border:1.5px dashed #7c3aed;border-radius:10px;padding:10px 12px;font-size:12px;color:#5b21b6;cursor:pointer;text-align:center;font-weight:700;">
          🏪 عندك محل / معرض / نشاط تجاري؟ سجّله من قسمه مباشرة بزرار "سجّل نشاطك"
        </div>
      </div>

      <!-- خطوة 2: التفاصيل -->
      <div style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;color:var(--primary);margin-bottom:12px;">2️⃣ تفاصيل الإعلان</div>
        <div class="fg">
          <label id="fTitleLabel">عنوان الإعلان *</label>
          <input type="text" id="fTitle" placeholder="اكتب عنوان إعلانك هنا" style="font-size:14px;">
        </div>
        <div class="fg">
          <label id="fDescLabel">التفاصيل</label>
          <textarea id="fDesc" rows="6" placeholder="اكتب كل خدمة أو معلومة في سطر لوحده — كل معلومة في سطر" onkeydown="autoListOnEnter(event,this)" oninput="document.getElementById('fDescCounter').textContent=this.value.length+' حرف'" style="font-size:14px;"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <div id="fDescHint" style="font-size:11px;color:#94a3b8;padding-right:4px;">💡 اكتب كل خدمة أو معلومة في سطر منفصل — هتظهر منظمة كأيقونات بالتطبيق</div>
            <div id="fDescCounter" style="font-size:11px;color:#cbd5e1;flex-shrink:0;padding-left:4px;">0 حرف</div>
          </div>
        </div>

        <!-- حقول المفقودات (تظهر بس في قسم مفقودات) -->
        <div id="lostFields" style="display:none;">
          <div style="background:#fff7ed;border-radius:12px;padding:12px;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:900;color:#9a3412;margin-bottom:10px;">🔎 إيه الموضوع؟</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <button type="button" id="fLostModeBtnLost" onclick="setLostMode('lost')" style="flex:1;padding:10px;border-radius:10px;border:2px solid #f87171;background:#fee2e2;color:#dc2626;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">😟 فقدت حاجة</button>
              <button type="button" id="fLostModeBtnFound" onclick="setLostMode('found')" style="flex:1;padding:10px;border-radius:10px;border:2px solid #e5e7eb;background:white;color:#64748b;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">🙂 لقيت حاجة</button>
            </div>
            <input type="hidden" id="fLostMode" value="lost">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="fRewardCheckWrap">
              <input type="checkbox" id="fHasReward" onchange="document.getElementById('fRewardAmountWrap').style.display=this.checked?'block':'none'" style="width:18px;height:18px;accent-color:#dc2626;">
              <span style="font-size:13px;font-weight:700;color:#374151;">🎁 هعرض مكافأة مالية لمن يجدها</span>
            </label>
            <div id="fRewardAmountWrap" style="display:none;margin-top:8px;">
              <input type="text" id="fRewardAmount" placeholder="مثال: 100 جنيه أو حسب الاتفاق" style="width:100%;padding:8px;border:1px solid #fdba74;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
          </div>
        </div>

        <!-- حقول المطاعم والكافيهات -->
        <div id="foodFields" style="display:none;">
          <div style="background:#fef9c3;border-radius:12px;padding:12px;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:900;color:#854d0e;margin-bottom:10px;">🍽️ بيانات إضافية</div>
            <div class="fg" style="margin-bottom:10px;">
              <label style="font-size:11px;color:#713f12;font-weight:700;display:block;margin-bottom:4px;">مواعيد العمل (اختياري)</label>
              <input type="text" id="fOpeningHours" placeholder="مثال: يوميًا من 12 ظهرًا لـ 2 فجرًا" style="width:100%;padding:8px;border:1px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:11px;color:#713f12;font-weight:700;display:block;margin-bottom:4px;">التوصيل متاح؟</label>
              <select id="fDelivery" style="width:100%;padding:8px;border:1px solid #fde047;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;background:white;">
                <option value="">-- اختر --</option>
                <option value="متاح">🛵 متاح</option>
                <option value="غير متاح">🚫 غير متاح — استلام بس</option>
              </select>
            </div>
          </div>
        </div>

        <!-- حقول الوفيات (تظهر بس في قسم الوفيات) -->
        <!-- تاريخ الوفاة (يظهر في وفيات الحامول وتوثيق الراحلين) -->
        <div id="deathDateField" style="display:none;margin-bottom:12px;">
          <div class="fg" style="margin-bottom:0;">
            <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">تاريخ الوفاة (اختياري)</label>
            <input type="date" id="fDeathDate" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
          </div>
        </div>

        <!-- حقول وفيات الحامول -->
        <div id="deathsFields" style="display:none;">
          <div style="background:#f1f5f9;border-radius:12px;padding:12px;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:900;color:#334155;margin-bottom:10px;">🕌 بيانات النعي</div>
            <div class="fg" style="margin-bottom:10px;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">صلة القرابة (اختياري)</label>
              <select id="fRelation" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;background:white;">
                <option value="">-- اختر صلة القرابة --</option>
                <option value="ابن/ابنة المتوفى">ابن/ابنة المتوفى</option>
                <option value="زوج/زوجة المتوفى">زوج/زوجة المتوفى</option>
                <option value="أخ/أخت المتوفى">أخ/أخت المتوفى</option>
                <option value="أحد أقارب المتوفى">أحد أقارب المتوفى</option>
                <option value="أحد معارف المتوفى">أحد معارف المتوفى</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div class="fg" style="margin-bottom:10px;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">موعد ومكان الجنازة (اختياري)</label>
              <input type="text" id="fFuneralInfo" placeholder="مثال: عصر اليوم بعد صلاة العصر، من مسجد النور" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">مكان العزاء (اختياري)</label>
              <input type="text" id="fCondolenceInfo" placeholder="مثال: عزاء الرجال بمنزل العائلة من الساعة 4 لـ 7 مساءً" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
          </div>
        </div>

        <!-- حقول توثيق الراحلين -->
        <div id="memorialFields" style="display:none;">
          <div style="background:#f5f3ff;border-radius:12px;padding:12px;margin-bottom:4px;border:1px dashed #c4b5fd;">
            <div style="font-size:13px;font-weight:900;color:#6d28d9;margin-bottom:6px;">🕯️ تخليد الذكرى</div>
            <div style="font-size:12px;color:#5b21b6;line-height:1.7;">ارفع صور أو فيديوهات للفقيد في قسم الصور تحت، واكتب كلمة أو ذكرى عنه في التفاصيل — هيفضل محفوظ هنا يقدر أي حد يرجع يتصفحه.</div>
          </div>
        </div>

        <!-- حقول الوظائف (تظهر بس في قسم الوظائف) -->
        <div id="jobsFields" style="display:none;">
          <div style="background:#eff6ff;border-radius:12px;padding:12px;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:900;color:#1e40af;margin-bottom:10px;" id="jobsFieldsTitle">💼 بيانات الوظيفة</div>
            <div class="fg" style="margin-bottom:10px;">
              <label id="fSalaryLabel" style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">الراتب المتوقع / المعروض</label>
              <input type="text" id="fSalary" placeholder="مثال: 3000 جنيه أو يحدد بالمقابلة" style="width:100%;padding:8px;border:1px solid #bfdbfe;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
            <div class="fg" id="fJobStatusWrap" style="margin-bottom:0;display:none;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">الحالة</label>
              <select id="fJobStatus" style="width:100%;padding:8px;border:1px solid #bfdbfe;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;background:white;">
                <option value="">-- اختر حالتك --</option>
                <option value="متاح فوراً">🟢 متاح فوراً</option>
                <option value="يبحث عن عمل">🔵 يبحث عن عمل</option>
                <option value="متاح للمقابلات">🟡 متاح للمقابلات</option>
              </select>
            </div>
          </div>
        </div>

        <!-- حقل سعر الكشف (يظهر بس في قسم الأطباء) -->
        <div id="doctorFields" style="display:none;">
          <div style="background:#fee2e2;border-radius:12px;padding:12px;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:900;color:#991b1b;margin-bottom:10px;">🩺 بيانات الكشف</div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">سعر الكشف (اختياري)</label>
              <input type="text" id="fConsultPrice" placeholder="مثال: 150 جنيه — سيبها فاضية لو مش عايز تحددها" style="width:100%;padding:8px;border:1px solid #fca5a5;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
          </div>
        </div>


        <!-- حقول المتجر -->
        <div id="shopFields" style="display:none;">
          <div style="background:#f0fdf4;border-radius:12px;padding:12px;margin-top:4px;">
            <div style="font-size:13px;font-weight:900;color:#166534;margin-bottom:10px;">🛍️ بيانات المنتج</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">💰 السعر</label>
                <div style="display:flex;align-items:center;border:1px solid #d1fae5;border-radius:8px;overflow:hidden;background:white;">
                  <input type="number" id="fPrice" placeholder="0" min="0" style="flex:1;padding:8px;border:none;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;width:100%;">
                  <span style="padding:0 8px;color:#16a34a;font-weight:900;font-size:13px;">ج</span>
                </div>
                <label style="display:flex;align-items:center;gap:5px;margin-top:5px;cursor:pointer;">
                  <input type="checkbox" id="fPriceOnRequest" onchange="var p=document.getElementById('fPrice'); p.disabled=this.checked; if(this.checked) p.value='';" style="width:14px;height:14px;accent-color:#16a34a;">
                  <span style="font-size:11px;color:#64748b;">💬 تواصل للسعر</span>
                </label>
              </div>
              <div>
                <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">📦 الكمية المتاحة</label>
                <input type="number" id="fQty" placeholder="مثال: 10" min="1" style="width:100%;padding:8px;border:1px solid #d1fae5;border-radius:8px;font-family:Cairo,sans-serif;font-size:14px;box-sizing:border-box;background:white;">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">🏷️ حالة المنتج</label>
                <select id="fCondition" style="width:100%;padding:8px;border:1px solid #d1fae5;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;background:white;">
                  <option value="">-- اختر --</option>
                  <option value="جديد">✨ جديد</option>
                  <option value="كسر زيرو">📦 كسر زيرو</option>
                  <option value="مستعمل بحالة جيدة">👍 مستعمل بحالة جيدة</option>
                  <option value="مستعمل بحالة متوسطة">🔄 مستعمل بحالة متوسطة</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">🎨 اللون (اختياري)</label>
                <input type="text" id="fColor" placeholder="مثال: أسود" style="width:100%;padding:8px;border:1px solid #d1fae5;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
              </div>
            </div>
            <div class="fg" style="margin-bottom:0;">
              <label style="font-size:11px;color:#374151;font-weight:700;display:block;margin-bottom:4px;">🛡️ الضمان (اختياري)</label>
              <input type="text" id="fWarranty" placeholder="مثال: سنة ضمان وكيل، أو بدون ضمان" style="width:100%;padding:8px;border:1px solid #d1fae5;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">
            </div>
          </div>
        </div>
        <div class="fg" style="margin-bottom:0;">
          <label id="fPhoneLabel">رقم التليفون / واتساب *</label>
          <input type="tel" id="fPhone" placeholder="01xxxxxxxxx" maxlength="11" oninput="this.value=this.value.replace(/[^0-9]/g,'')" style="font-size:16px;letter-spacing:2px;">
        </div>
        <div id="fPhone2Toggle" style="margin-top:8px;">
          <span onclick="document.getElementById('fPhone2Toggle').style.display='none';document.getElementById('fPhone2Wrap').style.display='block';document.getElementById('fPhone2').focus();" style="font-size:12px;color:var(--primary);font-weight:700;cursor:pointer;">+ أضف رقم تاني (اختياري)</span>
        </div>
        <div class="fg" id="fPhone2Wrap" style="margin-bottom:0;margin-top:10px;display:none;">
          <label>رقم تاني (اختياري)</label>
          <input type="tel" id="fPhone2" placeholder="01xxxxxxxxx" maxlength="11" oninput="this.value=this.value.replace(/[^0-9]/g,'')" style="font-size:16px;letter-spacing:2px;">
        </div>
      </div>

      <!-- خطوة 3: الموقع -->
      <div style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;color:var(--primary);margin-bottom:12px;">3️⃣ الموقع (اختياري)</div>
        <div class="fg">
          <label id="fAddressLabel">العنوان بالتفصيل</label>
          <input type="text" id="fAddress" placeholder="مثال: شارع الجمهورية، بجوار مسجد النور" style="font-size:14px;">
        </div>
        <div class="fg" style="margin-bottom:0;" id="fMapUrlBlock">
          <label id="fMapLabel">رابط الخريطة</label>
          <input type="url" id="fLocation" placeholder="https://maps.google.com/..." style="font-size:13px;" oninput="checkMapUrl(this)">
          <div id="mapUrlHint" style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.8;background:#f0fdf4;border-radius:8px;padding:8px;">
            📱 <b>إزاي تجيب رابط صح:</b><br>
            1️⃣ افتح تطبيق <b>Google Maps</b><br>
            2️⃣ ابحث عن موقعك<br>
            3️⃣ اضغط <b>مشاركة</b> ثم <b>نسخ الرابط</b><br>
            ✅ الرابط الصح يبدأ بـ <b>maps.google.com</b> أو <b>maps.app.goo.gl</b>
          </div>
          <div id="mapUrlPreview" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;border:1px solid var(--border);height:160px;"></div>
        </div>

        <!-- روابط الفيديو -->
        <div style="background:#fef3c7;border-radius:12px;padding:12px;margin-top:8px;" id="fVideoLinksBlock">
          <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:8px;">🎥 روابط فيديو (اختياري)</div>
          <div id="videoLinksContainer">
            <div class="video-link-row" style="display:flex;gap:6px;margin-bottom:6px;">
              <input type="url" placeholder="يوتيوب / تيك توك / فيسبوك ..." oninput="checkVideoUrl(this)" style="flex:1;padding:8px;border:1px solid #d97706;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
              <button type="button" onclick="addVideoLink()" style="background:#f59e0b;color:white;border:none;width:34px;height:34px;border-radius:8px;font-size:18px;cursor:pointer;flex-shrink:0;">+</button>
            </div>
          </div>
          <div style="font-size:10px;color:#b45309;margin-top:4px;">💡 اضغط + لإضافة رابط تاني</div>
        </div>
      </div>

      <!-- خطوة 4: الصور -->
      <div id="fImgSection" style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;color:var(--primary);margin-bottom:12px;">4️⃣ صور الإعلان (اختياري — حتى 10 صور)</div>
        <div id="currentImgPreview"></div>
        <label id="fImgLabel" style="display:flex;align-items:center;justify-content:center;gap:8px;background:var(--primary-light);color:var(--primary);padding:14px;border-radius:10px;cursor:pointer;border:2px dashed var(--primary);font-weight:700;font-size:13px;">
          📸 اختر صور
          <input type="file" id="fImages" accept="image/*" multiple onchange="previewAddImages(this)" style="display:none;">
        </label>
        <div id="addImgPreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;"></div>
        <div id="imgCountText" style="font-size:11px;color:var(--gray);margin-top:6px;"></div>
        <div id="imgUploadProgressWrap" style="display:none;margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--primary);font-weight:700;margin-bottom:4px;">
            <span id="imgUploadProgressLabel">جاري رفع الصور...</span>
            <span id="imgUploadProgressPct">0%</span>
          </div>
          <div style="background:#f1f5f9;border-radius:20px;height:8px;overflow:hidden;">
            <div id="imgUploadProgressBar" style="background:var(--primary);height:100%;width:0%;transition:width .3s;"></div>
          </div>
        </div>
      </div>

      ${isAdmin ? `
      <!-- خطوة 5: عرض مميز -->
      <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border-radius:14px;padding:16px;margin-bottom:12px;border:2px solid #fed7aa;">
        <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
          <input type="checkbox" id="fIsOffer" style="width:22px;height:22px;cursor:pointer;accent-color:var(--orange);">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--orange);">⭐ نشر كعرض مميز</div>
            <div style="font-size:12px;color:#92400e;">هيظهر في تاب العروض بشكل بارز</div>
          </div>
        </label>
      </div>` : ''}

      <!-- إرسال -->
      <div style="background:white;border-radius:14px;padding:16px;border:1px solid var(--border);">
        <div style="font-size:12px;color:var(--gray);text-align:center;margin-bottom:12px;position:relative;">
          <span>⚠️ إعلانك هيظهر بعد مراجعة المشرف</span>
          <span onclick="toggleReviewTooltip(this)" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:10px;font-weight:900;cursor:pointer;margin-right:4px;vertical-align:middle;">ⓘ</span>
          <div class="review-tooltip" style="display:none;background:#1e293b;color:white;font-size:11px;line-height:1.6;padding:8px 12px;border-radius:8px;margin-top:8px;text-align:center;">
            ⏱️ المراجعة بتتم عادةً خلال ساعة في أوقات النهار — هتوصلك رسالة واتساب فور الموافقة
          </div>
        </div>
        <button type="button" onclick="showAdPreviewModal()" id="fPreviewBtn" style="display:none;width:100%;background:#fff7ed;color:#c2410c;border:2px solid #fdba74;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px;">
          👁️ معاينة الإعلان
        </button>
        <button onclick="submitNewAd()" id="fSubmit"
          style="width:100%;background:var(--primary);color:white;border:none;padding:14px;border-radius:12px;font-family:Cairo,sans-serif;font-size:15px;font-weight:900;cursor:pointer;">
          🚀 إرسال الإعلان للمراجعة
        </button>
        <button onclick="hideDynPage()"
          style="width:100%;background:#f3f4f6;color:var(--gray);border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px;">
          إلغاء
        </button>
      </div>

    </div>`;

  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ updateFSub(); if(sub){ var fs=document.getElementById('fSub'); if(fs){ for(var i=0;i<fs.options.length;i++){ if(fs.options[i].value===sub){fs.value=sub;break;} } } } updateTitlePlaceholder(); updateDescPlaceholder(); updateJobsUI(); updateLostUI(); updateDeathsUI(); updateDoctorUI(); }, 50);
  updateFSub();
  if(sub) { setTimeout(() => { const sel = document.getElementById('fSub'); if(sel) sel.value = sub; updateTitlePlaceholder(); updateDescPlaceholder(); updateJobsUI(); updateLostUI(); updateDeathsUI(); updateDoctorUI(); }, 100); }
}

function buildAddForm(catId, sub) { openAddModal(catId, sub); }
function closeAddModal() { hideDynPage(); }

function titlePlaceholderFor(catId, subVal) {
  const subPlaceholders = {
    'cars': {
      'إيجار سيارات': 'مثال: سيارة هيونداي 2020 للإيجار اليومي',
      'مغسلة سيارات': 'مثال: مغسلة سيارات — غسيل وتلميع بالحامول',
      'صيانة وزيت': 'مثال: تغيير زيت وصيانة سيارات',
      'تروسيكل': 'مثال: تروسيكل للبيع — موديل 2019',
      '🛺 اطلب توكتوك': 'مثال: مطلوب توكتوك — من الحامول لكفر الشيخ',
      'نقل عفش': 'مثال: نقل عفش وأثاث — بالحامول وضواحيها',
      'دليفري': 'مثال: خدمة دليفري وتوصيل طلبات',
      'سواقين': 'مثال: سواق خاص — متاح يوميًا',
    }
  };
  if(catId && subVal && subPlaceholders[catId] && subPlaceholders[catId][subVal]) {
    return subPlaceholders[catId][subVal];
  }
  return null;
}

function updateTitlePlaceholder() {
  const catId = document.getElementById('fCat')?.value;
  const subVal = document.getElementById('fSub')?.value;
  const titleInput = document.getElementById('fTitle');
  if(!titleInput) return;
  const subPh = titlePlaceholderFor(catId, subVal);
  if(subPh) { titleInput.placeholder = subPh; return; }
  const placeholders = {
    'jobs': 'مثال: مطلوب محاسب — خبرة 3 سنوات',
    'jobs_vacancy': 'مثال: مطلوب موظف مبيعات — براتب مجزي',
    'jobs_seeker': 'مثال: أبحث عن عمل — خريج محاسبة',
    'realestate': 'مثال: شقة للإيجار — 3 غرف — الحامول',
    're_rent': 'مثال: شقة للإيجار — دور ثاني — الحامول',
    're_sale': 'مثال: شقة للبيع — 120 متر — بالحامول',
    're_wanted': 'مثال: مطلوب شقة للإيجار في الحامول',
    'food': 'اكتب اسم المطعم أو الكافيه',
    'food_rest': 'اكتب اسم المطعم',
    'food_cafe': 'اكتب اسم الكافيه',
    'doctors': 'مثال: دكتور محمد علي — طبيب أسنان',
    'teachers_hub': 'مثال: مدرس رياضيات — ثانوي عام',
    'cars': 'اكتب عنوان واضح يوصف الخدمة أو السيارة',
    'used_market': 'مثال: تليفزيون سامسونج 55 بوصة للبيع',
    'fashion': 'اكتب اسم المحل أو الشركة',
    'shoes': 'اكتب اسم المحل أو الشركة',
    'home': 'اكتب اسم المحل',
    'furniture': 'اكتب اسم المحل أو الشركة',
    'cars_market': 'مثال: هيونداي فيرنا 2020 — فبريكا',
    'building': 'مثال: مقاول بناء وتشطيب — الحامول',
    'crafts': 'مثال: سباك — صيانة فورية',
    'tech': 'مثال: تصليح موبايلات وأجهزة',
    'salon': 'مثال: صالون حلاقة — حجوزات متاحة',
    'events': 'مثال: فوتوغرافي أفراح — أسعار مميزة',
    'charity': 'مثال: تبرع ملابس أطفال — حالة جيدة',
    'sports': 'مثال: أكاديمية كرة قدم — تسجيل مفتوح',
    'agri': 'مثال: بذور طماطم — كميات كبيرة متاحة',
    'lost': 'مثال: ضاع كلب أبيض بمنطقة الحامول',
    'deaths': 'مثال: نعي المرحوم الحاج محمد أحمد',
    'marriage': 'مثال: أبحث عن شريكة حياة — الحامول',
  };
  if(catId && placeholders[catId]) {
    titleInput.placeholder = placeholders[catId];
  } else {
    titleInput.placeholder = 'اكتب عنوان إعلانك هنا';
  }
}

function updateFSub() {
  // تحديث placeholder العنوان حسب الفئة
  updateTitlePlaceholder();
  var phCatId = document.getElementById('fCat')?.value;
  // رقم التليفون اختياري في الوفيات
  var phoneLabel = document.getElementById('fPhoneLabel');
  var phoneInput = document.getElementById('fPhone');
  if(phoneLabel && phoneInput) {
    if(phCatId === 'deaths') {
      phoneLabel.innerHTML = 'رقم التليفون / واتساب <span style="color:#94a3b8;font-weight:400;">(اختياري)</span>';
      phoneInput.placeholder = '01xxxxxxxxx — اختياري';
      phoneInput.required = false;
    } else {
      phoneLabel.innerHTML = 'رقم التليفون / واتساب *';
      phoneInput.placeholder = '01xxxxxxxxx';
      phoneInput.required = true;
    }
  }

  // حقول المتجر - تظهر بس في البيع أونلاين والمستعمل
  var shopFields = document.getElementById('shopFields');
  if(shopFields) {
    var isShop = (phCatId === 'online' || phCatId === 'used_market');
    shopFields.style.display = isShop ? 'block' : 'none';
  }
  const catId = document.getElementById('fCat').value;
  const cat = CATEGORIES.find(c => c.id === catId);
  const wrap = document.getElementById('fSubWrap');
  const sel = document.getElementById('fSub');
  if(!cat) { wrap.style.display = 'none'; return; }

  // ===== مجتمع المدرسين: واجهة خاصة لاختيار أكتر من مادة =====
  if(catId === 'teachers_hub') {
    wrap.style.display = 'block';
    document.getElementById('fSubLabel').textContent = 'نوع الإعلان';
    let otherOptsHtml = '<option value="">-- مدرّس مادة (اختار من القايمة تحت) --</option>' + TEACHER_OTHER_TYPES.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
    sel.innerHTML = otherOptsHtml;
    sel.onchange = function() {
      const picker = document.getElementById('teacherSubjectPicker');
      if(picker) picker.style.display = sel.value ? 'none' : 'block';
      updateTitlePlaceholder(); updateDescPlaceholder();
    };
    let existingPicker = document.getElementById('teacherSubjectPicker');
    if(!existingPicker) {
      existingPicker = document.createElement('div');
      existingPicker.id = 'teacherSubjectPicker';
      existingPicker.style.marginTop = '10px';
      wrap.appendChild(existingPicker);
    }
    existingPicker.style.display = 'block';
    existingPicker.innerHTML = '<div style="font-size:12px;color:var(--gray);margin-bottom:8px;">✅ اختار كل المواد اللي بتدرّسها (تقدر تختار أكتر من واحدة):</div>' +
      TEACHER_SUBJECT_GROUPS.map(g => `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:900;color:#5b21b6;margin-bottom:6px;">${g.icon} ${g.label}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${g.subjects.map((s,i)=>`
            <label style="display:flex;align-items:center;gap:4px;background:#f5f3ff;border:1px solid #ede9fe;border-radius:20px;padding:5px 10px;font-size:11px;cursor:pointer;">
              <input type="checkbox" class="teacherSubjChk" value="${s}" style="margin:0;">
              <span>${s}</span>
            </label>`).join('')}
          </div>
        </div>`).join('');
    updateDescPlaceholder();
    updateJobsUI(); updateLostUI(); updateDeathsUI(); updateDoctorUI();
    return;
  } else {
    const oldPicker = document.getElementById('teacherSubjectPicker');
    if(oldPicker) oldPicker.remove();
    document.getElementById('fSubLabel').textContent = 'التخصص';
    sel.onchange = function() { updateTitlePlaceholder();updateDescPlaceholder();updateJobsUI();updateLostUI();updateDeathsUI();updateDoctorUI(); };
  }

  // جمع كل التخصصات: subs المباشرة + subs داخل children
  let allSubs = [];
  if(cat.subs && cat.subs.length > 0) {
    allSubs = cat.subs.map(s => typeof s === 'string' ? s : s.name);
    // في المستعمل، شيل التخصصات اللي شغالة كمعارض تسجيل (ليها زرار "سجّل نشاطك" لوحدها) عشان محدش يضيف إعلان عادي فيها يضيع
    if(catId === 'used_market') {
      allSubs = allSubs.filter(s => USED_MARKET_SHOP_SUBS.indexOf(s) === -1);
    }
  }
  if(cat.children && cat.children.length > 0) {
    cat.children.forEach(child => {
      if(child.subs && child.subs.length > 0) {
        child.subs.forEach(s => {
          const subName = typeof s === 'string' ? s : s.name;
          if(!subName.startsWith('عام —')) {
            allSubs.push(child.name + ' — ' + subName);
          }
        });
      } else {
        allSubs.push(child.name);
      }
    });
  }

  if(allSubs.length > 0) {
    wrap.style.display = 'block';
    sel.innerHTML = '<option value="">-- اختر تخصص --</option>' + allSubs.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
  } else {
    wrap.style.display = 'none';
  }

  updateDescPlaceholder();
  updateJobsUI();
  updateLostUI();
  updateDeathsUI();
  updateDoctorUI();
}

// ===== نص إرشادي مخصص لحقل التفاصيل حسب القسم (خاصة العقارات) =====
function updateDescPlaceholder() {
  const catId = document.getElementById('fCat')?.value;
  const descInput = document.getElementById('fDesc');
  const descHint = document.getElementById('fDescHint');

  const foodFields = document.getElementById('foodFields');
  if(foodFields) foodFields.style.display = (catId === 'food') ? 'block' : 'none';

  // تسمية حقل العنوان حسب القسم (الوظائف/المفقودات/الوفيات بيتحكموا في تسميتهم بنفسهم)
  const titleLabelEl = document.getElementById('fTitleLabel');
  const TITLE_LABELS = {
    'food': 'اسم المطعم / الكافيه *',
    'home': 'اسم المحل *',
    'furniture': 'اسم المحل / الشركة *',
    'fashion': 'اسم المحل / الشركة *',
    'shoes': 'اسم المحل / الشركة *',
  };
  if(titleLabelEl && catId !== 'jobs' && catId !== 'lost' && catId !== 'deaths' && catId !== 'memorial') {
    titleLabelEl.textContent = TITLE_LABELS[catId] || 'عنوان الإعلان *';
  }

  if(!descInput || catId === 'jobs' || catId === 'lost') return; // الوظائف والمفقودات ليهم دوال خاصة

  if(catId === 'food') {
    const subVal = document.getElementById('fSub')?.value || '';
    const isCafe = subVal.indexOf('كافيهات') === 0;
    if(isCafe) {
      descInput.placeholder = 'مثال:\nأشهر المشروبات عندك\nمواعيد العمل\nهل فيه توصيل؟\nهل فيه جلسة خارجية؟';
      if(descHint) descHint.textContent = '💡 اذكر مواعيد العمل وأشهر الأصناف — كل ما البيانات أوضح كل ما جالك زباين أسرع';
    } else {
      descInput.placeholder = 'مثال:\nأشهر الأصناف عندك\nمواعيد العمل\nهل فيه توصيل؟ ولحد فين\nهل فيه صالة ولا تيك أواي بس';
      if(descHint) descHint.textContent = '💡 اذكر مواعيد العمل وخدمة التوصيل — دي أكتر حاجة بيسأل عنها العميل';
    }
    return;
  }

  if(catId === 'home') {
    descInput.placeholder = 'اكتب المنتجات أو الخدمات اللي بتقدمها، مثال:\nتوصيل طلبات للمنزل\nمواعيد العمل\nأشهر المنتجات عندك\nهل فيه عروض؟';
    if(descHint) descHint.textContent = '💡 اذكر مواعيد العمل والتوصيل وأشهر المنتجات — دي أكتر حاجة بيسأل عنها الزبون';
    return;
  }

  if(catId === 'furniture') {
    const subVal = document.getElementById('fSub')?.value || '';
    if(subVal === 'تكييفات') {
      descInput.placeholder = 'اكتب تفاصيل المنتج أو الخدمة، مثال:\nالنوع والقدرة (1.5 حصان / 3 حصان)\nبارد ولا بارد ساخن\nجديد ولا مستعمل\nهل فيه تركيب؟';
    } else if(subVal === 'قطع غيار أدوات كهربائية') {
      descInput.placeholder = 'اكتب تفاصيل القطع المتوفرة، مثال:\nقطع غيار لأنهي أجهزة\nأصلي ولا تجاري\nهل فيه ضمان؟\nمواعيد العمل';
    } else if(subVal === 'فلاتر مياه') {
      descInput.placeholder = 'اكتب تفاصيل المنتج أو الخدمة، مثال:\nعدد المراحل\nهل فيه تركيب وصيانة؟\nمواعيد العمل\nأسعار الشمعات';
    } else {
      descInput.placeholder = 'اكتب تفاصيل المنتج أو المحل، مثال:\nنوع المنتجات المتوفرة\nجديد ولا مستعمل\nمواعيد العمل\nهل فيه توصيل؟';
    }
    if(descHint) descHint.textContent = '💡 اذكر نوع المنتجات والمواعيد والتوصيل — كل ما البيانات أوضح كل ما جالك زباين أسرع';
    return;
  }

  if(catId === 'fashion') {
    descInput.placeholder = 'اكتب تفاصيل المحل، مثال:\nنوع الملابس المتوفرة\nالماركات أو التشكيلات\nمواعيد العمل\nهل فيه توصيل؟';
    if(descHint) descHint.textContent = '💡 اذكر نوع الملابس والمواعيد والتوصيل — كل ما البيانات أوضح كل ما جالك زباين أكتر';
    return;
  }

  if(catId === 'shoes') {
    descInput.placeholder = 'اكتب تفاصيل المحل، مثال:\nنوع الأحذية والأكسسوارات المتوفرة\nالماركات أو التشكيلات\nمواعيد العمل\nهل فيه توصيل؟';
    if(descHint) descHint.textContent = '💡 اذكر نوع المنتجات والمواعيد والتوصيل — كل ما البيانات أوضح كل ما جالك زباين أكتر';
    return;
  }

  if(catId === 'cars_market') {
    const subVal = document.getElementById('fSub')?.value || '';
    if(subVal.indexOf('قطع غيار') === 0) {
      descInput.placeholder = 'اكتب تفاصيل القطعة، مثال:\nالقطعة مناسبة لأنهي موديل\nأصلي ولا تجاري\nجديد ولا مستعمل\nحالة القطعة';
      if(descHint) descHint.textContent = '💡 اذكر الموديل المناسب وحالة القطعة — كل ما البيانات أدق كل ما قل السؤال';
    } else {
      descInput.placeholder = 'اكتب تفاصيل العربية أو التوكتوك، مثال:\nالموديل وسنة الصنع\nعدد الكيلومترات\nحالة الموتور والفرش\nسبب البيع';
      if(descHint) descHint.textContent = '💡 اذكر الموديل والسنة والكيلومترات وحالة العربية — دي أهم حاجة بيسأل عنها المشتري';
    }
    return;
  }

  if(catId === 'used_market') {
    const subVal = document.getElementById('fSub')?.value || '';
    const USED_PLACEHOLDERS = {
      'موبايلات وأجهزة': 'مثال:\nالنوع والموديل: آيفون 12\nحالة البطارية: 88%\nمعاه العلبة والشاحن؟\nسبب البيع',
      'أثاث وديكور': 'مثال:\nالنوع: دولاب 4 أبواب\nالخامة: خشب زان\nالأبعاد تقريبًا\nسبب البيع',
      'ملابس مستعملة': 'مثال:\nالمقاس\nعدد مرات الاستخدام\nهل فيه أي عيوب\nسبب البيع',
      'كتب ومستلزمات دراسية': 'مثال:\nاسم الكتاب/المنهج\nالسنة الدراسية\nحالة الكتاب (مكتوب فيه ولا لأ)',
      'أجهزة كهربائية': 'مثال:\nالنوع والموديل: غسالة توشيبا 8 كيلو\nسنة الشراء\nهل فيها أي أعطال\nسبب البيع',
      'عفش كامل': 'مثال:\nمحتويات العفش بالتفصيل\nحالة كل قطعة\nهل ممكن البيع بالقطعة',
      'سيارات وتكاتك': 'مثال:\nالموديل وسنة الصنع\nعدد الكيلومترات\nحالة الموتور والكهرباء\nسبب البيع',
      'أدوات ومعدات': 'مثال:\nنوع الأداة والاستخدام\nحالة التشغيل\nسبب البيع',
      'العاب أطفال': 'مثال:\nنوع اللعبة والسن المناسب\nحالة اللعبة\nمعاها كل القطع؟',
    };
    const cfg = USED_PLACEHOLDERS[subVal];
    descInput.placeholder = cfg || 'اكتب المواصفات هنا (مثال: النوع، الموديل، حالة القطعة، سبب البيع)';
    if(descHint) descHint.textContent = '💡 كل ما وصفت الحالة بدقة كل ما قل السؤال والتفاوض بعد كده';
    return;
  }

  if(catId === 'realestate') {
    const subVal = document.getElementById('fSub')?.value || '';
    let mode = null;
    if(subVal.indexOf('إيجار') === 0) mode = 'rent';
    else if(subVal.indexOf('بيع') === 0) mode = 'sale';
    else if(subVal.indexOf('مطلوب') === 0) mode = 'wanted';
    else if(addCatId === 're_rent') mode = 'rent';
    else if(addCatId === 're_sale') mode = 'sale';
    else if(addCatId === 're_wanted') mode = 'wanted';

    if(mode === 'rent') {
      descInput.placeholder = 'مثال:\nدور تاني — 3 غرف وصالة\nمفروشة جزئيًا\nالسعر الشهري: 3000 جنيه\nقريبة من السوق';
      if(descHint) descHint.textContent = '💡 اذكر الدور وعدد الغرف والأثاث والسعر الشهري بالتفصيل — كل ما البيانات أدق كل ما جالك اتصال جاد';
      return;
    }
    if(mode === 'sale') {
      descInput.placeholder = 'مثال:\n120 متر — 3 غرف وصالة\nتشطيب سوبر لوكس\nدور رابع بدون أسانسير\nالسعر الإجمالي: 850,000 جنيه';
      if(descHint) descHint.textContent = '💡 اذكر المساحة والتشطيب والدور والسعر الإجمالي بالتفصيل — كل ما البيانات أدق كل ما جالك اتصال جاد';
      return;
    }
    if(mode === 'wanted') {
      descInput.placeholder = 'مثال:\nعايز شقة 3 غرف في الحامول\nالميزانية: حتى 15,000 شهريًا\nدور أول أو تاني\nقريبة من السوق أو المستشفى';
      if(descHint) descHint.textContent = '💡 اذكر نوع العقار المطلوب والميزانية والمنطقة المفضلة بالتفصيل — كل ما طلبك واضح كل ما جالك عروض مناسبة بسرعة';
      return;
    }
    // عقارات عام — لسه محددش تخصص
    descInput.placeholder = 'مثال:\nنوع العقار (شقة / محل / أرض)\nالمساحة أو عدد الغرف\nالسعر\nالمنطقة بالتفصيل';
    if(descHint) descHint.textContent = '💡 اذكر تفاصيل العقار والسعر والمنطقة بدقة — كل ما البيانات أوضح كل ما جالك اهتمام أسرع';
    return;
  }

  if(catId === 'medservices') {
    const subVal = document.getElementById('fSub')?.value || '';
    const addressInput = document.getElementById('fAddress');
    const MED_PLACEHOLDERS = {
      'صيدليات': {
        desc: 'مثال:\nتوصيل أدوية للمنازل\nمستحضرات تجميل\nخدمة 24 ساعة\nصرف روشتة التأمين الصحي',
        hint: '💡 اذكر خدمات التوصيل والمنتجات المتوفرة ومواعيد العمل بالتفصيل',
        addr: 'مثال: شارع الجمهورية، بجوار صيدلية العزبي القديمة'
      },
      'معامل تحاليل': {
        desc: 'مثال:\nتحليل سكر\nتحاليل شاملة\nخدمة سحب عينات من المنزل\nمواعيد العمل: 8 صباحاً - 10 مساءً',
        hint: '💡 اذكر أنواع التحاليل المتاحة وهل فيه سحب عينات من المنزل ومواعيد استلام النتائج',
        addr: 'مثال: شارع المحطة، أمام مستشفى الحامول المركزي'
      },
      'مراكز أشعة': {
        desc: 'مثال:\nأشعة إكس\nسونار\nرنين مغناطيسي (MRI)\nمواعيد الحجز والاستلام',
        hint: '💡 اذكر أنواع الأشعة المتاحة وهل الحجز محتاج معاد مسبق',
        addr: 'مثال: بجوار مستشفى الحامول، الدور الأول'
      },
      'مراكز تخاطب': {
        desc: 'مثال:\nجلسات تخاطب للأطفال\nعلاج تأخر النطق\nتقييم مبدئي مجاني\nمواعيد الجلسات الأسبوعية',
        hint: '💡 اذكر الفئة العمرية والمشاكل اللي بتتعالج ونظام الحجز',
        addr: 'مثال: شارع النادي، الدور الثاني'
      },
      'مستلزمات طبية': {
        desc: 'مثال:\nكراسي متحركة\nأجهزة ضغط وسكر\nتأجير أجهزة\nتوصيل للمنزل',
        hint: '💡 اذكر المنتجات المتوفرة وهل فيه تأجير أو بيع بس',
        addr: 'مثال: شارع السوق، بجوار البنك الأهلي'
      },
      'معامل نظارات': {
        desc: 'مثال:\nفحص نظر مجاني\nعدسات لاصقة\nتصنيع نظارات في نفس اليوم\nخصومات وتقسيط',
        hint: '💡 اذكر خدمة الفحص ومدة تجهيز النظارة ونظام الدفع',
        addr: 'مثال: شارع الجمهورية، أمام محطة البنزين'
      },
      'تمريض منزلي': {
        desc: 'مثال:\nحقن وقياس ضغط بالمنزل\nمتابعة مرضى بعد العمليات\nرعاية كبار السن\nمتاح على مدار اليوم',
        hint: '💡 اذكر الخدمات المتاحة ونطاق التغطية (داخل الحامول بس ولا القرى المجاورة كمان)',
        addr: ''
      },
      'الطب التكميلي': {
        desc: 'مثال:\nجلسات علاج طبيعي\nحجامة وعلاج بالأعشاب\nتدليك علاجي\nمواعيد الجلسات',
        hint: '💡 اذكر نوع الجلسات والمدة وهل بتتم في العيادة ولا بزيارة منزلية',
        addr: 'مثال: شارع الجمهورية، بجوار مسجد النور'
      }
    };
    const cfg = MED_PLACEHOLDERS[subVal];
    if(cfg) {
      descInput.placeholder = cfg.desc;
      if(descHint) descHint.textContent = cfg.hint;
      if(addressInput) addressInput.placeholder = cfg.addr || 'مثال: شارع الجمهورية، بجوار مسجد النور';
      return;
    }
    // خدمات طبية عام — لسه محددش تخصص
    descInput.placeholder = 'مثال:\nنوع الخدمة الطبية بالتفصيل\nمواعيد العمل\nهل التوصيل متاح للمنزل';
    if(descHint) descHint.textContent = '💡 اختار التخصص فوق الأول عشان يظهرلك مثال مخصص لنوع الخدمة';
    if(addressInput) addressInput.placeholder = 'مثال: شارع الجمهورية، بجوار مسجد النور';
    return;
  }

  // خدمات طبية — المثال الطبي مناسب ليها
  if(catId === 'medservices') {
    descInput.placeholder = 'اكتب كل خدمة أو معلومة في سطر لوحده، مثال:\nمتابعة أمراض الأطفال\nعلاج الحساسية\nمواعيد: 10 صباحاً - 3 مساءً\nيوجد سونار';
    if(descHint) descHint.textContent = '💡 اكتب كل خدمة أو معلومة في سطر منفصل — هتظهر منظمة كأيقونات بالتطبيق';
    const addrEl0 = document.getElementById('fAddress');
    if(addrEl0) addrEl0.placeholder = 'مثال: شارع الجمهورية، بجوار مسجد النور';
    return;
  }

  // افتراضي لباقي الأقسام — محايد بدون مثال طبي
  descInput.placeholder = 'اكتب كل خدمة أو معلومة في سطر لوحده — كل معلومة في سطر';
  if(descHint) descHint.textContent = '💡 اكتب كل خدمة أو معلومة في سطر منفصل — هتظهر منظمة كأيقونات بالتطبيق';
  const addressInput = document.getElementById('fAddress');
  if(addressInput) addressInput.placeholder = 'مثال: شارع الجمهورية، بجوار مسجد النور';
}

// ===== تحديد نوع الإعلان: وظيفة شاغرة ولا باحث عن عمل =====
function getJobsMode() {
  var catVal = document.getElementById('fCat')?.value;
  if(catVal !== 'jobs') return null;
  var subVal = document.getElementById('fSub')?.value || '';
  if(subVal.indexOf('باحث عن عمل') === 0) return 'seeker';
  if(subVal.indexOf('وظيفة شاغرة') === 0) return 'vacancy';
  // لسه ما اخترش تخصص — نرجع لنوع القسم اللي اتفتح بيه الفورم
  if(addCatId === 'jobs_seeker') return 'seeker';
  if(addCatId === 'jobs_vacancy') return 'vacancy';
  return 'vacancy'; // افتراضي داخل قسم الوظائف
}

// ===== تحديث واجهة قسم الوظائف (الراتب، الحالة، النصوص، زرار الإرسال) =====
function updateJobsUI() {
  var catVal = document.getElementById('fCat')?.value;
  var jobsFields = document.getElementById('jobsFields');
  var titleLabel = document.getElementById('fTitleLabel');
  var titleInput = document.getElementById('fTitle');
  var descLabel = document.getElementById('fDescLabel');
  var descInput = document.getElementById('fDesc');
  var descHint = document.getElementById('fDescHint');
  var submitBtn = document.getElementById('fSubmit');
  var previewBtn = document.getElementById('fPreviewBtn');
  var salaryLabel = document.getElementById('fSalaryLabel');
  var jobStatusWrap = document.getElementById('fJobStatusWrap');
  var jobsFieldsTitle = document.getElementById('jobsFieldsTitle');

  if(catVal !== 'jobs') {
    if(jobsFields) jobsFields.style.display = 'none';
    if(previewBtn) previewBtn.style.display = 'block';
    if(descLabel) descLabel.textContent = 'التفاصيل';
    if(submitBtn) submitBtn.textContent = '🚀 إرسال الإعلان للمراجعة';
    return;
  }

  var mode = getJobsMode();
  if(jobsFields) jobsFields.style.display = 'block';
  if(previewBtn) previewBtn.style.display = 'block';

  if(mode === 'seeker') {
    if(jobsFieldsTitle) jobsFieldsTitle.textContent = '🙋 بيانات الباحث عن عمل';
    if(titleLabel) titleLabel.textContent = 'ملخص الخبرة/المهنة *';
    if(titleInput) titleInput.placeholder = 'مثال: خريج محاسبة — خبرة سنتين مبيعات';
    if(descLabel) descLabel.textContent = 'خبراتك ومهاراتك';
    if(descInput) descInput.placeholder = 'اكتب خبراتك ومهاراتك كل نقطة في سطر، مثال:\nخبرة 3 سنوات محاسبة\nإجادة برامج الأوفيس\nمتاح للعمل الفوري';
    if(descHint) descHint.textContent = '💡 اكتب كل مهارة أو خبرة في سطر منفصل — هتظهر منظمة كأيقونات بالتطبيق';
    if(salaryLabel) salaryLabel.textContent = 'الراتب المتوقع (اختياري)';
    if(jobStatusWrap) jobStatusWrap.style.display = 'block';
    if(submitBtn) submitBtn.textContent = '🚀 انشر طلبي';
  } else {
    if(jobsFieldsTitle) jobsFieldsTitle.textContent = '💼 بيانات الوظيفة';
    if(titleLabel) titleLabel.textContent = 'عنوان الإعلان *';
    if(titleInput) titleInput.placeholder = 'مثال: مطلوب محاسب — خبرة 3 سنوات';
    if(descLabel) descLabel.textContent = 'تفاصيل ومتطلبات الوظيفة';
    if(descInput) descInput.placeholder = 'اكتب متطلبات الوظيفة كل نقطة في سطر، مثال:\nخبرة سنتين على الأقل\nيفضل من سكان الحامول\nمواعيد العمل: 9ص - 5م';
    if(descHint) descHint.textContent = '💡 اكتب كل شرط أو معلومة في سطر منفصل — هتظهر منظمة كأيقونات بالتطبيق';
    if(salaryLabel) salaryLabel.textContent = 'الراتب المعروض (اختياري)';
    if(jobStatusWrap) jobStatusWrap.style.display = 'none';
    if(submitBtn) submitBtn.textContent = '🚀 نشر الوظيفة';
  }
}

// ===== تبديل وضع "فقدت / لقيت" =====
function setLostMode(mode) {
  const hidden = document.getElementById('fLostMode');
  if(hidden) hidden.value = mode;
  const lostBtn = document.getElementById('fLostModeBtnLost');
  const foundBtn = document.getElementById('fLostModeBtnFound');
  if(lostBtn && foundBtn) {
    if(mode === 'lost') {
      lostBtn.style.background = '#fee2e2'; lostBtn.style.color = '#dc2626'; lostBtn.style.borderColor = '#f87171';
      foundBtn.style.background = 'white'; foundBtn.style.color = '#64748b'; foundBtn.style.borderColor = '#e5e7eb';
    } else {
      foundBtn.style.background = '#dcfce7'; foundBtn.style.color = '#166534'; foundBtn.style.borderColor = '#4ade80';
      lostBtn.style.background = 'white'; lostBtn.style.color = '#64748b'; lostBtn.style.borderColor = '#e5e7eb';
    }
  }
  updateLostUI();
}

// ===== تحديث واجهة قسم المفقودات =====
function updateLostUI() {
  const catVal = document.getElementById('fCat')?.value;
  const lostFields = document.getElementById('lostFields');
  const mapBlock = document.getElementById('fMapUrlBlock');
  const videoBlock = document.getElementById('fVideoLinksBlock');
  const titleLabel = document.getElementById('fTitleLabel');
  const titleInput = document.getElementById('fTitle');
  const descInput = document.getElementById('fDesc');
  const descHint = document.getElementById('fDescHint');
  const addressLabel = document.getElementById('fAddressLabel');
  const addressInput = document.getElementById('fAddress');
  const rewardCheckWrap = document.getElementById('fRewardCheckWrap');

  if(catVal !== 'lost') {
    if(lostFields) lostFields.style.display = 'none';
    if(mapBlock) mapBlock.style.display = 'block';
    if(videoBlock) videoBlock.style.display = 'block';
    if(addressLabel) addressLabel.textContent = 'العنوان بالتفصيل';
    if(addressInput) addressInput.placeholder = 'مثال: شارع الجمهورية، بجوار مسجد النور';
    return;
  }

  // إخفاء الحقول اللي مش لازمة لسرعة الإنجاز
  if(lostFields) lostFields.style.display = 'block';
  if(mapBlock) mapBlock.style.display = 'none';
  if(videoBlock) videoBlock.style.display = 'none';

  const mode = document.getElementById('fLostMode')?.value || 'lost';

  if(mode === 'lost') {
    if(titleLabel) titleLabel.textContent = 'ماذا فقدت؟ *';
    if(titleInput) titleInput.placeholder = 'مثال: محفظة جلد بني، مفاتيح فيها ميدالية';
    if(descInput) descInput.placeholder = 'مثال:\nلون ومواصفات الغرض\nمكان وتوقيت الفقد تقريبًا\nأي علامة مميزة تساعد في التعرف عليه';
    if(descHint) descHint.textContent = '💡 كل ما وصفت الغرض بدقة كل ما سهل على اللي لقاه إنه يتعرف عليه';
    if(addressLabel) addressLabel.textContent = 'مكان وتوقيت الفقد (اختياري)';
    if(addressInput) addressInput.placeholder = 'مثال: شارع السوق، يوم الخميس بعد صلاة العصر';
    if(rewardCheckWrap) rewardCheckWrap.style.display = 'flex';
  } else {
    if(titleLabel) titleLabel.textContent = 'ماذا وجدت؟ *';
    if(titleInput) titleInput.placeholder = 'مثال: مفتاح لقيته بالقرب من السوق';
    if(descInput) descInput.placeholder = 'مثال:\nلون ومواصفات الغرض\nمكان وتوقيت العثور عليه\nموجود عندك من امتى';
    if(descHint) descHint.textContent = '💡 وصف دقيق هيسهّل على صاحب الغرض إنه يثبت ملكيته';
    if(addressLabel) addressLabel.textContent = 'مكان وتوقيت العثور عليه (اختياري)';
    if(addressInput) addressInput.placeholder = 'مثال: أمام مسجد النور، يوم الجمعة الصبح';
    // اللي لقى حاجة مش محتاج يعرض مكافأة
    if(rewardCheckWrap) rewardCheckWrap.style.display = 'none';
    const hasRewardBox = document.getElementById('fHasReward');
    if(hasRewardBox) hasRewardBox.checked = false;
    const rewardAmountWrap = document.getElementById('fRewardAmountWrap');
    if(rewardAmountWrap) rewardAmountWrap.style.display = 'none';
  }
}

// ===== تحديث واجهة قسم الوفيات =====
// ===== تحديد وضع قسم الوفيات: نعي عادي ولا توثيق راحلين =====
function getDeathsMode() {
  const catVal = document.getElementById('fCat')?.value;
  if(catVal !== 'deaths') return null;
  const subVal = document.getElementById('fSub')?.value || '';
  if(subVal === 'توثيق الراحلين') return 'memorial';
  if(subVal === 'نعي ووفيات') return 'announce';
  if(addCatId === 'deaths_memorial') return 'memorial';
  if(addCatId === 'deaths_announce') return 'announce';
  return 'announce'; // افتراضي
}

function updateDoctorUI() {
  const catVal = document.getElementById('fCat')?.value;
  const doctorFields = document.getElementById('doctorFields');
  if(doctorFields) doctorFields.style.display = (catVal === 'doctors') ? 'block' : 'none';
}

function updateDeathsUI() {
  const catVal = document.getElementById('fCat')?.value;
  const deathsFields = document.getElementById('deathsFields');
  const memorialFields = document.getElementById('memorialFields');
  const deathDateField = document.getElementById('deathDateField');
  const videoBlock = document.getElementById('fVideoLinksBlock');
  const titleLabel = document.getElementById('fTitleLabel');
  const titleInput = document.getElementById('fTitle');
  const descLabel = document.getElementById('fDescLabel');
  const descInput = document.getElementById('fDesc');
  const descHint = document.getElementById('fDescHint');
  const mapLabel = document.getElementById('fMapLabel');

  if(catVal !== 'deaths') {
    if(deathsFields) deathsFields.style.display = 'none';
    if(memorialFields) memorialFields.style.display = 'none';
    if(deathDateField) deathDateField.style.display = 'none';
    if(mapLabel) mapLabel.textContent = 'رابط الخريطة';
    // فيديو بيرجع يظهر إلا لو قسم مفقودات هو اللي مسيطر (updateLostUI بتتحكم فيه لوحدها)
    if(videoBlock && catVal !== 'lost') videoBlock.style.display = 'block';
    return;
  }

  const mode = getDeathsMode();
  if(deathDateField) deathDateField.style.display = 'block';

  if(mode === 'announce') {
    if(deathsFields) deathsFields.style.display = 'block';
    if(memorialFields) memorialFields.style.display = 'none';
    if(videoBlock) videoBlock.style.display = 'none'; // مش لازم فيديوهات في نعي
    if(mapLabel) mapLabel.textContent = '📍 موقع الجنازة أو العزاء (اختياري)';
    if(titleLabel) titleLabel.textContent = 'اسم المتوفى *';
    if(titleInput) titleInput.placeholder = 'مثال: المرحوم الحاج محمد أحمد علي';
    if(descLabel) descLabel.textContent = 'تفاصيل إضافية (اختياري)';
    if(descInput) descInput.placeholder = 'أي تفاصيل إضافية حابب تضيفها (اختياري)';
    if(descHint) descHint.textContent = '💡 موعد الجنازة ومكان العزاء ليهم حقول مخصصة فوق — الحقل ده لأي تفاصيل تانية بس';
  } else {
    // توثيق الراحلين
    if(deathsFields) deathsFields.style.display = 'none';
    if(memorialFields) memorialFields.style.display = 'block';
    if(videoBlock) videoBlock.style.display = 'block'; // فيديوهات مسموحة هنا للتخليد
    if(mapLabel) mapLabel.textContent = 'رابط الخريطة (اختياري)';
    if(titleLabel) titleLabel.textContent = 'اسم المتوفى *';
    if(titleInput) titleInput.placeholder = 'مثال: المرحوم الحاج محمد أحمد علي';
    if(descLabel) descLabel.textContent = 'كلمة أو ذكرى عن الفقيد (اختياري)';
    if(descInput) descInput.placeholder = 'مثال: كان رحمه الله معروف بكرمه وحسن خلقه بين أهالي الحامول';
    if(descHint) descHint.textContent = '💡 اكتب أي ذكرى أو كلمة حلوة — هتفضل محفوظة مع صوره وفيديوهاته';
  }
}

function renderVideoLinks(videoLinksJson) {
  if(!videoLinksJson) return '';
  try {
    const vids = JSON.parse(videoLinksJson);
    if(!vids || !vids.length) return '';
    var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">';
    for(var i=0; i<vids.length; i++) {
      var v = vids[i];
      html += '<a href="' + escapeHtml(safeUrl(v)) + '" target="_blank" onclick="event.stopPropagation()" style="background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;text-decoration:none;">';
      html += getVideoIcon(v) + ' ' + getVideoDomain(v);
      html += '</a>';
    }
    html += '</div>';
    return html;
  } catch(e) { return ''; }
}

function getVideoIcon(url) {
  if(!url) return '🎥';
  const u = url.toLowerCase();
  if(u.includes('youtube') || u.includes('youtu.be')) return '▶️';
  if(u.includes('tiktok')) return '🎵';
  if(u.includes('facebook') || u.includes('fb.watch')) return '📘';
  if(u.includes('instagram')) return '📸';
  return '🎥';
}

function getVideoDomain(url) {
  if(!url) return 'فيديو';
  const u = url.toLowerCase();
  if(u.includes('youtube') || u.includes('youtu.be')) return 'يوتيوب';
  if(u.includes('tiktok')) return 'تيك توك';
  if(u.includes('facebook') || u.includes('fb.watch')) return 'فيسبوك';
  if(u.includes('instagram')) return 'انستجرام';
  try { return new URL(url).hostname.replace('www.',''); } catch(e) { return 'فيديو'; }
}

function fixMapUrl(url) {
  if(!url) return url;
  // تحويل google.com/maps/dir لـ maps.google.com
  if(url.includes('google.com/maps/dir')) {
    // استخراج الإحداثيات لو موجودة
    var match = url.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if(match) {
      return 'https://maps.google.com/?q=' + match[1] + ',' + match[2];
    }
  }
  // تحويل goo.gl/maps لـ maps.google.com
  if(url.includes('goo.gl/maps/')) {
    return url; // ده صح بيشتغل على الموبايل
  }
  return url;
}

function isValidMapUrl(url) {
  if(!url) return false;
  const u = url.toLowerCase();
  return u.includes('maps.google') || 
         u.includes('goo.gl/maps') || 
         u.includes('maps.app.goo.gl') || 
         u.includes('share.google') ||
         u.includes('google.com/maps');
}

function isValidVideoUrl(url) {
  if(!url) return false;
  if(!/^https?:\/\//i.test(url.trim())) return false;
  const u = url.toLowerCase();
  return u.includes('youtube.com') || u.includes('youtu.be') ||
         u.includes('tiktok.com') || u.includes('facebook.com') ||
         u.includes('fb.watch') || u.includes('instagram.com');
}

function checkVideoUrl(input) {
  const v = input.value.trim();
  if(!v) { input.style.borderColor = '#d97706'; return; }
  input.style.borderColor = isValidVideoUrl(v) ? '#16a34a' : '#dc2626';
}

function toggleReviewTooltip(el) {
  const tip = el.nextElementSibling;
  if(!tip) return;
  tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
}

// ===== تنسيق تلقائي (Auto-list) لحقل التفاصيل عند الضغط على Enter =====
function autoListOnEnter(e, textarea) {
  if(e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const start = textarea.selectionStart;
  const value = textarea.value;
  const beforeCursor = value.substring(0, start);
  const afterCursor = value.substring(start);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const currentLine = beforeCursor.substring(lastNewline + 1);
  const bulletMatch = currentLine.match(/^(\s*)•\s?/);
  let insert;
  if(bulletMatch) {
    const lineContent = currentLine.substring(bulletMatch[0].length).trim();
    if(!lineContent) {
      // سطر بولت فاضي — اقفل القايمة (شيل البولت وانزل سطر عادي)
      const newBefore = beforeCursor.substring(0, lastNewline + 1);
      textarea.value = newBefore + afterCursor;
      textarea.selectionStart = textarea.selectionEnd = newBefore.length;
      return;
    }
    insert = '\n• ';
  } else if(currentLine.trim()) {
    insert = '\n• ';
  } else {
    insert = '\n';
  }
  textarea.value = beforeCursor + insert + afterCursor;
  const newPos = start + insert.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
}

function checkMapUrl(input) {
  const hint = document.getElementById('mapUrlHint');
  const preview = document.getElementById('mapUrlPreview');
  if(!hint) return;
  const v = input.value.trim();
  if(!v) {
    hint.style.background = '#f0fdf4';
    hint.style.color = '#64748b';
    hint.innerHTML = '📱 <b>إزاي تجيب رابط صح:</b><br>1️⃣ افتح تطبيق <b>Google Maps</b><br>2️⃣ ابحث عن موقعك<br>3️⃣ اضغط <b>مشاركة</b> ثم <b>نسخ الرابط</b><br>✅ الرابط الصح يبدأ بـ <b>maps.google.com</b> أو <b>maps.app.goo.gl</b>';
    if(preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  } else if(v.includes('goo.gl/app/maps') || (v.includes('firebase') && !v.includes('maps'))) {
    hint.style.background = '#fef2f2';
    hint.style.color = '#dc2626';
    hint.innerHTML = '❌ الرابط ده Firebase مش هيشتغل على الموبايل!<br>افتح Google Maps واضغط <b>مشاركة → نسخ الرابط</b>';
    input.style.borderColor = '#dc2626';
    if(preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  } else if(isValidMapUrl(v)) {
    hint.style.background = '#f0fdf4';
    hint.style.color = '#16a34a';
    hint.innerHTML = '✅ رابط صح — هيشتغل على الموبايل والكمبيوتر';
    input.style.borderColor = '#16a34a';
    showMapLivePreview(v, preview);
  } else {
    hint.style.background = '#fff7ed';
    hint.style.color = '#92400e';
    hint.innerHTML = '⚠️ تأكد إن الرابط من Google Maps';
    input.style.borderColor = '#f59e0b';
    if(preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  }
}

// ===== معاينة فورية لرابط الخريطة (من غير أي مفتاح API — بنستخدم OpenStreetMap) =====
function showMapLivePreview(url, preview) {
  if(!preview) return;
  // روابط Google Maps غالبًا بتحتوي إحداثيات بالشكل @lat,lng
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if(!m) {
    // مفيش إحداثيات ظاهرة في الرابط (زي روابط maps.app.goo.gl المختصرة) — مينفعش نعمل معاينة من غير API key
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }
  const lat = m[1], lng = m[2];
  const d = 0.006;
  const bbox = (parseFloat(lng)-d) + ',' + (parseFloat(lat)-d) + ',' + (parseFloat(lng)+d) + ',' + (parseFloat(lat)+d);
  preview.style.display = 'block';
  preview.innerHTML = '<iframe style="width:100%;height:100%;border:0;" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&marker='+lat+','+lng+'"></iframe>';
}

function addVideoLink() {
  const container = document.getElementById('videoLinksContainer');
  if(!container) return;
  const rows = container.querySelectorAll('.video-link-row');
  if(rows.length >= 5) { showToast('أقصى عدد 5 روابط فيديو','error'); return; }
  const div = document.createElement('div');
  div.className = 'video-link-row';
  div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
  div.innerHTML = '<input type="url" placeholder="يوتيوب / تيك توك / فيسبوك ..." oninput="checkVideoUrl(this)" style="flex:1;padding:8px;border:1px solid #d97706;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">' +
    '<button type="button" onclick="this.parentElement.remove()" style="background:#ef4444;color:white;border:none;width:34px;height:34px;border-radius:8px;font-size:18px;cursor:pointer;flex-shrink:0;">−</button>';
  container.appendChild(div);
}

function getVideoLinks() {
  const container = document.getElementById('videoLinksContainer');
  if(!container) return [];
  const inputs = container.querySelectorAll('input[type="url"]');
  const links = [];
  inputs.forEach(inp => {
    const v = inp.value.trim();
    if(v) links.push(v);
  });
  return links;
}

// ملء خانات الفيديو بالروابط القديمة وقت التعديل
function fillVideoLinks(videoLinksJson) {
  const container = document.getElementById('videoLinksContainer');
  if(!container || !videoLinksJson) return;
  let vids = [];
  try { vids = JSON.parse(videoLinksJson); } catch(e) { return; }
  if(!Array.isArray(vids) || !vids.length) return;
  // املأ أول خانة موجودة، وضيف خانات للباقي
  const firstInput = container.querySelector('input[type="url"]');
  if(firstInput) firstInput.value = vids[0] || '';
  for(let i = 1; i < vids.length && i < 5; i++) {
    addVideoLink();
    const rows = container.querySelectorAll('.video-link-row input[type="url"]');
    if(rows[i]) rows[i].value = vids[i];
  }
}

let addSelectedFiles = [];
function previewAddImages(input) {
  const files = Array.from(input.files).slice(0,10);
  addSelectedFiles = files;
  const prev = document.getElementById('addImgPreview');
  prev.innerHTML = '';
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => { prev.innerHTML += `<img src="${e.target.result}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">`; };
    r.readAsDataURL(f);
  });
}

// ===== معاينة الإعلان قبل الإرسال =====
// ===== رسالة تأكيد واضحة بعد إرسال الإعلان =====
function showSubmitSuccessModal(title) {
  let modal = document.getElementById('submitSuccessModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'submitSuccessModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;max-width:380px;width:100%;padding:26px 22px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      <div style="font-size:16px;font-weight:900;color:#166534;margin-bottom:8px;">تم استلام إعلانك!</div>
      <div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:6px;">"${escapeHtml(title)}"</div>
      <div style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:18px;">هيراجعه المشرف وعادةً بيظهر خلال ساعة تقريبًا في أوقات النهار.</div>
      <button onclick="document.getElementById('submitSuccessModal').remove()" style="width:100%;background:#16a34a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">تمام 👍</button>
    </div>`;
}

// ===== رسالة تأكيد واضحة بعد إرسال ملف بيت الحلال =====
function showMarriageSubmitSuccessModal() {
  let modal = document.getElementById('submitSuccessModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'submitSuccessModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;max-width:380px;width:100%;padding:26px 22px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      <div style="font-size:16px;font-weight:900;color:#be185d;margin-bottom:8px;">تم استلام طلبك!</div>
      <div style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:18px;">هيراجعه المشرف وعادةً بيظهر خلال ساعة تقريبًا في أوقات النهار. بياناتك سرية ومحدش هيشوفها غير الإدارة.</div>
      <button onclick="document.getElementById('submitSuccessModal').remove()" style="width:100%;background:#be185d;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">تمام 👍</button>
    </div>`;
}

function showAdPreviewModal() {
  const title = document.getElementById('fTitle')?.value.trim() || '(من غير عنوان)';
  const desc = document.getElementById('fDesc')?.value.trim() || '';
  const phone = document.getElementById('fPhone')?.value.trim() || '';
  const address = document.getElementById('fAddress')?.value.trim() || '';
  const salary = document.getElementById('fSalary')?.value.trim() || '';
  const jobStatus = document.getElementById('fJobStatus')?.value || '';
  const priceOnRequest = document.getElementById('fPriceOnRequest')?.checked;
  const price = priceOnRequest ? '' : (document.getElementById('fPrice')?.value.trim() || '');
  const qty = document.getElementById('fQty')?.value.trim() || '';
  const condition = document.getElementById('fCondition')?.value || '';
  const color = document.getElementById('fColor')?.value.trim() || '';
  const warranty = document.getElementById('fWarranty')?.value.trim() || '';
  const catId = document.getElementById('fCat')?.value;
  const subEl = document.getElementById('fSub');
  const sub = (subEl && subEl.style.display !== 'none') ? subEl.value : '';
  const cat = CATEGORIES.find(c => c.id === catId) || {icon:'📋', name:''};
  const mode = getJobsMode();
  const imgCount = (typeof addSelectedFiles !== 'undefined' && addSelectedFiles) ? addSelectedFiles.length : 0;

  const descHtml = desc ? desc.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => '<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">• ' + escapeHtml(l) + '</div>').join('') : '<div style="color:#94a3b8;">لسه ما كتبتش تفاصيل</div>';

  let modal = document.getElementById('adPreviewModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'adPreviewModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:18px 18px 0 0;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;padding:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:900;color:var(--primary);">👁️ معاينة الإعلان</div>
        <button onclick="document.getElementById('adPreviewModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="background:#f8fafc;border-radius:14px;padding:14px;border:1px solid var(--border);">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <span style="background:var(--primary-light);color:var(--primary);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${cat.icon} ${cat.name}</span>
          ${sub ? `<span style="background:#f3f4f6;color:#555;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${escapeHtml(sub)}</span>` : ''}
          ${imgCount ? `<span style="background:#f3f4f6;color:#555;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">🖼️ ${imgCount} صورة</span>` : ''}
        </div>
        <h3 style="font-size:16px;font-weight:900;margin-bottom:8px;">${escapeHtml(title)}</h3>
        ${price ? `<div style="font-size:16px;font-weight:900;color:#16a34a;margin-bottom:8px;">💰 ${escapeHtml(price)} جنيه</div>` : (priceOnRequest ? `<div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:8px;">💬 تواصل للسعر</div>` : '')}
        ${condition ? `<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">🏷️ الحالة: ${escapeHtml(condition)}</div>` : ''}
        ${color ? `<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">🎨 اللون: ${escapeHtml(color)}</div>` : ''}
        ${warranty ? `<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">🛡️ الضمان: ${escapeHtml(warranty)}</div>` : ''}
        ${qty ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">📦 الكمية المتاحة: ${escapeHtml(qty)}</div>` : ''}
        ${salary ? `<div style="font-size:14px;font-weight:800;color:#1d4ed8;margin-bottom:8px;">💰 ${mode==='seeker'?'الراتب المتوقع':'الراتب المعروض'}: ${escapeHtml(salary)}</div>` : ''}
        ${jobStatus ? `<div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:8px;">📌 الحالة: ${escapeHtml(jobStatus)}</div>` : ''}
        ${address ? `<div style="font-size:12px;color:var(--gray);margin-bottom:8px;">📍 ${escapeHtml(address)}</div>` : ''}
        <div style="font-size:13px;margin:10px 0;">${descHtml}</div>
        ${phone ? `<div style="font-size:13px;font-weight:700;margin-top:10px;">📞 ${escapeHtml(phone)}</div>` : ''}
      </div>
      <button onclick="document.getElementById('adPreviewModal').remove()" style="width:100%;background:var(--primary);color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:14px;">
        تمام، ارجع للتعديل
      </button>
    </div>`;
}

async function submitNewAd() {
  const title = document.getElementById('fTitle').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const phone2 = (document.getElementById('fPhone2')?.value || '').trim();
  const desc = document.getElementById('fDesc').value.trim();
  const catId = document.getElementById('fCat').value;
  const subEl = document.getElementById('fSub');
  let sub = (subEl && subEl.style.display !== 'none') ? subEl.value : '';
  // مجتمع المدرسين: لو مدرّس اختار أكتر من مادة، اجمعهم كلهم في نفس الإعلان
  if(catId === 'teachers_hub' && !sub) {
    const checkedSubjects = Array.from(document.querySelectorAll('.teacherSubjChk:checked')).map(c=>c.value);
    if(checkedSubjects.length === 0) { showToast('اختار مادة واحدة على الأقل، أو نوع الإعلان من القايمة', 'error'); return; }
    sub = checkedSubjects.join('، ');
  }
  if(!title) { showToast('اكتب عنوان الإعلان','error'); return; }
  // رقم التليفون اختياري في قسم الوفيات فقط
  if(catId !== 'deaths' && (!phone || !/^01[0-9]{9}$/.test(phone))) { showToast('رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  const btn = document.getElementById('fSubmit');
  btn.disabled=true; btn.textContent='جاري الإرسال...';
  try {
    const videoLks = getVideoLinks();
    const _curUser = getCurrentUser();
    const adData = {
      title,
      description: desc || null,
      phone: phone || null,
      category: catId,
      subcategory: sub || null,
      status: 'pending',
      image_url: null,
      owner_id: _curUser ? _curUser.id : null,
      is_offer: isAdmin && document.getElementById('fIsOffer')?.checked ? true : false,
      address: document.getElementById('fAddress')?.value.trim() || null,
      location_url: null,
      video_links: videoLks.length > 0 ? JSON.stringify(videoLks) : null,
      price: document.getElementById('fPriceOnRequest')?.checked ? null : (document.getElementById('fPrice')?.value ? parseFloat(document.getElementById('fPrice').value) : null),
      price_on_request: document.getElementById('fPriceOnRequest')?.checked ? true : false,
      quantity: document.getElementById('fQty')?.value ? parseInt(document.getElementById('fQty').value) : null,
      condition: document.getElementById('fCondition')?.value || null,
      color: document.getElementById('fColor')?.value.trim() || null,
      warranty: document.getElementById('fWarranty')?.value.trim() || null,
      salary: catId === 'jobs' ? (document.getElementById('fSalary')?.value.trim() || null) : null,
      job_status: catId === 'jobs' ? (document.getElementById('fJobStatus')?.value || null) : null,
      consultation_price: catId === 'doctors' ? (document.getElementById('fConsultPrice')?.value.trim() || null) : null,
      lost_mode: catId === 'lost' ? (document.getElementById('fLostMode')?.value || 'lost') : null,
      reward: (catId === 'lost' && document.getElementById('fHasReward')?.checked) ? (document.getElementById('fRewardAmount')?.value.trim() || null) : null,
      funeral_info: getDeathsMode() === 'announce' ? (document.getElementById('fFuneralInfo')?.value.trim() || null) : null,
      condolence_info: getDeathsMode() === 'announce' ? (document.getElementById('fCondolenceInfo')?.value.trim() || null) : null,
      relation: getDeathsMode() === 'announce' ? (document.getElementById('fRelation')?.value || null) : null,
      death_date: catId === 'deaths' ? (document.getElementById('fDeathDate')?.value || null) : null,
      opening_hours: catId === 'food' ? (document.getElementById('fOpeningHours')?.value.trim() || null) : null,
      delivery: catId === 'food' ? (document.getElementById('fDelivery')?.value || null) : null
    };
    // إضافة رابط الخريطة بعد التحقق
    var locVal = document.getElementById('fLocation')?.value.trim() || '';
    if(locVal && isValidMapUrl(locVal)) {
      adData.location_url = locVal;
    } else if(locVal) {
      showToast('⚠️ رابط الخريطة مش صح — حطه من Google Maps', 'error');
      btn.disabled=false; btn.textContent='إرسال للمراجعة 🚀';
      return;
    }
    // التحقق من روابط الفيديو
    for(var vi=0; vi<videoLks.length; vi++) {
      if(!isValidVideoUrl(videoLks[vi])) {
        showToast('⚠️ رابط الفيديو مش صح — لازم يكون من يوتيوب أو تيك توك أو فيسبوك أو انستجرام', 'error');
        btn.disabled=false; btn.textContent='إرسال للمراجعة 🚀';
        return;
      }
    }
    console.log('Sending adData:', JSON.stringify(adData));
    const res = await fetch(SB_URL+'/rest/v1/ads', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Prefer':'return=representation' },
      body: JSON.stringify(adData)
    });
    const resText = await res.text();
    if(!res.ok) { console.error('POST error:', resText); throw new Error(resText); }
    const newAds = JSON.parse(resText);
    const newAdId = newAds?.[0]?.id;

    if(newAdId && addSelectedFiles.length > 0) {
      btn.textContent='جاري رفع الصور...';
      const progWrap = document.getElementById('imgUploadProgressWrap');
      const progBar = document.getElementById('imgUploadProgressBar');
      const progPct = document.getElementById('imgUploadProgressPct');
      const progLabel = document.getElementById('imgUploadProgressLabel');
      // لو الرفع استغرق أكتر من ثانيتين، اظهر شريط التقدم
      const showProgTimer = setTimeout(function(){ if(progWrap) progWrap.style.display = 'block'; }, 2000);
      let firstUrl = null;
      for(let i=0; i<addSelectedFiles.length; i++) {
        try {
          if(progLabel) progLabel.textContent = 'جاري رفع الصورة ' + (i+1) + ' من ' + addSelectedFiles.length;
          const url = await uploadImage(addSelectedFiles[i]);
          if(i===0) firstUrl = url;
          await fetch(SB_URL+'/rest/v1/ad_images', {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Prefer':'return=minimal' },
            body: JSON.stringify({ad_id:newAdId, image_url:url})
          });
          const pct = Math.round(((i+1)/addSelectedFiles.length)*100);
          if(progBar) progBar.style.width = pct + '%';
          if(progPct) progPct.textContent = pct + '%';
        } catch(imgErr) { console.error('Image upload error:', imgErr); }
      }
      clearTimeout(showProgTimer);
      if(progWrap) progWrap.style.display = 'none';
      if(firstUrl) {
        // الطريقة الآمنة (نفس اللي بيستخدمها فورم تعديل الإعلان) — التحديث المباشر عبر REST كان بيتمنع بصلاحيات قاعدة البيانات فالصورة كانت بتتحفظ في معرض الصور بس ومش بتوصل لعمود الصورة الرئيسية اللي بتستخدمه كروت العرض بره
        let mainImgSaved = false;
        let lastErrMsg = '';
        if(_curUser && _curUser.token) {
          try {
            await sbRPC('secure_update_ad', {
              p_token: _curUser.token, p_ad_id: newAdId,
              p_title: adData.title, p_description: adData.description,
              p_phone: adData.phone, p_phone2: phone2 || null,
              p_location: adData.address, p_location_url: adData.location_url,
              p_price: adData.price, p_category: adData.category, p_subcategory: adData.subcategory,
              p_images: null,
              p_image_url: firstUrl
            });
            mainImgSaved = true;
          } catch(rpcErr) { lastErrMsg = 'RPC: ' + (rpcErr.message||rpcErr); console.error('secure_update_ad image save failed:', rpcErr.message||rpcErr); }
        } else {
          lastErrMsg = 'مفيش مستخدم مسجّل دخول أو مفيش توكن (token) وقت رفع الصورة';
        }
        // fallback احتياطي لو الطريقة الآمنة فشلت لأي سبب
        if(!mainImgSaved) {
          try {
            const patchRes = await fetch(SB_URL+`/rest/v1/ads?id=eq.${newAdId}`, {
              method:'PATCH',
              headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Prefer':'return=minimal' },
              body: JSON.stringify({image_url:firstUrl})
            });
            if(!patchRes.ok) { const t = await patchRes.text(); lastErrMsg += ' | PATCH: ' + t; console.error('image_url PATCH failed:', t); }
            else mainImgSaved = true;
          } catch(patchErr) { lastErrMsg += ' | PATCH: ' + (patchErr.message||patchErr); console.error('image_url PATCH error:', patchErr); }
        }
        if(mainImgSaved) {
          const _ix = allAds.findIndex(a=>a.id===newAdId); if(_ix!==-1) allAds[_ix].image_url = firstUrl;
        } else {
          showToast('⚠️ الصورة اتحفظت في معرض الصور بس فشل ظهورها بره — ابعت السبب ده للدعم الفني: ' + lastErrMsg.slice(0,180), 'error');
        }
      }
    }
    closeAddModal();
    showSubmitSuccessModal(title);
    // إشعار واتساب
    const cat = CATEGORIES.find(c=>c.id===catId);
    const msg = `🔔 إعلان جديد على دليل الحامول!\n\nالقسم: ${cat?.name||catId}\n${sub?'التخصص: '+sub+'\n':''}العنوان: ${title}\n${desc?'التفاصيل: '+desc+'\n':''}التليفون: ${phone}\n\n⏳ في انتظار موافقتك`;
    setTimeout(() => { const a=document.createElement('a'); a.href=`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`; a.target='_blank'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),500); }, 800);
    await loadAds();
    // الرجوع للقسم اللي رفع فيه
    const returnCat = CATEGORIES.find(c=>c.id===catId) || CATEGORIES.find(c=>c.children?.some(ch=>ch.id===catId));
    if(returnCat) {
      hideDynPage();
      setTimeout(() => {
        if(returnCat.id === catId) {
          showAdsPage(returnCat, sub||null);
        } else {
          const child = returnCat.children?.find(ch=>ch.id===catId);
          if(child) showChildrenPage(returnCat);
          else showAdsPage(returnCat, sub||null);
        }
      }, 300);
    } else {
      hideDynPage();
    }
  } catch(e) {
    console.error('submitNewAd error full:', e);
    const msg = e?.message || String(e) || '';
    if(msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.toLowerCase().includes('network')) {
      showToast('❌ خطأ في الاتصال — تأكد من الإنترنت','error');
    } else if(msg.includes('image upload failed')) {
      showToast('❌ خطأ في رفع الصورة — جرب بدون صورة','error');
    } else if(msg.toLowerCase().includes('violates') || msg.includes('duplicate')) {
      showToast('❌ الإعلان ده موجود بالفعل','error');
    } else if(msg.includes('"code"')) {
      // Supabase JSON error
      try {
        const errObj = JSON.parse(msg);
        showToast('❌ ' + (errObj.message || errObj.hint || errObj.details || msg.slice(0,80)), 'error');
      } catch(_) {
        showToast('❌ خطأ: ' + msg.slice(0,80), 'error');
      }
    } else {
      showToast('❌ ' + (msg.slice(0,80) || 'خطأ غير معروف'), 'error');
    }
  }
  btn.disabled=false; btn.textContent='إرسال للمراجعة 🚀';
}

// ===== ضغط الصور قبل الرفع (تقليل الحجم بدون فقدان جودة ملحوظة) =====
function compressImageFile(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if(!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file); // مش هنضغط GIF (بيفقد الحركة) أو ملفات مش صور
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        // لو الصورة صغيرة بالفعل، مفيش داعي نضغطها
        if(width <= maxDim && height <= maxDim && file.size < 400*1024) {
          resolve(file);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if(!blob || blob.size >= file.size) { resolve(file); return; }
          const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          resolve(new File([blob], newName, {type:'image/jpeg', lastModified: Date.now()}));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  file = await compressImageFile(file);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext) ? ext : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${safeExt}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/ads-images/${fileName}`, {
    method:'POST', headers:{
      'apikey':SB_KEY,
      'Authorization':'Bearer '+SB_KEY,
      'Content-Type':file.type||'image/jpeg',
      'x-upsert':'true'
    }, body:file
  });
  if(!res.ok) {
    const errText = await res.text().catch(()=>'');
    throw new Error('image upload failed: ' + res.status + ' ' + errText.slice(0,100));
  }
  return `${SB_URL}/storage/v1/object/public/ads-images/${fileName}`;
}

// ADMIN
function openAdmin() {
  if(isAdmin) { showAdminPanel('pending'); return; }

  // حماية من محاولات التخمين المتكررة
  const lockUntil = parseInt(localStorage.getItem('admin_lock_until') || '0');
  if(Date.now() < lockUntil) {
    const mins = Math.ceil((lockUntil - Date.now()) / 60000);
    showToast('🔒 محاولات كتير غلط — حاول بعد ' + mins + ' دقيقة', 'error');
    return;
  }

  const pass = prompt('كلمة مرور المشرف:');
  if(!pass) return;

  adminSignIn(pass).then(function(ok) {
    if(ok) {
      localStorage.removeItem('admin_fail_count');
      localStorage.removeItem('admin_lock_until');
      showToast('✅ أهلاً يا مشرف إسلام!');
      var _agb = document.getElementById('adminGearBtn'); if(_agb) _agb.style.display = 'flex';
      loadAds().then(() => showAdminPanel('pending'));
    } else {
      const fails = parseInt(localStorage.getItem('admin_fail_count') || '0') + 1;
      localStorage.setItem('admin_fail_count', String(fails));
      if(fails >= 5) {
        const lockMs = Date.now() + (15 * 60 * 1000); // قفل 15 دقيقة
        localStorage.setItem('admin_lock_until', String(lockMs));
        localStorage.setItem('admin_fail_count', '0');
        showToast('🔒 5 محاولات غلط — اتقفل لمدة 15 دقيقة', 'error');
      } else {
        showToast('كلمة المرور غلط ❌ (' + (5-fails) + ' محاولات متبقية)');
      }
    }
  });
}

// تسجيل دخول الأدمن الحقيقي عن طريق Supabase Auth (مش فحص محلي بس)
// كده السيرفر نفسه بيتأكد من هويته، مش بس المتصفح
async function adminSignIn(password) {
  try {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: password })
    });
    if(!res.ok) return false;
    const data = await res.json();
    if(!data.access_token) return false;
    adminAccessToken = data.access_token;
    adminRefreshToken = data.refresh_token;
    localStorage.setItem('hamoul_admin_refresh', data.refresh_token);
    isAdmin = true;
    return true;
  } catch(e) {
    console.error('admin sign in error:', e);
    return false;
  }
}

// محاولة استرجاع جلسة الأدمن تلقائيًا (لو كان مسجّل دخول قبل كده) بدل ما يدخل الباسورد كل مرة
async function tryRestoreAdminSession() {
  const savedRefresh = localStorage.getItem('hamoul_admin_refresh');
  if(!savedRefresh) return false;
  try {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ refresh_token: savedRefresh })
    });
    if(!res.ok) { localStorage.removeItem('hamoul_admin_refresh'); return false; }
    const data = await res.json();
    if(!data.access_token) return false;
    adminAccessToken = data.access_token;
    adminRefreshToken = data.refresh_token;
    localStorage.setItem('hamoul_admin_refresh', data.refresh_token);
    isAdmin = true;
    return true;
  } catch(e) {
    console.error('admin session restore error:', e);
    return false;
  }
}

async function showAdminPanel(tab='pending') {
  sessionStorage.setItem('dynState', JSON.stringify({type:'admin', tab}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const pending = allAds.filter(a=>a.status==='pending');
  const approved = allAds.filter(a=>a.status==='approved');
  const rejected = allAds.filter(a=>a.status==='rejected');
  const pendingTeachers = pending.filter(a=>a.category==='teachers_hub').length;

  const tabList = [
    ['pending','⏳ انتظار'],['approved','✅ معتمدة'],['rejected','❌ مرفوضة'],
    ['marriage','💍 زواج'],['banners','📢 بانرات'],['broadcast','📣 رسالة عامة'],['stats','📊 إحصائيات'],['merchants','🏪 تجار'],['shops','🛍️ معارض'],['users','👤 مستخدمين'],['dellog','🗑️ سجل الحذف'],['backup','💾 نسخة احتياطية']
  ];

  // بناء الهيكل دايماً من أول
  page.innerHTML = `
    <div class="dyn-header" style="flex-direction:column;gap:0;padding:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;width:100%;">
        <button class="dyn-back" onclick="hideDynPage()">←</button>
        <span>⚙️ لوحة تحكم إسلام عنتر</span>
        <button onclick="adminLogout()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">خروج</button>
      </div>
      ${pendingTeachers > 0 ? `<div onclick="showAdminPanel('pending')" style="background:#7c3aed;color:white;padding:6px 12px;font-size:12px;font-weight:700;text-align:center;cursor:pointer;">👨‍🏫 عندك ${pendingTeachers} منشور من مجتمع المدرسين في انتظار المراجعة</div>` : ''}
      <div style="display:flex;width:100%;background:white;border-bottom:2px solid var(--border);overflow-x:auto;">
        ${tabList.map(([t,l])=>`<button onclick="showAdminPanel('${t}')" style="flex-shrink:0;padding:10px 8px;border:none;background:${tab===t?'#0284c7':'white'};color:${tab===t?'white':'var(--gray)'};font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;position:relative;">${l}${t==='pending'&&pendingTeachers>0?`<span style="position:absolute;top:2px;right:0;background:#ef4444;color:white;border-radius:50%;width:15px;height:15px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:900;">${pendingTeachers}</span>`:''}</button>`).join('')}
      </div>
    </div>
    <div class="dyn-content" style="padding:12px;" id="adminContent">
      <div style="text-align:center;padding:30px;color:var(--gray);">
        <div style="font-size:28px;">⏳</div><p>جاري التحميل...</p>
      </div>
    </div>`;

  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  const cont = page.querySelector('#adminContent');

  if(tab === 'pending' || tab === 'approved' || tab === 'rejected') {
    const ads = tab==='pending' ? pending : tab==='approved' ? approved : rejected;
    renderAdminAdsList(cont, ads, tab);
  } else if(tab === 'banners') {
    cont.innerHTML = '<div id="bannersAdminContent"><div style="text-align:center;padding:30px;color:var(--gray);"><div style="font-size:28px;">⏳</div><p>جاري تحميل البانرات...</p></div></div>';
    setTimeout(loadAdminBanners, 50);
  } else if(tab === 'broadcast') {
    cont.innerHTML =
      '<div style="background:white;border-radius:14px;padding:16px;border:1px solid var(--border);">' +
        '<div style="font-size:14px;font-weight:900;margin-bottom:4px;">📣 إرسال رسالة عامة</div>' +
        '<div style="font-size:12px;color:var(--gray);margin-bottom:14px;">هتوصل كإشعار جوه الموقع لكل العملاء المسجلين دخول، وكبانر في لوحة تحكم كل التجار.</div>' +
        '<input id="bcTitle" type="text" placeholder="عنوان الرسالة" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;box-sizing:border-box;">' +
        '<textarea id="bcBody" placeholder="نص الرسالة (اختياري)" rows="4" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;box-sizing:border-box;resize:vertical;"></textarea>' +
        '<button id="bcSendBtn" onclick="sendAdminBroadcast()" style="width:100%;background:var(--primary);color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">📣 إرسال للجميع</button>' +
      '</div>';
  } else if(tab === 'marriage') {
    loadAdminMarriage(page);
  } else if(tab === 'stats') {
    loadAdminStatsContent(cont);
  } else if(tab === 'merchants') {
    loadAdminMerchants(cont);
  } else if(tab === 'backup') {
    loadAdminBackup(cont);
  } else if(tab === 'shops') {
    loadAdminShops(cont);
  } else if(tab === 'users') {
    loadAdminUsers(cont);
  } else if(tab === 'dellog') {
    loadAdminDeletionLog(cont);
  }
}

async function loadAdminDeletionLog(cont) {
  cont.innerHTML = '<div style="text-align:center;padding:30px;">⏳ جاري التحميل...</div>';
  var logs = [];
  try {
    logs = await sbFetch('GET', 'admin_deletion_log?select=id,table_name,record_id,item_label,deleted_at&order=deleted_at.desc&limit=300') || [];
  } catch(e) {
    console.error('load deletion log error:', e);
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;">⚠️ حصل خطأ في تحميل السجل<br><span style="font-size:11px;">' + (e.message||'') + '</span></div>';
    return;
  }
  var labels = {market_products: '🛒 منتج سوق', shop_traders: '🛍️ معرض', ads: '📋 إعلان', marriage_profiles: '💍 ملف زواج'};
  cont.innerHTML =
    '<div style="background:white;border-radius:14px;padding:14px;">' +
      '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">🗑️ سجل عمليات الحذف (' + logs.length + ')</div>' +
      (!logs.length ? '<p style="font-size:12px;color:#94a3b8;">مفيش عمليات حذف مسجّلة لحد دلوقتي</p>' :
        logs.map(function(l){
          var dt = new Date(l.deleted_at).toLocaleString('ar-EG', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
          return '<div style="padding:9px;background:#f8fafc;border-radius:8px;margin-bottom:6px;">' +
            '<div style="font-size:13px;font-weight:700;">' + (labels[l.table_name] || l.table_name) + ' — ' + escapeHtml(l.item_label||'—') + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:2px;">' + dt + '</div>' +
          '</div>';
        }).join('')
      ) +
    '</div>';
}

async function loadAdminUsers(cont) {
  cont.innerHTML = '<div style="text-align:center;padding:30px;">⏳ جاري التحميل...</div>';
  var users = [];
  try {
    users = await sbFetch('GET', 'users?select=id,name,phone,email,created_at&order=created_at.desc&limit=500') || [];
  } catch(e) {
    console.error('load admin users error:', e);
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;">⚠️ حصل خطأ في تحميل المستخدمين<br><span style="font-size:11px;">' + (e.message||'') + '</span></div>';
    return;
  }
  cont.innerHTML =
    '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">👤 المستخدمون المسجلون (' + users.length + ')</div>' +
      '<input id="adminUsersSearch" type="text" placeholder="🔍 دوّر بالاسم أو رقم الموبايل" oninput="filterAdminUsers()" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;">' +
      '<div id="adminUsersList">' + renderAdminUsersList(users) + '</div>' +
    '</div>';
  window._adminUsersCache = users;
}

function renderAdminUsersList(users) {
  if(!users.length) return '<p style="font-size:12px;color:#94a3b8;">مفيش مستخدمين</p>';
  return users.map(function(u){
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px;background:#f8fafc;border-radius:8px;margin-bottom:6px;">' +
      '<div style="width:36px;height:36px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;">' + escapeHtml(u.name||'—') + '</div>' +
        '<div style="font-size:11px;color:#64748b;">' + (u.phone ? '📱 ' + escapeHtml(u.phone) : '<span style="color:#dc2626;">مفيش رقم موبايل</span>') + (u.email ? ' • ✉️ ' + escapeHtml(u.email) : '') + '</div>' +
      '</div>' +
      (u.phone ? '<a href="https://wa.me/20'+(u.phone.charAt(0)==='0'?u.phone.slice(1):u.phone)+'" target="_blank" style="background:#dcfce7;color:#16a34a;border:none;padding:6px 10px;border-radius:8px;font-size:12px;text-decoration:none;flex-shrink:0;">💬</a>' : '') +
      '<button data-uid="'+u.id+'" data-uname="'+escapeHtml(u.name||'')+'" onclick="resetUserPassword(this.dataset.uid,this.dataset.uname)" style="background:#fef3c7;color:#92400e;border:none;padding:6px 10px;border-radius:8px;font-size:14px;cursor:pointer;flex-shrink:0;">🔑</button>' +
    '</div>';
  }).join('');
}

async function resetUserPassword(userId, userName) {
  if(!confirm('تعيد ضبط كلمة سر "'+userName+'"؟ الباسورد القديم هيبقى ملغي.\n\n(ملحوظة: لو المستخدم بيدخل بالجيميل بس، الباسورد الجديد ده مش هيتستخدم أصلاً)')) return;
  const tempPass = String(Math.floor(100000 + Math.random()*900000));
  try {
    const passHash = await hashPass(tempPass);
    await sbRPC('admin_reset_user_password', {p_user_id: userId, p_new_password_hash: passHash});
    prompt('كلمة السر المؤقتة الجديدة (انسخها وابعتها للمستخدم):', tempPass);
    showToast('✅ تم إعادة ضبط كلمة السر');
  } catch(e) { showToast('حصل خطأ', 'error'); }
}

function filterAdminUsers() {
  var q = (document.getElementById('adminUsersSearch').value||'').trim().toLowerCase();
  var users = window._adminUsersCache || [];
  var filtered = !q ? users : users.filter(function(u){
    return (u.name||'').toLowerCase().indexOf(q)!==-1 || (u.phone||'').indexOf(q)!==-1;
  });
  document.getElementById('adminUsersList').innerHTML = renderAdminUsersList(filtered);
}

async function loadAdminShops(cont) {
  cont.innerHTML = '<div style="text-align:center;padding:30px;">⏳ جاري التحميل...</div>';
  var traders = [];
  try {
    traders = await sbFetch('GET', 'shop_traders?select=id,category,subcategory,shop_name,phone,logo_url,description,status,created_at,address,map_url,social_links,pin_order,sort_order,gallery_images,opening_hours,delivery_available,last_comments_seen_at&order=created_at.desc&limit=200') || [];
  } catch(e) {
    console.error('load admin shops error:', e);
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;">⚠️ حصل خطأ في تحميل المعارض<br><span style="font-size:11px;">' + (e.message||'') + '</span></div>';
    return;
  }
  window._adminShopsCache = traders;
  cont.innerHTML =
    '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">🔍 دوّر على معرض</div>' +
      '<input id="adminShopsSearch" type="text" placeholder="اكتب اسم المعرض أو رقم الموبايل..." oninput="filterAdminShops()" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">' +
    '</div>' +
    '<div id="adminShopsListsWrap"></div>';
  renderAdminShopsLists(traders);
}

function renderAdminShopsLists(traders) {
  var wrap = document.getElementById('adminShopsListsWrap');
  if(!wrap) return;
  var pending = traders.filter(function(t){ return t.status==='pending'; });
  var approved = traders.filter(function(t){ return t.status==='approved'; });

  wrap.innerHTML =
    '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">⏳ معارض تنتظر الموافقة (' + pending.length + ')</div>' +
      (pending.length ? pending.map(function(t){
        return '<div style="background:#fef9c3;border-radius:10px;padding:12px;margin-bottom:8px;">' +
          '<div style="font-size:13px;font-weight:900;">' + escapeHtml(t.shop_name) + '</div>' +
          '<div style="font-size:11px;color:#64748b;margin-top:2px;">📦 ' + t.subcategory + ' • 📞 ' + t.phone + '</div>' +
          (t.description ? '<div style="font-size:11px;color:#64748b;margin-top:2px;">' + escapeHtml(t.description) + '</div>' : '') +
          '<div style="display:flex;gap:8px;margin-top:8px;">' +
            '<button data-tid="'+t.id+'" onclick="approveShopTrader(this.dataset.tid)" style="flex:1;background:#16a34a;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ اعتمد</button>' +
            '<button data-tid="'+t.id+'" onclick="rejectShopTrader(this.dataset.tid)" style="flex:1;background:#dc2626;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">❌ ارفض</button>' +
          '</div>' +
        '</div>';
      }).join('') : '<p style="font-size:12px;color:#94a3b8;">مفيش معارض في الانتظار</p>') +
    '</div>' +
    '<div style="background:white;border-radius:14px;padding:14px;">' +
      '<div style="font-size:14px;font-weight:900;margin-bottom:10px;">✅ معارض معتمدة (' + approved.length + ')</div>' +
      (approved.length ? approved.map(function(t){
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f0fdf4;border-radius:8px;margin-bottom:6px;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:700;">' + escapeHtml(t.shop_name) + '</div>' +
            '<div style="font-size:11px;color:#64748b;">' + t.subcategory + ' • ' + t.phone + '</div>' +
          '</div>' +
          '<button data-tid="'+t.id+'" data-tcat="'+t.category+'" data-tsub="'+escapeHtml(t.subcategory||'')+'" onclick="moveShopTraderToCategory(this.dataset.tid,this.dataset.tcat,this.dataset.tsub)" style="background:#dbeafe;color:#1d4ed8;border:none;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">📂 نقل</button>' +
          '<button data-tid="'+t.id+'" data-tname="'+escapeHtml(t.shop_name||'')+'" onclick="resetShopTraderPassword(this.dataset.tid,this.dataset.tname)" style="background:#fef3c7;color:#92400e;border:none;padding:5px 10px;border-radius:8px;font-size:14px;cursor:pointer;">🔑</button>' +
          '<button data-tid="'+t.id+'" data-tname="'+escapeHtml(t.shop_name||'')+'" onclick="deleteShopTraderAdmin(this.dataset.tid,this.dataset.tname)" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 10px;border-radius:8px;font-size:12px;cursor:pointer;">🗑️</button>' +
        '</div>';
      }).join('') : '<p style="font-size:12px;color:#94a3b8;">مفيش معارض معتمدة</p>') +
    '</div>';
}

function filterAdminShops() {
  var q = (document.getElementById('adminShopsSearch')?.value || '').trim().toLowerCase();
  var traders = window._adminShopsCache || [];
  var filtered = !q ? traders : traders.filter(function(t){
    return (t.shop_name||'').toLowerCase().indexOf(q) !== -1 || (t.phone||'').indexOf(q) !== -1;
  });
  renderAdminShopsLists(filtered);
}

// نقل معرض لقسم/تخصص فرعي تاني (للأدمن) — زي نقل الإعلانات بالظبط
function moveShopTraderToCategory(traderId, currentCat, currentSub) {
  const options = [];
  CATEGORIES.forEach(function(c) {
    if(SHOP_ONLY_CAT_IDS.indexOf(c.id) !== -1 && c.subs && c.subs.length > 0) {
      c.subs.forEach(function(s) {
        var sName = typeof s === 'string' ? s : s.name;
        options.push({cat: c.id, sub: sName, label: c.icon + ' ' + c.name + ' — ' + sName});
      });
    }
    if(c.children) {
      c.children.forEach(function(child) {
        if(typeof NESTED_SHOP_CHILDREN !== 'undefined' && NESTED_SHOP_CHILDREN.indexOf(child.id) !== -1 && child.subs && child.subs.length > 0) {
          child.subs.forEach(function(s) {
            var sName = typeof s === 'string' ? s : s.name;
            options.push({cat: child.id, sub: sName, label: c.icon + ' ' + c.name + ' ← ' + child.name + ' ← ' + sName});
          });
        }
      });
    }
  });

  const modal = document.createElement('div');
  modal.id = 'moveShopModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';

  var btns = options.map(function(o) {
    var isCurrent = (o.cat === currentCat && o.sub === currentSub);
    var btn = document.createElement('button');
    btn.style.cssText = "background:" + (isCurrent ? "#dbeafe" : "#f8fafc") + ";border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;text-align:right;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#1e293b;margin-bottom:6px;width:100%;";
    btn.textContent = o.label + (isCurrent ? ' ✅ الحالي' : '');
    btn.dataset.cat = o.cat;
    btn.dataset.sub = o.sub;
    btn.dataset.tid = traderId;
    btn.onclick = function() { confirmMoveShopTrader(this.dataset.tid, this.dataset.cat, this.dataset.sub); };
    return btn.outerHTML;
  }).join('');

  modal.innerHTML = '<div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:80vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div style="font-size:16px;font-weight:900;">📂 نقل المعرض لقسم آخر</div>' +
    '<button id="closeMoveShopModal" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">×</button>' +
    '</div>' +
    '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">اختار القسم الجديد:</div>' +
    '<div id="moveShopBtnsWrap">' + btns + '</div>' +
    '</div>';

  document.body.appendChild(modal);
  document.getElementById('closeMoveShopModal').onclick = function() { modal.remove(); };
  modal.addEventListener('click', function(e) { if(e.target === modal) modal.remove(); });

  document.querySelectorAll('#moveShopBtnsWrap button').forEach(function(btn) {
    btn.onclick = function() {
      confirmMoveShopTrader(btn.dataset.tid, btn.dataset.cat, btn.dataset.sub);
    };
  });
}

async function confirmMoveShopTrader(traderId, newCat, newSub) {
  var modal = document.getElementById('moveShopModal');
  try {
    await sbFetch('PATCH', 'shop_traders?id=eq.' + traderId, {category: newCat, subcategory: newSub});
    if(modal) modal.remove();
    showToast('✅ تم نقل المعرض بنجاح');
    showAdminPanel('shops');
  } catch(e) {
    showToast('خطأ في النقل ❌', 'error');
  }
}

async function resetShopTraderPassword(traderId, traderName) {
  if(!confirm('تعيد ضبط كلمة سر "'+traderName+'"؟ الباسورد القديم هيبقى ملغي.')) return;
  const tempPass = String(Math.floor(100000 + Math.random()*900000)); // كود 6 أرقام
  try {
    const passHash = await hashPass(tempPass);
    await sbRPC('admin_reset_shop_trader_password', {p_trader_id: traderId, p_new_password_hash: passHash});
    prompt('كلمة السر المؤقتة الجديدة (انسخها وابعتها لصاحب النشاط):', tempPass);
    showToast('✅ تم إعادة ضبط كلمة السر');
  } catch(e) { showToast('حصل خطأ', 'error'); }
}

async function approveShopTrader(id) {
  await sbFetch('PATCH', 'shop_traders?id=eq.'+id, {status:'approved'});
  showToast('✅ تم اعتماد المعرض');
  showAdminPanel('shops');
}

async function rejectShopTrader(id) {
  await sbFetch('PATCH', 'shop_traders?id=eq.'+id, {status:'rejected'});
  showToast('تم رفض المعرض');
  showAdminPanel('shops');
}

async function deleteShopTraderAdmin(id, shopName) {
  if(!confirm('مسح المعرض نهائياً؟ (منتجاته هتتخفي معاه)')) return;
  try {
    // نستخدم PATCH بدل DELETE عشان يشتغل على الموبايل (زي حذف الإعلانات بالظبط)
    await sbFetch('PATCH', 'shop_traders?id=eq.'+id, {status: 'deleted'});
    await sbRPC('admin_log_deletion', {p_table_name: 'shop_traders', p_record_id: id, p_item_label: shopName || ''});
    showToast('تم الحذف');
    showAdminPanel('shops');
  } catch(e) {
    showToast('⚠️ حصل خطأ في الحذف — جرب تاني', 'error');
    console.error('delete shop trader error:', e);
  }
}

function loadAdminBackup(cont) {
  cont.innerHTML = `
    <div style="background:white;border-radius:14px;padding:16px;margin-bottom:14px;border:1px solid var(--border);">
      <div style="font-size:14px;font-weight:900;margin-bottom:10px;">💾 نسخة احتياطية من كل بيانات الموقع</div>
      <p style="font-size:12px;color:#64748b;margin-bottom:14px;line-height:1.7;">
        بتحمّل ملف فيه كل الإعلانات، التجار، بروفايلات الزواج، المنتديات، البانرات، وكل حاجة في الموقع.
        احتفظ بالملف ده في مكان آمن (إيميلك، Google Drive). لو حصلت مشكلة، الملف ده بيوثّق كل البيانات وقت التحميل.
      </p>
      <button onclick="downloadFullBackup()" id="backupBtn" style="width:100%;background:#1a7a4a;color:white;border:none;padding:14px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">⬇️ تحميل نسخة احتياطية الآن</button>
      <div id="backupStatus" style="margin-top:10px;font-size:12px;color:#64748b;text-align:center;"></div>
    </div>
    <div style="background:#fef9c3;border-radius:14px;padding:14px;border:1px solid #fde047;">
      <div style="font-size:12px;font-weight:900;margin-bottom:6px;">💡 نصيحة</div>
      <div style="font-size:12px;color:#92400e;line-height:1.7;">حمّل نسخة احتياطية مرة كل أسبوع على الأقل، وخصوصاً قبل أي تعديل كبير في الموقع.</div>
    </div>`;
}

async function downloadFullBackup() {
  var btn = document.getElementById('backupBtn');
  var status = document.getElementById('backupStatus');
  btn.disabled = true;
  btn.textContent = '⏳ جاري تجميع البيانات...';

  var tables = [
    'ads', 'market_traders', 'transport_votes', 'marriage_profiles',
    'marriage_likes', 'marriage_requests', 'community_posts', 'community_comments',
    'community_likes', 'banners', 'ad_stats', 'ad_likes', 'reviews', 'site_visits'
  ];

  var backup = { exported_at: new Date().toISOString(), site: 'دليل الحامول' };
  var done = 0;

  for(var i=0; i<tables.length; i++) {
    var t = tables[i];
    try {
      status.textContent = 'جاري تحميل: ' + t + ' (' + (i+1) + '/' + tables.length + ')';
      var rows = await sbFetch('GET', t + '?select=*&limit=5000');
      backup[t] = rows || [];
      done++;
    } catch(e) {
      backup[t] = { error: 'تعذر تحميل هذا الجدول' };
    }
  }

  var json = JSON.stringify(backup, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = 'hamoul-backup-' + dateStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  btn.disabled = false;
  btn.textContent = '⬇️ تحميل نسخة احتياطية الآن';
  status.textContent = '✅ تم تحميل ' + done + ' من ' + tables.length + ' جدول بنجاح';
  showToast('✅ تم تحميل النسخة الاحتياطية');
}

function loadAdminMerchants(cont) {
  // جيب كل أجهزة التجار المفعلة من localStorage — الأدمن بيشوف كودهم
  cont.innerHTML = `
    <div style="background:white;border-radius:14px;padding:16px;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:900;margin-bottom:10px;">🏪 تفعيل حساب تاجر</div>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px;">
        التاجر يفتح الموقع على موبايله وبيبعتلك كود الجهاز. أنت بتضيفه هنا وهو هيقدر يضيف أسعار السوق.
      </p>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="merchantCodeInput" type="text" placeholder="كود الجهاز..." style="flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;">
        <input id="merchantNameInput" type="text" placeholder="اسم التاجر..." style="flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;">
      </div>
      <button onclick="addMerchantCode()" style="width:100%;background:#16a34a;color:white;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">✅ تفعيل التاجر</button>
    </div>
    <div style="background:white;border-radius:14px;padding:16px;">
      <div style="font-size:14px;font-weight:900;margin-bottom:10px;">📋 التجار المفعلون</div>
      <div id="merchantsList">${renderMerchantsList()}</div>
    </div>
    <div style="background:#fef9c3;border-radius:14px;padding:14px;margin-top:14px;border:1px solid #fde047;">
      <div style="font-size:12px;font-weight:900;margin-bottom:6px;">📱 كودك أنت على الجهاز ده:</div>
      <div style="font-size:14px;font-weight:900;color:#92400e;letter-spacing:1px;">${getDeviceCode()}</div>
      <div style="font-size:11px;color:#92400e;margin-top:4px;">ابعته للتاجر عشان يديك كوده</div>
    </div>`;
}

function getDeviceCode() {
  var code = localStorage.getItem('hamoul_device_code');
  if(!code) {
    code = Math.random().toString(36).substr(2,8).toUpperCase();
    localStorage.setItem('hamoul_device_code', code);
  }
  return code;
}

function renderMerchantsList() {
  try {
    var merchants = JSON.parse(localStorage.getItem('hamoul_merchants') || '[]');
    if(!merchants.length) return '<p style="color:var(--gray);font-size:13px;">مفيش تجار مفعلين لحد دلوقتي</p>';
    return merchants.map((m,i) => 
      '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">' +
      '<div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + m.name + '</div>' +
      '<div style="font-size:11px;color:#64748b;">' + m.code + '</div></div>' +
      '<button onclick="removeMerchant(' + i + ')" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 10px;border-radius:8px;font-size:12px;cursor:pointer;">حذف</button>' +
      '</div>'
    ).join('');
  } catch(e) { return ''; }
}

function addMerchantCode() {
  var code = document.getElementById('merchantCodeInput').value.trim().toUpperCase();
  var name = document.getElementById('merchantNameInput').value.trim();
  if(!code || !name) { showToast('اكتب الكود والاسم', 'error'); return; }
  var merchants = JSON.parse(localStorage.getItem('hamoul_merchants') || '[]');
  if(merchants.find(m => m.code === code)) { showToast('الكود ده موجود بالفعل', 'error'); return; }
  merchants.push({code, name});
  localStorage.setItem('hamoul_merchants', JSON.stringify(merchants));
  showToast('✅ تم تفعيل التاجر ' + name);
  document.getElementById('merchantsList').innerHTML = renderMerchantsList();
  document.getElementById('merchantCodeInput').value = '';
  document.getElementById('merchantNameInput').value = '';
}

function removeMerchant(idx) {
  var merchants = JSON.parse(localStorage.getItem('hamoul_merchants') || '[]');
  merchants.splice(idx, 1);
  localStorage.setItem('hamoul_merchants', JSON.stringify(merchants));
  document.getElementById('merchantsList').innerHTML = renderMerchantsList();
  showToast('تم حذف التاجر');
}

// ===== تتبع زيارات الموقع =====
async function trackSiteVisit() {
  try {
    // زيارة واحدة بس لكل جلسة (مش كل ضغطة)
    if(sessionStorage.getItem('visit_tracked')) return;
    sessionStorage.setItem('visit_tracked', '1');

    var vid = localStorage.getItem('hamoul_visitor_id');
    if(!vid) {
      vid = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
      localStorage.setItem('hamoul_visitor_id', vid);
    }
    var deviceType = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent||'') ? 'mobile' : 'desktop';
    await sbFetch('POST', 'site_visits', { visitor_id: vid, device_type: deviceType });
  } catch(e) {}
}

async function loadSiteVisitsData(fromDate, toDate) {
  try {
    var url = 'site_visits?select=visitor_id,created_at&order=created_at.desc&limit=10000';
    if(fromDate) url += '&created_at=gte.' + fromDate.toISOString();
    var rows = await sbFetch('GET', url) || [];
    if(toDate) {
      var toTime = toDate.getTime();
      rows = rows.filter(function(r){ return new Date(r.created_at).getTime() <= toTime; });
    }
    return rows;
  } catch(e) { return []; }
}

function showVisitsDateFilter() {
  var overlay = document.createElement('div');
  overlay.id = 'visitsFilterOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:20px;width:100%;max-width:340px;">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:14px;text-align:center;">📅 عدد الزوار في فترة معينة</div>' +
      '<label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">من تاريخ</label>' +
      '<input id="vf_from" type="date" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;">' +
      '<label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">إلى تاريخ</label>' +
      '<input id="vf_to" type="date" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:14px;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="calcVisitsRange()" style="flex:1;background:#0369a1;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">احسب</button>' +
        '<button onclick="document.getElementById(\'visitsFilterOverlay\').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  // افتراضي: آخر 7 أيام
  var to = new Date(), from = new Date(); from.setDate(from.getDate()-6);
  document.getElementById('vf_to').value = to.toISOString().split('T')[0];
  document.getElementById('vf_from').value = from.toISOString().split('T')[0];
}

function calcVisitsRange() {
  var fromStr = document.getElementById('vf_from').value;
  var toStr = document.getElementById('vf_to').value;
  if(!fromStr || !toStr) { showToast('اختار التاريخين', 'error'); return; }
  var from = new Date(fromStr + 'T00:00:00');
  var to = new Date(toStr + 'T23:59:59');
  var visits = window._siteVisitsAll || [];
  var filtered = visits.filter(function(v) {
    var t = new Date(v.created_at).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
  var uniqueCount = new Set(filtered.map(function(v){ return v.visitor_id; })).size;

  document.getElementById('visitsFilterOverlay').remove();
  var resBox = document.getElementById('visitsDateResult');
  if(resBox) {
    resBox.innerHTML = '<div style="background:rgba(255,255,255,.25);border-radius:10px;padding:10px;text-align:center;">' +
      '<div style="font-size:11px;opacity:.85;margin-bottom:4px;">من ' + fromStr + ' إلى ' + toStr + '</div>' +
      '<div style="font-size:20px;font-weight:900;">' + filtered.length + ' زيارة</div>' +
      '<div style="font-size:11px;opacity:.85;">(' + uniqueCount + ' زائر فريد)</div>' +
    '</div>';
  }
}

async function loadAdminStatsContent(cont) {
  cont.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray);"><div style="font-size:28px;margin-bottom:8px;">⏳</div><p>جاري تحميل الإحصائيات...</p></div>';
  try {
    const pending = allAds.filter(a=>a.status==='pending');
    const approved = allAds.filter(a=>a.status==='approved');
    const rejected = allAds.filter(a=>a.status==='rejected');

    let adStats=[], likes=[], reviews=[], marriageProfiles=[], marriageLikes=[], marriageRequests=[], siteVisits=[], appInstalls=[];
    [adStats, likes, reviews, marriageProfiles, marriageLikes, marriageRequests, siteVisits, appInstalls] = await Promise.all([
      sbFetch('GET', 'ad_stats?select=ad_id,event_type,created_at').catch(()=>[]) || [],
      sbFetch('GET', 'ad_likes?select=ad_id').catch(()=>[]) || [],
      sbFetch('GET', 'reviews?select=id,rating').catch(()=>[]) || [],
      sbFetch('GET', 'marriage_profiles?select=id,status,gender,city').catch(()=>[]) || [],
      sbFetch('GET', 'marriage_likes?select=id').catch(()=>[]) || [],
      sbFetch('GET', 'marriage_requests?select=id,status').catch(()=>[]) || [],
      sbFetch('GET', 'site_visits?select=visitor_id,created_at,device_type&order=created_at.desc&limit=10000').catch(()=>[]) || [],
      sbFetch('GET', 'app_installs?select=device_id,platform,created_at&order=created_at.desc&limit=10000').catch(()=>[]) || [],
    ]);
    window._siteVisitsAll = siteVisits;
    const totalInstalls = appInstalls.length;
    const installsAndroid = appInstalls.filter(i=>i.platform==='android').length;
    const installsIOS = appInstalls.filter(i=>i.platform==='ios').length;
    const installsDesktop = appInstalls.filter(i=>i.platform==='desktop').length;

    const totalViews = (adStats||[]).filter(s=>s.event_type==='view').length;
    setTimeout(()=>renderViewsChart(adStats), 100);
    const totalWA = (adStats||[]).filter(s=>s.event_type==='whatsapp').length;
    const totalLikes = (likes||[]).length;
    const avgRating = (reviews||[]).length ? ((reviews||[]).reduce((s,r)=>s+(r.rating||0),0)/(reviews||[]).length).toFixed(1) : '—';

    const viewsPerAd = {};
    (adStats||[]).filter(s=>s.event_type==='view').forEach(s => viewsPerAd[s.ad_id]=(viewsPerAd[s.ad_id]||0)+1);
    const topAds = Object.entries(viewsPerAd).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>({
      ad: allAds.find(a=>String(a.id)===String(id)), views: v
    })).filter(x=>x.ad);

    const catCount = {};
    approved.forEach(a => catCount[a.category]=(catCount[a.category]||0)+1);
    const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];
    const topCatObj = topCat ? CATEGORIES.find(c=>c.id===topCat[0]) : null;

    const mApproved = (marriageProfiles||[]).filter(p=>p.status==='approved').length;
    const mPending = (marriageProfiles||[]).filter(p=>p.status==='pending').length;
    const mMale = (marriageProfiles||[]).filter(p=>p.gender==='male').length;
    const mFemale = (marriageProfiles||[]).filter(p=>p.gender==='female').length;
    const mReqPending = (marriageRequests||[]).filter(r=>r.status==='pending').length;

    // حساب زيارات اليوم والأمس والإجمالي
    const todayStr = new Date().toISOString().split('T')[0];
    const yestStr = new Date(Date.now()-86400000).toISOString().split('T')[0];
    const visitsToday = siteVisits.filter(v=>v.created_at.startsWith(todayStr)).length;
    const visitsYest = siteVisits.filter(v=>v.created_at.startsWith(yestStr)).length;
    const uniqueVisitorsToday = new Set(siteVisits.filter(v=>v.created_at.startsWith(todayStr)).map(v=>v.visitor_id)).size;
    const uniqueVisitorsTotal = new Set(siteVisits.map(v=>v.visitor_id)).size;

    cont.innerHTML = `
      <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:900;opacity:.9;">👥 زوار الموقع</div>
          <button onclick="showVisitsDateFilter()" style="background:rgba(255,255,255,.25);color:white;border:none;padding:5px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📅 فترة معينة</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${visitsToday}</div>
            <div style="font-size:10px;opacity:.85;">📈 زيارة النهارده</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${uniqueVisitorsToday}</div>
            <div style="font-size:10px;opacity:.85;">👤 زائر فريد النهارده</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:16px;font-weight:900;">${visitsYest}</div>
            <div style="font-size:10px;opacity:.8;">أمس</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:16px;font-weight:900;">${uniqueVisitorsTotal}</div>
            <div style="font-size:10px;opacity:.8;">إجمالي الزوار الفريدين</div>
          </div>
        </div>
        <div id="visitsDateResult" style="margin-top:8px;"></div>
      </div>

      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">📲 تثبيت التطبيق</div>
        <div style="display:grid;grid-template-columns:repeat(1,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:28px;font-weight:900;">${totalInstalls}</div>
            <div style="font-size:11px;opacity:.85;">إجمالي عدد من ثبّت التطبيق</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:16px;font-weight:900;">${installsAndroid}</div>
            <div style="font-size:10px;opacity:.8;">🤖 أندرويد</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:16px;font-weight:900;">${installsIOS}</div>
            <div style="font-size:10px;opacity:.8;">🍎 آيفون</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:16px;font-weight:900;">${installsDesktop}</div>
            <div style="font-size:10px;opacity:.8;">💻 كمبيوتر</div>
          </div>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#1a7a4a,#22c55e);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">📊 دليل الحامول — الإجمالي</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${allAds.length}</div>
            <div style="font-size:10px;opacity:.85;">📋 إعلانات</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalViews}</div>
            <div style="font-size:10px;opacity:.85;">👁️ مشاهدة</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalWA}</div>
            <div style="font-size:10px;opacity:.85;">📞 تواصل</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalLikes}</div>
            <div style="font-size:10px;opacity:.85;">❤️ إعجاب</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${(reviews||[]).length}</div>
            <div style="font-size:10px;opacity:.85;">⭐ تقييم</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${avgRating}</div>
            <div style="font-size:10px;opacity:.85;">📈 متوسط</div>
          </div>
        </div>
        ${topCatObj?'<div style="margin-top:8px;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">🏆 أكتر قسم: <strong>'+topCatObj.icon+' '+topCatObj.name+'</strong> ('+topCat[1]+' إعلان)</div>':''}
      </div>

      <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📋 حالة الإعلانات</div>
        <div style="display:flex;gap:3px;height:12px;border-radius:6px;overflow:hidden;margin-bottom:10px;">
          <div style="background:#10b981;width:${allAds.length?(approved.length/allAds.length*100):0}%;"></div>
          <div style="background:#f59e0b;width:${allAds.length?(pending.length/allAds.length*100):0}%;"></div>
          <div style="background:#ef4444;width:${allAds.length?(rejected.length/allAds.length*100):0}%;"></div>
        </div>
        <div style="display:flex;gap:12px;font-size:12px;">
          <span>✅ معتمدة: <strong>${approved.length}</strong></span>
          <span>⏳ انتظار: <strong style="color:#f59e0b;">${pending.length}</strong></span>
          <span>❌ مرفوضة: <strong style="color:#ef4444;">${rejected.length}</strong></span>
        </div>
      </div>

      ${topAds.length ? '<div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);"><div style="font-size:13px;font-weight:900;margin-bottom:10px;">🔥 أكتر إعلانات مشاهدة</div>' +
        topAds.map((item,i)=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;" onclick="openAdDetails(\''+item.ad.id+'\')"><div style="width:28px;height:28px;border-radius:50%;background:'+(i===0?'#fef9c3':i===1?'#f3f4f6':'#f9fafb')+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:'+(i===0?'#d97706':'var(--gray)')+'">'+(i+1)+'</div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(item.ad.title||'—')+'</div><div style="font-size:11px;color:var(--gray);">'+(item.ad.phone||'')+'</div></div><div style="text-align:left;flex-shrink:0;"><div style="font-size:13px;font-weight:900;color:var(--primary);">'+item.views+'</div><div style="font-size:10px;color:var(--gray);">مشاهدة</div></div></div>').join('') +
      '</div>' : ''}

      <div id="statsChartSection" style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📈 إحصائيات المشاهدات والتواصل</div>
        <!-- فلاتر سريعة -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;" id="chartQuickFilters">
          <button onclick="setChartPeriod('7d')" id="cf_7d" style="padding:5px 10px;border-radius:20px;border:1px solid #0284c7;background:#0284c7;color:white;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">آخر 7 أيام</button>
          <button onclick="setChartPeriod('30d')" id="cf_30d" style="padding:5px 10px;border-radius:20px;border:1px solid #e2e8f0;background:white;color:#64748b;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">آخر شهر</button>
          <button onclick="setChartPeriod('3m')" id="cf_3m" style="padding:5px 10px;border-radius:20px;border:1px solid #e2e8f0;background:white;color:#64748b;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">آخر 3 شهور</button>
          <button onclick="setChartPeriod('1y')" id="cf_1y" style="padding:5px 10px;border-radius:20px;border:1px solid #e2e8f0;background:white;color:#64748b;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">آخر سنة</button>
          <button onclick="setChartPeriod('custom')" id="cf_custom" style="padding:5px 10px;border-radius:20px;border:1px solid #e2e8f0;background:white;color:#64748b;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📅 تاريخ محدد</button>
        </div>
        <!-- فلتر تاريخ مخصص -->
        <div id="customDateRange" style="display:none;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#64748b;">من:</div>
          <input type="date" id="chartDateFrom" style="padding:5px 8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
          <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#64748b;">إلى:</div>
          <input type="date" id="chartDateTo" style="padding:5px 8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
          <button onclick="applyCustomDateRange()" style="padding:5px 12px;background:#0284c7;color:white;border:none;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">عرض</button>
        </div>
        <!-- إجمالي الفترة -->
        <div id="chartTotals" style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;background:#eff6ff;border-radius:10px;padding:8px;text-align:center;">
            <div id="totalViewsNum" style="font-size:20px;font-weight:900;color:#0284c7;">0</div>
            <div style="font-size:10px;color:#64748b;">👁️ مشاهدات</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:8px;text-align:center;">
            <div id="totalWaNum" style="font-size:20px;font-weight:900;color:#166534;">0</div>
            <div style="font-size:10px;color:#64748b;">📞 تواصل</div>
          </div>
          <div style="flex:1;background:#fef3c7;border-radius:10px;padding:8px;text-align:center;">
            <div id="convRateNum" style="font-size:20px;font-weight:900;color:#d97706;">0%</div>
            <div style="font-size:10px;color:#64748b;">💡 معدل تحويل</div>
          </div>
        </div>
        <!-- الرسم البياني -->
        <canvas id="viewsChart" height="160"></canvas>
        <div style="display:flex;gap:12px;margin-top:8px;justify-content:center;">
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;"><div style="width:12px;height:12px;border-radius:3px;background:#0284c7;"></div>مشاهدات</div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;"><div style="width:12px;height:12px;border-radius:3px;background:#25D366;"></div>تواصل واتساب</div>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#be185d,#ec4899);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">💍 بيت الحلال</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;">${(marriageProfiles||[]).length}</div>
            <div style="font-size:10px;opacity:.85;">إجمالي</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#bbf7d0;">${mApproved}</div>
            <div style="font-size:10px;opacity:.85;">✅ معتمدة</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#fef08a;">${mPending}</div>
            <div style="font-size:10px;opacity:.85;">⏳ انتظار</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;">👨 ${mMale}</div>
            <div style="font-size:10px;opacity:.85;">طالب زواج</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;">👩 ${mFemale}</div>
            <div style="font-size:10px;opacity:.85;">طالبة زواج</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:${mReqPending>0?'#fef08a':'white'};">📩 ${mReqPending}</div>
            <div style="font-size:10px;opacity:.85;">طلبات جديدة</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <div style="flex:1;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">❤️ ${(marriageLikes||[]).length} إعجاب</div>
          <div style="flex:1;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">📩 ${(marriageRequests||[]).length} طلب تواصل</div>
        </div>
      </div>

      <div style="text-align:center;padding:8px;font-size:11px;color:var(--gray);">
        آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}
        <button onclick="loadAdminStatsContent(document.getElementById('adminContent'))" style="margin-right:8px;background:#f3f4f6;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">↺ تحديث</button>
      </div>`;

    // ===== إحصائيات إضافية =====
    renderExtraAdminStats(cont, {adStats, allAdsSnapshot: allAds.slice(), siteVisits});
  } catch(e) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);font-family:Cairo,sans-serif;"><p>خطأ في تحميل الإحصائيات</p><button onclick="loadAdminStatsContent(document.getElementById(\'adminContent\'))" style="margin-top:12px;background:#f3f4f6;border:none;padding:8px 16px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">↺ إعادة المحاولة</button></div>';
  }
}

function renderExtraAdminStats(cont, data) {
  const adStats = data.adStats || [];
  const allAdsSnap = data.allAdsSnapshot || [];
  const siteVisits = data.siteVisits || [];

  // 1) أكتر الأقسام زيارة
  const adCatMap = {};
  allAdsSnap.forEach(a => { adCatMap[a.id] = a.category; });
  const catViewCounts = {};
  adStats.filter(s=>s.event_type==='view').forEach(s => {
    const catId = adCatMap[s.ad_id];
    if(!catId) return;
    catViewCounts[catId] = (catViewCounts[catId]||0) + 1;
  });
  const topCats = Object.entries(catViewCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,v]) => {
    const cat = CATEGORIES.find(c=>c.id===id) || CATEGORIES.find(c=>(c.children||[]).some(ch=>ch.id===id));
    return {name: cat ? cat.name : id, icon: cat ? cat.icon : '📋', views: v};
  });

  // 2) معدل إعلانات جديدة يوميًا (آخر 7 أيام)
  const dayLabels = [], dayCounts = [];
  for(let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const dEnd = new Date(d); dEnd.setDate(dEnd.getDate()+1);
    const count = allAdsSnap.filter(a => { const t=new Date(a.created_at); return t>=d && t<dEnd; }).length;
    dayLabels.push(d.toLocaleDateString('ar-EG',{day:'numeric',month:'numeric'}));
    dayCounts.push(count);
  }
  const maxDayCount = Math.max(...dayCounts, 1);

  // 3) توزيع الأجهزة
  const mobileCount = siteVisits.filter(v=>v.device_type==='mobile').length;
  const desktopCount = siteVisits.filter(v=>v.device_type==='desktop').length;
  const unknownCount = siteVisits.length - mobileCount - desktopCount;
  const devTotal = Math.max(siteVisits.length, 1);

  const extraHtml = `
    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🏷️ أكتر الأقسام زيارة</div>
      ${topCats.length ? topCats.map((c,i)=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;${i<topCats.length-1?'border-bottom:1px solid #f3f4f6;':''}">
          <span style="font-size:18px;">${c.icon}</span>
          <span style="flex:1;font-size:13px;font-weight:700;">${escapeHtml(c.name)}</span>
          <span style="font-size:13px;font-weight:900;color:#0284c7;">${c.views.toLocaleString('ar-EG')} 👁️</span>
        </div>`).join('') : '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:10px;">لسه مفيش بيانات كافية</p>'}
    </div>

    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📈 إعلانات جديدة يوميًا (آخر 7 أيام)</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px;">
        ${dayCounts.map((c,i)=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
            <div style="font-size:10px;font-weight:900;color:#0284c7;margin-bottom:2px;">${c}</div>
            <div style="width:100%;background:#0284c7;border-radius:4px 4px 0 0;height:${Math.max((c/maxDayCount)*100,4)}%;"></div>
            <div style="font-size:9px;color:#94a3b8;margin-top:4px;">${dayLabels[i]}</div>
          </div>`).join('')}
      </div>
    </div>

    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📱 توزيع الأجهزة</div>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:#eff6ff;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:#2563eb;">${devTotal?Math.round(mobileCount/devTotal*100):0}%</div>
          <div style="font-size:10px;color:#64748b;">📱 موبايل (${mobileCount.toLocaleString('ar-EG')})</div>
        </div>
        <div style="flex:1;background:#f5f3ff;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:#7c3aed;">${devTotal?Math.round(desktopCount/devTotal*100):0}%</div>
          <div style="font-size:10px;color:#64748b;">💻 كمبيوتر (${desktopCount.toLocaleString('ar-EG')})</div>
        </div>
        ${unknownCount>0?`<div style="flex:1;background:#f8fafc;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:18px;font-weight:900;color:#94a3b8;">${Math.round(unknownCount/devTotal*100)}%</div>
          <div style="font-size:10px;color:#64748b;">قديم (${unknownCount.toLocaleString('ar-EG')})</div>
        </div>`:''}
      </div>
    </div>

    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🔄 الزوار — جديد مقابل راجع (آخر 30 يوم)</div>
      <div id="visitorReturnStatsBox" style="text-align:center;padding:10px;color:#94a3b8;font-size:12px;">⏳ جاري الحساب...</div>
    </div>

    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🏪 أكتر المعارض مشاهدة (آخر 30 يوم)</div>
      <div id="topShopsStatsBox" style="text-align:center;padding:10px;color:#94a3b8;font-size:12px;">⏳ جاري التحميل...</div>
    </div>

    <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🔍 بحث بدون نتيجة (آخر 30 يوم)</div>
      <div id="searchMissesStatsBox" style="text-align:center;padding:10px;color:#94a3b8;font-size:12px;">⏳ جاري التحميل...</div>
    </div>
  `;
  cont.insertAdjacentHTML('beforeend', extraHtml);
  loadDeferredAdminStats();
}

async function loadDeferredAdminStats() {
  const since30 = new Date(Date.now() - 30*86400000).toISOString();
  const now = new Date().toISOString();

  // اتجاه الزوار
  try {
    const r = await sbRPC('get_visitor_return_stats', {p_from: since30, p_to: now});
    const row = (r && r[0]) || {new_visitors:0, returning_visitors:0};
    const total = (row.new_visitors||0) + (row.returning_visitors||0);
    const box = document.getElementById('visitorReturnStatsBox');
    if(box) box.innerHTML = `
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:10px;">
          <div style="font-size:18px;font-weight:900;color:#16a34a;">${(row.new_visitors||0).toLocaleString('ar-EG')}</div>
          <div style="font-size:10px;color:#166534;">✨ زائر جديد</div>
        </div>
        <div style="flex:1;background:#eff6ff;border-radius:10px;padding:10px;">
          <div style="font-size:18px;font-weight:900;color:#2563eb;">${(row.returning_visitors||0).toLocaleString('ar-EG')}</div>
          <div style="font-size:10px;color:#1e40af;">🔁 زائر راجع</div>
        </div>
      </div>
      ${total ? `<div style="font-size:11px;color:#94a3b8;margin-top:8px;">${Math.round((row.returning_visitors||0)/total*100)}% من الزوار بيرجعوا للموقع</div>` : ''}`;
  } catch(e) {
    const box = document.getElementById('visitorReturnStatsBox');
    if(box) box.innerHTML = '<p style="color:#94a3b8;">تعذّر التحميل</p>';
  }

  // أكتر المعارض مشاهدة
  try {
    const shops = await sbRPC('get_top_shops_by_views', {p_from: since30, p_to: now, p_limit: 8});
    const box = document.getElementById('topShopsStatsBox');
    if(box) {
      if(!shops || !shops.length) { box.innerHTML = '<p style="color:#94a3b8;">لسه مفيش بيانات كافية</p>'; }
      else {
        box.innerHTML = shops.map((s,i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;text-align:right;${i<shops.length-1?'border-bottom:1px solid #f3f4f6;':''}">
            <span style="flex:1;font-size:13px;font-weight:700;">🏪 ${escapeHtml(s.shop_name)} <span style="color:#94a3b8;font-weight:400;font-size:11px;">${escapeHtml(s.subcategory||'')}</span></span>
            <span style="font-size:13px;font-weight:900;color:#7c3aed;">${Number(s.views).toLocaleString('ar-EG')} 👁️</span>
          </div>`).join('');
      }
    }
  } catch(e) {
    const box = document.getElementById('topShopsStatsBox');
    if(box) box.innerHTML = '<p style="color:#94a3b8;">تعذّر التحميل</p>';
  }

  // البحث بدون نتيجة
  try {
    const misses = await sbRPC('get_top_search_misses', {p_from: since30, p_to: now, p_limit: 15});
    const box = document.getElementById('searchMissesStatsBox');
    if(box) {
      if(!misses || !misses.length) { box.innerHTML = '<p style="color:#94a3b8;">لسه مفيش بيانات كافية</p>'; }
      else {
        box.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">' + misses.map(m =>
          `<span style="background:#fef2f2;color:#b91c1c;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;">${escapeHtml(m.query)} <span style="opacity:.7;">×${m.times}</span></span>`
        ).join('') + '</div>';
      }
    }
  } catch(e) {
    const box = document.getElementById('searchMissesStatsBox');
    if(box) box.innerHTML = '<p style="color:#94a3b8;">تعذّر التحميل</p>';
  }
}

async function loadAdminMarriage(page) {
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  // جلب عدد الإعلانات للـ stats
  const pending = allAds.filter(a=>a.status==='pending');
  const approved = allAds.filter(a=>a.status==='approved');
  const rejected = allAds.filter(a=>a.status==='rejected');

  page.innerHTML = `
    <div class="dyn-header" style="flex-direction:column;gap:0;padding:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;width:100%;">
        <button class="dyn-back" onclick="hideDynPage()">←</button>
        <span>⚙️ لوحة تحكم إسلام عنتر</span>
        <button onclick="adminLogout()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">خروج</button>
      </div>
      <div style="display:flex;gap:0;width:100%;background:rgba(0,0,0,.2);">
        <div style="flex:1;text-align:center;padding:8px 4px;"><div style="font-size:18px;font-weight:900;color:white;">${allAds.length}</div><div style="font-size:10px;color:rgba(255,255,255,.7);">إجمالي</div></div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);"><div style="font-size:18px;font-weight:900;color:#fbbf24;">${pending.length}</div><div style="font-size:10px;color:rgba(255,255,255,.7);">انتظار</div></div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);"><div style="font-size:18px;font-weight:900;color:#86efac;">${approved.length}</div><div style="font-size:10px;color:rgba(255,255,255,.7);">معتمدة</div></div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);"><div style="font-size:18px;font-weight:900;color:#fca5a5;">${rejected.length}</div><div style="font-size:10px;color:rgba(255,255,255,.7);">مرفوضة</div></div>
      </div>
      <div style="display:flex;width:100%;background:white;border-bottom:2px solid var(--border);">
        <button onclick="showAdminPanel('pending')" style="flex:1;padding:10px 4px;border:none;background:white;color:var(--gray);font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">⏳ انتظار (${pending.length})</button>
        <button onclick="showAdminPanel('approved')" style="flex:1;padding:10px 4px;border:none;background:white;color:var(--gray);font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">✅ معتمدة (${approved.length})</button>
        <button onclick="showAdminPanel('rejected')" style="flex:1;padding:10px 4px;border:none;background:white;color:var(--gray);font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">❌ مرفوضة (${rejected.length})</button>
        <button onclick="showAdminPanel('marriage')" style="flex:1;padding:10px 4px;border:none;background:#be185d;color:white;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border-bottom:2px solid #be185d;">💍 زواج</button>
      </div>
    </div>
    <div class="dyn-content" style="padding:12px;" id="marriageAdminContent">
      <div style="text-align:center;padding:40px;color:var(--gray);">
        <div style="font-size:30px;margin-bottom:8px;">⏳</div>
        <p>جاري تحميل الملفات...</p>
      </div>
    </div>`;

  // جلب إحصائيات بيت الحلال
  const cont = document.getElementById('marriageAdminContent');
  let stats = { total:0, approved:0, pending:0, rejected:0, likes:0, requests:0, newRequests:0, cities:{} };
  try {
    const [mProfiles, mLikes, mRequests] = await Promise.all([
      sbFetch('GET', 'marriage_profiles?select=id,status,city').catch(()=>[]) || [],
      sbFetch('GET', 'marriage_likes?select=id').catch(()=>[]) || [],
      sbFetch('GET', 'marriage_requests?select=id,status').catch(()=>[]) || []
    ]);
    stats.total = (mProfiles||[]).length;
    stats.approved = (mProfiles||[]).filter(p=>p.status==='approved').length;
    stats.pending = (mProfiles||[]).filter(p=>p.status==='pending').length;
    stats.rejected = (mProfiles||[]).filter(p=>p.status==='rejected').length;
    stats.likes = (mLikes||[]).length;
    stats.requests = (mRequests||[]).length;
    stats.newRequests = (mRequests||[]).filter(r=>r.status==='pending').length;
    (mProfiles||[]).forEach(p => { if(p.city) stats.cities[p.city] = (stats.cities[p.city]||0)+1; });
  } catch(e) { console.warn('marriage stats error:', e); }

  const topCity = Object.entries(stats.cities).sort((a,b)=>b[1]-a[1])[0];

  if(cont) cont.innerHTML =
    '<div style="background:linear-gradient(135deg,#be185d,#ec4899);border-radius:14px;padding:14px;margin-bottom:14px;color:white;">' +
    '<div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">📊 إحصائيات بيت الحلال</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;">'+stats.total+'</div><div style="font-size:10px;opacity:.85;">إجمالي الملفات</div></div>' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#bbf7d0;">'+stats.approved+'</div><div style="font-size:10px;opacity:.85;">✅ معتمدة</div></div>' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#fef08a;">'+stats.pending+'</div><div style="font-size:10px;opacity:.85;">⏳ انتظار</div></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;">❤️ '+stats.likes+'</div><div style="font-size:10px;opacity:.85;">إجمالي اهتمام</div></div>' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;">📩 '+stats.requests+'</div><div style="font-size:10px;opacity:.85;">طلبات تواصل</div></div>' +
    '<div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#fef08a;">🔔 '+stats.newRequests+'</div><div style="font-size:10px;opacity:.85;">طلبات جديدة</div></div>' +
    '</div>' +
    (topCity?'<div style="margin-top:10px;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">📍 أكتر بلد: <strong>'+topCity[0]+'</strong> ('+topCity[1]+' ملف)</div>':'') +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px;">' +
    '<button onclick="filterMarriageAdmin(\'all\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;background:#1e293b;color:white;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">الكل ('+stats.total+')</button>' +
    '<button onclick="filterMarriageAdmin(\'pending\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid #fbbf24;background:white;color:#92400e;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">⏳ انتظار ('+stats.pending+')</button>' +
    '<button onclick="filterMarriageAdmin(\'approved\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid var(--green);background:white;color:var(--green);font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ معتمدة ('+stats.approved+')</button>' +
    '<button onclick="filterMarriageAdmin(\'rejected\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid var(--red);background:white;color:var(--red);font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">❌ مرفوضة ('+stats.rejected+')</button>' +
    '<button onclick="loadContactRequests()" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid #7c3aed;background:'+(stats.newRequests>0?'#7c3aed':'white')+';color:'+(stats.newRequests>0?'white':'#7c3aed')+';font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📩 طلبات'+(stats.newRequests>0?' ('+stats.newRequests+')':'')+'</button>' +
    '</div>' +
    '<div id="marriageProfilesList"><div>'+skeletonCards(3)+'</div></div>';

  // تحميل الملفات تلقائياً
  setTimeout(() => filterMarriageAdmin('all'), 100);
}

async function filterMarriageAdmin(status) {
  const list = document.getElementById('marriageProfilesList');
  if(list) list.innerHTML = `<div>${skeletonCards(3)}</div>`;
  try {
    let path = 'marriage_profiles?select=*&order=created_at.desc';
    if(status !== 'all') path += `&status=eq.${status}`;
    const profiles = await sbFetch('GET', path) || [];
    window._marriageAdminProfiles = profiles;
    localStorage.setItem('marriage_pending_count', profiles.filter(p=>p.status==='pending').length);
    if(list) list.innerHTML = renderMarriageAdminCards(profiles);
  } catch(e) {
    if(list) list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red);">خطأ في التحميل</div>`;
  }
}

async function loadContactRequests() {
  const cont = document.getElementById('marriageAdminContent');
  if(!cont) return;
  cont.innerHTML = `<div style="text-align:center;padding:30px;color:var(--gray);"><div style="font-size:28px;margin-bottom:8px;">⏳</div><p>جاري التحميل...</p></div>`;
  try {
    const requests = await sbFetch('GET', 'marriage_requests?select=*&order=created_at.desc') || [];
    if(!requests.length) {
      cont.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray);"><div style="font-size:40px;margin-bottom:12px;">📩</div><p style="font-weight:700;">مفيش طلبات تواصل دلوقتي</p></div>`;
      return;
    }
    const pending = requests.filter(r=>r.status==='pending');
    cont.innerHTML = `
      <div style="background:#fef3c7;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#92400e;font-weight:700;">
        📩 ${requests.length} طلب تواصل — ${pending.length} في الانتظار
      </div>
      ${requests.map(r => {
        const statusColor = r.status==='pending'?'#f59e0b':r.status==='approved'?'#10b981':'#ef4444';
        const statusLabel = r.status==='pending'?'⏳ انتظار':r.status==='approved'?'✅ تم التواصل':'❌ مرفوض';
        return `
        <div style="background:white;border-radius:12px;margin-bottom:10px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-right:4px solid ${statusColor};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-size:14px;font-weight:900;">👤 ${r.from_name}</div>
              <div style="font-size:13px;font-weight:800;color:#166534;margin-top:3px;">📞 ${r.from_phone}</div>
              ${r.message?`<div style="font-size:12px;color:var(--gray);margin-top:4px;line-height:1.5;">💬 ${r.message}</div>`:''}
            </div>
            <span style="background:${statusColor}22;color:${statusColor};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;">${statusLabel}</span>
          </div>
          <div style="font-size:11px;color:var(--gray);margin-bottom:10px;">
            معرف الملف المطلوب: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${r.to_profile_id}</code>
            • ${new Date(r.created_at).toLocaleDateString('ar-EG')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${r.status==='pending'?`
              <button onclick="approveContactRequest('${r.id}','${r.from_name}','${r.from_phone}','${r.to_profile_id}')" style="flex:1;background:#10b981;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ تواصل وأرسل الأرقام</button>
              <button onclick="rejectContactRequest('${r.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">❌ رفض</button>
            `:''}
            <a href="https://wa.me/20${r.from_phone.replace(/^0/,'')}" target="_blank" style="background:#f0fdf4;color:#10b981;border:none;padding:8px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">📞 واتساب</a>
          </div>
        </div>`;
      }).join('')}`;
  } catch(e) {
    cont.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);"><p>خطأ في التحميل</p></div>`;
  }
}

async function approveContactRequest(reqId, fromName, fromPhone, toProfileId) {
  // جيب بيانات الملف المطلوب
  try {
    const profiles2 = await sbFetch('GET', `marriage_profiles?id=eq.${toProfileId}&select=phone,gender,age,ref_code`);
    const toProfile = profiles2?.[0];
    if(!toProfile?.phone) { showToast('مفيش رقم للملف المطلوب!','error'); return; }
    await sbFetch('PATCH', `marriage_requests?id=eq.${reqId}`, {status:'approved'});
    showToast('✅ تم! ابعت الأرقام على واتساب');
    const isMale = toProfile.gender === 'male';
    const msg = `💍 بيت الحلال — تواصل مبارك\n\nالسلام عليكم ${fromName}،\nنُبشّرك باهتمام ${isMale?'طالب زواج':'طالبة زواج'} (${toProfile.age} سنة${toProfile.ref_code?' — 🔖 '+toProfile.ref_code:''}) بملفك.\n\n📞 رقم التواصل: ${toProfile.phone}\n\nنسأل الله لكما التوفيق 💍`;
    const a = document.createElement('a');
    a.href = `https://wa.me/20${fromPhone.replace(/^0/,'')}?text=${encodeURIComponent(msg)}`;
    a.target='_blank'; document.body.appendChild(a); a.click();
    setTimeout(()=>document.body.removeChild(a),500);
    loadContactRequests();
  } catch(e) { showToast('خطأ: ' + e.message,'error'); }
}

async function rejectContactRequest(reqId) {
  await sbFetch('PATCH', `marriage_requests?id=eq.${reqId}`, {status:'rejected'});
  showToast('❌ تم الرفض');
  loadContactRequests();
}

function renderMarriageAdminCards(profiles) {
  if(!profiles.length) return `<div style="text-align:center;padding:40px;color:var(--gray);"><p>مفيش ملفات في هذه الفئة</p></div>`;
  return profiles.map(p => {
    const isMale = p.gender === 'male';
    const statusColor = p.status==='pending'?'#f59e0b': p.status==='approved'?'#10b981':'#ef4444';
    const statusLabel = p.status==='pending'?'⏳ انتظار': p.status==='approved'?'✅ معتمد':'❌ مرفوض';
    return `
    <div style="background:white;border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);border-right:4px solid ${statusColor};">
      <div style="padding:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:44px;height:44px;border-radius:50%;background:#fce7f3;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${isMale?'👨':'👩'}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:900;">${isMale?'طالب زواج':'طالبة زواج'} — ${p.age} سنة${p.ref_code?' | 🔖 '+escapeHtml(p.ref_code):''}</div>
            <div style="font-size:11px;color:var(--gray);">${escapeHtml(p.social_status||'')} | ${escapeHtml(p.education||'')} | ${escapeHtml(p.religiosity||'')}</div>
            <div style="margin-top:3px;"><span style="background:${statusColor}22;color:${statusColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${statusLabel}</span></div>
          </div>
          <div style="font-size:11px;color:var(--gray);">${new Date(p.created_at).toLocaleDateString('ar-EG')}</div>
        </div>

        ${p.job?`<div style="font-size:12px;margin-bottom:4px;">💼 ${escapeHtml(p.job)}</div>`:''}
        ${p.about?`<div style="font-size:12px;color:var(--gray);margin-bottom:4px;line-height:1.5;">📝 ${escapeHtml(p.about)}</div>`:''}
        ${p.requirements?`<div style="font-size:12px;color:var(--gray);margin-bottom:6px;line-height:1.5;">🎯 ${escapeHtml(p.requirements)}</div>`:''}

        <div style="background:#f0fdf4;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;font-weight:700;color:#166534;">
          📞 ${escapeHtml(p.phone||'—')}${p.whatsapp?' | 💬 '+escapeHtml(p.whatsapp):''}
        </div>
        ${p.is_verified?`<div style="background:#dcfce7;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:11px;font-weight:700;color:#166534;">🛡️ متحقق منه — تم التواصل والتأكد من الجدية</div>`:''}

        ${p.card_image?`
          <div style="margin-bottom:8px;">
            <div style="font-size:10px;color:#be185d;font-weight:700;margin-bottom:4px;">🖼️ صورة البطاقة (للتحقق من المصداقية)</div>
            <img src="${escapeHtml(safeUrl(p.card_image))}" onerror="this.parentElement.style.display='none'" style="width:100%;max-height:130px;object-fit:cover;border-radius:8px;display:block;">
          </div>`:''}

        ${p.personal_photo?`
          <div style="margin-bottom:8px;border:1px dashed #f9a8d4;border-radius:8px;padding:8px;">
            <div style="font-size:10px;color:#be185d;font-weight:700;margin-bottom:4px;">🔒 الصورة الشخصية — للإدارة فقط</div>
            <img src="${escapeHtml(safeUrl(p.personal_photo))}" onerror="this.parentElement.style.display='none'" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;display:block;">
          </div>`:''}

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${p.status==='pending'?`
            <button onclick="approveMarriageProfile('${p.id}')" style="flex:1;background:#10b981;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ موافقة</button>
            <button onclick="rejectMarriageProfile('${p.id}')" style="flex:1;background:#ef4444;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">❌ رفض</button>
          `:''}
          ${p.status==='approved'?`
            <button onclick="rejectMarriageProfile('${p.id}')" style="background:#fee2e2;color:var(--red);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🗑️ إلغاء موافقة</button>
            <button onclick="toggleMarriageVerified('${p.id}',${p.is_verified?'false':'true'})" style="background:${p.is_verified?'#f3f4f6':'#dcfce7'};color:${p.is_verified?'#64748b':'#166534'};border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">${p.is_verified?'↩️ إلغاء التوثيق':'🛡️ توثيق (تم التواصل)'}</button>
          `:''}
          ${p.status==='rejected'?`
            <button onclick="approveMarriageProfile('${p.id}')" style="background:#f0fdf4;color:var(--green);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">↩️ استعادة</button>
            <button onclick="deleteMarriageProfile('${p.id}')" style="background:#fee2e2;color:var(--red);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🗑️ حذف نهائي</button>
          `:''}
          ${p.phone?`<a href="https://wa.me/20${String(p.phone||'').replace(/[^0-9]/g,'').replace(/^0/,'')}" target="_blank" style="background:#f0fdf4;color:var(--green);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;text-decoration:none;display:inline-block;">📞 واتساب</a>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function approveMarriageProfile(id) {
  await sbFetch('PATCH', `marriage_profiles?id=eq.${id}`, {status:'approved'});
  showToast('✅ تم الموافقة على الملف');
  loadAdminMarriage(document.getElementById('dynamicPage'));
}

// التوثيق منفصل عن الموافقة — بيتحط بعد ما الإدارة تتواصل فعليًا مع صاحب الملف وتتأكد من جديته
async function toggleMarriageVerified(id, newState) {
  await sbFetch('PATCH', `marriage_profiles?id=eq.${id}`, {is_verified: newState});
  showToast(newState ? '🛡️ تم توثيق الملف' : 'تم إلغاء التوثيق');
  loadAdminMarriage(document.getElementById('dynamicPage'));
}

async function rejectMarriageProfile(id) {
  await sbFetch('PATCH', `marriage_profiles?id=eq.${id}`, {status:'rejected'});
  showToast('❌ تم رفض الملف');
  loadAdminMarriage(document.getElementById('dynamicPage'));
}

async function deleteMarriageProfile(id) {
  if(!confirm('هل أنت متأكد من الحذف النهائي للملف؟')) return;
  await sbFetch('DELETE', `marriage_profiles?id=eq.${id}`);
  try { await sbRPC('admin_log_deletion', {p_table_name: 'marriage_profiles', p_record_id: id, p_item_label: 'ملف زواج'}); } catch(e) {}
  showToast('🗑️ تم الحذف النهائي');
  loadAdminMarriage(document.getElementById('dynamicPage'));
}

async function loadAdminStatsPage(page, tab='stats') {
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  const pending = allAds.filter(a=>a.status==='pending');
  const approved = allAds.filter(a=>a.status==='approved');
  const rejected = allAds.filter(a=>a.status==='rejected');

  page.innerHTML = `
    <div class="dyn-header" style="flex-direction:column;gap:0;padding:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;width:100%;">
        <button class="dyn-back" onclick="hideDynPage()">←</button>
        <span>⚙️ لوحة تحكم إسلام عنتر</span>
        <button onclick="adminLogout()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">خروج</button>
      </div>
      <div style="display:flex;width:100%;background:white;border-bottom:2px solid var(--border);overflow-x:auto;">
        ${[['pending','⏳ انتظار'],['approved','✅ معتمدة'],['rejected','❌ مرفوضة'],['marriage','💍 زواج'],['banners','📢 بانرات'],['stats','📊 إحصائيات'],['merchants','🏪 تجار'],['backup','💾 نسخة']].map(([t,l])=>`<button onclick="showAdminPanel('${t}')" style="flex-shrink:0;flex:1;padding:10px 4px;border:none;background:${tab===t?'#0284c7':'white'};color:${tab===t?'white':'var(--gray)'};font-family:Cairo,sans-serif;font-size:10px;font-weight:700;cursor:pointer;">${l}</button>`).join('')}
      </div>
    </div>
    <div class="dyn-content" style="padding:12px;" id="statsContent">
      <div style="text-align:center;padding:30px;color:var(--gray);">
        <div style="font-size:28px;margin-bottom:8px;">⏳</div>
        <p>جاري تحميل الإحصائيات...</p>
      </div>
    </div>`;

  try {
    // جلب البيانات — فقط لو tab = stats
    let adStats=[], likes=[], reviews=[], marriageProfiles=[], marriageLikes=[], marriageRequests=[];
    if(tab === 'stats') {
      [adStats, likes, reviews, marriageProfiles, marriageLikes, marriageRequests] = await Promise.all([
        sbFetch('GET', 'ad_stats?select=ad_id,event_type,created_at') || [],
        sbFetch('GET', 'ad_likes?select=ad_id') || [],
        sbFetch('GET', 'reviews?select=id,rating') || [],
        sbFetch('GET', 'marriage_profiles?select=id,status,gender,city') || [],
        sbFetch('GET', 'marriage_likes?select=id') || [],
        sbFetch('GET', 'marriage_requests?select=id,status') || [],
      ]);
    } else {
      // لتبويبات الإعلانات فقط نجيب الإحصائيات البسيطة
      adStats = await sbFetch('GET', 'ad_stats?select=ad_id,event_type') || [];
    }

    const totalViews = adStats?.filter(s=>s.event_type==='view').length || 0;
    const totalWA = adStats?.filter(s=>s.event_type==='whatsapp').length || 0;
    const totalLikes = likes?.length || 0;
    const avgRating = reviews?.length ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length).toFixed(1) : '—';

    // أكتر الإعلانات مشاهدة
    const viewsPerAd = {};
    adStats?.filter(s=>s.event_type==='view').forEach(s => viewsPerAd[s.ad_id]=(viewsPerAd[s.ad_id]||0)+1);
    const topAds = Object.entries(viewsPerAd).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>({
      ad: allAds.find(a=>a.id===id), views: v
    })).filter(x=>x.ad);

    // أكتر فئة
    const catCount = {};
    approved.forEach(a => catCount[a.category]=(catCount[a.category]||0)+1);
    const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];
    const topCatObj = topCat ? CATEGORIES.find(c=>c.id===topCat[0]) : null;

    // إحصائيات بيت الحلال
    const mApproved = marriageProfiles?.filter(p=>p.status==='approved').length||0;
    const mPending = marriageProfiles?.filter(p=>p.status==='pending').length||0;
    const mMale = marriageProfiles?.filter(p=>p.gender==='male').length||0;
    const mFemale = marriageProfiles?.filter(p=>p.gender==='female').length||0;
    const mReqPending = marriageRequests?.filter(r=>r.status==='pending').length||0;

    const cont = document.getElementById('statsContent');
    if(!cont) return;
    cont.innerHTML = `

      <!-- إحصائيات الدليل العام -->
      <div style="background:linear-gradient(135deg,#1a7a4a,#22c55e);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">📊 دليل الحامول — الإجمالي</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${allAds.length}</div>
            <div style="font-size:10px;opacity:.85;">📋 إعلانات</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalViews}</div>
            <div style="font-size:10px;opacity:.85;">👁️ مشاهدة</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalWA}</div>
            <div style="font-size:10px;opacity:.85;">📞 تواصل</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${totalLikes}</div>
            <div style="font-size:10px;opacity:.85;">❤️ إعجاب</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${reviews?.length||0}</div>
            <div style="font-size:10px;opacity:.85;">⭐ تقييم</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${avgRating}</div>
            <div style="font-size:10px;opacity:.85;">📈 متوسط</div>
          </div>
        </div>
        ${topCatObj?`<div style="margin-top:8px;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">🏆 أكتر قسم: <strong>${topCatObj.icon} ${topCatObj.name}</strong> (${topCat[1]} إعلان)</div>`:''}
      </div>

      <!-- حالة الإعلانات -->
      <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📋 حالة الإعلانات</div>
        <div style="display:flex;gap:3px;height:12px;border-radius:6px;overflow:hidden;margin-bottom:10px;">
          <div style="background:#10b981;width:${allAds.length?(approved.length/allAds.length*100):0}%;"></div>
          <div style="background:#f59e0b;width:${allAds.length?(pending.length/allAds.length*100):0}%;"></div>
          <div style="background:#ef4444;width:${allAds.length?(rejected.length/allAds.length*100):0}%;"></div>
        </div>
        <div style="display:flex;gap:12px;font-size:12px;">
          <span>✅ معتمدة: <strong>${approved.length}</strong></span>
          <span>⏳ انتظار: <strong style="color:#f59e0b;">${pending.length}</strong></span>
          <span>❌ مرفوضة: <strong style="color:#ef4444;">${rejected.length}</strong></span>
        </div>
      </div>

      <!-- أكتر إعلانات مشاهدة -->
      ${topAds.length?`
      <div style="background:white;border-radius:14px;padding:14px;margin-bottom:12px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🔥 أكتر إعلانات مشاهدة</div>
        ${topAds.map((item,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;" onclick="openAdDetails('${item.ad.id}')">
          <div style="width:28px;height:28px;border-radius:50%;background:${i===0?'#fef9c3':i===1?'#f3f4f6':'#f9fafb'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${i===0?'#d97706':'var(--gray)'};">${i+1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.ad.title||'—'}</div>
            <div style="font-size:11px;color:var(--gray);">${item.ad.phone||''}</div>
          </div>
          <div style="text-align:left;flex-shrink:0;">
            <div style="font-size:13px;font-weight:900;color:var(--primary);">${item.views}</div>
            <div style="font-size:10px;color:var(--gray);">مشاهدة</div>
          </div>
        </div>`).join('')}
      </div>`:'' }

      <!-- إحصائيات بيت الحلال -->
      <div style="background:linear-gradient(135deg,#be185d,#ec4899);border-radius:14px;padding:14px;margin-bottom:12px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;opacity:.9;">💍 بيت الحلال</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">${marriageProfiles?.length||0}</div>
            <div style="font-size:10px;opacity:.85;">إجمالي ملفات</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#bbf7d0;">${mApproved}</div>
            <div style="font-size:10px;opacity:.85;">✅ معتمدة</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#fef08a;">${mPending}</div>
            <div style="font-size:10px;opacity:.85;">⏳ انتظار</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">👨 ${mMale}</div>
            <div style="font-size:10px;opacity:.85;">طالب زواج</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;">👩 ${mFemale}</div>
            <div style="font-size:10px;opacity:.85;">طالبة زواج</div>
          </div>
          <div style="background:rgba(255,255,255,.2);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:${mReqPending>0?'#fef08a':'white'};">📩 ${mReqPending}</div>
            <div style="font-size:10px;opacity:.85;">طلبات جديدة</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <div style="flex:1;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">❤️ ${marriageLikes?.length||0} إعجاب</div>
          <div style="flex:1;background:rgba(255,255,255,.15);border-radius:8px;padding:8px;text-align:center;font-size:12px;">📩 ${marriageRequests?.length||0} طلب تواصل</div>
        </div>
      </div>

      <!-- تحديث -->
      <div style="text-align:center;padding:8px;font-size:11px;color:var(--gray);">
        آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}
        <button onclick="loadAdminStatsPage(document.getElementById('dynamicPage'))" style="margin-right:8px;background:#f3f4f6;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">↺ تحديث</button>
      </div>`;

  } catch(e) {
    const cont = document.getElementById('statsContent');
    if(cont) cont.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);"><p>خطأ في تحميل الإحصائيات</p></div>`;
  }

  // جلب عدد ملفات الزواج في الانتظار لتحديث الـ badge
  try {
    const mp = await sbFetch('GET', 'marriage_profiles?status=eq.pending&select=id');
    if(mp) localStorage.setItem('marriage_pending_count', mp.length);
  } catch(e) {}

  // جلب الإحصائيات
  let statsMap = {};
  try {
    const stats = await sbFetch('GET', 'ad_stats?select=ad_id,event_type');
    if(stats) {
      stats.forEach(s => {
        if(!statsMap[s.ad_id]) statsMap[s.ad_id] = {view:0, whatsapp:0};
        statsMap[s.ad_id][s.event_type] = (statsMap[s.ad_id][s.event_type]||0) + 1;
      });
    }
  } catch(e) {}

  const totalViews = Object.values(statsMap).reduce((sum,s)=>sum+(s.view||0),0);
  const totalWA = Object.values(statsMap).reduce((sum,s)=>sum+(s.whatsapp||0),0);

  const tabs = [
    {id:'pending', label:`⏳ انتظار (${pending.length})`, color:'#7c3aed'},
    {id:'approved', label:`✅ معتمدة (${approved.length})`, color:'var(--green)'},
    {id:'rejected', label:`❌ مرفوضة (${rejected.length})`, color:'var(--red)'},
    {id:'marriage', label:`💍 زواج`, color:'#be185d', badge:true},
    {id:'stats', label:`📊 إحصائيات`, color:'#0284c7'},
  ];

  const currentAds = tab==='pending' ? pending : tab==='approved' ? approved : rejected;

  page.innerHTML = `
    <div class="dyn-header" style="flex-direction:column;gap:0;padding:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;width:100%;">
        <button class="dyn-back" onclick="hideDynPage()">←</button>
        <span>⚙️ لوحة تحكم إسلام عنتر</span>
        <button onclick="adminLogout()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer;">خروج</button>
      </div>
      <!-- STATS -->
      <div style="display:flex;gap:0;width:100%;background:rgba(0,0,0,.2);">
        <div style="flex:1;text-align:center;padding:8px 4px;">
          <div style="font-size:18px;font-weight:900;color:white;">${allAds.length}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">إجمالي</div>
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);">
          <div style="font-size:18px;font-weight:900;color:#fbbf24;">${pending.length}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">انتظار</div>
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);">
          <div style="font-size:18px;font-weight:900;color:#86efac;">${approved.length}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">معتمدة</div>
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);">
          <div style="font-size:18px;font-weight:900;color:#fca5a5;">${rejected.length}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">مرفوضة</div>
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);">
          <div style="font-size:18px;font-weight:900;color:#7dd3fc;">${totalViews}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">👁️ مشاهدة</div>
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(255,255,255,.2);">
          <div style="font-size:18px;font-weight:900;color:#86efac;">${totalWA}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);">📞 واتساب</div>
        </div>
      </div>
      <!-- TABS -->
      <div style="display:flex;width:100%;background:white;border-bottom:2px solid var(--border);overflow-x:auto;">
        ${tabs.map(t=>{
          const marriagePending = t.badge ? (parseInt(localStorage.getItem('marriage_pending_count'))||0) : 0;
          return `
          <button onclick="showAdminPanel('${t.id}')" style="flex-shrink:0;padding:10px 10px;border:none;background:${tab===t.id?t.color:'white'};color:${tab===t.id?'white':'var(--gray)'};font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;border-bottom:${tab===t.id?'2px solid '+t.color:'none'};white-space:nowrap;position:relative;">
            ${t.label}
            ${t.badge && marriagePending > 0 ? `<span style="position:absolute;top:4px;right:2px;background:#ef4444;color:white;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:900;">${marriagePending}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>
    <div class="dyn-content" style="padding:12px;">
      ${currentAds.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">✨</div>
          <p style="font-size:15px;font-weight:700;">مفيش إعلانات هنا</p>
        </div>` :
        currentAds.map(ad => {
          const cat = CATEGORIES.find(c=>c.id===ad.category)||{icon:'📋',name:'عام'};
          return `
          <div class="ad-card" style="border-right:4px solid ${tab==='pending'?'#7c3aed':tab==='approved'?'var(--green)':'var(--red)'};">
            ${ad.image_url ? `<img src="${ad.image_url}" class="ad-img" loading="lazy" style="max-height:120px;" onerror="this.style.display=\"none\"">` : ''}
            <div class="ad-body">
              <div style="font-size:11px;color:var(--primary);font-weight:700;margin-bottom:4px;">${cat.icon} ${cat.name} ${ad.subcategory?'← '+ad.subcategory:''}</div>
              <div class="ad-title">${escapeHtml(ad.title)||'بدون عنوان'}</div>
              <div class="ad-desc" style="font-size:12px;">${ad.description||'—'}</div>
              <div style="font-size:12px;color:var(--gray);margin-bottom:8px;">
                📞 ${ad.phone} | ${new Date(ad.created_at).toLocaleDateString('ar-EG')}
                ${statsMap[ad.id] ? `
                  <span style="margin-right:8px;background:#eff6ff;color:var(--primary);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">
                    👁️ ${statsMap[ad.id].view||0} مشاهدة
                  </span>
                  <span style="background:#f0fdf4;color:var(--green);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">
                    📞 ${statsMap[ad.id].whatsapp||0} واتساب
                  </span>
                ` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${tab==='approved' ? `
                  <div style="display:flex;align-items:center;gap:6px;width:100%;margin-bottom:6px;background:#f8fafc;border-radius:8px;padding:6px 10px;">
                    <span style="font-size:11px;color:#64748b;font-weight:700;white-space:nowrap;">ترتيب:</span>
                    <input type="number" value="${ad.sponsored_order||0}" min="0" max="999"
                      onchange="updateAdOrder('${ad.id}', this.value)"
                      style="width:55px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;text-align:center;">
                    <span style="font-size:10px;color:#94a3b8;">↑ أكبر = أول</span>
                    <button onclick="moveAdToCategory('${ad.id}','${ad.category}','${ad.subcategory||''}')" style="margin-right:auto;background:#dbeafe;color:#1d4ed8;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📂 نقل لقسم</button>
                  </div>
                ` : ''}
                ${tab==='pending' ? `
                  <button onclick="approveAd('${ad.id}')" style="flex:1;background:var(--green);color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ موافقة</button>
                  <button onclick="openRejectReasonModal('${ad.id}')" style="flex:1;background:var(--red);color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">❌ رفض</button>
                ` : ''}
                ${tab==='approved' ? `
                  <button onclick="rejectAd('${ad.id}')" style="background:#fee2e2;color:var(--red);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🗑️ حذف</button>
                ` : ''}
                ${tab==='rejected' ? `
                  <button onclick="approveAd('${ad.id}')" style="background:var(--green-light);color:var(--green);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">↩️ استعادة</button>
                  <button onclick="deleteAdPermanent('${ad.id}')" style="background:#fee2e2;color:var(--red);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🗑️ حذف نهائي</button>
                ` : ''}
                <a href="https://wa.me/20${ad.phone?.replace(/^0/,'')}" target="_blank" style="background:var(--primary-light);color:var(--primary);border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;text-decoration:none;">📞 تواصل</a>
                <button onclick="openAdminEditAd('${ad.id}')" style="background:#fef3c7;color:#92400e;border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✏️ تعديل</button>
              </div>
            </div>
          </div>`;
        }).join('')
      }
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function adminLogout() {
  isAdmin = false;
  adminAccessToken = null;
  adminRefreshToken = null;
  localStorage.removeItem('hamoul_admin_auth');
  localStorage.removeItem('hamoul_admin_refresh');
  var _agb = document.getElementById('adminGearBtn'); if(_agb) _agb.style.display = 'none';
  hideDynPage();
  showToast('تم الخروج من وضع المشرف');
  loadAds();
}

function openAdminEditAd(adId) {
  const ad = allAds.find(a => a.id === adId);
  if(!ad) return;
  const cat = CATEGORIES.find(c => c.id === ad.category) || {icon:'📋', name:'عام'};
  const old = document.getElementById('adminEditModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'adminEditModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';
  modal.innerHTML = '<div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:90vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div style="font-size:15px;font-weight:900;">✏️ تعديل الإعلان</div>' +
    '<button onclick="document.getElementById(\'adminEditModal\').remove()" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--primary);font-weight:700;margin-bottom:12px;background:var(--primary-light);padding:8px 12px;border-radius:8px;">' + cat.icon + ' ' + cat.name + (ad.subcategory ? ' ← ' + ad.subcategory : '') + '</div>' +
    '<div style="margin-bottom:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">عنوان الإعلان *</label>' +
    '<input id="aeTitle" value="' + (ad.title||'').replace(/"/g,'&quot;') + '" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '<div style="margin-bottom:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">التفاصيل</label>' +
    '<textarea id="aeDesc" rows="3" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;">' + (ad.description||'') + '</textarea></div>' +
    '<div style="margin-bottom:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رقم الواتساب</label>' +
    '<input id="aePhone" value="' + (ad.phone||'') + '" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    (ad.image_url ? '<div style="margin-bottom:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">الصورة الحالية</label><img src="' + ad.image_url + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'"></div>' : '') +
    '<div style="margin-bottom:16px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🖼️ تغيير الصورة (اختياري)</label>' +
    '<label id="aeImgLabel" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#f0fdf4;border:2px dashed #16a34a;border-radius:12px;padding:14px;cursor:pointer;font-family:Cairo,sans-serif;font-size:13px;color:#15803d;font-weight:700;">' +
    '📷 اضغط لاختيار صورة' +
    '<input type="file" id="aeImageInput" accept="image/*" capture="environment" style="display:none;" onchange="previewAdminEditImg(this)">' +
    '</label>' +
    '<div id="aeImgPreview" style="margin-top:10px;display:none;text-align:center;">' +
    '<img id="aePreviewImg" style="max-width:100%;max-height:150px;object-fit:cover;border-radius:10px;border:2px solid #16a34a;">' +
    '<div style="font-size:11px;color:#16a34a;font-weight:700;margin-top:4px;">✅ تم اختيار الصورة</div>' +
    '</div></div>' +
    '<button data-adid="' + adId + '" onclick="saveAdminEditAd(this.dataset.adid)" id="aeSubmitBtn" style="width:100%;background:var(--primary);color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 حفظ التعديلات</button>' +
    '</div>';
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

function previewAdminEditImg(input) {
  const preview = document.getElementById('aeImgPreview');
  const img = document.getElementById('aePreviewImg');
  const label = document.getElementById('aeImgLabel');
  if(input.files && input.files[0]) {
    const file = input.files[0];
    // Compress if too large
    if(file.size > 1.5 * 1024 * 1024) {
      compressAndPreview(file, img, preview, label);
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target.result;
        if(preview) preview.style.display = 'block';
        if(label) label.style.borderColor = '#16a34a';
      };
      reader.readAsDataURL(file);
    }
  }
}

function compressAndPreview(file, imgEl, previewEl, labelEl) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const image = new Image();
    image.onload = function() {
      const canvas = document.createElement('canvas');
      let w = image.width, h = image.height;
      const maxDim = 1200;
      if(w > maxDim || h > maxDim) {
        if(w > h) { h = Math.round(h * maxDim/w); w = maxDim; }
        else { w = Math.round(w * maxDim/h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(image, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      // Replace file input with compressed blob
      canvas.toBlob(function(blob) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'compressed.jpg', {type:'image/jpeg'}));
        document.getElementById('aeImageInput').files = dt.files;
      }, 'image/jpeg', 0.8);
      if(imgEl) imgEl.src = compressed;
      if(previewEl) previewEl.style.display = 'block';
      if(labelEl) labelEl.style.borderColor = '#16a34a';
    };
    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveAdminEditAd(adId) {
  const title = document.getElementById('aeTitle')?.value.trim();
  const desc = document.getElementById('aeDesc')?.value.trim();
  const phone = document.getElementById('aePhone')?.value.trim();
  if(!title) { showToast('اكتب عنوان الإعلان','error'); return; }
  const btn = document.getElementById('aeSubmitBtn');
  if(btn) { btn.textContent='⏳ جاري الحفظ...'; btn.disabled=true; }
  try {
    const updates = { title, description: desc||null, phone: phone||null };
    const fileInput = document.getElementById('aeImageInput');
    if(fileInput && fileInput.files && fileInput.files[0]) {
      btn.textContent='⏳ جاري رفع الصورة...';
      updates.image_url = await uploadImage(fileInput.files[0]);
    }
    await sbFetch('PATCH', 'ads?id=eq.' + adId, updates);
    const idx = allAds.findIndex(a => a.id === adId);
    if(idx !== -1) allAds[idx] = {...allAds[idx], ...updates};
    document.getElementById('adminEditModal')?.remove();
    showToast('✅ تم حفظ التعديلات!');
    showAdminPanel('approved');
  } catch(e) {
    const msg = e?.message || '';
    console.error('saveAdminEditAd error:', msg);
    if(msg.includes('image upload') || msg.includes('413') || msg.includes('storage')) {
      showToast('❌ خطأ في رفع الصورة: ' + msg.slice(0,60),'error');
    } else if(msg.includes('401') || msg.includes('403')) {
      showToast('❌ خطأ في الصلاحيات — تأكد من إعدادات Supabase','error');
    } else {
      showToast('❌ خطأ: ' + msg.slice(0,60),'error');
    }
    if(btn) { btn.textContent='💾 حفظ التعديلات'; btn.disabled=false; }
  }
}

async function deleteAdPermanent(id) {
  if(!confirm('هل أنت متأكد من الحذف النهائي؟')) return;
  await sbFetch('DELETE', `ads?id=eq.${id}`);
  showToast('🗑️ تم الحذف النهائي');
  await loadAds();
  showAdminPanel('rejected');
}

async function moveAdToCategory(adId, currentCat, currentSub) {
  const options = [];
  CATEGORIES.forEach(function(c) {
    if(c.subs && c.subs.length > 0) {
      c.subs.forEach(function(s) {
        var sName = typeof s === 'string' ? s : s.name;
        options.push({cat: c.id, sub: sName, label: c.icon + ' ' + c.name + ' — ' + sName});
      });
    } else if(c.children && c.children.length > 0) {
      c.children.forEach(function(ch) {
        if(ch.subs && ch.subs.length > 0) {
          ch.subs.forEach(function(s) {
            var sName = typeof s === 'string' ? s : s.name;
            if(!sName.startsWith('عام —')) {
              options.push({cat: c.id, sub: ch.name + ' — ' + sName, label: c.icon + ' ' + c.name + ' ← ' + ch.name + ' ← ' + sName});
            }
          });
        } else {
          options.push({cat: c.id, sub: ch.name, label: c.icon + ' ' + c.name + ' ← ' + ch.name});
        }
      });
    } else {
      options.push({cat: c.id, sub: '', label: c.icon + ' ' + c.name});
    }
  });

  const modal = document.createElement('div');
  modal.id = 'moveModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';

  var btns = options.map(function(o) {
    var isCurrent = (o.cat === currentCat && o.sub === currentSub);
    var btn = document.createElement('button');
    btn.style.cssText = "background:" + (isCurrent ? "#dbeafe" : "#f8fafc") + ";border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;text-align:right;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#1e293b;margin-bottom:6px;width:100%;";
    btn.textContent = o.label + (isCurrent ? ' ✅ الحالي' : '');
    btn.dataset.cat = o.cat;
    btn.dataset.sub = o.sub;
    btn.dataset.adid = adId;
    btn.onclick = function() { confirmMoveAd(this.dataset.adid, this.dataset.cat, this.dataset.sub); };
    return btn.outerHTML;
  }).join('');

  modal.innerHTML = '<div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:80vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div style="font-size:16px;font-weight:900;">📂 نقل لقسم آخر</div>' +
    '<button id="closeMoveModal" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">×</button>' +
    '</div>' +
    '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">اختار القسم الجديد:</div>' +
    '<div id="moveBtnsWrap">' + btns + '</div>' +
    '</div>';

  document.body.appendChild(modal);
  document.getElementById('closeMoveModal').onclick = function() { modal.remove(); };
  modal.addEventListener('click', function(e) { if(e.target === modal) modal.remove(); });

  // Re-attach onclick events after innerHTML
  document.querySelectorAll('#moveBtnsWrap button').forEach(function(btn) {
    btn.onclick = function() {
      confirmMoveAd(btn.dataset.adid, btn.dataset.cat, btn.dataset.sub);
    };
  });
}

async function confirmMoveAd(adId, newCat, newSub) {
  var modal = document.getElementById('moveModal');
  try {
    await sbFetch('PATCH', 'ads?id=eq.' + adId, {category: newCat, subcategory: newSub || null});
    if(modal) modal.remove();
    showToast('✅ تم نقل الإعلان بنجاح');
    await loadAds();
    showAdminPanel('approved');
  } catch(e) {
    showToast('خطأ في النقل ❌', 'error');
  }
}


async function updateAdOrder(id, order) {
  try {
    await sbFetch('PATCH', 'ads?id=eq.' + id, {sponsored_order: parseInt(order)||0});
    showToast('✅ تم تحديث الترتيب');
  } catch(e) { showToast('خطأ في التحديث','error'); }
}

async function approveAd(id) {
  await sbFetch('PATCH',`ads?id=eq.${id}`,{status:'approved'});
  showToast('✅ تم الموافقة على الإعلان — سيظهر فوراً في قسمه');
  await loadAds();
  showAdminPanel('pending');
}

async function rejectAd(id) {
  await sbFetch('PATCH',`ads?id=eq.${id}`,{status:'rejected'});
  showToast('❌ تم الرفض');
  await loadAds();
  showAdminPanel('pending');
}

// ===== رفض الإعلان مع ذكر السبب (وتنبيه صاحب الإعلان لو رقمه متوفر) =====
function openRejectReasonModal(id) {
  const ad = allAds.find(a => a.id === id);
  const reasons = ['صورة غير واضحة','بيانات ناقصة أو غير كافية','السعر غير منطقي','مخالف لسياسة الموقع','إعلان مكرر','رقم تليفون غير صحيح','أخرى'];
  let modal = document.getElementById('rejectReasonModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'rejectReasonModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:18px 18px 0 0;max-width:480px;width:100%;padding:18px;max-height:85vh;overflow-y:auto;">
      <div style="font-size:15px;font-weight:900;margin-bottom:4px;">❌ رفض الإعلان</div>
      <div style="font-size:12px;color:var(--gray);margin-bottom:14px;">${ad ? escapeHtml(ad.title) : ''}</div>
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">سبب الرفض</label>
      <select id="rejectReasonSelect" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;background:white;">
        ${reasons.map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select>
      <textarea id="rejectReasonNote" rows="2" placeholder="ملاحظة إضافية (اختياري)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:14px;resize:none;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:8px;">
        <button onclick="rejectAdWithReason('${id}')" style="flex:1;background:var(--red);color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">❌ تأكيد الرفض</button>
        <button onclick="document.getElementById('rejectReasonModal').remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>
      </div>
    </div>`;
}

async function rejectAdWithReason(id) {
  const reason = document.getElementById('rejectReasonSelect')?.value || 'أخرى';
  const note = document.getElementById('rejectReasonNote')?.value.trim() || '';
  const fullReason = note ? `${reason} — ${note}` : reason;
  const ad = allAds.find(a => a.id === id);

  await sbFetch('PATCH', `ads?id=eq.${id}`, {status:'rejected', rejection_reason: fullReason});
  document.getElementById('rejectReasonModal')?.remove();
  showToast('❌ تم الرفض وحفظ السبب');

  // تنبيه صاحب الإعلان بالسبب لو رقمه متوفر
  if(ad && ad.phone && /^01[0-9]{9}$/.test(ad.phone)) {
    const msg = `مرحبًا، للأسف تم رفض إعلانك "${ad.title}" في دليل الحامول.\n\nالسبب: ${fullReason}\n\nتقدر تعدّل الإعلان وتعيد إرساله للمراجعة.`;
    try {
      const a = document.createElement('a');
      a.href = `https://wa.me/20${ad.phone.replace(/^0/,'')}?text=${encodeURIComponent(msg)}`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>document.body.removeChild(a), 500);
    } catch(e) {}
  }

  await loadAds();
  showAdminPanel('pending');
}

// SLIDER
function buildSlider() {
  const inner = document.getElementById('sliderInner');
  const dots = document.getElementById('slideDots');
  inner.innerHTML = paidBanners.map(b => `
    <div class="slide">
      <a href="${b.link}" target="_blank">
        <img src="${b.image_url||b.img||''}" alt="${b.title}" onerror="this.parentElement.parentElement.style.display='none'">
      </a>
    </div>
  `).join('');
  dots.innerHTML = paidBanners.map((_,i) => `
    <div class="slide-dot ${i===0?'active':''}" onclick="goSlide(${i})"></div>
  `).join('');
  startSlider();
}

function goSlide(i) {
  clearInterval(slideTimer);
  if(i < 0) i = paidBanners.length-1;
  if(i >= paidBanners.length) i = 0;
  slideIdx = i;
  document.getElementById('sliderInner').style.transform = `translateX(${i*100}%)`;
  document.querySelectorAll('.slide-dot').forEach((d,idx) => d.classList.toggle('active', idx===i));
  startSlider();
}
function moveSlide(d) { goSlide(slideIdx+d); }
function startSlider() { slideTimer = setInterval(() => goSlide(slideIdx+1), 4000); }

function showHome() { hideDynPage(); }
// FAVORITES
function getFavs() { return JSON.parse(localStorage.getItem('hamoul_favs')||'[]'); }
function isFav(id) { return getFavs().includes(id); }
function toggleFav(id) {
  let favs = getFavs();
  if(favs.includes(id)) {
    favs = favs.filter(f=>f!==id);
    showToast('تم الحذف من المفضلة');
  } else {
    favs.push(id);
    showToast('✅ تم الإضافة للمفضلة ❤️');
  }
  localStorage.setItem('hamoul_favs', JSON.stringify(favs));
  // تحديث الزرار
  const btn = document.getElementById('fav_'+id);
  if(btn) {
    btn.style.background = isFav(id) ? '#fee2e2' : '#f3f4f6';
    btn.style.color = isFav(id) ? '#dc2626' : '#aaa';
  }
}

function showWelcomeIfNew() {
  if(localStorage.getItem('hamoul_welcomed')) return;
  localStorage.setItem('hamoul_welcomed', '1');
  setTimeout(() => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:800;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:20px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:24px;width:100%;max-width:340px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a7a4a,#155a37);padding:28px 20px;text-align:center;color:white;">
          <div style="font-size:48px;margin-bottom:10px;">🏘️</div>
          <div style="font-size:20px;font-weight:900;margin-bottom:6px;">أهلاً بيك في دليل الحامول!</div>
          <div style="font-size:13px;opacity:.9;line-height:1.6;">دليلك الشامل لكل خدمات ومحلات وأطباء الحامول</div>
        </div>
        <div style="padding:20px;">
          ${[
            ['🔍','ابحث','عن أي خدمة أو محل بسهولة'],
            ['📢','أعلن','إعلانك مجاناً للناس كلها'],
            ['💍','بيت الحلال','للتعارف الشرعي'],
            ['📈','بورصة الحامول','أسعار المحاصيل يومياً'],
          ].map(([icon,title,desc])=>`
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:24px;">${icon}</span>
            <div><div style="font-size:13px;font-weight:700;">${title}</div><div style="font-size:12px;color:var(--gray);">${desc}</div></div>
          </div>`).join('')}
          <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;background:var(--primary);color:white;border:none;padding:14px;border-radius:14px;font-family:Cairo,sans-serif;font-size:15px;font-weight:900;cursor:pointer;margin-top:8px;">ابدأ التصفح 🚀</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }, 5500);
}

function showMore() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'more'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const totalAds = allAds.filter(a=>a.status==='approved').length;
  const totalCats = CATEGORIES.length;

  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>⚙️ المزيد <small style="font-size:10px;opacity:.7;">v15</small></span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:0;">

      <!-- PROFILE CARD -->
      <div style="background:linear-gradient(135deg,var(--primary),var(--primary-dark));padding:24px 20px;text-align:center;color:white;">
        <div style="width:70px;height:70px;border-radius:50%;border:3px solid var(--gold);overflow:hidden;margin:0 auto 12px;background:white;">
          <img id="moreLogoImg" src="" style="width:100%;height:100%;object-fit:contain;">
        </div>
        <h2 style="font-size:18px;font-weight:900;margin-bottom:4px;">سوق ودليل الحامول</h2>
        <p style="font-size:12px;opacity:.8;">برعاية فركة كعب — مركز الحامول، كفر الشيخ</p>
        <p style="font-size:11px;opacity:.7;margin-top:2px;">المدير المسؤول: إسلام عنتر</p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:14px;">
          <div style="text-align:center;">
            <div style="font-size:22px;font-weight:900;">${totalAds}</div>
            <div style="font-size:11px;opacity:.8;">إعلان معتمد</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.3);"></div>
          <div style="text-align:center;">
            <div style="font-size:22px;font-weight:900;">${CATEGORIES.length}</div>
            <div style="font-size:11px;opacity:.8;">قسم</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.3);"></div>
          <div style="text-align:center;">
            <div style="font-size:22px;font-weight:900;">مجاني</div>
            <div style="font-size:11px;opacity:.8;">100%</div>
          </div>
        </div>
      </div>

      <!-- ACCOUNT STATUS -->
      <div style="background:white;border-bottom:8px solid #f8fafc;" id="acctStatusBox"></div>

      <!-- MENU ITEMS -->
      <div style="padding:16px;">

        <!-- فركة كعب -->
        <div style="font-size:12px;color:var(--gray);font-weight:700;margin-bottom:8px;padding-right:4px;">🛵 فركة كعب للتوصيل</div>
        <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px;">
          <a href="https://wa.me/201014185158?text=مرحباً%2C%20أنا%20جاي%2Fة%20من%20سوق%20ودليل%20الحامول%20وعايز%20أطلب%20توصيل" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--dark);border-bottom:1px solid #f3f4f6;">
            <span style="font-size:22px;">📞</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">اطلب توصيل</div>
              <div style="font-size:12px;color:var(--gray);">01014185158 — داخل الحامول وضواحيها</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </a>
          <a href="https://wa.me/201033253032?text=مرحباً%2C%20أنا%20جاي%2Fة%20من%20سوق%20ودليل%20الحامول%20وعايز%20أطلب%20توصيل" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--dark);">
            <span style="font-size:22px;">📱</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">خط احتياطي</div>
              <div style="font-size:12px;color:var(--gray);">01033253032</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </a>
        </div>

        <!-- الموقع -->
        <div style="font-size:12px;color:var(--gray);font-weight:700;margin-bottom:8px;padding-right:4px;">ℹ️ الموقع</div>
        <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px;">
          <div onclick="showGoldPrices()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:22px;">💍</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">أسعار الدهب اليوم</div>
              <div style="font-size:12px;color:var(--gray);">سعر الجرام المصري أوتوماتيك</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
          <div onclick="subscribeToNotifications()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:22px;">🔔</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">تفعيل الإشعارات</div>
              <div style="font-size:12px;color:var(--gray);">استقبل إشعارات الإعلانات الجديدة</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
          <div onclick="installPWA()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:22px;">📲</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">تثبيت التطبيق</div>
              <div style="font-size:12px;color:var(--gray);">نزّل الموقع على شاشتك الرئيسية</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
          <div onclick="shareApp()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:22px;">📤</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">شارك الموقع</div>
              <div style="font-size:12px;color:var(--gray);">شارك دليل الحامول مع أصحابك</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
          <div onclick="showAbout()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;">
            <span style="font-size:22px;">📋</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">عن الموقع وإخلاء المسؤولية</div>
              <div style="font-size:12px;color:var(--gray);">معلومات قانونية ومسؤول الموقع</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
        </div>

        <!-- المشرف -->
        <div style="font-size:12px;color:var(--gray);font-weight:700;margin-bottom:8px;padding-right:4px;">🔑 إدارة الموقع</div>
        <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px;">
          <div onclick="${isAdmin ? 'showAdminPanel()' : 'openAdmin()'}" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;">
            <span style="font-size:22px;">${isAdmin ? '⚙️' : '🔑'}</span>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;">${isAdmin ? 'لوحة التحكم' : 'دخول المشرف'}</div>
              <div style="font-size:12px;color:var(--gray);">${isAdmin ? 'إسلام عنتر — وضع المشرف مفعّل ✅' : 'للمشرف فقط'}</div>
            </div>
            <span style="color:var(--gray);">←</span>
          </div>
          ${isAdmin ? `<div onclick="adminLogout()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-top:1px solid #f3f4f6;">
            <span style="font-size:22px;">🚪</span>
            <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:var(--red);">خروج من وضع المشرف</div></div>
          </div>` : ''}
        </div>

        <p style="text-align:center;font-size:11px;color:#ccc;margin-top:8px;">© 2026 دليل الحامول — برعاية فركة كعب</p>
      </div>
    </div>`;

  // إضافة اللوجو
  const logoSrc = document.getElementById('logoImg')?.src;
  const moreLogo = document.getElementById('moreLogoImg');
  if(moreLogo && logoSrc) moreLogo.src = logoSrc;

  renderAcctStatusBox();
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function showAbout() {
  if(!window._restoringFromDetail){
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) { try { sessionStorage.setItem('parentDynState', currentState); } catch(e) {} }
  }
  sessionStorage.setItem('dynState', JSON.stringify({type:'about'}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="showMore()">←</button>
      <span>📋 عن الموقع</span>
      <span></span>
    </div>
    <div class="dyn-content">

      <!-- عن الموقع -->
      <div style="background:white;border-radius:14px;padding:18px;margin-bottom:14px;border:1px solid var(--border);">
        <h3 style="font-size:15px;font-weight:900;color:var(--primary);margin-bottom:10px;">📌 عن دليل الحامول</h3>
        <p style="font-size:13px;color:var(--gray);line-height:1.8;">
          دليل الحامول هو منصة إعلانية مجانية تهدف إلى ربط أبناء مركز الحامول بمحافظة كفر الشيخ ببعضهم البعض، من خلال عرض الخدمات والوظائف والإعلانات التجارية في مكان واحد سهل وبسيط.
        </p>
      </div>

      <!-- المسؤول -->
      <div style="background:linear-gradient(135deg,#1a7a4a,#2d9e63);border-radius:14px;padding:18px;margin-bottom:14px;color:white;">
        <h3 style="font-size:15px;font-weight:900;margin-bottom:10px;">💬 شكاوى وخدمة عملاء الموقع</h3>
        <p style="font-size:12px;opacity:.9;margin-bottom:12px;line-height:1.7;">لو عندك أي ملاحظة، اقتراح، أو شكوى عن الموقع نفسه (مش عن التوصيل)، تواصل معنا مباشرة:</p>
        <a href="https://wa.me/201080150801?text=مرحباً%2C%20عندي%20ملاحظة%2Fشكوى%20عن%20موقع%20سوق%20ودليل%20الحامول" target="_blank" style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.15);border-radius:12px;padding:12px;text-decoration:none;color:white;">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📞</div>
          <div>
            <div style="font-size:14px;font-weight:900;">01080150801</div>
            <div style="font-size:11px;opacity:.85;">دوس هنا للتواصل على واتساب</div>
          </div>
        </a>
      </div>

      <!-- إخلاء المسؤولية -->
      <div style="background:#fff7ed;border-radius:14px;padding:18px;border:2px solid #fed7aa;margin-bottom:14px;">
        <h3 style="font-size:15px;font-weight:900;color:var(--orange);margin-bottom:10px;">⚠️ إخلاء المسؤولية</h3>
        <p style="font-size:13px;color:#92400e;line-height:1.8;">
          هذا الموقع هو <strong>منصة إعلانية مجانية</strong> فقط، ويعمل كوسيط للتعريف بين الأطراف داخل مركز الحامول.
          <br><br>
          ✦ الموقع <strong>لا يتحمل أي مسؤولية</strong> عن طبيعة العلاقة بين الأطراف أو نتائج التواصل بينهم.<br>
          ✦ الموقع <strong>لا يضمن</strong> صحة أو دقة المعلومات المنشورة من قِبل المُعلِنين.<br>
          ✦ جميع الاتفاقيات والتعاملات تتم <strong>مباشرة بين الأطراف المعنية</strong> على مسؤوليتهم الشخصية.<br>
          ✦ في حالة وجود أي شكوى، يُرجى التواصل مع فريق الموقع على الرقم المخصص للشكاوى وخدمة العملاء بالأعلى.
        </p>
      </div>

      <div style="text-align:center;padding:10px;font-size:11px;color:#ccc;">
        © 2026 دليل الحامول — جميع الحقوق محفوظة لإسلام عنتر
      </div>
    </div>`;
  page.classList.add('active');
}

function shareApp() {
  const msg = `🗺️ دليل الحامول\n\nوظائف، عقارات، أطباء، وخدمات في مركز الحامول — كل حاجة في مكان واحد مجاناً!\n\n🔗 souqelhamoul.com`;
  if(navigator.share) {
    navigator.share({title:'دليل الحامول', text:msg, url:'https://souqelhamoul.com'});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

function showFavorites() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'favorites'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const favIds = getFavs();
  const favAds = allAds.filter(a => favIds.includes(a.id) && (a.status==='approved'||isAdmin));

  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>❤️ المفضلة (${favAds.length})</span>
      <span></span>
    </div>
    <div class="dyn-content">
      ${favAds.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">❤️</div>
          <p style="font-size:15px;font-weight:700;">مفضلتك فاضية</p>
          <p style="font-size:13px;margin-top:6px;color:#aaa;">اضغط ❤️ على أي إعلان لإضافته</p>
        </div>` :
        favAds.map(ad => {
          const cat = CATEGORIES.find(c=>c.id===ad.category)||{icon:'📋',name:'عام'};
          let phone = ad.phone||'';
          if(phone.startsWith('01')) phone='20'+phone.substring(1);
          const waMsg = encodeURIComponent(`أهلاً، أنا مهتم بإعلانك (${ad.title}) على دليل الحامول`);
          const waUrl = phone?`https://wa.me/${phone}?text=${waMsg}`:'#';
          const date = new Date(ad.created_at).toLocaleDateString('ar-EG');
          return `
          <div class="ad-card">
            ${ad.image_url?`<img src="${ad.image_url}" class="ad-img" loading="lazy" onerror="this.style.display='none'" onclick="openAdDetails('${ad.id}')">` : ''}
            <div class="ad-body">
              <div style="font-size:11px;color:var(--primary);font-weight:700;margin-bottom:4px;">${cat.icon} ${cat.name}${ad.subcategory?' ← '+ad.subcategory:''}</div>
              <div class="ad-title" onclick="openAdDetails('${ad.id}')">${escapeHtml(ad.title)||''}</div>
              <div class="ad-desc">${ad.description||''}</div>
              <div class="ad-footer">
                <span class="ad-date">${date}</span>
                <div style="display:flex;gap:6px;align-items:center;">
                  <button onclick="toggleFav('${ad.id}');showFavorites()" style="background:#fee2e2;color:#dc2626;border:none;width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;">❤️</button>
                  <button class="btn-details" onclick="openAdDetails('${ad.id}')">التفاصيل</button>
                  <a href="${waUrl}" target="_blank" class="btn-wa">💬 واتساب</a>
                </div>
              </div>
            </div>
          </div>`;
        }).join('')
      }
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}
async function showDeals() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'deals'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');

  // إعلانات العروض — إما مميزة كعرض أو فيها كلمات عروض
  const dealKeywords = ['خصم','عرض','تخفيض','مجاناً','مجانا','هدية','أوفر','توفير','بأقل سعر','فرصة'];
  const dealAds = allAds.filter(a => {
    if(a.status !== 'approved' && !isAdmin) return false;
    if(a.is_offer) return true;
    const text = ((a.title||'')+(a.description||'')).toLowerCase();
    return dealKeywords.some(k => text.includes(k));
  }).map(a => Object.assign({_kind:'ad'}, a));

  // منتجات المعارض المميّزة كعروض بواسطة التاجر نفسه
  let dealProducts = [];
  try {
    const offerProducts = await sbFetch('GET', 'shop_products?is_offer=eq.true&order=created_at.desc') || [];
    if(offerProducts.length) {
      const traderIds = [...new Set(offerProducts.map(p => p.trader_id))];
      const traders = await sbFetch('GET', 'shop_traders?id=in.(' + traderIds.join(',') + ')&status=eq.approved&select=id,shop_name,phone,subcategory') || [];
      const tMap = {}; traders.forEach(t => tMap[t.id] = t);
      dealProducts = offerProducts
        .filter(p => tMap[p.trader_id])
        .map(p => Object.assign({_kind:'product'}, p, {_trader: tMap[p.trader_id]}));
    }
  } catch(e) {}

  const dealItems = dealAds.concat(dealProducts).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🏷️ العروض والخصومات</span>
      <span></span>
    </div>
    <div class="dyn-content" id="dealsContent">
      <div style="background:linear-gradient(135deg,#ff6b00,#ff9500);padding:16px;text-align:center;color:white;border-radius:14px;margin-bottom:10px;">
        <div style="font-size:28px;margin-bottom:4px;">🏷️</div>
        <div style="font-size:16px;font-weight:900;">أحدث العروض في الحامول</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px;">${dealItems.length} عرض متاح دلوقتي</div>
      </div>
      <div id="catBanner"></div>
      ${dealItems.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">🏷️</div>
          <p style="font-size:15px;font-weight:700;">مفيش عروض دلوقتي</p>
          <p style="font-size:13px;margin-top:6px;color:#aaa;">تابع الموقع للعروض الجديدة</p>
        </div>` :
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">` +
        dealItems.map(item => {
          if(item._kind === 'product') {
            const p = item, trader = item._trader;
            return `
            <div class="deal-tile" onclick="openShopProduct('${p.id}')" style="background:white;border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;">
              <div style="position:relative;aspect-ratio:1/1;background:#f3f4f6;">
                ${p.image_url ? `<img src="${p.image_url}" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;">🏷️</div>'}
                <div style="position:absolute;top:4px;right:4px;background:var(--orange);color:white;font-size:9px;font-weight:900;padding:2px 6px;border-radius:6px;">⭐ عرض</div>
              </div>
              <div style="padding:6px 8px;">
                <div style="font-size:11px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.title)||''}</div>
                <div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏪 ${escapeHtml(trader.shop_name)}</div>
                ${p.price ? `<div style="font-size:12px;font-weight:900;color:#7c3aed;margin-top:2px;">${parseFloat(p.price).toLocaleString()} ج</div>` : ''}
              </div>
            </div>`;
          }
          const ad = item;
          const cat = CATEGORIES.find(c=>c.id===ad.category)||{icon:'📋',name:'عام'};
          return `
          <div class="deal-tile" onclick="openAdDetails('${ad.id}')" style="background:white;border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;">
            <div style="position:relative;aspect-ratio:1/1;background:#f3f4f6;">
              ${ad.image_url ? `<img src="${ad.image_url}" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;">${cat.icon}</div>`}
              <div style="position:absolute;top:4px;right:4px;background:var(--orange);color:white;font-size:9px;font-weight:900;padding:2px 6px;border-radius:6px;">⭐ عرض</div>
              <button onclick="event.stopPropagation();toggleFav('${ad.id}')" style="position:absolute;top:4px;left:4px;background:rgba(255,255,255,.9);color:${isFav(ad.id)?'#dc2626':'#aaa'};border:none;width:22px;height:22px;border-radius:50%;font-size:11px;cursor:pointer;">❤️</button>
            </div>
            <div style="padding:6px 8px;">
              <div style="font-size:11px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ad.title)||''}</div>
              <div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cat.icon} ${cat.name}</div>
            </div>
          </div>`;
        }).join('') + `</div>`
      }
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('deals');
}

async function toggleSponsored(id, val) {
  await sbFetch('PATCH', `ads?id=eq.${id}`, {is_sponsored: val});
  showToast(val ? '📢 تم تفعيل الإعلان الممول!' : 'تم إلغاء الإعلان الممول');
  await loadAds();
}

async function toggleOffer(id, val) {
  await sbFetch('PATCH', `ads?id=eq.${id}`, {is_offer: val});
  showToast(val ? '⭐ تم التمييز كعرض!' : 'تم إلغاء التمييز');
  await loadAds();
  showDeals();
}

async function toggleMyAdOffer(id, val) {
  const u = getCurrentUser();
  if(!u || !u.token) { showToast('سجّل دخولك الأول', 'error'); return; }
  try {
    await sbRPC('secure_toggle_ad_offer', {p_token: u.token, p_ad_id: id, p_is_offer: val});
    showToast(val ? '⭐ اتضاف إعلانك للعروض!' : 'تم إلغاء إعلانك من العروض');
    hideDynPage();
    await loadAds();
  } catch(e) {
    showToast('حصل خطأ، جرب تاني', 'error');
  }
}
function toggleSearch() { showSearchPage(); }

function showSearchPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'search'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🔍 البحث</span>
      <span></span>
    </div>
    <div style="background:var(--primary-dark);padding:12px;">
      <div style="display:flex;align-items:center;background:white;border-radius:12px;overflow:hidden;">
        <span style="padding:0 10px;font-size:18px;">🔍</span>
        <input type="text" id="globalSearchInput" placeholder="ابحث عن وظيفة، طبيب، خدمة..."
          style="flex:1;padding:12px 4px;border:none;font-family:Cairo,sans-serif;font-size:14px;outline:none;"
          oninput="doGlobalSearch()" autofocus>
        <button onclick="document.getElementById('globalSearchInput').value='';doGlobalSearch()" style="padding:0 12px;background:transparent;border:none;font-size:18px;cursor:pointer;color:var(--gray);">✕</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;overflow-x:auto;padding-bottom:2px;">
        <button onclick="setSearchTab('all',this)" id="stab_all" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:none;background:white;color:var(--primary);font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔍 الكل</button>
        <button onclick="setSearchTab('ads',this)" id="stab_ads" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:none;background:rgba(255,255,255,.2);color:white;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📋 إعلانات</button>
        <button onclick="setSearchTab('jobs',this)" id="stab_jobs" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:none;background:rgba(255,255,255,.2);color:white;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💼 وظائف</button>
        <button onclick="setSearchTab('marriage',this)" id="stab_marriage" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:none;background:rgba(255,255,255,.2);color:white;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💍 زواج</button>
      </div>
    </div>
    <div id="searchSuggestions" style="padding:12px 16px;">
      <div style="font-size:12px;color:var(--gray);font-weight:700;margin-bottom:8px;">🔥 الأكثر بحثاً</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${['طبيب','مدرس','حلاق','كهربائي','سباك','ملابس','وظيفة','مطعم','صيدلية','ميكانيكي'].map(k=>`<button onclick="document.getElementById('globalSearchInput').value='${k}';doGlobalSearch()" style="background:#f3f4f6;border:none;padding:6px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;color:#374151;">${k}</button>`).join('')}
      </div>
    </div>
    <div class="dyn-content" id="searchResults" style="padding:0 16px 80px;"></div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  window._searchTab = 'all';
  setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 100);
}

function setSearchTab(tab, btn) {
  window._searchTab = tab;
  ['all','ads','jobs','marriage'].forEach(t => {
    const b = document.getElementById('stab_'+t);
    if(b) { b.style.background = 'rgba(255,255,255,.2)'; b.style.color = 'white'; }
  });
  if(btn) { btn.style.background = 'white'; btn.style.color = 'var(--primary)'; }
  doGlobalSearch();
}

async function doGlobalSearch() {
  const q = document.getElementById('globalSearchInput')?.value.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  const suggestions = document.getElementById('searchSuggestions');
  if(!results) return;
  if(!q || q.length < 2) {
    results.innerHTML = '';
    if(suggestions) suggestions.style.display = 'block';
    return;
  }
  if(suggestions) suggestions.style.display = 'none';
  const tab = window._searchTab || 'all';
  results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray);font-size:13px;">⏳ جاري البحث...</div>';
  let html = '';
  let totalCount = 0;
  // بحث في الإعلانات
  if(tab === 'all' || tab === 'ads' || tab === 'jobs') {
    const filtered = allAds.filter(a => {
      if(a.status !== 'approved' && !isAdmin) return false;
      if(tab === 'jobs' && a.category !== 'jobs') return false;
      return (a.title||'').toLowerCase().includes(q) ||
             (a.description||'').toLowerCase().includes(q) ||
             (a.subcategory||'').toLowerCase().includes(q);
    });
    totalCount += filtered.length;
    if(filtered.length) {
      html += `<div style="font-size:12px;color:var(--gray);font-weight:700;padding:8px 0 4px;">${tab==='jobs'?'💼 وظائف':'📋 إعلانات'} (${filtered.length})</div>`;
      html += filtered.map(ad => {
        const cat = CATEGORIES.find(c=>c.id===ad.category)||{icon:'📋',name:'عام'};
        let phone = ad.phone||''; if(phone.startsWith('01')) phone='20'+phone.substring(1);
        const titleH = escapeHtml(ad.title||'').replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), m=>`<mark style="background:#fef9c3;border-radius:2px;">${m}</mark>`);
        return `<div class="ad-card" style="${ad.is_offer?'border-right:3px solid #f59e0b;':''}" onclick="openAdDetails('${ad.id}')">
          <div class="ad-body">
            <div style="font-size:11px;color:var(--primary);font-weight:700;margin-bottom:4px;">${cat.icon} ${cat.name}${ad.subcategory?' ← '+escapeHtml(ad.subcategory):''} ${ad.is_offer?'⭐':''}</div>
            <div class="ad-title">${titleH}</div>
            ${ad.description?`<div class="ad-desc">${escapeHtml(ad.description.substring(0,80))}...</div>`:''}
            <div style="margin-top:8px;display:flex;gap:6px;">
              <button class="btn-details" onclick="event.stopPropagation();openAdDetails('${ad.id}')">التفاصيل</button>
              ${phone?`<a href="https://wa.me/${phone}?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85+%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C+%D8%B1%D8%A3%D9%8A%D8%AA+%D8%A5%D8%B9%D9%84%D8%A7%D9%86%D9%83%D9%85+%D8%B9%D9%84%D9%89+%D8%AF%D9%84%D9%8A%D9%84+%D8%A7%D9%84%D8%AD%D8%A7%D9%85%D9%88%D9%84+%D9%88%D8%A3%D8%B1%D9%8A%D8%AF+%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1" target="_blank" class="btn-wa" onclick="event.stopPropagation()">💬 واتساب</a>`:''}
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }
  // بحث في بيت الحلال
  if(tab === 'all' || tab === 'marriage') {
    try {
      const profiles = await sbFetch('GET', 'marriage_profiles?status=eq.approved&select=id,ref_code,gender,age,city,social_status,job,education&order=created_at.desc') || [];
      const mFiltered = profiles.filter(p =>
        (p.city||'').toLowerCase().includes(q) ||
        (p.job||'').toLowerCase().includes(q) ||
        (p.education||'').toLowerCase().includes(q) ||
        (p.social_status||'').toLowerCase().includes(q) ||
        (p.ref_code||'').toLowerCase().includes(q)
      );
      totalCount += mFiltered.length;
      if(mFiltered.length) {
        html += `<div style="font-size:12px;color:var(--gray);font-weight:700;padding:8px 0 4px;">💍 بيت الحلال (${mFiltered.length})</div>`;
        html += mFiltered.map(p => {
          const isMale = p.gender==='male';
          const color = isMale?'#2563eb':'#be185d';
          return `<div class="ad-card" style="border-right:3px solid ${color};cursor:pointer;" onclick="showMarriagePage()">
            <div class="ad-body" style="display:flex;align-items:center;gap:10px;">
              <div style="width:40px;height:40px;border-radius:50%;background:${isMale?'#dbeafe':'#fce7f3'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${isMale?'👨':'👩'}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:900;color:${color};">${isMale?'طالب زواج':'طالبة زواج'}</div>
                <div style="font-size:12px;color:var(--gray);">📍 ${escapeHtml(p.city||'الحامول')} • ${p.age} سنة • ${escapeHtml(p.social_status||'')}</div>
                ${p.ref_code?`<div style="font-size:11px;color:#64748b;font-weight:700;">🔖 ${escapeHtml(p.ref_code)}</div>`:''}
              </div>
              <div style="font-size:20px;color:#ccc;">›</div>
            </div>
          </div>`;
        }).join('');
      }
    } catch(e) {}
  }
  if(!totalCount) {
    results.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray);">
      <div style="font-size:48px;margin-bottom:12px;">😕</div>
      <p style="font-size:15px;font-weight:700;">مفيش نتايج لـ "${escapeHtml(q)}"</p>
      <p style="font-size:13px;margin-top:6px;color:#aaa;">جرب كلمة تانية</p>
    </div>`;
    clearTimeout(window._searchMissTimer);
    window._searchMissTimer = setTimeout(function(){
      try { sbFetch('POST', 'search_misses', {query: q}); } catch(e) {}
    }, 900);
    return;
  }
  results.innerHTML = `<div style="font-size:13px;color:var(--gray);padding:4px 0 8px;font-weight:700;">${totalCount} نتيجة لـ "<span style="color:var(--primary);">${q}</span>"</div>${html}`;
}

// DARK MODE
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('hamoul_dark', isDark ? '1' : '0');
  const btn = document.getElementById('darkModeBtn');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function initDarkMode() {
  if(localStorage.getItem('hamoul_dark') === '1') {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('darkModeBtn');
    if(btn) btn.textContent = '☀️';
  }
}

// SKELETON CARDS
function skeletonCards(count=3) {
  return Array(count).fill(0).map(()=>`
    <div class="ad-card" style="pointer-events:none;">
      <div class="ad-body">
        <div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;">
          <div class="skeleton" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="skeleton" style="height:14px;width:70%;margin-bottom:6px;"></div>
            <div class="skeleton" style="height:12px;width:50%;"></div>
          </div>
        </div>
        <div class="skeleton" style="height:13px;width:100%;margin-bottom:6px;"></div>
        <div class="skeleton" style="height:13px;width:80%;margin-bottom:12px;"></div>
        <div style="display:flex;gap:6px;">
          <div class="skeleton" style="height:34px;flex:1;border-radius:8px;"></div>
          <div class="skeleton" style="height:34px;flex:1;border-radius:8px;"></div>
        </div>
      </div>
    </div>`).join('');
}

function skeletonMarriageCards(count=3) {
  return Array(count).fill(0).map(()=>`
    <div class="ad-card" style="pointer-events:none;">
      <div class="ad-body">
        <div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;">
          <div class="skeleton" style="width:48px;height:48px;border-radius:50%;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="skeleton" style="height:14px;width:60%;margin-bottom:6px;"></div>
            <div class="skeleton" style="height:12px;width:80%;"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div class="skeleton" style="height:52px;border-radius:8px;"></div>
          <div class="skeleton" style="height:52px;border-radius:8px;"></div>
        </div>
        <div style="display:flex;gap:6px;">
          <div class="skeleton" style="height:34px;flex:1;border-radius:8px;"></div>
          <div class="skeleton" style="height:34px;flex:1;border-radius:8px;"></div>
        </div>
      </div>
    </div>`).join('');
}

// TOAST
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type==='error' ? 'var(--red)' : 'var(--dark)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}


// DEVICE ID
function getDeviceId() {
  let id = localStorage.getItem('hamoul_device_id');
  if(!id) { id = 'dev_' + Math.random().toString(36).substring(2) + Date.now(); localStorage.setItem('hamoul_device_id', id); }
  return id;
}

// LIKES
async function toggleLike(adId) {
  const deviceId = getDeviceId();
  const existing = await sbFetch('GET', `ad_likes?ad_id=eq.${adId}&device_id=eq.${deviceId}&select=id`);
  if(existing && existing.length > 0) {
    await sbFetch('DELETE', `ad_likes?ad_id=eq.${adId}&device_id=eq.${deviceId}`);
    showToast('تم إلغاء الإعجاب');
  } else {
    await sbFetch('POST', 'ad_likes', {ad_id: adId, device_id: deviceId});
    showToast('❤️ تم الإعجاب!');
  }
  // تحديث عداد اللايكات
  const likes = await sbFetch('GET', `ad_likes?ad_id=eq.${adId}&select=id`);
  const count = likes?.length || 0;
  const btn = document.getElementById('likeBtn_'+adId);
  if(btn) { btn.innerHTML = `${existing?.length > 0 ? '🤍' : '❤️'} ${count}`; }
}

// REVIEWS
function loadSimilarAds(currentId, category, subcategory) {
  const cont = document.getElementById('similarAdsContainer');
  if(!cont) return;
  const similar = allAds.filter(a =>
    a.status === 'approved' &&
    a.id !== currentId &&
    a.category === category &&
    (!subcategory || a.subcategory === subcategory)
  ).slice(0, 4);
  if(!similar.length) return;
  const fakeCat = CATEGORIES.find(c => c.id === category) || {icon:'📋', name:'إعلانات'};
  cont.innerHTML = `
    <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;">
      <div style="padding:12px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:900;">
        🔍 إعلانات مشابهة
      </div>
      ${similar.map(ad => {
        let phone = ad.phone||''; if(phone.startsWith('01')) phone='20'+phone.substring(1);
        return `
        <div onclick="openAdDetails('${ad.id}')" style="display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid #f9fafb;cursor:pointer;">
          ${ad.image_url ? `<img src="${escapeHtml(safeUrl(ad.image_url))}" loading="lazy" style="width:60px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:60px;height:60px;border-radius:8px;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${fakeCat.icon}</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ad.title||'')}</div>
            ${ad.description ? `<div style="font-size:12px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ad.description.substring(0,60))}</div>` : ''}
            <div style="margin-top:6px;display:flex;gap:6px;">
              ${ad.is_offer ? '<span style="background:#fff7ed;color:var(--orange);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">⭐ مميز</span>' : ''}
              <span style="font-size:11px;color:var(--gray);">${new Date(ad.created_at).toLocaleDateString('ar-EG')}</span>
            </div>
          </div>
          <div style="color:var(--gray);font-size:18px;flex-shrink:0;">›</div>
        </div>`;
      }).join('')}
    </div>`;
}

async function loadReviews(adId) {
  const container = document.getElementById('reviewsContainer');
  if(!container) return;
  container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--gray);font-size:12px;">جاري تحميل التقييمات...</div>';
  try {
    const deviceId = getDeviceId();
    const adRef = (typeof allAds !== 'undefined' ? allAds.find(a=>a.id===adId) : null);
    const isDeaths = adRef && adRef.category === 'deaths';
    const isDoctor = adRef && adRef.category === 'doctors';
    const isAdOwner = isOwnerOf(adRef);
    const [reviews, likes, myLike] = await Promise.all([
      sbFetch('GET', `reviews?ad_id=eq.${adId}&select=*&order=created_at.desc`) || [],
      sbFetch('GET', `ad_likes?ad_id=eq.${adId}&select=id`) || [],
      sbFetch('GET', `ad_likes?ad_id=eq.${adId}&device_id=eq.${deviceId}&select=id`) || []
    ]);
    const totalLikes = likes?.length || 0;
    const hasLiked = myLike?.length > 0;
    const avgRating = reviews?.length ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length) : 0;
    const myReview = reviews?.find(r=>r.device_id===deviceId);
    const ratingCounts = [5,4,3,2,1].map(n=>({ n, count: reviews?.filter(r=>r.rating===n).length||0 }));
    container.innerHTML = `
      <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;">
        ${isDeaths ? `
        <div style="padding:14px;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:900;">🤍 كلمات العزاء</div>
          <div style="font-size:11px;color:var(--gray);margin-top:2px;">${reviews?.length||0} رسالة عزاء</div>
        </div>` : `
        <div style="padding:14px;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:900;margin-bottom:10px;">⭐ التقييمات</div>
          <div style="display:flex;gap:12px;align-items:center;">
            <div style="text-align:center;min-width:70px;">
              <div style="font-size:36px;font-weight:900;color:#f59e0b;line-height:1;">${reviews?.length ? avgRating.toFixed(1) : '—'}</div>
              <div style="font-size:16px;margin:2px 0;">${'⭐'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</div>
              <div style="font-size:11px;color:var(--gray);">${reviews?.length||0} تقييم</div>
            </div>
            <div style="flex:1;">
              ${ratingCounts.map(({n,count})=>`
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                <span style="font-size:11px;color:var(--gray);width:8px;">${n}</span>
                <div style="flex:1;background:#f3f4f6;border-radius:4px;height:6px;overflow:hidden;">
                  <div style="background:#f59e0b;height:100%;width:${reviews?.length?(count/reviews.length*100):0}%;border-radius:4px;"></div>
                </div>
                <span style="font-size:11px;color:var(--gray);width:16px;">${count}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>`}
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);">
          <button onclick="toggleLike('${adId}').then(()=>loadReviews('${adId}'))"
            style="width:100%;background:${hasLiked?'#fee2e2':'#f3f4f6'};color:${hasLiked?'#dc2626':'var(--gray)'};border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer;">
            ${hasLiked?'❤️ أنت أعجبت بهذا':'🤍 أعجبني'} • ${totalLikes} إعجاب
          </button>
        </div>
        ${!myReview ? `
        <div style="padding:14px;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;font-weight:900;margin-bottom:10px;">${isDeaths ? '🤍 اكتب كلمة عزاء' : '✍️ أضف تقييمك'}</div>
          <input type="text" id="reviewName" placeholder="اسمك (اختياري)" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;box-sizing:border-box;">
          ${isDeaths ? '' : `
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:10px;">
            ${[1,2,3,4,5].map(i=>`<button onclick="setRating(${i},'${adId}')" id="star_${adId}_${i}" style="background:transparent;border:none;font-size:32px;cursor:pointer;opacity:.3;transition:all .2s;">⭐</button>`).join('')}
          </div>`}
          <textarea id="reviewComment" placeholder="${isDeaths ? 'اكتب كلمة عزاء ومواساة...' : isDoctor ? 'اكتب رأيك أو سؤالك للطبيب...' : 'اكتب تعليقك... (اختياري)'}" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;resize:none;box-sizing:border-box;"></textarea>
          <button onclick="submitReview('${adId}', ${isDeaths})" style="width:100%;background:var(--primary);color:white;border:none;padding:11px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${isDeaths ? 'إرسال كلمة العزاء 🤍' : 'إرسال التقييم ⭐'}</button>
        </div>` : `
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);background:#f0fdf4;text-align:center;font-size:13px;color:#166534;font-weight:700;">
          ✅ ${isDeaths ? 'شكراً لمشاركتنا العزاء' : 'قيّمت هذا الإعلان من قبل — شكراً!'}
        </div>`}
        <div style="padding:14px;">
          <div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:10px;">${isDeaths ? 'رسائل العزاء' : isDoctor ? '💬 آراء وأسئلة عن الطبيب' : 'تعليقات الناس'}</div>
          ${reviews?.length ? reviews.map(r=>`
          <div style="border-bottom:1px solid #f3f4f6;padding-bottom:10px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:13px;font-weight:700;">${r.reviewer_name||'زائر'}</span>
              ${isDeaths ? '' : `<span style="font-size:13px;">${'⭐'.repeat(r.rating||0)}${'☆'.repeat(5-(r.rating||0))}</span>`}
            </div>
            ${r.comment?`<p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 4px;">${escapeHtml(r.comment)}</p>`:''}
            <div style="font-size:11px;color:#aaa;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
            ${r.reply ? `
            <div style="background:#eff6ff;border-radius:10px;padding:8px 10px;margin-top:8px;border-right:3px solid #2563eb;">
              <div style="font-size:11px;font-weight:900;color:#1d4ed8;margin-bottom:2px;">🩺 رد الطبيب</div>
              <div style="font-size:12.5px;color:#1e3a8a;line-height:1.6;">${escapeHtml(r.reply)}</div>
            </div>` : (isDoctor && isAdOwner ? `
            <div style="margin-top:8px;">
              <button onclick="showReplyBox('${r.id}')" id="replyBtn_${r.id}" style="background:#eff6ff;color:#1d4ed8;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">↩️ رد على السؤال ده</button>
              <div id="replyBox_${r.id}" style="display:none;margin-top:6px;">
                <textarea id="replyText_${r.id}" rows="2" placeholder="اكتب ردك..." style="width:100%;padding:8px 10px;border:1.5px solid #bfdbfe;border-radius:8px;font-family:Cairo,sans-serif;font-size:12.5px;margin-bottom:6px;resize:none;box-sizing:border-box;"></textarea>
                <button onclick="submitReply('${r.id}','${adId}')" style="width:100%;background:#2563eb;color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">إرسال الرد</button>
              </div>
            </div>` : '')}
          </div>`).join('') : `<div style="text-align:center;padding:20px;color:var(--gray);font-size:13px;">${isDeaths ? 'كن أول من يواسي الأسرة 🤍' : isDoctor ? 'لسه مفيش آراء أو أسئلة — كن أول من يسأل! 💬' : 'لا توجد تقييمات بعد — كن أول من يقيّم! 🌟'}</div>`}
        </div>
      </div>`;
    window._currentRating = 0;
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--gray);font-size:12px;">تعذر تحميل التقييمات</div>';
  }
}

let _currentRating = 0;
function setRating(val, adId) {
  _currentRating = val;
  window._currentRating = val;
  [1,2,3,4,5].forEach(i => {
    const s = document.getElementById(`star_${adId}_${i}`);
    if(s) { s.style.opacity = i <= val ? '1' : '0.3'; s.style.transform = i <= val ? 'scale(1.1)' : 'scale(1)'; }
  });
}

async function submitReview(adId, skipRatingRequirement) {
  const rating = window._currentRating || 0;
  if(!rating && !skipRatingRequirement) { showToast('اختر عدد النجوم أولاً ⭐','error'); return; }
  const name = document.getElementById('reviewName')?.value.trim() || 'زائر';
  const comment = document.getElementById('reviewComment')?.value.trim() || null;
  if(skipRatingRequirement && !comment) { showToast('اكتب كلمة العزاء أولاً','error'); return; }
  try {
    await sbFetch('POST', 'reviews', {
      ad_id: adId, device_id: getDeviceId(),
      reviewer_name: name, rating: skipRatingRequirement ? null : rating, comment
    });
    showToast(skipRatingRequirement ? '✅ اتبعتت كلمة العزاء، ربنا يصبّر أهل الفقيد 🤍' : '✅ تم إرسال تقييمك! شكراً 🌟');
    loadReviews(adId);
  } catch(e) { showToast('خطأ في الإرسال','error'); }
}

function showReplyBox(reviewId) {
  var box = document.getElementById('replyBox_'+reviewId);
  var btn = document.getElementById('replyBtn_'+reviewId);
  if(box) box.style.display = 'block';
  if(btn) btn.style.display = 'none';
  var ta = document.getElementById('replyText_'+reviewId);
  if(ta) ta.focus();
}

async function submitReply(reviewId, adId) {
  var u = getCurrentUser();
  if(!u || !u.token) { showToast('سجّل دخولك الأول', 'error'); return; }
  var text = document.getElementById('replyText_'+reviewId)?.value.trim();
  if(!text) { showToast('اكتب الرد الأول', 'error'); return; }
  try {
    await sbRPC('secure_reply_to_review', {p_token: u.token, p_review_id: reviewId, p_reply: text});
    showToast('✅ اتبعت ردك');
    loadReviews(adId);
  } catch(e) {
    showToast('حصل خطأ، حاول تاني', 'error');
  }
}

// تحويل وقت الصلاة من نظام 24 ساعة لنظام 12 ساعة (1-12) مع ص/م
function to12h(timeStr) {
  if(!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12;
  if(h === 0) h = 12;
  return h + ':' + m + ' ' + period;
}

async function loadPrayerBar() {
  try {
    const today = new Date();
    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}?city=Hamoul&country=Egypt&method=5`);
    const data = await res.json();
    const t = data?.data?.timings;
    if(!t) return;

    const prayers = [
      {name:'الفجر', time:t.Fajr, icon:'🌙'},
      {name:'الشروق', time:t.Sunrise, icon:'🌅'},
      {name:'الظهر', time:t.Dhuhr, icon:'☀️'},
      {name:'العصر', time:t.Asr, icon:'🌤️'},
      {name:'المغرب', time:t.Maghrib, icon:'🌇'},
      {name:'العشاء', time:t.Isha, icon:'🌙'},
    ];

    const nowMins = today.getHours()*60 + today.getMinutes();
    let nextPrayer = null;
    prayers.forEach(p => {
      const [h,m] = p.time.split(':').map(Number);
      const pMins = h*60+m;
      if(pMins > nowMins && !nextPrayer) { nextPrayer = {...p, remaining: pMins-nowMins}; }
    });

    const bar = document.getElementById('prayerTimesBar');
    if(bar) bar.innerHTML = prayers.map(p => {
      const [h,m] = p.time.split(':').map(Number);
      const isNext = nextPrayer?.name === p.name;
      const isPast = (h*60+m) < nowMins;
      return `<span style="white-space:nowrap;${isNext?'color:#86efac;font-weight:700;':isPast?'opacity:.5;':''}">
        ${p.icon} ${p.name} ${to12h(p.time)}
      </span>`;
    }).join('<span style="opacity:.3;">|</span>');

    const badge = document.getElementById('nextPrayerBadge');
    if(badge && nextPrayer) {
      const h = Math.floor(nextPrayer.remaining/60);
      const m = nextPrayer.remaining%60;
      badge.textContent = `${nextPrayer.icon} ${nextPrayer.name} — ${h>0?h+'س ':''} ${m}د`;
      badge.style.display = 'block';
    }
  } catch(e) {
    const bar = document.getElementById('prayerTimesBar');
    if(bar) bar.innerHTML = '<span style="opacity:.6;">اضغط لعرض المواقيت</span>';
  }
}

// alias لأن الـ init بينادي loadPrayerTimes
const loadPrayerTimes = loadPrayerBar;

// PRAYER TIMES PAGE
async function showPrayerTimes() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'prayer'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🕌 مواقيت الصلاة</span>
      <span></span>
    </div>
    <div class="dyn-content">
      <div style="text-align:center;padding:40px;color:var(--gray);">
        <div class="spinner"></div>
        <p style="margin-top:12px;">جاري تحميل المواقيت...</p>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  try {
    // API مجاني لمواقيت الصلاة — الحامول، كفر الشيخ، مصر
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=Hamoul&country=Egypt&method=5`);
    const data = await res.json();
    const timings = data?.data?.timings;
    const hijri = data?.data?.date?.hijri;
    const greg = data?.data?.date?.gregorian;

    const prayers = [
      { name:'الفجر',   time: timings?.Fajr,    icon:'🌙', color:'#1e3a5f', textColor:'white' },
      { name:'الشروق',  time: timings?.Sunrise,  icon:'🌅', color:'#f59e0b', textColor:'white' },
      { name:'الظهر',   time: timings?.Dhuhr,    icon:'☀️', color:'#f97316', textColor:'white' },
      { name:'العصر',   time: timings?.Asr,      icon:'🌤️', color:'#06b6d4', textColor:'white' },
      { name:'المغرب',  time: timings?.Maghrib,  icon:'🌇', color:'#dc2626', textColor:'white' },
      { name:'العشاء',  time: timings?.Isha,     icon:'🌙', color:'#1e1b4b', textColor:'white' },
    ];

    // تحديد الصلاة الحالية والقادمة
    const nowMins = today.getHours() * 60 + today.getMinutes();
    let nextPrayer = null;
    prayers.forEach(p => {
      if(!p.time) return;
      const [h,m] = p.time.split(':').map(Number);
      const pMins = h * 60 + m;
      if(pMins > nowMins && !nextPrayer) nextPrayer = {...p, mins: pMins - nowMins};
    });

    const content = page.querySelector('.dyn-content');
    content.innerHTML = `
      <!-- التاريخ -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:20px;border-radius:14px;margin-bottom:16px;color:white;text-align:center;">
        <div style="font-size:16px;font-weight:900;margin-bottom:4px;">
          ${hijri?.day} ${hijri?.month?.ar} ${hijri?.year} هـ
        </div>
        <div style="font-size:13px;opacity:.8;">
          ${greg?.weekday?.ar} — ${greg?.day} ${greg?.month?.en} ${greg?.year}
        </div>
        <div style="font-size:12px;opacity:.7;margin-top:4px;">📍 مركز الحامول — كفر الشيخ</div>
      </div>

      <!-- الصلاة القادمة -->
      ${nextPrayer ? `
      <div style="background:linear-gradient(135deg,#166534,#22c55e);padding:16px;border-radius:14px;margin-bottom:16px;color:white;text-align:center;">
        <div style="font-size:12px;opacity:.85;margin-bottom:4px;">الصلاة القادمة</div>
        <div style="font-size:22px;font-weight:900;">${nextPrayer.icon} ${nextPrayer.name}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${to12h(nextPrayer.time)}</div>
        <div style="font-size:13px;opacity:.85;margin-top:6px;">
          باقي ${Math.floor(nextPrayer.mins/60) > 0 ? Math.floor(nextPrayer.mins/60)+' ساعة و' : ''}${nextPrayer.mins%60} دقيقة
        </div>
      </div>` : ''}

      <!-- كل الصلوات -->
      <div style="display:grid;gap:8px;">
        ${prayers.map(p => {
          const [h,m] = (p.time||'00:00').split(':').map(Number);
          const pMins = h * 60 + m;
          const isPast = pMins < nowMins;
          const isNext = nextPrayer?.name === p.name;
          return `
          <div style="background:${isNext ? p.color : 'white'};border-radius:14px;padding:14px 16px;border:${isNext?'none':'1px solid var(--border)'};display:flex;align-items:center;justify-content:space-between;opacity:${isPast&&!isNext?'.6':'1'};">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="font-size:24px;">${p.icon}</div>
              <div>
                <div style="font-size:15px;font-weight:900;color:${isNext?'white':'var(--dark)'};">${p.name}</div>
                ${isPast ? `<div style="font-size:11px;color:${isNext?'rgba(255,255,255,.7)':'#aaa'};">انتهت</div>` : ''}
              </div>
            </div>
            <div style="font-size:18px;font-weight:900;color:${isNext?'white':'var(--primary)'};">${to12h(p.time)}</div>
          </div>`;
        }).join('')}
      </div>

      <div style="text-align:center;margin-top:14px;font-size:11px;color:#aaa;">
        المواقيت من aladhan.com — طريقة حساب وزارة الأوقاف المصرية
      </div>`;

  } catch(e) {
    page.querySelector('.dyn-content').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--gray);">
        <div style="font-size:48px;margin-bottom:12px;">📡</div>
        <p style="font-weight:700;">تعذر تحميل المواقيت</p>
        <button onclick="showPrayerTimes()" style="margin-top:14px;background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">إعادة المحاولة</button>
      </div>`;
  }
}

// ========== أرقام الطوارئ ==========
const EMERGENCY_SECTIONS = [
  {
    title: 'أرقام الطوارئ المركزية',
    numbers: [
      { name:'الإسعاف',              number:'123',        icon:'🚑', color:'#dc2626' },
      { name:'الشرطة / النجدة',       number:'122',        icon:'🚓', color:'#1e3a5f' },
      { name:'المطافئ / الحماية المدنية', number:'180',    icon:'🚒', color:'#ea580c' },
      { name:'طوارئ الغاز الطبيعي',   number:'129',        icon:'🔥', color:'#0891b2' },
      { name:'طوارئ الكهرباء',        number:'121',        icon:'⚡', color:'#f59e0b' },
      { name:'طوارئ المياه والصرف الصحي', number:'125',    icon:'💧', color:'#0284c7' },
    ]
  },
  {
    title: 'أرقام الخدمات المحلية — مركز ومدينة الحامول',
    numbers: [
      { name:'مركز شرطة الحامول',           number:'0473800122', icon:'🚓', color:'#1e3a5f' },
      { name:'مستشفى الحامول المركزي',      number:'0473800346', icon:'🏥', color:'#dc2626' },
      { name:'مجلس مدينة الحامول (عمليات وأزمات)', number:'0473800311', icon:'🏛️', color:'#166534' },
      { name:'وحدة مطافئ الحامول',          number:'0473800180', icon:'🚒', color:'#ea580c' },
      { name:'هندسة كهرباء الحامول',         number:'0473801267', icon:'⚡', color:'#f59e0b' },
      { name:'شركة مياه الشرب بالحامول',     number:'0473800632', icon:'💧', color:'#0284c7' },
    ]
  },
  {
    title: 'أرقام محافظة كفر الشيخ',
    numbers: [
      { name:'غرفة عمليات محافظة كفر الشيخ', number:'0473220741', icon:'🏛️', color:'#166534' },
      { name:'الخط الساخن للمحافظة',         number:'114',        icon:'📞', color:'#7c3aed' },
      { name:'إسعاف كفر الشيخ الرئيسي',      number:'0473223441', icon:'🚑', color:'#dc2626' },
    ]
  }
];

function emergencyRow(e) {
  return '<a href="tel:'+e.number+'" style="text-decoration:none;display:flex;align-items:center;gap:12px;background:white;border:1px solid var(--border);border-radius:14px;padding:14px 16px;">' +
    '<div style="width:44px;height:44px;border-radius:12px;background:'+e.color+'22;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">'+e.icon+'</div>' +
    '<div style="flex:1;"><div style="font-size:14px;font-weight:900;color:var(--dark);">'+e.name+'</div></div>' +
    '<div style="font-size:'+(e.number.length>6?'15px':'20px')+';font-weight:900;color:'+e.color+';direction:ltr;">'+e.number+'</div>' +
  '</a>';
}

function showEmergencyPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'emergency'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🚨 أرقام الطوارئ</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px;">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;margin-bottom:14px;text-align:center;font-size:12px;color:#991b1b;">
        📞 اضغط على أي رقم عشان تتصل بيه على طول
      </div>
      ${EMERGENCY_SECTIONS.map(function(sec){
        return '<div style="margin-bottom:18px;">' +
          '<div style="font-size:13px;font-weight:900;color:var(--primary);margin-bottom:8px;padding-right:2px;">'+sec.title+'</div>' +
          '<div style="display:grid;gap:10px;">' + sec.numbers.map(emergencyRow).join('') + '</div>' +
        '</div>';
      }).join('')}
      <div style="text-align:center;margin-top:6px;font-size:11px;color:#aaa;">
        سيف الأرقام دي عندك — ممكن تحتاجها فجأة أو تساعد بيها حد في الشارع 🙏
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ========== بيت الحلال ==========
// ===== نصائح للتعارف الشرعي =====
function renderMarriageTipsCard() {
  return `
    <div id="marriageTipsCard" style="background:#fffbeb;border-bottom:2px solid #fde68a;padding:14px 16px;">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:22px;flex-shrink:0;">🕌</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:6px;">نصائح للتعارف الشرعي</div>
          <ul style="margin:0;padding-right:16px;font-size:12px;color:#78350f;line-height:1.9;">
            <li>التواصل الأول دايمًا بإشراف الإدارة — محدش يشارك رقمه مباشرة قبل الموافقة</li>
            <li>خلي أهلك في الصورة من البداية — الاستخارة والمشورة بركة</li>
            <li>الصدق في البيانات أهم حاجة — التعارف مبني على الثقة</li>
            <li>خد وقتك في التعارف، ومتستعجلش قرار بهذا الحجم</li>
          </ul>
        </div>
        <button onclick="dismissMarriageTips()" style="background:transparent;border:none;color:#92400e;font-size:16px;cursor:pointer;flex-shrink:0;">✕</button>
      </div>
    </div>`;
}
function dismissMarriageTips() {
  localStorage.setItem('marriage_tips_seen', '1');
  var box = document.getElementById('marriageTipsBox');
  if(box) box.innerHTML = '';
}

function marriageBannerHtml() {
  return `<div id="marriageCollapsible">
      <div style="background:linear-gradient(135deg,#be185d,#ec4899);padding:16px;color:white;text-align:center;">
        <div style="font-size:28px;margin-bottom:6px;">💍</div>
        <div style="font-size:15px;font-weight:900;">بيت الحلال — مركز الحامول</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px;">منصة آمنة وموثوقة للتعارف الشرعي</div>
        <div style="font-size:11px;opacity:.7;margin-top:4px;">البيانات سرية — التواصل بموافقة الطرفين فقط</div>
      </div>
      <div id="marriageTipsBox">${localStorage.getItem('marriage_tips_seen') ? '' : renderMarriageTipsCard()}</div>
    </div>`;
}

function showMarriagePage(filter='all') {
  sessionStorage.setItem('dynState', JSON.stringify({type:'marriage', filter}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>💍 بيت الحلال</span>
      <div style="display:flex;gap:6px;">
        <button onclick="showMyMarriageProfile()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">👤 ملفي</button>
        <button onclick="showMarriageForm()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ سجّل</button>
      </div>
    </div>
    </div>

    <!-- تابات الجنس -->
    <div style="display:flex;background:white;border-bottom:2px solid var(--border);">
      <button onclick="setMarriageGenderFilter('all',this)" id="mfAll" style="flex:1;padding:10px;border:none;background:var(--primary);color:white;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">الكل</button>
      <button onclick="setMarriageGenderFilter('male',this)" id="mfMale" style="flex:1;padding:10px;border:none;background:transparent;color:var(--gray);font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">👨 طالب</button>
      <button onclick="setMarriageGenderFilter('female',this)" id="mfFemale" style="flex:1;padding:10px;border:none;background:transparent;color:var(--gray);font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">👩 طالبة</button>
      <button onclick="toggleMarriageFilters()" style="padding:10px 14px;border:none;background:transparent;color:var(--gray);font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;" title="فلاتر">⚙️</button>
    </div>

    <!-- لوح الفلاتر المتقدمة (مخفي بالأساس) -->
    <div id="marriageFilterPanel" style="display:none;background:#f8f9fa;padding:12px;border-bottom:2px solid var(--border);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="font-size:11px;color:var(--gray);font-weight:700;display:block;margin-bottom:3px;">📍 البلد</label>
          <select id="mFilterCity" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
            <option value="">كل البلاد</option>
            <option>الحامول</option>
            <option>كفر الشيخ</option>
            <option>دسوق</option>
            <option>فوه</option>
            <option>سيدي سالم</option>
            <option>بيلا</option>
            <option>مطوبس</option>
            <option>قلين</option>
            <option>محافظة أخرى</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--gray);font-weight:700;display:block;margin-bottom:3px;">💒 الحالة</label>
          <select id="mFilterSocial" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
            <option value="">الكل</option>
            <option>أعزب</option>
            <option>مطلق</option>
            <option>أرمل</option>
            <option>متزوج</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--gray);font-weight:700;display:block;margin-bottom:3px;">📅 السن من</label>
          <input type="number" id="mFilterAgeMin" placeholder="18" min="18" max="70" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;color:var(--gray);font-weight:700;display:block;margin-bottom:3px;">📅 السن لحد</label>
          <input type="number" id="mFilterAgeMax" placeholder="50" min="18" max="70" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;box-sizing:border-box;">
        </div>
        <div style="grid-column:1/-1;">
          <label style="font-size:11px;color:var(--gray);font-weight:700;display:block;margin-bottom:3px;">🕌 الالتزام</label>
          <select id="mFilterReligion" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
            <option value="">الكل</option>
            <option>ملتزم</option>
            <option>متوسط الالتزام</option>
            <option>محافظ</option>
          </select>
        </div>
        <input type="hidden" id="mFilterMarriageType" value="">
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="applyMarriageFilters()" style="flex:1;background:#be185d;color:white;border:none;padding:9px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🔍 بحث</button>
        <button onclick="resetMarriageFilters()" style="background:#f3f4f6;color:var(--gray);border:none;padding:9px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">↺ إعادة</button>
      </div>
    </div>

    <!-- نتيجة الفلتر النشط -->
    <div id="marriageFilterBadge" style="display:none;background:#fdf2f8;padding:8px 12px;border-bottom:1px solid #f9a8d4;font-size:12px;color:#be185d;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
      <span id="marriageFilterText"></span>
      <button onclick="resetMarriageFilters()" style="background:transparent;border:none;color:#be185d;font-size:13px;cursor:pointer;">✕ مسح</button>
    </div>

    <div id="catBanner"></div>
    <div class="dyn-content" id="marriageContent">
      ${marriageBannerHtml()}
      ${skeletonMarriageCards(3)}
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('marriage');
  loadMarriageProfiles(filter);
}

async function loadMarriageProfiles(filter='all') {
  try {
    let path = `marriage_profiles?select=id,ref_code,gender,age,education,job,social_status,city,religiosity,about,requirements,status,is_verified,card_image,marriage_type,children${isAdmin?',phone,whatsapp,personal_photo':''}&order=created_at.desc`;
    if(filter !== 'all') path += `&gender=eq.${filter}`;
    if(!isAdmin) path += '&status=eq.approved';
    const profiles = await sbFetch('GET', path) || [];

    // جيب اللايكات عشان نعرف عدد اللايكات ولو الجهاز ده عمل لايك قبل كده
    const deviceId = getDeviceId();
    let likesData = [];
    try {
      likesData = await sbFetch('GET', 'marriage_likes?select=profile_id,device_id') || [];
    } catch(e) {}

    // حسب عدد اللايكات لكل ملف وشوف لو الجهاز ده عمل لايك
    const likeCountMap = {};
    const myLikesSet = new Set();
    likesData.forEach(l => {
      likeCountMap[l.profile_id] = (likeCountMap[l.profile_id]||0) + 1;
      if(l.device_id === deviceId) myLikesSet.add(l.profile_id);
    });

    profiles.forEach(p => {
      p.likes_count = likeCountMap[p.id] || 0;
      p.i_liked = myLikesSet.has(p.id);
    });

    renderMarriageProfiles(profiles);
  } catch(e) { showToast('خطأ في التحميل','error'); }
}

function renderMarriageProfiles(profiles) {
  const content = document.getElementById('marriageContent');
  if(!content) return;
  if(!profiles.length) {
    content.innerHTML = marriageBannerHtml() + `<div style="text-align:center;padding:60px 20px;color:var(--gray);">
      <div style="font-size:48px;margin-bottom:12px;">💍</div>
      <p style="font-size:15px;font-weight:700;">مفيش ملفات دلوقتي</p>
      <button onclick="showMarriageForm()" style="margin-top:14px;background:#be185d;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ سجّل ملفك</button>
    </div>`;
    return;
  }
  window._marriageProfiles = profiles;
  content.innerHTML = marriageBannerHtml() + profiles.map(p => {
    const isMale = p.gender === 'male';
    const borderColor = isMale ? '#2563eb' : '#be185d';
    const bgBadge = isMale ? '#dbeafe' : '#fce7f3';
    const textBadge = isMale ? '#1e40af' : '#be185d';
    const likeCount = p.likes_count || 0;
    return `
    <div class="ad-card" style="border-right:4px solid ${borderColor};cursor:pointer;background:white;" onclick="openMarriageDetail('${p.id}')">
      <div class="ad-body">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:48px;height:48px;border-radius:50%;background:${bgBadge};display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${isMale?'👨':'👩'}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:14px;font-weight:900;color:${textBadge};">${isMale?'👨 طالب زواج':'👩 طالبة زواج'}</span>
              ${p.is_verified?'<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">✅ موثق</span>':''}
            </div>
            <div style="font-size:12px;color:var(--gray);margin-top:2px;">📍 ${escapeHtml(p.city||'الحامول')} • ${p.age} سنة • ${escapeHtml(p.social_status||'')}</div>
            ${p.ref_code?`<div style="font-size:11px;font-weight:900;color:#64748b;margin-top:3px;background:#f1f5f9;display:inline-block;padding:2px 8px;border-radius:6px;">🔖 ${p.ref_code}</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${likeCount>0?`<span style="font-size:11px;color:#be185d;font-weight:700;">${likeCount} ❤️</span>`:''}
            <div style="font-size:22px;color:#ccc;">›</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
          <div style="background:#f8f9fa;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--gray);">المؤهل</div><div style="font-size:12px;font-weight:700;">${escapeHtml(p.education||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--gray);">المهنة</div><div style="font-size:12px;font-weight:700;">${escapeHtml(p.job||'—')}</div></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="event.stopPropagation();toggleMarriageLike('${p.id}',this)" style="flex:1;background:${p.i_liked?'#be185d':bgBadge};color:${p.i_liked?'white':textBadge};border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">${p.i_liked?'❤️ معجب':'🤍 اهتمام'}</button>
          <button onclick="event.stopPropagation();openContactRequest('${p.id}')" style="flex:1;background:${borderColor};color:white;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📩 طلب تواصل</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function showMyMarriageProfile() {
  const deviceId = getDeviceId();
  const old = document.getElementById('myProfileDrawer');
  if(old) old.remove();

  // أعمل drawer تحميل
  const drawer = document.createElement('div');
  drawer.id = 'myProfileDrawer';
  drawer.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);';
  drawer.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;max-height:88vh;overflow-y:auto;">
      <div style="padding:20px;text-align:center;">
        <div style="font-size:30px;margin-bottom:8px;">⏳</div>
        <p style="color:var(--gray);">جاري البحث عن ملفك...</p>
      </div>
    </div>`;
  drawer.addEventListener('click', e => { if(e.target===drawer) drawer.remove(); });
  document.body.appendChild(drawer);

  try {
    const profiles = await sbFetch('GET', `marriage_profiles?device_id=eq.${deviceId}&select=*`) || [];

    if(!profiles.length) {
      drawer.querySelector('div > div').innerHTML = `
        <div style="padding:28px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">💍</div>
          <div style="font-size:15px;font-weight:900;margin-bottom:8px;">مفيش ملف مسجل من جهازك</div>
          <p style="font-size:13px;color:var(--gray);margin-bottom:20px;">سجّل ملفك دلوقتي وهيظهر بعد موافقة الإدارة</p>
          <button onclick="document.getElementById('myProfileDrawer').remove();showMarriageForm();" style="background:#be185d;color:white;border:none;padding:12px 24px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">+ سجّل ملفك</button>
          <br><br>
          <button onclick="document.getElementById('myProfileDrawer').remove()" style="background:#f3f4f6;color:var(--gray);border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إغلاق</button>
        </div>`;
      return;
    }

    const p = profiles[0];
    const isMale = p.gender === 'male';
    const statusColor = p.status==='pending'?'#f59e0b':p.status==='approved'?'#10b981':'#ef4444';
    const statusLabel = p.status==='pending'?'⏳ جاري مراجعة طلبك من قبل الإدارة':p.status==='approved'?'✅ تم قبول طلبك':'❌ تم رفض الملف';
    const bgColor = isMale ? '#dbeafe' : '#fce7f3';
    const textColor = isMale ? '#1e40af' : '#be185d';

    drawer.querySelector('div > div').innerHTML = `
      <div style="position:sticky;top:0;background:white;padding:14px 16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:15px;font-weight:900;">👤 ملفي في بيت الحلال</div>
        <button onclick="document.getElementById('myProfileDrawer').remove()" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:16px 16px 28px;">

        <!-- حالة الملف -->
        <div style="background:${statusColor}22;border-radius:12px;padding:12px;margin-bottom:16px;text-align:center;border:1px solid ${statusColor}44;">
          <div style="font-size:15px;font-weight:900;color:${statusColor};">${statusLabel}</div>
          ${p.ref_code?`<div style="font-size:12px;color:var(--gray);margin-top:4px;">🔖 رقم ملفك: <strong>${p.ref_code}</strong></div>`:''}
          ${p.status==='rejected'?`<p style="font-size:12px;color:var(--gray);margin-top:6px;">تواصل مع الإدارة لمعرفة السبب</p>`:''}
        </div>

        <!-- بيانات الملف -->
        <div style="background:${bgColor};border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-size:14px;font-weight:900;color:${textColor};margin-bottom:10px;">${isMale?'👨 طالب زواج':'👩 طالبة زواج'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:white;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:10px;color:var(--gray);">السن</div><div style="font-size:13px;font-weight:700;">${p.age} سنة</div></div>
            <div style="background:white;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:10px;color:var(--gray);">الحالة</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.social_status||'—')}</div></div>
            <div style="background:white;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:10px;color:var(--gray);">البلد</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.city||'—')}</div></div>
            <div style="background:white;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:10px;color:var(--gray);">المهنة</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.job||'—')}</div></div>
          </div>
          ${p.about?`<div style="background:white;border-radius:8px;padding:10px;margin-top:8px;font-size:13px;line-height:1.6;"><span style="font-size:11px;color:var(--gray);">نبذة: </span>${escapeHtml(p.about)}</div>`:''}
        </div>

        <!-- إحصائيات -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
          <div style="background:#fdf2f8;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#be185d;" id="myLikesCount">...</div>
            <div style="font-size:11px;color:var(--gray);">❤️ اهتمام</div>
          </div>
          <div style="background:#f0fdf4;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#10b981;" id="myRequestsCount">...</div>
            <div style="font-size:11px;color:var(--gray);">📩 طلب تواصل</div>
          </div>
        </div>

        <!-- أزرار -->
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${p.status==='approved'?`
          <div style="background:#f0fdf4;border-radius:10px;padding:12px;font-size:12px;color:#166534;text-align:center;">
            ✅ ملفك ظاهر للناس — لو اتجوزت احذفه عشان تفرّح غيرك 💍
          </div>`:''}
          <button onclick="confirmDeleteMyProfile('${p.id}')" style="width:100%;background:#fee2e2;color:#dc2626;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;cursor:pointer;">🗑️ حذف ملفي نهائياً</button>
          <button onclick="document.getElementById('myProfileDrawer').remove()" style="width:100%;background:#f3f4f6;color:var(--gray);border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إغلاق</button>
        </div>
      </div>`;

    // جيب إحصائيات اللايكات والطلبات
    try {
      const likes = await sbFetch('GET', `marriage_likes?profile_id=eq.${p.id}&select=id`) || [];
      const reqs = await sbFetch('GET', `marriage_requests_public?to_profile_id=eq.${p.id}&select=id`) || [];
      const lEl = document.getElementById('myLikesCount');
      const rEl = document.getElementById('myRequestsCount');
      if(lEl) lEl.textContent = likes.length;
      if(rEl) rEl.textContent = reqs.length;
    } catch(e) {}

  } catch(e) {
    drawer.querySelector('div > div').innerHTML = `
      <div style="padding:28px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="color:var(--red);">خطأ في التحميل — تأكد من الاتصال</p>
        <button onclick="document.getElementById('myProfileDrawer').remove()" style="margin-top:12px;background:#f3f4f6;color:var(--gray);border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;cursor:pointer;">إغلاق</button>
      </div>`;
  }
}

async function confirmDeleteMyProfile(profileId) {
  const drawer = document.createElement('div');
  drawer.className = 'marriageDeleteConfirmDrawer';
  drawer.style.cssText = 'position:fixed;inset:0;z-index:700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:20px;';
  drawer.addEventListener('click', e => { if(e.target===drawer) drawer.remove(); });
  drawer.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;position:relative;">
      <button onclick="this.closest('.marriageDeleteConfirmDrawer').remove()" style="position:absolute;top:10px;left:10px;background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;">✕</button>
      <div style="font-size:40px;margin-bottom:12px;">💍</div>
      <div style="font-size:16px;font-weight:900;margin-bottom:8px;">هل اتجوزت؟ 🎉</div>
      <p style="font-size:13px;color:var(--gray);line-height:1.6;margin-bottom:20px;">لو اتجوزت الحمد لله! احذف ملفك عشان تفرّح الناس بخبر جواز جديد في الحامول 💍<br><br>لو مش اتجوزت وعاوز تحذف لسبب تاني، اضغط تأكيد الحذف.</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="deleteMyProfile('${profileId}', true)" style="background:#10b981;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💍 اتجوزت — احذف وشاركوا الخبر!</button>
        <button onclick="deleteMyProfile('${profileId}', false)" style="background:#fee2e2;color:#dc2626;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🗑️ حذف بدون إعلان</button>
        <button onclick="this.closest('.marriageDeleteConfirmDrawer').remove()" style="background:#f3f4f6;color:var(--gray);border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(drawer);
}

async function deleteMyProfile(profileId, announce) {
  try {
    const deviceId = getDeviceId();
    await sbRPC('delete_my_marriage_profile', {p_device_id: deviceId, p_profile_id: profileId});
    // أغلق كل الـ drawers
    document.getElementById('myProfileDrawer')?.remove();
    document.querySelectorAll('.marriageDeleteConfirmDrawer').forEach(d=>d.remove());
    document.querySelectorAll('div[style*="z-index:700"]').forEach(d=>d.remove());
    if(announce) {
      showToast('💍 مبروك الجواز! تم حذف ملفك');
      const msg = `💍 خبر فرحة من بيت الحلال!\n\nأحد أعضاء بيت الحلال أعلن عن جوازه بالحمد لله 🎉\nنسأل الله لهم الستر والتوفيق والذرية الصالحة 💚\n\n📲 دليل الحامول — souqelhamoul.com`;
      setTimeout(()=>{ const a=document.createElement('a'); a.href=`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`; a.target='_blank'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),500); }, 800);
    } else {
      showToast('✅ تم حذف ملفك');
    }
    loadMarriageProfiles();
  } catch(e) {
    document.querySelectorAll('.marriageDeleteConfirmDrawer').forEach(d=>d.remove());
    showToast('خطأ في الحذف','error');
  }
}

async function toggleMarriageLike(profileId, btn) {
  const deviceId = getDeviceId();
  const p = (window._marriageProfiles||[]).find(x=>String(x.id)===String(profileId));
  const alreadyLiked = p?.i_liked;
  try {
    if(alreadyLiked) {
      await sbFetch('DELETE', `marriage_likes?profile_id=eq.${profileId}&device_id=eq.${deviceId}`);
      if(p) { p.i_liked = false; p.likes_count = Math.max(0,(p.likes_count||1)-1); }
      btn.style.background = ''; btn.style.color = '';
      btn.textContent = '🤍 اهتمام';
      showToast('تم إلغاء الاهتمام');
    } else {
      await sbFetch('POST', 'marriage_likes', {profile_id: profileId, device_id: deviceId});
      if(p) { p.i_liked = true; p.likes_count = (p.likes_count||0)+1; }
      btn.style.background = '#be185d'; btn.style.color = 'white';
      btn.textContent = '❤️ معجب';
      showToast('❤️ تم تسجيل اهتمامك');
      addMarriageNotification('interest', 'اهتمام بملف زواج', null);
    }
  } catch(e) { showToast('حاول تاني','error'); }
}

function openContactRequest(profileId) {
  const p = (window._marriageProfiles||[]).find(x=>String(x.id)===String(profileId));
  if(!p) return;
  const isMale = p.gender === 'male';
  const borderColor = isMale ? '#2563eb' : '#be185d';
  const bgBadge = isMale ? '#dbeafe' : '#fce7f3';
  const textBadge = isMale ? '#1e40af' : '#be185d';
  const old = document.getElementById('contactRequestModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'contactRequestModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;width:100%;max-width:600px;padding:20px;padding-bottom:32px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:900;color:#1e293b;">📩 طلب تواصل</div>
        <button onclick="document.getElementById('contactRequestModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="background:${bgBadge};border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px;color:${textBadge};font-weight:700;">
        ${isMale?'👨 طالب زواج':'👩 طالبة زواج'} • ${p.age} سنة • ${escapeHtml(p.city||'الحامول')}
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">اسمك *</label>
        <input id="reqName" type="text" placeholder="الاسم الكريم" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رقم تليفونك *</label>
        <input id="reqPhone" type="tel" placeholder="01xxxxxxxxx" maxlength="11" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رسالة (اختياري)</label>
        <textarea id="reqMsg" rows="2" placeholder="أي معلومة إضافية..." style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;"></textarea>
      </div>
      <div style="background:#fef9c3;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:#92400e;line-height:1.6;">
        🔒 بياناتك للإدارة فقط — لن يعرف أحد رقمك إلا بموافقتك. الإدارة هي من تقرر إتمام التواصل.
      </div>
      <button onclick="submitContactRequest('${profileId}')" style="width:100%;background:${borderColor};color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;" id="reqSubmitBtn">📩 إرسال الطلب للإدارة</button>
    </div>`;
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function submitContactRequest(profileId) {
  const name = document.getElementById('reqName').value.trim();
  const phone = document.getElementById('reqPhone').value.trim();
  const message = document.getElementById('reqMsg').value.trim();
  if(!name) { showToast('اكتب اسمك','error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)) { showToast('رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم','error'); return; }
  const btn = document.getElementById('reqSubmitBtn');
  btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...';
  try {
    const p = (window._marriageProfiles||[]).find(x=>String(x.id)===String(profileId));
    await sbFetch('POST', 'marriage_requests', {
      from_device: getDeviceId(),
      to_profile_id: profileId,
      from_name: name,
      from_phone: phone,
      message: message || null,
      status: 'pending'
    });
    document.getElementById('contactRequestModal').remove();
    showToast('✅ تم إرسال طلبك! الإدارة ستتواصل معك قريباً');
    addMarriageNotification('request', 'طلب تواصل جديد من ' + name, null);
    const isMale = p?.gender === 'male';
    const msg = `📩 طلب تواصل جديد في بيت الحلال!\n\n👤 الطالب: ${name}\n📞 رقمه: ${phone}${message?'\n💬 رسالة: '+message:''}\n\n${isMale?'👨':'👩'} الملف: ${isMale?'طالب زواج':'طالبة زواج'} — ${p?.age} سنة${p?.ref_code?' 🔖 '+p.ref_code:''}\n\n⏳ في انتظار قرارك بالتواصل بينهم`;
    setTimeout(()=>{const a=document.createElement('a');a.href=`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;a.target='_blank';document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),500);},600);
  } catch(e) {
    showToast('خطأ: ' + (e.message||'تأكد من الاتصال'),'error');
    btn.disabled=false; btn.textContent='📩 إرسال الطلب للإدارة';
  }
}

function openMarriageDetail(profileId) {
  const p = (window._marriageProfiles||[]).find(x=>String(x.id)===String(profileId));
  if(!p) return;
  const isMale = p.gender === 'male';
  const borderColor = isMale ? '#2563eb' : '#be185d';
  const bgBadge = isMale ? '#dbeafe' : '#fce7f3';
  const textBadge = isMale ? '#1e40af' : '#be185d';
  const old = document.getElementById('marriageDetailDrawer');
  if(old) old.remove();
  const drawer = document.createElement('div');
  drawer.id = 'marriageDetailDrawer';
  drawer.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.5);';
  drawer.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;max-height:88vh;overflow-y:auto;">
      <div style="position:sticky;top:0;background:white;padding:14px 16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:42px;height:42px;border-radius:50%;background:${bgBadge};display:flex;align-items:center;justify-content:center;font-size:22px;">${isMale?'👨':'👩'}</div>
          <div>
            <div style="font-size:14px;font-weight:900;color:${textBadge};">${isMale?'👨 طالب زواج':'👩 طالبة زواج'}</div>
            <div style="font-size:12px;color:var(--gray);">📍 ${escapeHtml(p.city||'الحامول')}${p.is_verified?' • ✅ موثق':''}${p.ref_code?' • 🔖 '+escapeHtml(p.ref_code):''}</div>
          </div>
        </div>
        <button onclick="document.getElementById('marriageDetailDrawer').remove()" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:16px 16px 28px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">السن</div><div style="font-size:15px;font-weight:800;">${p.age} سنة</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">الحالة</div><div style="font-size:14px;font-weight:700;">${escapeHtml(p.social_status||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">المؤهل</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.education||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">المهنة</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.job||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;grid-column:1/-1;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">الالتزام الديني</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.religiosity||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">📍 البلد</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.city||'—')}</div></div>
          <div style="background:#f8f9fa;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:var(--gray);margin-bottom:3px;">💍 نوع الزواج</div><div style="font-size:13px;font-weight:700;">${escapeHtml(p.marriage_type||'—')}</div></div>
          ${p.children?`<div style="background:#fef9c3;border-radius:10px;padding:10px;text-align:center;grid-column:1/-1;"><div style="font-size:11px;color:#92400e;margin-bottom:3px;">👶 الأطفال</div><div style="font-size:13px;font-weight:700;color:#92400e;">${escapeHtml(p.children)}</div></div>`:''}
        </div>
        ${p.about?`<div style="background:#fdf2f8;border-radius:10px;padding:12px;margin-bottom:10px;border-right:3px solid #be185d;"><div style="font-size:11px;color:#be185d;font-weight:700;margin-bottom:5px;">📝 نبذة</div><div style="font-size:13px;line-height:1.7;">${escapeHtml(p.about)}</div></div>`:''}
        ${p.requirements?`<div style="background:#f0fdf4;border-radius:10px;padding:12px;margin-bottom:14px;border-right:3px solid #10b981;"><div style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:5px;">🎯 المطلوب في الشريك</div><div style="font-size:13px;line-height:1.7;">${escapeHtml(p.requirements)}</div></div>`:''}
        ${isAdmin?`
          <div style="background:#fff7f0;border-radius:10px;padding:12px;margin-bottom:12px;border:1px solid #fed7aa;">
            <div style="font-size:11px;color:#ea580c;font-weight:700;margin-bottom:8px;">🔐 بيانات الإدارة</div>
            <div style="font-size:15px;font-weight:800;color:#166534;margin-bottom:10px;">📞 ${escapeHtml(p.phone||'—')}${p.whatsapp?' | 💬 '+escapeHtml(p.whatsapp):''}</div>
            ${p.card_image?`<div style="margin-bottom:10px;"><div style="font-size:11px;color:#be185d;font-weight:700;margin-bottom:5px;">🖼️ صورة البطاقة</div><img src="${escapeHtml(safeUrl(p.card_image))}" onclick="openImgFull(this.src)" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;cursor:zoom-in;" onerror="this.parentElement.style.display='none'"></div>`:''}
            ${p.personal_photo?`<div><div style="font-size:11px;color:#be185d;font-weight:700;margin-bottom:5px;">🔒 الصورة الشخصية — للإدارة فقط</div><img src="${escapeHtml(safeUrl(p.personal_photo))}" onclick="openImgFull(this.src)" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;cursor:zoom-in;" onerror="this.parentElement.style.display='none'"></div>`:''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${p.status==='pending'?`<button onclick="approveMarriage('${p.id}')" style="flex:1;background:#10b981;color:white;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✅ موافقة</button>`:''}
            ${p.status==='approved'?`<button onclick="rejectMarriage('${p.id}')" style="flex:1;background:#fee2e2;color:#dc2626;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">❌ إلغاء موافقة</button>` +
            `<button onclick="toggleMarriageVerified('${p.id}',${p.is_verified?'false':'true'})" style="flex:1;background:${p.is_verified?'#f3f4f6':'#dcfce7'};color:${p.is_verified?'#64748b':'#166534'};border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">${p.is_verified?'↩️ إلغاء التوثيق':'🛡️ توثيق'}</button>`:''}
            <button onclick="deleteMarriage('${p.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:10px 14px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">🗑️</button>
            ${p.phone?`<a href="https://wa.me/20${String(p.phone||'').replace(/[^0-9]/g,'').replace(/^0/,'')}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#25D366;color:white;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;text-decoration:none;padding:10px;">📞 واتساب</a>`:''}
          </div>
        `:`
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button onclick="toggleMarriageLike('${p.id}',this)" style="flex:1;background:${bgBadge};color:${textBadge};border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">❤️ اهتمام</button>
            <button onclick="document.getElementById('marriageDetailDrawer').remove();openContactRequest('${p.id}')" style="flex:1;background:${borderColor};color:white;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">📩 طلب تواصل</button>
          </div>
          <p style="text-align:center;font-size:11px;color:var(--gray);">التواصل يتم بإشراف الإدارة فقط — بياناتك سرية 🔒</p>
        `}
      </div>
    </div>`;
  drawer.addEventListener('click', e => { if(e.target===drawer) drawer.remove(); });
  document.body.appendChild(drawer);
}

async function approveMarriage(id) {
  await sbFetch('PATCH', `marriage_profiles?id=eq.${id}`, {status:'approved'});
  showToast('✅ تم الموافقة');
  document.getElementById('marriageDetailDrawer')?.remove();
  loadMarriageProfiles();
}
async function rejectMarriage(id) {
  await sbFetch('PATCH', `marriage_profiles?id=eq.${id}`, {status:'rejected'});
  showToast('❌ تم الرفض');
  document.getElementById('marriageDetailDrawer')?.remove();
  loadMarriageProfiles();
}
async function deleteMarriage(id) {
  if(!confirm('حذف الملف نهائياً؟')) return;
  await sbFetch('DELETE', `marriage_profiles?id=eq.${id}`);
  showToast('🗑️ تم الحذف');
  document.getElementById('marriageDetailDrawer')?.remove();
  loadMarriageProfiles();
}
async function sendInterest(toId) { openContactRequest(toId); }

// متغير الفلتر الحالي
window._marriageGenderFilter = 'all';

function setMarriageGenderFilter(gender, btn) {
  window._marriageGenderFilter = gender;
  // تحديث الأزرار
  ['mfAll','mfMale','mfFemale'].forEach(id => {
    const b = document.getElementById(id);
    if(b) { b.style.background = 'transparent'; b.style.color = 'var(--gray)'; }
  });
  if(btn) { btn.style.background = 'var(--primary)'; btn.style.color = 'white'; }
  applyMarriageFilters();
}

function toggleMarriageFilters() {
  const panel = document.getElementById('marriageFilterPanel');
  const btn = document.querySelector('[onclick="toggleMarriageFilters()"]');
  if(!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if(btn) {
    btn.style.background = isOpen ? 'transparent' : '#fce7f3';
    btn.style.color = isOpen ? 'var(--gray)' : '#be185d';
  }
}

async function applyMarriageFilters() {
  const gender = window._marriageGenderFilter || 'all';
  const city = document.getElementById('mFilterCity')?.value || '';
  const social = document.getElementById('mFilterSocial')?.value || '';
  const ageMin = document.getElementById('mFilterAgeMin')?.value || '';
  const ageMax = document.getElementById('mFilterAgeMax')?.value || '';
  const religion = document.getElementById('mFilterReligion')?.value || '';
  const mType = document.getElementById('mFilterMarriageType')?.value || '';

  // بناء الـ query
  let path = `marriage_profiles?select=id,ref_code,gender,age,education,job,social_status,city,religiosity,about,requirements,status,is_verified,card_image,marriage_type,children${isAdmin?',phone,whatsapp,personal_photo':''}&status=eq.approved&order=created_at.desc`;
  if(gender !== 'all') path += `&gender=eq.${gender}`;
  if(city) path += `&city=eq.${encodeURIComponent(city)}`;
  if(social) path += `&social_status=eq.${encodeURIComponent(social)}`;
  if(ageMin) path += `&age=gte.${ageMin}`;
  if(ageMax) path += `&age=lte.${ageMax}`;
  if(religion) path += `&religiosity=eq.${encodeURIComponent(religion)}`;
  if(mType) path += `&marriage_type=eq.${encodeURIComponent(mType)}`;

  // اعرض badge الفلتر
  const filters = [
    city && `📍 ${city}`,
    social && `💒 ${social}`,
    (ageMin||ageMax) && `📅 ${ageMin||'18'} - ${ageMax||'70'} سنة`,
    religion && `🕌 ${religion}`,
    mType && `💍 ${mType}`,
  ].filter(Boolean);

  const badge = document.getElementById('marriageFilterBadge');
  const badgeText = document.getElementById('marriageFilterText');
  if(badge && badgeText) {
    if(filters.length > 0) {
      badgeText.textContent = 'فلتر: ' + filters.join(' • ');
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // تحميل
  const content = document.getElementById('marriageContent');
  if(content) content.innerHTML = `<div>${skeletonCards(3)}</div>`;

  try {
    const profiles = await sbFetch('GET', path) || [];
    // جيب اللايكات
    const deviceId = getDeviceId();
    let likesData = [];
    try { likesData = await sbFetch('GET', 'marriage_likes?select=profile_id,device_id') || []; } catch(e) {}
    const likeCountMap = {};
    const myLikesSet = new Set();
    likesData.forEach(l => {
      likeCountMap[l.profile_id] = (likeCountMap[l.profile_id]||0) + 1;
      if(l.device_id === deviceId) myLikesSet.add(l.profile_id);
    });
    profiles.forEach(p => { p.likes_count = likeCountMap[p.id]||0; p.i_liked = myLikesSet.has(p.id); });
    renderMarriageProfiles(profiles);
  } catch(e) { showToast('خطأ في البحث','error'); }
}

function resetMarriageFilters() {
  const ids = ['mFilterCity','mFilterSocial','mFilterAgeMin','mFilterAgeMax','mFilterReligion','mFilterMarriageType'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  window._marriageGenderFilter = 'all';
  ['mfAll','mfMale','mfFemale'].forEach(id => {
    const b = document.getElementById(id);
    if(b) { b.style.background = 'transparent'; b.style.color = 'var(--gray)'; }
  });
  const mfAll = document.getElementById('mfAll');
  if(mfAll) { mfAll.style.background = 'var(--primary)'; mfAll.style.color = 'white'; }
  const badge = document.getElementById('marriageFilterBadge');
  if(badge) badge.style.display = 'none';
  loadMarriageProfiles('all');
}

function showAdvertisePage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'advertise'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>📢 أعلن في دليل الحامول</span>
      <div></div>
    </div>
    <div class="dyn-content" style="padding:0 16px 100px;">

      <!-- هيدر -->
      <div style="background:linear-gradient(135deg,#f59e0b,#d97706);margin:0 -16px;padding:24px 16px 32px;text-align:center;color:white;margin-bottom:-14px;">
        <div style="font-size:36px;margin-bottom:8px;">📢</div>
        <div style="font-size:20px;font-weight:900;margin-bottom:6px;">وصّل إعلانك لكل فرد في الحامول</div>
        <div style="font-size:13px;opacity:.9;">دليل الحامول — الدليل المحلي الأول في المنطقة</div>
      </div>

      <!-- إحصائيات حقيقية للمعلنين -->
      <div id="advertiseStatsBox" style="margin-bottom:14px;">
        <div style="text-align:center;padding:16px;color:var(--gray);font-size:12px;">⏳ جاري تحميل الإحصائيات...</div>
      </div>

      <!-- مميزات -->
      <div style="background:white;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="font-size:13px;font-weight:900;margin-bottom:12px;color:#d97706;">✨ ليه تعلن معنا؟</div>
        ${[
          ['👥','لكل فرد في الحامول','إعلانك يوصل لكل أهل المنطقة'],
          ['📱','متاح 24/7','على الموبايل والكمبيوتر في أي وقت'],
          ['⭐','ظهور مميز','إعلانك يظهر في أعلى نتائج قسمك'],
          ['📊','إحصائيات مباشرة','شوف كم واحد شاف إعلانك وتواصل'],
          ['🎯','جمهور محلي','ناس من منطقتك بالظبط'],
          ['🔄','تعديل سهل','عدّل إعلانك في أي وقت'],
        ].map(([icon,title,desc])=>`
          <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
            <span style="font-size:20px;">${icon}</span>
            <div><div style="font-size:13px;font-weight:700;">${title}</div><div style="font-size:11px;color:var(--gray);">${desc}</div></div>
          </div>`).join('')}
      </div>

      <!-- الباقات -->
      <div style="font-size:14px;font-weight:900;margin-bottom:12px;color:#1e293b;">💎 الباقات والأسعار</div>

      <!-- باقة أساسية -->
      <div style="background:white;border-radius:16px;padding:16px;margin-bottom:10px;border:2px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,.06);position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;right:0;background:#ef4444;color:white;padding:4px 12px;border-radius:0 16px 0 12px;font-size:11px;font-weight:900;">🔥 خصم لفترة محدودة</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;margin-top:16px;">
          <div>
            <div style="font-size:15px;font-weight:900;">🥉 الباقة الأساسية</div>
            <div style="font-size:12px;color:var(--gray);">مدة الإعلان 15 يوم</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:13px;color:#9ca3af;text-decoration:line-through;">150 جنيه</div>
            <div style="font-size:24px;font-weight:900;color:#16a34a;">99 جنيه</div>
          </div>
        </div>
        ${['ظهور في قسمك 15 يوم','صورة + بيانات كاملة','رقم واتساب مباشر','إحصائيات المشاهدات'].map(f=>`<div style="font-size:12px;color:#374151;margin-bottom:4px;">✅ ${f}</div>`).join('')}
        <button onclick="openAdvertiseForm('الأساسية','99 جنيه')" style="width:100%;background:#16a34a;color:white;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:10px;">احجز الباقة الأساسية 🚀</button>
      </div>

      <!-- باقة مميزة -->
      <div style="background:linear-gradient(135deg,#1e40af,#1d4ed8);border-radius:16px;padding:16px;margin-bottom:10px;border:2px solid #3b82f6;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;right:0;background:#fbbf24;color:#1e293b;padding:4px 12px;border-radius:0 16px 0 12px;font-size:11px;font-weight:900;">⭐ الأكثر طلباً</div>
        <div style="position:absolute;top:28px;right:0;background:#ef4444;color:white;padding:3px 10px;border-radius:0 0 0 10px;font-size:10px;font-weight:900;">خصم لفترة محدودة</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;margin-top:20px;">
          <div>
            <div style="font-size:15px;font-weight:900;color:white;">🥈 الباقة المميزة</div>
            <div style="font-size:12px;color:rgba(255,255,255,.8);">مدة الإعلان 20 يوم</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:13px;color:rgba(255,255,255,.6);text-decoration:line-through;">250 جنيه</div>
            <div style="font-size:24px;font-weight:900;color:#fbbf24;">149 جنيه</div>
          </div>
        </div>
        ${['ظهور مميز في قسمك 20 يوم','شارة "مميز" على إعلانك','أولوية في نتائج البحث','إحصائيات تفصيلية'].map(f=>`<div style="font-size:12px;color:rgba(255,255,255,.9);margin-bottom:4px;">✅ ${f}</div>`).join('')}
        <button onclick="openAdvertiseForm('المميزة','149 جنيه')" style="width:100%;background:#fbbf24;color:#1e293b;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:10px;">احجز الباقة المميزة ⭐</button>
      </div>

      <!-- باقة بلاتينيوم -->
      <div style="background:linear-gradient(135deg,#713f12,#92400e);border-radius:16px;padding:16px;margin-bottom:10px;border:2px solid #d97706;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;right:0;background:#fbbf24;color:#1e293b;padding:4px 12px;border-radius:0 16px 0 12px;font-size:11px;font-weight:900;">👑 VIP</div>
        <div style="position:absolute;top:28px;right:0;background:#ef4444;color:white;padding:3px 10px;border-radius:0 0 0 10px;font-size:10px;font-weight:900;">خصم لفترة محدودة</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;margin-top:20px;">
          <div>
            <div style="font-size:15px;font-weight:900;color:#fbbf24;">💎 الباقة البلاتينيوم</div>
            <div style="font-size:12px;color:rgba(255,255,255,.8);">مدة الإعلان 30 يوم</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:13px;color:rgba(255,255,255,.6);text-decoration:line-through;">500 جنيه</div>
            <div style="font-size:24px;font-weight:900;color:#fbbf24;">299 جنيه</div>
          </div>
        </div>
        ${['ظهور في أعلى كل الأقسام 30 يوم','بانر إعلاني في الصفحة الرئيسية','شارة VIP ذهبية','أولوية قصوى في البحث','تقرير إحصائي أسبوعي'].map(f=>`<div style="font-size:12px;color:rgba(255,255,255,.9);margin-bottom:4px;">✅ ${f}</div>`).join('')}
        <button onclick="openAdvertiseForm('البلاتينيوم','299 جنيه')" style="width:100%;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e293b;border:none;padding:12px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:10px;">احجز الباقة البلاتينيوم 💎</button>
      </div>

      <!-- تواصل -->
      <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:13px;font-weight:900;color:#166534;margin-bottom:6px;">📞 للاستفسار والحجز</div>
        <div style="font-size:12px;color:#15803d;margin-bottom:10px;">تواصل معنا مباشرة على واتساب</div>
        <button onclick="window.open('https://wa.me/201014185158','_blank')" style="background:#25D366;color:white;border:none;padding:10px 24px;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💬 تواصل واتساب</button>
      </div>

    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(loadAdvertiseStatsBox, 50);
}

// عدد صفوف دقيق من غير ما نجيب البيانات كلها — بيستخدم Prefer: count=exact
async function sbCount(path) {
  try {
    const res = await fetch(SB_URL+'/rest/v1/'+path, {
      method: 'HEAD',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+SB_KEY, 'Prefer': 'count=exact' }
    });
    const range = res.headers.get('content-range'); // شكلها "0-24/1234"
    if(!range) return 0;
    const total = range.split('/')[1];
    return total === '*' ? 0 : (parseInt(total, 10) || 0);
  } catch(e) { return 0; }
}

async function loadAdvertiseStatsBox() {
  const box = document.getElementById('advertiseStatsBox');
  if(!box) return;
  try {
    const since30 = new Date(Date.now() - 30*86400000).toISOString();
    const [visits30, waClicks, adViews, installs, activeAds, activeTraders] = await Promise.all([
      sbFetch('GET', 'site_visits?select=visitor_id&created_at=gte.'+encodeURIComponent(since30)).catch(()=>[]) || [],
      sbCount('ad_stats?select=id&event_type=eq.whatsapp'),
      sbCount('ad_stats?select=id&event_type=eq.view'),
      sbCount('app_installs?select=id'),
      sbCount('ads?select=id&status=eq.approved'),
      sbCount('shop_traders?select=id&status=eq.approved'),
    ]);
    const uniqueVisitors30 = new Set((visits30||[]).map(v=>v.visitor_id)).size;
    const totalVisits30 = (visits30||[]).length;

    box.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:16px;color:white;">
        <div style="font-size:13px;font-weight:900;margin-bottom:12px;text-align:center;opacity:.9;">📊 أرقام حقيقية من الموقع — آخر 30 يوم</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.12);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#4ade80;">${totalVisits30.toLocaleString('ar-EG')}</div>
            <div style="font-size:10px;opacity:.85;">👁️ زيارة</div>
          </div>
          <div style="background:rgba(255,255,255,.12);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#60a5fa;">${uniqueVisitors30.toLocaleString('ar-EG')}</div>
            <div style="font-size:10px;opacity:.85;">👤 زائر فريد</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px;">
          <div style="background:rgba(255,255,255,.12);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#25D366;">${waClicks.toLocaleString('ar-EG')}</div>
            <div style="font-size:10px;opacity:.85;">💬 تواصل واتساب</div>
          </div>
          <div style="background:rgba(255,255,255,.12);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#fbbf24;">${adViews.toLocaleString('ar-EG')}</div>
            <div style="font-size:10px;opacity:.85;">📢 مشاهدة إعلان</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:rgba(255,255,255,.08);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:15px;font-weight:900;">${activeAds.toLocaleString('ar-EG')}</div>
            <div style="font-size:9px;opacity:.8;">إعلان نشط</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:15px;font-weight:900;">${activeTraders.toLocaleString('ar-EG')}</div>
            <div style="font-size:9px;opacity:.8;">تاجر ومعرض</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:15px;font-weight:900;">${installs.toLocaleString('ar-EG')}</div>
            <div style="font-size:9px;opacity:.8;">📲 ثبّت التطبيق</div>
          </div>
        </div>
      </div>`;
  } catch(e) {
    box.innerHTML = '';
  }
}

function openAdvertiseForm(packageName, price) {
  const old = document.getElementById('advertiseFormModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'advertiseFormModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;background:rgba(0,0,0,.5);';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;padding-bottom:32px;max-height:85vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div style="font-size:15px;font-weight:900;">📢 طلب إعلان</div>
          <div style="font-size:12px;color:#d97706;font-weight:700;">الباقة ${packageName} — ${price}</div>
        </div>
        <button onclick="document.getElementById('advertiseFormModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">اسمك / اسم المحل *</label>
        <input id="advName" type="text" placeholder="مثال: محل أحمد للملابس" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رقم التليفون *</label>
        <input id="advPhone" type="tel" placeholder="01xxxxxxxxx" maxlength="11" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">نوع النشاط / القسم</label>
        <input id="advBusiness" type="text" placeholder="مثال: ملابس، مطعم، خدمات..." style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">ملاحظات إضافية</label>
        <textarea id="advNotes" rows="2" placeholder="أي تفاصيل تانية..." style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;"></textarea>
      </div>
      <button onclick="submitAdvertiseRequest('${packageName}','${price}')" style="width:100%;background:#f59e0b;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">📤 إرسال الطلب</button>
    </div>`;
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

function submitAdvertiseRequest(packageName, price) {
  const name = document.getElementById('advName')?.value.trim();
  const phone = document.getElementById('advPhone')?.value.trim();
  const business = document.getElementById('advBusiness')?.value.trim();
  const notes = document.getElementById('advNotes')?.value.trim();
  if(!name) { showToast('اكتب اسمك أو اسم المحل','error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)) { showToast('رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم','error'); return; }
  const msg = `📢 طلب إعلان جديد في دليل الحامول!\n\n🏪 الاسم: ${name}\n📞 الرقم: ${phone}\n💼 النشاط: ${business||'—'}\n💎 الباقة: ${packageName} — ${price}${notes?'\n📝 ملاحظات: '+notes:''}\n\n⏳ في انتظار تواصلك معه`;
  document.getElementById('advertiseFormModal').remove();
  showToast('✅ تم الإرسال! سنتواصل معك قريباً');
  setTimeout(()=>{ const a=document.createElement('a'); a.href=`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`; a.target='_blank'; document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),500); }, 600);
}

function toggleChildrenField() {
  const social = document.getElementById('mSocial').value;
  const field = document.getElementById('childrenField');
  if(field) field.style.display = (social === 'مطلق' || social === 'أرمل' || social === 'متزوج') ? 'block' : 'none';
}

function showMarriageForm() {
  const modal = document.getElementById('addModal');
  modal.innerHTML = `
    <div class="details-box" style="border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;">
      <button class="details-close" onclick="document.getElementById('addModal').classList.remove('active')">✕</button>
      <div style="padding:20px;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:28px;">💍</div>
          <div style="font-size:16px;font-weight:900;color:#be185d;">تسجيل في بيت الحلال</div>
          <div style="font-size:12px;color:var(--gray);margin-top:4px;">بياناتك سرية — التواصل بإشراف المشرف فقط</div>
        </div>

        <div style="background:#f0fdf4;border-radius:10px;padding:10px 12px;margin-bottom:14px;border:1px solid #bbf7d0;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🔒</span>
          <p style="font-size:11px;color:#166534;line-height:1.6;margin:0;font-weight:700;">بياناتك مشفرة تمامًا ولن تظهر لأي مستخدم آخر</p>
        </div>

        <div class="fg"><label>أنا أبحث عن *</label><select id="mGender"><option value="male">👨 طالب زواج</option><option value="female">👩 طالبة زواج</option></select></div>
        <div class="fg"><label>السن *</label><input type="number" id="mAge" placeholder="مثال: 25" min="18" max="70"></div>
        <div class="fg"><label>البلد / المنطقة *</label><select id="mCity">
          <option value="الحامول">الحامول</option>
          <option value="كفر الشيخ">كفر الشيخ</option>
          <option value="دسوق">دسوق</option>
          <option value="فوه">فوه</option>
          <option value="سيدي سالم">سيدي سالم</option>
          <option value="بيلا">بيلا</option>
          <option value="مطوبس">مطوبس</option>
          <option value="قلين">قلين</option>
          <option value="برج البرلس">برج البرلس</option>
          <option value="الرياض">الرياض</option>
          <option value="محافظة أخرى">محافظة أخرى</option>
        </select></div>
        <div class="fg"><label>الحالة *</label><select id="mSocial" onchange="toggleChildrenField()">
          <option value="أعزب">أعزب / عزباء</option>
          <option value="متزوج">متزوج / متزوجة (يريد الزواج مرة أخرى)</option>
          <option value="مطلق">مطلق / مطلقة</option>
          <option value="أرمل">أرمل / أرملة</option>
        </select></div>
        <div class="fg" id="childrenField" style="display:none;">
          <label>هل عندك أطفال؟</label>
          <select id="mChildren">
            <option value="لا يوجد">لا يوجد أطفال</option>
            <option value="1-2 أطفال">1 - 2 طفل</option>
            <option value="3+ أطفال">3 أطفال أو أكثر</option>
          </select>
        </div>
        <div class="fg"><label>نوع الزواج المطلوب *</label><select id="mMarriageType">
          <option value="زواج شرعي">زواج شرعي فقط</option>
          <option value="زواج مدني">زواج مدني</option>
          <option value="لا يهم">لا يهم</option>
        </select></div>
        <div class="fg"><label>المؤهل</label><select id="mEducation"><option value="ابتدائي">ابتدائي</option><option value="إعدادي">إعدادي</option><option value="ثانوي">ثانوي / دبلوم</option><option value="جامعي">جامعي</option><option value="فوق الجامعي">فوق الجامعي</option></select></div>
        <div class="fg"><label>المهنة</label><input type="text" id="mJob" placeholder="مدرس، موظف، تاجر..."></div>
        <div class="fg"><label>الالتزام الديني</label><select id="mReligiosity"><option value="ملتزم">ملتزم / ملتزمة</option><option value="متوسط الالتزام">متوسط الالتزام</option><option value="محافظ">محافظ</option></select></div>
        <div class="fg"><label>نبذة عنك</label><textarea id="mAbout" rows="3" placeholder="اكتب نبذة مختصرة..."></textarea></div>
        <div class="fg"><label>المواصفات المطلوبة</label><textarea id="mRequirements" rows="3" placeholder="مواصفات الشريك..."></textarea></div>
        <div class="fg"><label>رقم التليفون (سري — للمشرف فقط) *</label><input type="tel" id="mPhone" placeholder="01xxxxxxxxx" maxlength="11"></div>
        <div class="fg"><label>رقم الواتساب (سري — للمشرف فقط، اختياري لو نفس رقم التليفون)</label><input type="tel" id="mWhatsapp" placeholder="01xxxxxxxxx" maxlength="11"></div>

        <!-- صورة البطاقة - إلزامية -->
        <div class="fg">
          <label>🖼️ صورة البطاقة <span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;">اختياري</span></label>
          <div style="background:#fce7f3;border-radius:8px;padding:8px 10px;margin-bottom:8px;border:1px solid #f9a8d4;display:flex;align-items:flex-start;gap:6px;">
            <span style="font-size:14px;">🔒</span>
            <p style="font-size:11px;color:#9d174d;line-height:1.5;margin:0;">صورة البطاقة تظهر للإدارة فقط — للتحقق من المصداقية والبيانات الشخصية. لن تُعرض لأي زائر.</p>
          </div>
          <div id="mCardPreview" style="display:none;margin-bottom:8px;position:relative;">
            <img id="mCardImg" style="width:100%;max-height:120px;object-fit:cover;border-radius:10px;display:block;">
            <button onclick="removeMCard()" style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);color:white;border:none;border-radius:50%;width:26px;height:26px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
          <label for="mCardInput" id="mCardLabel" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:2px dashed #be185d;border-radius:10px;cursor:pointer;color:#be185d;font-size:13px;font-weight:700;background:#fdf2f8;">
            <span style="font-size:20px;">🖼️</span> اضغط لرفع صورة البطاقة <span style="color:#dc2626;">(إجباري)*</span>
          </label>
          <input type="file" id="mCardInput" accept="image/*" style="display:none;" onchange="previewMCard(this)">
        </div>

        <!-- الصورة الشخصية - اختيارية للإدارة فقط -->
        <div class="fg">
          <label>📸 الصورة الشخصية <span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;">اختياري</span></label>
          <div style="background:#fef3c7;border-radius:10px;padding:10px;margin-bottom:8px;border:1px solid #fde68a;display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:16px;">🔒</span>
            <p style="font-size:11px;color:#92400e;line-height:1.6;margin:0;">صورتك الشخصية <strong>لن يراها أحد إطلاقاً</strong> سوى إدارة الموقع فقط — لا تُشارك ولا تُعرض لأي زائر مهما كانت الظروف.</p>
          </div>
          <div id="mPersonalPreview" style="display:none;margin-bottom:8px;position:relative;">
            <img id="mPersonalImg" style="width:100%;max-height:120px;object-fit:cover;border-radius:10px;display:block;">
            <button onclick="removeMPersonal()" style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);color:white;border:none;border-radius:50%;width:26px;height:26px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
          <label for="mPersonalInput" id="mPersonalLabel" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:2px dashed #d1d5db;border-radius:10px;cursor:pointer;color:var(--gray);font-size:13px;font-weight:700;background:#f9fafb;">
            <span style="font-size:20px;">📸</span> صورة شخصية للإدارة فقط (اختياري)
          </label>
          <input type="file" id="mPersonalInput" accept="image/*" style="display:none;" onchange="previewMPersonal(this)">
        </div>

        <div style="background:#fef9c3;border-radius:10px;padding:12px;margin-bottom:14px;border:1px solid #fde68a;">
          <p style="font-size:12px;color:#92400e;line-height:1.7;">⚠️ رقمك وصورتك الشخصية لن يُشاركا إلا بموافقتك وإشراف الإدارة. ملفك يظهر بعد المراجعة.</p>
        </div>
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;cursor:pointer;">
          <input type="checkbox" id="mAgree" style="width:18px;height:18px;margin-top:1px;flex-shrink:0;accent-color:#be185d;">
          <span style="font-size:12px;color:#374151;line-height:1.6;">أوافق على <strong>سياسة الخصوصية</strong> و<strong>شروط الاستخدام</strong> الخاصة بمنصة دليل الحامول *</span>
        </label>
        <button onclick="submitMarriageProfile()" style="width:100%;background:#be185d;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:15px;font-weight:900;cursor:pointer;" id="mSubmit">💍 إرسال للمراجعة</button>
      </div>
    </div>`;
  modal.classList.add('active');
}

function previewMCard(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('mCardImg').src = e.target.result;
    document.getElementById('mCardPreview').style.display = 'block';
    document.getElementById('mCardLabel').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function removeMCard() {
  document.getElementById('mCardInput').value = '';
  document.getElementById('mCardImg').src = '';
  document.getElementById('mCardPreview').style.display = 'none';
  document.getElementById('mCardLabel').style.display = 'flex';
}

function previewMPersonal(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('mPersonalImg').src = e.target.result;
    document.getElementById('mPersonalPreview').style.display = 'block';
    document.getElementById('mPersonalLabel').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function removeMPersonal() {
  document.getElementById('mPersonalInput').value = '';
  document.getElementById('mPersonalImg').src = '';
  document.getElementById('mPersonalPreview').style.display = 'none';
  document.getElementById('mPersonalLabel').style.display = 'flex';
}

async function uploadMarriageImage(file, type='card') {
  file = await compressImageFile(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `marriage/${type}_${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/ads-images/${fileName}`, {
    method:'POST', headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':file.type}, body:file
  });
  if(!res.ok) throw new Error('فشل رفع الصورة');
  return `${SB_URL}/storage/v1/object/public/ads-images/${fileName}`;
}

// ===== نظام إشعارات بيت الحلال =====
function addMarriageNotification(type, label, age) {
  if(!isAdmin) return; // الإشعارات للأدمن بس
  const notifs = JSON.parse(localStorage.getItem('marriage_notifs')||'[]');
  notifs.unshift({ type, label, age, time: new Date().toISOString(), read: false });
  // احتفظ بآخر 50 إشعار بس
  if(notifs.length > 50) notifs.pop();
  localStorage.setItem('marriage_notifs', JSON.stringify(notifs));
  updateMarriageBadge();
  showMarriageInAppNotif(type, label, age);
}

function updateMarriageBadge() {
  if(!isAdmin) return;
  const notifs = JSON.parse(localStorage.getItem('marriage_notifs')||'[]');
  const unread = notifs.filter(n=>!n.read).length;
  // تحديث badge على زرار بيت الحلال في الشبكة لو موجود
  const badge = document.getElementById('marriageBadge');
  if(badge) { badge.textContent = unread; badge.style.display = unread>0?'block':'none'; }
}

function showMarriageInAppNotif(type, label, age) {
  const isNewProfile = type === 'new_profile';
  const notif = document.createElement('div');
  notif.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);background:white;border-radius:16px;padding:14px 16px;box-shadow:0 4px 20px rgba(0,0,0,.25);z-index:600;display:flex;align-items:center;gap:12px;max-width:340px;width:90%;border-right:4px solid #be185d;animation:slideDown .4s ease;cursor:pointer;`;
  notif.innerHTML = `
    <div style="font-size:26px;">${isNewProfile?'💍':'💝'}</div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:900;color:var(--dark);">${isNewProfile?'ملف زواج جديد!':'اهتمام جديد في بيت الحلال!'}</div>
      <div style="font-size:12px;color:#be185d;margin-top:2px;">${label}${age?' — '+age+' سنة':''}</div>
      <div style="font-size:10px;color:var(--gray);margin-top:2px;">اضغط لعرض بيت الحلال</div>
    </div>
    <button onclick="event.stopPropagation();this.parentElement.remove()" style="background:transparent;border:none;font-size:18px;color:var(--gray);cursor:pointer;flex-shrink:0;">✕</button>`;
  notif.addEventListener('click', () => { notif.remove(); showMarriagePage(); markMarriageNotifsRead(); });
  document.body.appendChild(notif);
  setTimeout(() => { notif.style.transition='opacity .5s'; notif.style.opacity='0'; }, 6000);
  setTimeout(() => notif.remove(), 6500);
}

function markMarriageNotifsRead() {
  const notifs = JSON.parse(localStorage.getItem('marriage_notifs')||'[]');
  notifs.forEach(n=>n.read=true);
  localStorage.setItem('marriage_notifs', JSON.stringify(notifs));
  updateMarriageBadge();
}

function checkMarriageNotifs() {
  if(!isAdmin) return;
  updateMarriageBadge();
}
// ===== نهاية نظام الإشعارات =====

async function submitMarriageProfile() {
  const age = parseInt(document.getElementById('mAge').value);
  const phone = document.getElementById('mPhone').value.trim();
  const whatsapp = document.getElementById('mWhatsapp')?.value.trim() || '';
  const agree = document.getElementById('mAgree')?.checked;
  if(!age||age<18) { showToast('السن لازم 18+','error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)) { showToast('رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم','error'); return; }
  if(whatsapp && !/^01[0-9]{9}$/.test(whatsapp)) { showToast('رقم الواتساب لازم يبدأ بـ 01 ويتكون من 11 رقم','error'); return; }
  if(!agree) { showToast('لازم توافق على سياسة الخصوصية وشروط الاستخدام أولاً','error'); return; }
  const cardInputCheck = document.getElementById('mCardInput');
  if(!cardInputCheck || !cardInputCheck.files[0]) { showToast('لازم ترفع صورة البطاقة الشخصية','error'); return; }

  const btn = document.getElementById('mSubmit');
  btn.disabled=true;

  try {
    // رفع صورة البطاقة (إجباري)
    let card_image = null;
    const cardInput = document.getElementById('mCardInput');
    btn.textContent = '⏳ جاري رفع صورة البطاقة...';
    try { card_image = await uploadMarriageImage(cardInput.files[0], 'card'); }
    catch(e) { showToast('⚠️ تعذر رفع صورة البطاقة، حاول تاني','error'); btn.disabled=false; btn.textContent='إرسال'; return; }

    // رفع الصورة الشخصية (اختيارية)
    let personal_photo = null;
    const personalInput = document.getElementById('mPersonalInput');
    if(personalInput && personalInput.files[0]) {
      btn.textContent = '⏳ جاري رفع الصورة الشخصية...';
      try { personal_photo = await uploadMarriageImage(personalInput.files[0], 'personal'); }
      catch(e) { showToast('⚠️ تعذر رفع الصورة الشخصية — سيتم الإرسال بدونها'); }
    }

    btn.textContent = '⏳ جاري الإرسال...';
    const gender = document.getElementById('mGender').value;
    const socialStatus = document.getElementById('mSocial').value;
    const hasChildren = (socialStatus === 'مطلق' || socialStatus === 'أرمل' || socialStatus === 'متزوج')
      ? document.getElementById('mChildren').value : null;
    await sbFetch('POST','marriage_profiles',{
      gender, age,
      social_status: socialStatus,
      education: document.getElementById('mEducation').value,
      job: document.getElementById('mJob').value.trim()||null,
      religiosity: document.getElementById('mReligiosity').value,
      about: document.getElementById('mAbout').value.trim()||null,
      requirements: document.getElementById('mRequirements').value.trim()||null,
      phone, whatsapp: whatsapp || null, city: document.getElementById('mCity').value,
      marriage_type: document.getElementById('mMarriageType').value,
      children: hasChildren,
      status:'pending', card_image, personal_photo,
      device_id: getDeviceId()
    });

    document.getElementById('addModal').classList.remove('active');
    showMarriageSubmitSuccessModal();

    // إشعار داخل التطبيق للأدمن
    addMarriageNotification('new_profile', gender==='male'?'طالب زواج':'طالبة زواج', age);

    // رسالة واتساب للأدمن
    const msg = `💍 ملف زواج جديد!\nالجنس: ${gender==='male'?'ذكر 👨':'أنثى 👩'}\nالسن: ${age}\nالحالة: ${document.getElementById('mSocial').value}\n📞 ${phone}${personal_photo?'\n📸 يوجد صورة شخصية':''}\n⏳ في انتظار موافقتك`;
    setTimeout(()=>{const a=document.createElement('a');a.href=`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`;a.target='_blank';document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),500);},800);

  } catch(e) { showToast('خطأ: ' + (e.message||'تأكد من الاتصال'), 'error'); console.error('Marriage submit error:', e); }
  btn.disabled=false; btn.textContent='💍 إرسال للمراجعة';
}

// MARKET PRICES PAGE
// ===== أسعار السوق — النظام الجديد =====
// ===== سوق التجار — النظام الجديد =====
const MARKET_SECTIONS = [
  { id:'فراخ وطيور', icon:'🐔', color:'#fef9c3', items:['فراخ بلدي','فراخ رومي','بط','حمام','ديك رومي'] },
  { id:'لحوم',       icon:'🥩', color:'#fee2e2', items:['لحم ضاني','لحم بتلو','كبدة','كوارع','رأس'] },
  { id:'سمك',        icon:'🐟', color:'#dbeafe', items:['بلطي','بوري','مكرونة','قاروص','جمبري','فسيخ','رنجة'] },
  { id:'خضار',       icon:'🥦', color:'#dcfce7', items:['طماطم','بطاطس','بصل','جزر','كوسة','باذنجان','فلفل','فاصوليا خضرا','ملوخية','سبانخ'] },
  { id:'فاكهة',      icon:'🍎', color:'#fce7f3', items:['موز','تفاح','برتقال','مانجو','عنب','بطيخ','شمام','فراولة'] },
  { id:'بيض وألبان', icon:'🥚', color:'#fef3c7', items:['بيض بلدي','بيض أبيض','جبن أبيض','لبن','زبادي','قشطة'] },
  { id:'بقوليات',    icon:'🌾', color:'#f0fdf4', items:['عدس','فول','لوبيا','حمص','أرز','سكر','زيت'] },
];

function formatLastUpdate(date, isToday) {
  if(!date) return '';
  if(isToday) {
    const t = date.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    return '🟢 آخر تحديث النهارده الساعة ' + t;
  }
  const diff = Math.floor((Date.now() - date) / 86400000);
  if(diff === 1) return '🟡 آخر تحديث: أمس — الأسعار لم تُحدَّث اليوم بعد';
  return '🟠 آخر تحديث: منذ ' + diff + ' أيام — قد تكون قديمة';
}

// جيب كل أسعار التجار (مش مرتبطة بيوم — كل تاجر عنده منتجات كتير، كل منتج له آخر سعر بتاعه)
async function loadMarketPricesData() {
  try {
    const raw = await sbFetch('GET', 'market_products?select=id,section,product_name,price,updated_at,trader_id,trader:market_traders(name,phone,address,photo_url)&deleted_at=is.null&order=updated_at.desc&limit=500') || [];
    const rows = raw.map(function(r){
      return {
        id: r.id, section: r.section, product_name: r.product_name, price: r.price, updated_at: r.updated_at,
        trader_id: r.trader_id,
        trader_name: r.trader ? r.trader.name : 'تاجر',
        phone: r.trader ? r.trader.phone : '',
        address: r.trader ? r.trader.address : '',
        photo_url: r.trader ? r.trader.photo_url : ''
      };
    });
    const lastUpdate = rows.length ? new Date(rows[0].updated_at) : null;
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = lastUpdate ? lastUpdate.toISOString().startsWith(todayStr) : false;
    return { rows, lastUpdate, isToday };
  } catch(e) { return { rows:[], lastUpdate:null, isToday:false }; }
}

// ===== سوق التجار — عرض وتفاعل =====

async function showMarketPrices() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'market_prices'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const today = new Date().toLocaleDateString('ar-EG', {weekday:'long', day:'numeric', month:'long'});

  page.innerHTML =
    '<div class="dyn-header">' +
      '<button class="dyn-back" onclick="hideDynPage()">←</button>' +
      '<span>🛒 سوق الحامول</span>' +
      (isAdmin ? '<button onclick="showAddTraderDialog()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ تاجر</button>' : '<span></span>') +
    '</div>' +
    '<div style="background:linear-gradient(135deg,#c8922a,#f59e0b);padding:12px 16px;color:white;display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:26px;">🛒</span>' +
      '<div style="flex:1;"><div style="font-size:14px;font-weight:900;">سوق الحامول — قارن الأسعار</div>' +
      '<div style="font-size:11px;opacity:.85;">' + today + '</div></div>' +
    '</div>' +
    '<div id="marketUpdateBar" style="background:#f8fafc;padding:7px 16px;font-size:12px;color:#64748b;text-align:center;border-bottom:1px solid var(--border);">⏳ جاري التحميل...</div>' +
    '<div id="merchantBtnWrap"></div>' +
    '<div style="background:white;overflow-x:auto;display:flex;gap:0;border-bottom:2px solid var(--border);position:sticky;top:56px;z-index:10;" id="marketTabs">' +
      '<button data-filter="all" onclick="filterMarketBtn(this)" class="market-tab active" style="padding:10px 14px;border:none;background:transparent;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;color:var(--primary);border-bottom:2px solid var(--primary);">الكل</button>' +
      MARKET_SECTIONS.map(function(s){ return '<button data-filter="'+s.id+'" onclick="filterMarketBtn(this)" class="market-tab" style="padding:10px 14px;border:none;background:transparent;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;color:var(--gray);">'+s.icon+' '+s.id+'</button>'; }).join('') +
    '</div>' +
    '<div id="catBanner"></div>' +
    '<div class="dyn-content" id="marketContent" style="padding:0 0 80px;">' +
      '<div style="text-align:center;padding:40px;color:var(--gray);">⏳ جاري تحميل الأسعار...</div>' +
    '</div>';

  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('market');
  await refreshMarketContent('all');
}

async function refreshMarketContent(filter) {
  const { rows, lastUpdate, isToday } = await loadMarketPricesData();
  window._marketRows = rows;

  // شريط آخر تحديث
  var bar = document.getElementById('marketUpdateBar');
  if(bar) bar.textContent = lastUpdate ? formatLastUpdate(lastUpdate, isToday) : '⚪ لم تُسجَّل أسعار بعد';

  // زر التاجر المسجل — يعدل أسعاره
  var wrap = document.getElementById('merchantBtnWrap');
  if(wrap) {
    var myPhone = localStorage.getItem('trader_phone');
    var myPass  = localStorage.getItem('trader_pass');
    if(myPhone && myPass) {
      wrap.innerHTML = '<div style="padding:8px 16px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;display:flex;gap:8px;">' +
        '<div style="flex:1;font-size:12px;color:#166534;font-weight:700;display:flex;align-items:center;">👋 أهلاً بك يا تاجر</div>' +
        '<button onclick="showTraderUpdateDialog()" style="background:#16a34a;color:white;border:none;padding:7px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;">✏️ حدّث أسعارك</button>' +
      '</div>';
    } else {
      wrap.innerHTML = '<div style="padding:8px 16px;background:#fef9c3;border-bottom:1px solid #fde047;text-align:center;display:flex;gap:8px;justify-content:center;">' +
        '<button onclick="showTraderLoginDialog()" style="background:#92400e;color:white;border:none;padding:7px 18px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;">🏪 أنا تاجر — دخول</button>' +
        '<button onclick="showTraderRegisterDialog()" style="background:#1a7a4a;color:white;border:none;padding:7px 18px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;">➕ سجّل نفسك كتاجر</button>' +
      '</div>';
    }
  }

  // عرض الأسعار
  var content = document.getElementById('marketContent');
  if(content) content.innerHTML = renderTraderMarket(rows, filter || 'all');
}

function renderTraderMarket(rows, filter) {
  var filtered = filter === 'all' ? rows : rows.filter(function(r){ return r.section === filter; });
  if(!filtered.length) return '<div style="text-align:center;padding:60px 20px;color:var(--gray);"><div style="font-size:48px;margin-bottom:12px;">🛒</div><p style="font-size:15px;font-weight:700;">مفيش أسعار في هذا القسم دلوقتي</p></div>';

  // تجميع حسب القسم ثم المنتج
  var bySec = {};
  filtered.forEach(function(r) {
    var sec = r.section || 'أخرى';
    if(!bySec[sec]) bySec[sec] = {};
    var prod = r.product_name || 'منتج';
    if(!bySec[sec][prod]) bySec[sec][prod] = [];
    bySec[sec][prod].push(r);
  });

  return Object.entries(bySec).map(function(entry) {
    var sec = entry[0], products = entry[1];
    var secInfo = MARKET_SECTIONS.find(function(s){ return s.id === sec; }) || {icon:'🛒', color:'#f3f4f6'};
    return '<div style="margin-bottom:6px;">' +
      '<div style="background:' + secInfo.color + ';padding:10px 16px;display:flex;align-items:center;gap:8px;border-radius:10px 10px 0 0;">' +
        '<span style="font-size:20px;">' + secInfo.icon + '</span>' +
        '<span style="font-size:14px;font-weight:900;">' + sec + '</span>' +
      '</div>' +
      Object.entries(products).map(function(pe) {
        var prodName = pe[0], traders = pe[1];
        // رتب من الأرخص للأغلى
        traders.sort(function(a,b){ return (parseFloat(a.price)||999) - (parseFloat(b.price)||999); });
        var minPrice = parseFloat(traders[0].price);
        return '<div style="margin:0 12px 10px;background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;">' +
          '<div style="background:#1a7a4a;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="color:white;font-size:13px;font-weight:900;">' + escapeHtml(prodName) + '</span>' +
            '<span style="background:rgba(255,255,255,.2);color:white;padding:2px 10px;border-radius:20px;font-size:11px;">أفضل سعر: ' + minPrice.toLocaleString() + ' ج</span>' +
          '</div>' +
          traders.map(function(t, idx) {
            var isBest = parseFloat(t.price) === minPrice && idx === 0;
            var updTime = t.updated_at ? new Date(t.updated_at).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}) : '';
            var waNum = t.phone ? '20' + t.phone.replace(/^0/,'') : '';
            var avatar = t.photo_url ? '<img src="'+escapeHtml(t.photo_url)+'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">' : '';
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f5f9;background:' + (isBest?'#f0fdf4':'white') + ';">' +
              avatar +
              '<div style="flex:1;">' +
                '<div style="font-size:13px;font-weight:900;color:#1e293b;">' + (isBest?'🏆 ':'') + escapeHtml(t.trader_name||'تاجر') + '</div>' +
                '<div style="font-size:11px;color:#64748b;margin-top:2px;">📍 ' + escapeHtml(t.address||'') + (t.address&&t.phone?' • ':'') + (t.phone?'📞 '+escapeHtml(t.phone):'') + '</div>' +
                '<div style="font-size:10px;color:#94a3b8;margin-top:1px;">آخر تحديث: ' + updTime + '</div>' +
              '</div>' +
              '<div style="text-align:left;flex-shrink:0;">' +
                '<div style="font-size:16px;font-weight:900;color:' + (isBest?'#16a34a':'#1e293b') + ';">' + parseFloat(t.price).toLocaleString() + ' ج</div>' +
                '<div style="font-size:10px;color:#94a3b8;">للكيلو</div>' +
              '</div>' +
              (t.phone ? '<a href="tel:' + escapeHtml(t.phone) + '" style="background:#dcfce7;color:#16a34a;border:none;padding:8px 10px;border-radius:8px;font-size:16px;text-decoration:none;flex-shrink:0;">📞</a>' : '') +
              (waNum ? '<a href="https://wa.me/' + waNum + '" target="_blank" style="background:#dcfce7;color:#16a34a;border:none;padding:8px 10px;border-radius:8px;font-size:16px;text-decoration:none;flex-shrink:0;">💬</a>' : '') +
              (isAdmin ? '<button data-trid="'+t.trader_id+'" data-trname="'+escapeHtml(t.trader_name||'')+'" onclick="resetTraderPassword(this.dataset.trid,this.dataset.trname)" style="background:#fef3c7;color:#92400e;border:none;padding:8px 10px;border-radius:8px;font-size:14px;cursor:pointer;flex-shrink:0;">🔑</button>' : '') +
              (isAdmin ? '<button data-tid="'+t.id+'" data-plabel="'+escapeHtml(prodName+' - '+(t.trader_name||''))+'" onclick="deleteMarketProduct(this.dataset.tid,this.dataset.plabel)" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 10px;border-radius:8px;font-size:14px;cursor:pointer;flex-shrink:0;">🗑️</button>' : '') +
            '</div>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

function filterMarketBtn(btn) {
  var filter = btn.getAttribute('data-filter') || 'all';
  filterMarket(filter, btn);
}

async function filterMarket(filter, btn) {
  document.querySelectorAll('.market-tab').forEach(function(b){
    b.style.color = 'var(--gray)';
    b.style.borderBottom = 'none';
  });
  btn.style.color = 'var(--primary)';
  btn.style.borderBottom = '2px solid var(--primary)';
  var rows = window._marketRows || [];
  var content = document.getElementById('marketContent');
  if(content) content.innerHTML = renderTraderMarket(rows, filter);
}

// ===== إضافة تاجر جديد (أدمن) =====
function showAddTraderDialog() {
  var secs = MARKET_SECTIONS.map(function(s){ return '<option value="'+s.id+'">'+s.icon+' '+s.id+'</option>'; }).join('');
  var overlay = document.createElement('div');
  overlay.id = 'traderAddOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:14px;text-align:center;">🏪 إضافة تاجر جديد</div>' +
      '<select id="ta_sec" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;"><option value="">— اختار القسم —</option>' + secs + '</select>' +
      '<input id="ta_prod" type="text" placeholder="اسم المنتج (مثال: فراخ بلدي، بلطي، طماطم...)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ta_name" type="text" placeholder="اسم التاجر" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ta_phone" type="tel" placeholder="رقم الموبايل" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;" dir="ltr">' +
      '<input id="ta_pass" type="password" placeholder="كلمة سر التاجر (6 أحرف/أرقام على الأقل)" autocomplete="new-password" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ta_addr" type="text" placeholder="العنوان / الموقع" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="ta_price" type="number" placeholder="السعر الحالي للكيلو (جنيه)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:14px;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="submitAddTrader()" style="flex:1;background:#1a7a4a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✅ إضافة</button>' +
        '<button onclick="var o=document.getElementById(\'traderAddOverlay\');if(o)o.remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function submitAddTrader() {
  var sec   = document.getElementById('ta_sec').value;
  var prod  = document.getElementById('ta_prod').value.trim();
  var name  = document.getElementById('ta_name').value.trim();
  var phone = document.getElementById('ta_phone').value.trim();
  var pass  = document.getElementById('ta_pass').value.trim();
  var addr  = document.getElementById('ta_addr').value.trim();
  var price = document.getElementById('ta_price').value.trim();
  if(!sec){ showToast('اختار القسم الأول ☝️', 'error'); document.getElementById('ta_sec').focus(); return; }
  if(!prod){ showToast('اكتب اسم المنتج', 'error'); return; }
  if(!name){ showToast('اكتب اسم التاجر', 'error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)){ showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  if(!pass || pass.length < 6){ showToast('كلمة سر التاجر لازم تكون 6 أحرف/أرقام على الأقل', 'error'); return; }
  if(!price || isNaN(parseFloat(price))){ showToast('اكتب السعر', 'error'); return; }
  try {
    const passHash = await hashPass(pass);
    const traderId = await sbRPC('secure_register_market_trader', {p_name: name, p_phone: phone, p_password_hash: passHash, p_address: addr});
    await sbRPC('secure_add_market_product', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_section: sec, p_product_name: prod, p_price: parseFloat(price)});
    document.getElementById('traderAddOverlay').remove();
    showToast('✅ تم إضافة التاجر ' + name);
    await refreshMarketContent('all');
  } catch(e) { showToast('خطأ في الإضافة', 'error'); }
}

// ===== دخول التاجر وتحديث سعره =====
function showTraderLoginDialog() {
  var overlay = document.createElement('div');
  overlay.id = 'traderLoginOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🏪</div>' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:14px;">دخول التاجر</div>' +
      '<input id="tl_phone" type="tel" placeholder="رقم موبايلك" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:8px;text-align:center;" dir="ltr">' +
      '<input id="tl_pass" type="password" placeholder="كلمة السر" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;margin-bottom:14px;text-align:center;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="doTraderLogin()" style="flex:1;background:#1a7a4a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">دخول</button>' +
        '<button onclick="var o=document.getElementById(\'traderLoginOverlay\');if(o)o.remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
      '<a href="javascript:void(0)" onclick="forgotTraderPassword()" style="display:block;margin-top:14px;font-size:12px;color:#0369a1;text-decoration:underline;">نسيت كلمة السر؟</a>' +
    '</div>';
  document.body.appendChild(overlay);
}

function forgotTraderPassword() {
  const phone = document.getElementById('tl_phone').value.trim();
  const msg = 'السلام عليكم، نسيت كلمة سر حسابي كتاجر في سوق الحامول. رقم موبايلي: ' + (phone || '(اكتب رقمك هنا)');
  window.open('https://wa.me/' + ADMIN_WA + '?text=' + encodeURIComponent(msg), '_blank');
}

async function doTraderLogin() {
  var phone = document.getElementById('tl_phone').value.trim();
  var pass  = document.getElementById('tl_pass').value.trim();
  if(!phone||!pass){ showToast('اكتب الموبايل وكلمة السر', 'error'); return; }
  try {
    var passHash = await hashPass(pass);
    var rows = await sbRPC('market_trader_login', {p_phone: phone, p_password_hash: passHash}) || [];
    if(!rows.length){ showToast('رقم الموبايل أو كلمة السر غلط ❌', 'error'); return; }
    localStorage.setItem('trader_id', rows[0].id);
    localStorage.setItem('trader_phone', phone);
    localStorage.setItem('trader_pass', passHash);
    localStorage.setItem('trader_name', rows[0].name);
    document.getElementById('traderLoginOverlay').remove();
    showToast('أهلاً يا '+rows[0].name+' 👋');
    await refreshMarketContent('all');
  } catch(e) {
    if(String(e.message||'') === 'TOO_MANY_ATTEMPTS') showToast('⏳ حاولت كتير غلط، استنى ربع ساعة وجرب تاني', 'error');
    else showToast('خطأ في الدخول', 'error');
  }
}

// ===== تسجيل تاجر جديد بنفسه (بدون موافقة أدمن) =====
function showTraderRegisterDialog() {
  var secs = MARKET_SECTIONS.map(function(s){ return '<option value="'+s.id+'">'+s.icon+' '+s.id+'</option>'; }).join('');
  var overlay = document.createElement('div');
  overlay.id = 'traderRegisterOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">' +
      '<div style="font-size:16px;font-weight:900;margin-bottom:14px;text-align:center;">🏪 سجّل نفسك كتاجر</div>' +
      '<select id="tr_sec" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;"><option value="">— اختار القسم —</option>' + secs + '</select>' +
      '<input id="tr_prod" type="text" placeholder="اسم المنتج (مثال: فراخ بلدي، بلطي، طماطم...)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="tr_name" type="text" placeholder="اسمك" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="tr_phone" type="tel" placeholder="رقم موبايلك" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;" dir="ltr">' +
      '<input id="tr_pass" type="password" placeholder="اختار كلمة سر (6 أحرف/أرقام على الأقل)" autocomplete="new-password" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="tr_addr" type="text" placeholder="العنوان / الموقع" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
      '<input id="tr_price" type="number" placeholder="السعر الحالي للكيلو (جنيه)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:14px;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="submitTraderRegister()" style="flex:1;background:#1a7a4a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✅ سجّل</button>' +
        '<button onclick="var o=document.getElementById(\'traderRegisterOverlay\');if(o)o.remove()" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function submitTraderRegister() {
  var sec   = document.getElementById('tr_sec').value;
  var prod  = document.getElementById('tr_prod').value.trim();
  var name  = document.getElementById('tr_name').value.trim();
  var phone = document.getElementById('tr_phone').value.trim();
  var pass  = document.getElementById('tr_pass').value.trim();
  var addr  = document.getElementById('tr_addr').value.trim();
  var price = document.getElementById('tr_price').value.trim();
  if(!sec){ showToast('اختار القسم الأول ☝️', 'error'); document.getElementById('tr_sec').focus(); return; }
  if(!prod){ showToast('اكتب اسم المنتج', 'error'); return; }
  if(!name){ showToast('اكتب اسمك', 'error'); return; }
  if(!phone || !/^01[0-9]{9}$/.test(phone)){ showToast('رقم الموبايل لازم يبدأ بـ 01 ويتكون من 11 رقم', 'error'); return; }
  if(!pass || pass.length < 6){ showToast('كلمة السر لازم تكون 6 حروف/أرقام على الأقل', 'error'); return; }
  if(!price || isNaN(parseFloat(price))){ showToast('اكتب السعر', 'error'); return; }
  try {
    const passHash = await hashPass(pass);
    const traderId = await sbRPC('secure_register_market_trader', {p_name: name, p_phone: phone, p_password_hash: passHash, p_address: addr});
    await sbRPC('secure_add_market_product', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_section: sec, p_product_name: prod, p_price: parseFloat(price)});
    localStorage.setItem('trader_id', traderId);
    localStorage.setItem('trader_phone', phone);
    localStorage.setItem('trader_pass', passHash);
    localStorage.setItem('trader_name', name);
    document.getElementById('traderRegisterOverlay').remove();
    showToast('✅ أهلاً بيك يا ' + name + '، سعرك ظاهر دلوقتي');
    await refreshMarketContent('all');
  } catch(e) { showToast('حصل خطأ في التسجيل، جرب تاني', 'error'); }
}

// ===== لوحة التاجر — تعديل الأسعار، إضافة منتج، تعديل البيانات =====
async function showTraderUpdateDialog() {
  var traderId = localStorage.getItem('trader_id');
  var phone = localStorage.getItem('trader_phone');
  var pass  = localStorage.getItem('trader_pass');
  var name  = localStorage.getItem('trader_name');
  if(!traderId || !phone || !pass){ showToast('لازم تسجل دخول تاني ⚠️', 'error'); return; }

  var myProducts = [];
  try { myProducts = await sbFetch('GET', 'market_products?trader_id=eq.'+traderId+'&deleted_at=is.null&order=updated_at.desc') || []; } catch(e) {}

  var secs = MARKET_SECTIONS.map(function(s){ return '<option value="'+s.id+'">'+s.icon+' '+s.id+'</option>'; }).join('');

  var items = myProducts.length ? myProducts.map(function(r){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">' +
      '<div style="flex:1;font-size:13px;font-weight:700;">' + escapeHtml(r.product_name) + '<span style="font-size:11px;color:#94a3b8;margin-right:4px;">(' + escapeHtml(r.section) + ')</span></div>' +
      '<input type="number" value="'+r.price+'" data-id="'+r.id+'" class="price-upd-inp" style="width:70px;padding:6px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;text-align:center;">' +
      '<span style="font-size:11px;color:#64748b;">ج/كيلو</span>' +
      '<button data-pid="'+r.id+'" onclick="deleteMyProduct(this.dataset.pid)" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 8px;border-radius:8px;font-size:12px;cursor:pointer;">🗑️</button>' +
    '</div>';
  }).join('') : '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:10px 0;">مفيش أصناف مسجلة لسه</div>';

  var overlay = document.createElement('div');
  overlay.id = 'traderUpdateOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:4px;text-align:center;">✏️ لوحة التاجر</div>' +
      '<div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:14px;">يا '+escapeHtml(name)+'</div>' +

      '<div style="font-size:13px;font-weight:900;margin-bottom:6px;">أصنافك</div>' +
      '<div id="myProductsList">' + items + '</div>' +
      '<button onclick="submitTraderPrices()" id="submitTraderPricesBtn" style="width:100%;margin-top:10px;background:#1a7a4a;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 حفظ الأسعار</button>' +

      '<div style="border-top:1px solid #f1f5f9;margin:16px 0;padding-top:14px;">' +
        '<div style="font-size:13px;font-weight:900;margin-bottom:8px;">➕ إضافة صنف جديد</div>' +
        '<select id="np_sec" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:6px;"><option value="">— اختار القسم —</option>' + secs + '</select>' +
        '<input id="np_name" type="text" placeholder="اسم المنتج" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:6px;">' +
        '<input id="np_price" type="number" placeholder="السعر" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:8px;">' +
        '<button onclick="submitAddMyProduct()" style="width:100%;background:#0369a1;color:white;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">إضافة الصنف</button>' +
      '</div>' +

      '<div style="border-top:1px solid #f1f5f9;margin:16px 0;padding-top:14px;">' +
        '<div style="font-size:13px;font-weight:900;margin-bottom:8px;">👤 بياناتك</div>' +
        '<input id="tp_name" type="text" value="'+escapeHtml(name)+'" placeholder="اسمك" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:6px;">' +
        '<input id="tp_addr" type="text" placeholder="العنوان" style="width:100%;padding:9px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:6px;">' +
        '<input id="tp_photo" type="file" accept="image/*" style="width:100%;margin-bottom:8px;font-size:12px;">' +
        '<button onclick="submitTraderProfileEdit()" style="width:100%;background:#0369a1;color:white;border:none;padding:10px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">حفظ بياناتي</button>' +
      '</div>' +

      '<button onclick="var o=document.getElementById(\'traderUpdateOverlay\');if(o)o.remove()" style="width:100%;margin-top:10px;background:#f3f4f6;color:#666;border:none;padding:10px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إغلاق</button>' +
      '<button onclick="traderLogout()" style="width:100%;margin-top:8px;background:#fee2e2;color:#dc2626;border:none;padding:8px;border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">خروج من حساب التاجر</button>' +
    '</div>';
  document.body.appendChild(overlay);

  // نجيب عنوان التاجر الحالي (مش محفوظ في localStorage) ونحطه في الحقل
  try {
    var meRows = await sbFetch('GET', 'market_traders?id=eq.'+traderId+'&select=address&limit=1') || [];
    if(meRows[0] && meRows[0].address) document.getElementById('tp_addr').value = meRows[0].address;
  } catch(e) {}
}

async function submitTraderPrices() {
  var inputs = document.querySelectorAll('.price-upd-inp');
  var errors = 0;
  var phone = localStorage.getItem('trader_phone');
  var passHash = localStorage.getItem('trader_pass');
  if(!phone || !passHash) {
    document.getElementById('traderUpdateOverlay').remove();
    showToast('لازم تسجل دخول تاني ⚠️', 'error');
    return;
  }
  for(var i=0; i<inputs.length; i++){
    var inp = inputs[i];
    var id = inp.getAttribute('data-id');
    var price = parseFloat(inp.value);
    if(!price||price<=0) continue;
    try {
      await sbRPC('secure_update_market_price', {p_phone: phone, p_password_hash: passHash, p_trader_row_id: id, p_price: price});
    } catch(e) { errors++; }
  }
  var o = document.getElementById('traderUpdateOverlay');
  if(o) o.remove();
  if(errors) showToast('بعض الأسعار مش اتحفظت ⚠️', 'error');
  else showToast('✅ تم تحديث الأسعار!');
  await refreshMarketContent('all');
}

async function submitAddMyProduct() {
  var sec = document.getElementById('np_sec').value;
  var prod = document.getElementById('np_name').value.trim();
  var price = document.getElementById('np_price').value.trim();
  var traderId = localStorage.getItem('trader_id');
  var phone = localStorage.getItem('trader_phone');
  var passHash = localStorage.getItem('trader_pass');
  if(!sec){ showToast('اختار القسم الأول ☝️', 'error'); return; }
  if(!prod){ showToast('اكتب اسم المنتج', 'error'); return; }
  if(!price || isNaN(parseFloat(price))){ showToast('اكتب السعر', 'error'); return; }
  try {
    await sbRPC('secure_add_market_product', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_section: sec, p_product_name: prod, p_price: parseFloat(price)});
    showToast('✅ تم إضافة الصنف');
    var o = document.getElementById('traderUpdateOverlay');
    if(o) o.remove();
    await refreshMarketContent('all');
    await showTraderUpdateDialog();
  } catch(e) { showToast('حصل خطأ في الإضافة', 'error'); }
}

async function deleteMyProduct(productId) {
  if(!confirm('تمسح الصنف ده؟')) return;
  var phone = localStorage.getItem('trader_phone');
  var passHash = localStorage.getItem('trader_pass');
  try {
    await sbRPC('secure_delete_market_product', {p_phone: phone, p_password_hash: passHash, p_product_id: productId});
    showToast('تم الحذف');
    var o = document.getElementById('traderUpdateOverlay');
    if(o) o.remove();
    await refreshMarketContent('all');
    await showTraderUpdateDialog();
  } catch(e) { showToast('حصل خطأ في الحذف', 'error'); }
}

async function submitTraderProfileEdit() {
  var name = document.getElementById('tp_name').value.trim();
  var addr = document.getElementById('tp_addr').value.trim();
  var photoFile = document.getElementById('tp_photo').files[0];
  var traderId = localStorage.getItem('trader_id');
  var phone = localStorage.getItem('trader_phone');
  var passHash = localStorage.getItem('trader_pass');
  if(!name){ showToast('اكتب اسمك', 'error'); return; }
  try {
    var photoUrl = null;
    if(photoFile) photoUrl = await uploadImage(photoFile);
    await sbRPC('secure_update_market_trader_profile', {p_phone: phone, p_password_hash: passHash, p_trader_id: traderId, p_name: name, p_address: addr, p_photo_url: photoUrl});
    localStorage.setItem('trader_name', name);
    showToast('✅ تم حفظ بياناتك');
    var o = document.getElementById('traderUpdateOverlay');
    if(o) o.remove();
    await refreshMarketContent('all');
  } catch(e) { showToast('حصل خطأ في الحفظ', 'error'); }
}

function traderLogout() {
  localStorage.removeItem('trader_id');
  localStorage.removeItem('trader_phone');
  localStorage.removeItem('trader_pass');
  localStorage.removeItem('trader_name');
  var o = document.getElementById('traderUpdateOverlay');
  if(o) o.remove();
  refreshMarketContent('all');
}

async function resetTraderPassword(traderId, traderName) {
  if(!confirm('تعيد ضبط كلمة سر "'+traderName+'"؟ الباسورد القديم هيبقى ملغي.')) return;
  const tempPass = String(Math.floor(100000 + Math.random()*900000)); // كود 6 أرقام
  try {
    const passHash = await hashPass(tempPass);
    await sbRPC('admin_reset_market_trader_password', {p_trader_id: traderId, p_new_password_hash: passHash});
    prompt('كلمة السر المؤقتة الجديدة (انسخها وابعتها للتاجر):', tempPass);
    showToast('✅ تم إعادة ضبط كلمة السر');
  } catch(e) { showToast('حصل خطأ', 'error'); }
}

async function deleteMarketProduct(id, productName) {
  if(!confirm('تعطيل الصنف ده؟ (هيتخفي من العرض، بس مش هيتمسح نهائي)')) return;
  try {
    await sbFetch('PATCH', 'market_products?id=eq.'+id, {deleted_at: new Date().toISOString()});
    await sbRPC('admin_log_deletion', {p_table_name: 'market_products', p_record_id: id, p_item_label: productName || ''});
    showToast('تم التعطيل');
    await refreshMarketContent('all');
  } catch(e) {
    showToast('⚠️ حصل خطأ — جرب تاني', 'error');
    console.error('delete market product error:', e);
  }
}

// TRANSPORT NEWS PAGE

// ===== الموقف إيه دلوقتي؟ =====
async function loadTransportStatus() {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // آخر 60 دقيقة
    const votes = await sbFetch('GET', `transport_votes?created_at=gte.${since}&select=status&order=created_at.desc`) || [];
    
    if(votes.length === 0) return 'green'; // مفيش تصويت = أخضر تلقائي
    
    // احسب الأغلبية
    const counts = {red:0, yellow:0, green:0};
    votes.forEach(v => { if(counts[v.status] !== undefined) counts[v.status]++; });
    
    if(counts.red >= counts.yellow && counts.red >= counts.green) return 'red';
    if(counts.yellow >= counts.red && counts.yellow >= counts.green) return 'yellow';
    return 'green';
  } catch(e) { return 'green'; }
}

async function submitTransportVote(status) {
  const lastVote = localStorage.getItem('transport_last_vote');
  if(lastVote) {
    const diff = (Date.now() - parseInt(lastVote)) / 1000 / 60;
    if(diff < 15) {
      const remaining = Math.ceil(15 - diff);
      showToast('تقدر تصوت تاني بعد ' + remaining + ' دقيقة ⏳', 'error');
      return;
    }
  }
  
  // اسم المصوت
  var voterName = localStorage.getItem('transport_voter_name');
  if(!voterName) {
    // إظهار dialog مخصص بدل prompt
    showVoterNameDialog(status);
    return;
  }
  
  await doTransportVote(status, voterName);
}

function showVoterNameDialog(status) {
  // إنشاء dialog مخصص
  var overlay = document.createElement('div');
  overlay.id = 'voterNameOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = '<div style="background:white;border-radius:20px;padding:24px;width:100%;max-width:340px;text-align:center;">' +
    '<div style="font-size:32px;margin-bottom:8px;">👑</div>' +
    '<div style="font-size:16px;font-weight:900;margin-bottom:6px;">اكتب اسمك</div>' +
    '<div style="font-size:13px;color:#666;margin-bottom:16px;">اسمك هيظهر للناس لو بقيت عمدة الموقف</div>' +
    '<input id="voterNameInput" type="text" placeholder="اكتب اسمك هنا..." maxlength="30" style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:12px;font-family:Cairo,sans-serif;font-size:15px;text-align:center;box-sizing:border-box;margin-bottom:12px;">' +
    '<div style="display:flex;gap:8px;">' +
    '<button onclick="saveVoterName(\'' + status + '\')" style="flex:1;background:#22c55e;color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">تأكيد 👍</button>' +
    '<button onclick="saveVoterName(\'' + status + '\',true)" style="flex:1;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">بدون اسم</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function(){ var inp = document.getElementById('voterNameInput'); if(inp) inp.focus(); }, 100);
}

async function saveVoterName(status, anonymous) {
  var overlay = document.getElementById('voterNameOverlay');
  var input = document.getElementById('voterNameInput');
  var name = anonymous ? 'مجهول' : (input ? input.value.trim() : '');
  if(!name) name = 'مجهول';
  localStorage.setItem('transport_voter_name', name);
  if(overlay) overlay.remove();
  await doTransportVote(status, name);
}

async function doTransportVote(status, voterName) {
  try {
    await sbFetch('POST', 'transport_votes', {
      status: status,
      voter_name: voterName,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('transport_last_vote', Date.now().toString());
    
    const today = new Date().toISOString().split('T')[0];
    const myVotes = await sbFetch('GET', 'transport_votes?voter_name=eq.' + encodeURIComponent(voterName) + '&created_at=gte.' + today + 'T00:00:00&select=id') || [];
    
    showToast('✅ شكراً — صوتك بيساعد الناس!');
    if(voterName !== 'مجهول') showToast('عندك ' + myVotes.length + ' تصويت النهارده 🏆', 'success');
    
    updateTransportUI();
    loadTransportMayor();
  } catch(e) {
    showToast('خطأ في التصويت — جرب تاني', 'error');
  }
}

async function loadTransportMayor() {
  try {
    // نجيب كل التصويتات بـ pagination عشان مفيش limit
    var allVotes = [];
    var page = 0;
    var pageSize = 1000;
    while(true) {
      var chunk = await sbFetch('GET', 'transport_votes?select=voter_name&order=created_at.asc&limit=' + pageSize + '&offset=' + (page * pageSize)) || [];
      allVotes = allVotes.concat(chunk);
      if(chunk.length < pageSize) break;
      page++;
    }

    var mayorDiv = document.getElementById('transportMayor');
    var mayorName = document.getElementById('mayorName');
    var mayorCount = document.getElementById('mayorCount');

    if(!allVotes.length) {
      if(mayorDiv) mayorDiv.style.display = 'none';
      return;
    }

    // احسب كل شخص صوت كام مرة من الأول
    var counts = {};
    allVotes.forEach(function(v) {
      if(v.voter_name && v.voter_name !== 'مجهول') {
        counts[v.voter_name] = (counts[v.voter_name] || 0) + 1;
      }
    });

    var entries = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
    if(!entries.length) {
      if(mayorDiv) mayorDiv.style.display = 'none';
      return;
    }

    var mayor = entries[0];
    if(mayorDiv) mayorDiv.style.display = 'flex';
    if(mayorName) mayorName.textContent = mayor[0];
    if(mayorCount) mayorCount.textContent = mayor[1] + ' تصويت';

    // لو أنت نفسك العمدة — بنفسجي
    var myName = localStorage.getItem('transport_voter_name');
    if(myName && myName === mayor[0]) {
      if(mayorDiv) mayorDiv.style.background = 'linear-gradient(135deg,#7c3aed,#a855f7)';
    } else {
      if(mayorDiv) mayorDiv.style.background = 'linear-gradient(135deg,#92400e,#d97706)';
    }
  } catch(e) {}
}

async function updateTransportUI() {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const votes = await sbFetch('GET', 'transport_votes?created_at=gte.' + since + '&select=status') || [];
    
    let status = 'green';
    if(votes.length > 0) {
      const counts = {red:0, yellow:0, light:0, green:0};
      votes.forEach(v => { if(counts[v.status] !== undefined) counts[v.status]++; });
      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
      status = sorted[0][1] > 0 ? sorted[0][0] : 'green';
    }
    
    const colors = {
      green: {bg:'#22c55e', text:'الموقف فاضي والعربيات متوفرة', emoji:'🟢'},
      light: {bg:'#84cc16', text:'الموقف وسط — في ناس بس الحركة كويسة', emoji:'🟡'},
      yellow: {bg:'#f59e0b', text:'الموقف مزدحم بس الحركة مستمرة', emoji:'🟠'},
      red: {bg:'#ef4444', text:'الموقف مكدس ومفيش عربيات!', emoji:'🔴'}
    };
    const c = colors[status];
    
    const statusDiv = document.getElementById('transportStatus');
    const statusText = document.getElementById('transportStatusText');
    const voteCount = document.getElementById('transportVoteCount');
    if(statusDiv) statusDiv.style.background = c.bg;
    if(statusText) statusText.innerHTML = c.emoji + ' ' + c.text;
    if(voteCount) voteCount.textContent = votes.length > 0 ? votes.length + ' شخص صوّت في آخر ساعة' : 'مفيش تصويتات — الموقف فاضي افتراضياً';
    
    ['green','light','yellow','red'].forEach(s => {
      const btn = document.getElementById('tvote_' + s);
      if(btn) btn.style.opacity = s === status ? '1' : '0.65';
    });
  } catch(e) {}
}

function showTransportPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'transport_news'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  
  const lastVote = localStorage.getItem('transport_last_vote');
  const canVote = !lastVote || ((Date.now() - parseInt(lastVote)) / 1000 / 60) >= 15;
  const remaining = lastVote ? Math.ceil(15 - (Date.now() - parseInt(lastVote)) / 1000 / 60) : 0;

  page.innerHTML = `
    <div class="dyn-header">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🚌 موقف الحامول كفرالشيخ</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:0 0 80px;">
    
      <!-- عمدة الموقف -->
      <div id="transportMayor" style="display:none;background:linear-gradient(135deg,#92400e,#d97706);padding:12px 16px;align-items:center;gap:10px;">
        <span style="font-size:26px;">👑</span>
        <div style="color:white;flex:1;">
          <div style="font-size:11px;opacity:.85;">عمدة الموقف</div>
          <div style="font-size:15px;font-weight:900;" id="mayorName">...</div>
        </div>
        <div style="background:rgba(255,255,255,.2);padding:4px 12px;border-radius:20px;color:white;font-size:12px;font-weight:700;" id="mayorCount">0 تصويت</div>
      </div>
      
      <!-- حالة الموقف الحالية -->
      <div id="transportStatus" style="background:#22c55e;padding:20px 16px;text-align:center;transition:background .5s;">
        <div style="font-size:11px;color:rgba(255,255,255,.85);margin-bottom:4px;">📍 موقف الحامول — كفر الشيخ</div>
        <div style="font-size:13px;color:rgba(255,255,255,.85);margin-bottom:6px;">الحالة الحالية</div>
        <div id="transportStatusText" style="font-size:16px;font-weight:900;color:white;">🟢 جاري التحميل...</div>
        <div id="transportVoteCount" style="font-size:11px;color:rgba(255,255,255,.7);margin-top:6px;">بيتحدث تلقائياً</div>
      </div>
      
      <!-- أزرار التصويت -->
      <div style="padding:16px;">
        <div style="font-size:14px;font-weight:900;text-align:center;margin-bottom:14px;">
          ${canVote ? '📍 انت في الموقف؟ قول للناس الحالة:' : '⏳ تقدر تصوت تاني بعد ' + remaining + ' دقيقة'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
          <button id="tvote_green" onclick="submitTransportVote('green')" ${canVote ? '' : 'disabled'}
            style="background:#22c55e;color:white;border:none;padding:14px 6px;border-radius:14px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;${canVote?'':'opacity:.5;cursor:not-allowed;'}">
            <span style="font-size:24px;">🟢</span>
            <span>فاضي</span>
          </button>
          <button id="tvote_light" onclick="submitTransportVote('light')" ${canVote ? '' : 'disabled'}
            style="background:#84cc16;color:white;border:none;padding:14px 6px;border-radius:14px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;${canVote?'':'opacity:.5;cursor:not-allowed;'}">
            <span style="font-size:24px;">🟡</span>
            <span>وسط</span>
          </button>
          <button id="tvote_yellow" onclick="submitTransportVote('yellow')" ${canVote ? '' : 'disabled'}
            style="background:#f59e0b;color:white;border:none;padding:14px 6px;border-radius:14px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;${canVote?'':'opacity:.5;cursor:not-allowed;'}">
            <span style="font-size:24px;">🟠</span>
            <span>مزدحم</span>
          </button>
          <button id="tvote_red" onclick="submitTransportVote('red')" ${canVote ? '' : 'disabled'}
            style="background:#ef4444;color:white;border:none;padding:14px 6px;border-radius:14px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;${canVote?'':'opacity:.5;cursor:not-allowed;'}">
            <span style="font-size:24px;">🔴</span>
            <span>مكدس</span>
          </button>
        </div>
        <div style="font-size:11px;color:var(--gray);text-align:center;margin-top:10px;">
          تصويتك بيفضل ساعة واحدة • لو مفيش تصويتات في ساعة الموقف بيرجع أخضر تلقائياً
        </div>
      </div>
      
      <!-- شرح الألوان -->
      <div style="margin:0 16px;background:white;border-radius:14px;padding:14px;border:1px solid var(--border);">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🚦 معنى الألوان</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
            <span style="font-size:20px;">🟢</span>
            <div><b>فاضي</b> — العربيات متوفرة وهتلاقي مكان فوراً</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
            <span style="font-size:20px;">🟡</span>
            <div><b>وسط</b> — فيه ناس بس الحركة كويسة</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
            <span style="font-size:20px;">🟠</span>
            <div><b>مزدحم</b> — طابور طويل، الحركة بطيئة</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
            <span style="font-size:20px;">🔴</span>
            <div><b>مكدس</b> — مفيش عربيات، استنى في البيت!</div>
          </div>
        </div>
      </div>
      
    </div>`;

  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  updateTransportUI();
  loadTransportMayor();
  if(window._transportTimer) clearInterval(window._transportTimer);
  window._transportTimer = setInterval(function(){ updateTransportUI(); loadTransportMayor(); }, 2 * 60 * 1000);
}

// NEWS PAGE
// DAILY TIPS
async function loadDailyTip() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tips = await sbFetch('GET', `daily_tips?tip_date=eq.${today}&select=*&limit=1`) || [];
    const tip = tips[0];
    if(!tip) return;
    const card = document.getElementById('dailyTipCard');
    if(!card) return;
    document.getElementById('tipTitle').textContent = tip.title;
    document.getElementById('tipContent').textContent = tip.content.substring(0,100) + (tip.content.length>100?'...':'');
    document.getElementById('tipDoctor').textContent = tip.doctor_name ? `د. ${tip.doctor_name}` : '';
    document.getElementById('tipDate').textContent = new Date(tip.tip_date).toLocaleDateString('ar-EG',{day:'numeric',month:'long'});
    card.style.display = 'block';
    // تغيير الأيقونة والون حسب الفئة
    const icons = {قلب:'❤️', سكر:'🩸', تغذية:'🥗', عيون:'👁️', أسنان:'🦷', عام:'💊', نفسي:'🧠', أطفال:'👶'};
    const icon = card.querySelector('span');
    if(icon && tip.icon) icon.textContent = tip.icon;
  } catch(e) {}
}

async function showTipsPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'daily_tips'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>💊 نصيحة اليوم الطبية</span>
      ${isAdmin ? `<button onclick="openAddTipModal()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ نصيحة</button>` : '<span></span>'}
    </div>
    <div class="dyn-content" style="padding:0 16px 80px;" id="tipsContent">
      <div style="text-align:center;padding:30px;"><div class="spinner"></div></div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  await loadTipsContent();
}

async function loadTipsContent() {
  const cont = document.getElementById('tipsContent');
  if(!cont) return;
  try {
    const tips = await sbFetch('GET', 'daily_tips?select=*&order=tip_date.desc') || [];
    if(!tips.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">💊</div>
          <p style="font-size:15px;font-weight:700;">لا توجد نصائح بعد</p>
          <p style="font-size:13px;margin-top:6px;">ترقب النصيحة اليومية من أطباء الحامول</p>
          ${isAdmin ? `<button onclick="openAddTipModal()" style="margin-top:14px;background:#0284c7;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ أضف أول نصيحة</button>` : ''}
        </div>`;
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayTip = tips.find(t => t.tip_date === today);
    const oldTips = tips.filter(t => t.tip_date !== today);

    cont.innerHTML = `
      ${todayTip ? `
      <!-- نصيحة اليوم -->
      <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:16px;padding:18px;margin:16px 0;color:white;position:relative;">
        <div style="position:absolute;top:12px;left:12px;background:rgba(255,255,255,.2);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">✨ نصيحة اليوم</div>
        <div style="font-size:32px;margin-bottom:10px;margin-top:16px;">${todayTip.icon||'💊'}</div>
        <div style="font-size:16px;font-weight:900;margin-bottom:8px;">${todayTip.title}</div>
        <div style="font-size:13px;line-height:1.8;opacity:.95;">${todayTip.content}</div>
        ${todayTip.doctor_name ? `<div style="margin-top:10px;font-size:12px;opacity:.8;">👨‍⚕️ د. ${todayTip.doctor_name} ${todayTip.category?'— '+todayTip.category:''}</div>` : ''}
        ${isAdmin ? `
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button onclick="editTip('${todayTip.id}')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">✏️ تعديل</button>
          <button onclick="deleteTip('${todayTip.id}')" style="background:rgba(255,0,0,.3);color:white;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">🗑️ حذف</button>
        </div>` : ''}
      </div>` : `
      <div style="background:#f0f9ff;border-radius:14px;padding:14px;margin:16px 0;text-align:center;border:1px dashed #0ea5e9;">
        <div style="font-size:13px;color:#0284c7;font-weight:700;">⏳ نصيحة اليوم لم تُنشر بعد</div>
        ${isAdmin ? `<button onclick="openAddTipModal()" style="margin-top:8px;background:#0284c7;color:white;border:none;padding:8px 16px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ انشر نصيحة اليوم</button>` : ''}
      </div>`}

      ${oldTips.length ? `
      <div style="font-size:13px;font-weight:700;color:var(--gray);margin-bottom:10px;">📚 أرشيف النصائح السابقة</div>
      ${oldTips.map(t => `
      <div style="background:white;border-radius:14px;border:1px solid var(--border);padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:24px;">${t.icon||'💊'}</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:900;">${t.title}</div>
            <div style="font-size:11px;color:var(--gray);">${new Date(t.tip_date).toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})} ${t.doctor_name?'— د. '+t.doctor_name:''}</div>
          </div>
          ${t.category ? `<span style="background:#e0f2fe;color:#0284c7;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;">${t.category}</span>` : ''}
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.7;">${t.content}</div>
        ${isAdmin ? `
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button onclick="editTip('${t.id}')" style="background:#dbeafe;color:#1d4ed8;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">✏️</button>
          <button onclick="deleteTip('${t.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">🗑️</button>
        </div>` : ''}
      </div>`).join('')}` : ''}`;
  } catch(e) {
    cont.innerHTML = `<div style="text-align:center;padding:30px;color:var(--gray);">تعذر التحميل</div>`;
  }
}

function openAddTipModal(editData=null) {
  const old = document.getElementById('tipModal');
  if(old) old.remove();
  const today = new Date().toISOString().split('T')[0];
  const modal = document.createElement('div');
  modal.id = 'tipModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;background:rgba(0,0,0,.5);';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;padding-bottom:32px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:15px;font-weight:900;">${editData?'✏️ تعديل النصيحة':'💊 نصيحة جديدة'}</div>
        <button onclick="document.getElementById('tipModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;">✕</button>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">عنوان النصيحة *</label>
        <input id="tTitle" value="${editData?.title||''}" placeholder="مثال: كيف تحمي قلبك من الأمراض؟" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">محتوى النصيحة *</label>
        <textarea id="tContent" rows="4" placeholder="اكتب النصيحة الطبية هنا..." style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;">${editData?.content||''}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">اسم الدكتور</label>
          <input id="tDoctor" value="${editData?.doctor_name||''}" placeholder="اختياري" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">التخصص</label>
          <select id="tCat" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;">
            ${['عام','قلب','سكر','تغذية','عيون','أسنان','أطفال','نفسي','جلدية','عظام'].map(c=>`<option ${editData?.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">تاريخ النشر</label>
          <input id="tDate" type="date" value="${editData?.tip_date||today}" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">أيقونة</label>
          <select id="tIcon" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:16px;">
            ${['💊','❤️','🩸','🥗','👁️','🦷','🧠','👶','🦴','🫁','💉','🩺'].map(i=>`<option ${editData?.icon===i?'selected':''}>${i}</option>`).join('')}
          </select>
        </div>
      </div>
      <button onclick="saveTipData('${editData?.id||''}')" style="width:100%;background:#0284c7;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 نشر النصيحة</button>
    </div>`;
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveTipData(editId) {
  const title = document.getElementById('tTitle').value.trim();
  const content = document.getElementById('tContent').value.trim();
  if(!title) { showToast('اكتب عنوان النصيحة','error'); return; }
  if(!content) { showToast('اكتب محتوى النصيحة','error'); return; }
  const data = {
    title, content,
    doctor_name: document.getElementById('tDoctor').value.trim() || null,
    category: document.getElementById('tCat').value,
    tip_date: document.getElementById('tDate').value,
    icon: document.getElementById('tIcon').value,
  };
  try {
    if(editId) { await sbFetch('PATCH', `daily_tips?id=eq.${editId}`, data); }
    else { await sbFetch('POST', 'daily_tips', data); }
    document.getElementById('tipModal').remove();
    showToast('✅ تم نشر النصيحة');
    await loadTipsContent();
    loadDailyTip();
  } catch(e) { showToast('خطأ في الحفظ','error'); }
}

async function editTip(id) {
  const tips = await sbFetch('GET', `daily_tips?id=eq.${id}&select=*`) || [];
  if(tips[0]) openAddTipModal(tips[0]);
}

async function deleteTip(id) {
  if(!confirm('حذف النصيحة؟')) return;
  await sbFetch('DELETE', `daily_tips?id=eq.${id}`);
  showToast('🗑️ تم الحذف');
  loadDailyTip();
  await loadTipsContent();
}

// DOCTORS HUB
function showDoctorsHub() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'doctors'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#0891b2,#0e7490);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🩺 أطباء الحامول</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:0 0 80px;">
      <div id="catBanner"></div>
      <div onclick="showDoctorsCommunity()" style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:16px;cursor:pointer;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:10px;left:12px;background:#fbbf24;color:#1e293b;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:900;">💬 تفاعلي</div>
        <div style="font-size:38px;margin-top:6px;">🏥</div>
        <div style="flex:1;">
          <div style="color:white;font-size:15px;font-weight:900;">مجتمع الأطباء والمرضى</div>
          <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:3px;">اسأل طبيبك • شارك تجربتك • ناقش الصحة</div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">❓ أسئلة</span>
            <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">💬 نقاشات</span>
            <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">🔬 معلومات</span>
          </div>
        </div>
        <div style="background:rgba(255,255,255,.2);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;flex-shrink:0;">›</div>
      </div>
      <div style="padding:16px;">
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">👨‍⚕️ ابحث عن طبيبك</div>
        <div id="specsGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  buildSpecsGrid();
  loadCatBanner('doctors', null);
}

function buildSpecsGrid() {
  const grid = document.getElementById('specsGrid');
  if(!grid) return;
  const specs = [
    {sub:'أسنان',icon:'🦷'},{sub:'عظام',icon:'🦴'},
    {sub:'أطفال وحديثي الولادة',icon:'👶'},{sub:'نساء وتوليد',icon:'👩'},
    {sub:'باطنة والجهاز الهضمي',icon:'🫀'},{sub:'عيون',icon:'👁️'},
    {sub:'أنف وأذن وحنجرة',icon:'👂'},{sub:'قلب وأوعية دموية',icon:'❤️'},
    {sub:'جلدية',icon:'🩺'},{sub:'مخ وأعصاب',icon:'🧠'},
    {sub:'جراحة عامة',icon:'🏥'},{sub:'صدر',icon:'🫁'},
    {sub:'مسالك بولية',icon:'💊'},{sub:'أورام',icon:'🔬'},
    {sub:'علاج طبيعي',icon:'🤸'},{sub:'تغذية علاجية',icon:'🥗'},{sub:'عام',icon:'👨‍⚕️'},
  ];
  const knownSubs = specs.map(function(s){ return s.sub; });
  specs.forEach(function(s) {
    const count = allAds.filter(function(a){ return a.status==='approved' && a.category==='doctors' && a.subcategory===s.sub; }).length;
    const div = document.createElement('div');
    div.onclick = function(){ showDoctorAds(s.sub); };
    div.style.cssText = 'background:white;border:1px solid #cffafe;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;position:relative;';
    if(count > 0) {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;top:4px;left:4px;background:#0891b2;color:white;width:16px;height:16px;border-radius:50%;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;';
      badge.textContent = count;
      div.appendChild(badge);
    }
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:22px;margin-bottom:4px;';
    iconEl.textContent = s.icon;
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:10px;font-weight:700;color:#0e7490;';
    nameEl.textContent = s.sub;
    div.appendChild(iconEl);
    div.appendChild(nameEl);
    grid.appendChild(div);
  });
  // تصنيف احتياطي: أي طبيب اتسجل بتخصص مش من القايمة (أو من غير تخصص خالص) بيظهر هنا بدل ما يضيع
  const otherCount = allAds.filter(function(a){ return a.status==='approved' && a.category==='doctors' && knownSubs.indexOf((a.subcategory||'').trim()) === -1; }).length;
  const otherDiv = document.createElement('div');
  otherDiv.onclick = function(){ showDoctorAds('__other__'); };
  otherDiv.style.cssText = 'background:white;border:1px solid #cffafe;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;position:relative;';
  if(otherCount > 0) {
    const obadge = document.createElement('div');
    obadge.style.cssText = 'position:absolute;top:4px;left:4px;background:#0891b2;color:white;width:16px;height:16px;border-radius:50%;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;';
    obadge.textContent = otherCount;
    otherDiv.appendChild(obadge);
  }
  otherDiv.innerHTML += '<div style="font-size:22px;margin-bottom:4px;">➕</div><div style="font-size:10px;font-weight:700;color:#0e7490;">تخصصات أخرى</div>';
  grid.appendChild(otherDiv);

  const addBtn = document.createElement('div');
  addBtn.onclick = function(){ openAddModal('doctors',''); };
  addBtn.style.cssText = 'background:linear-gradient(135deg,#0891b2,#0e7490);border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;';
  addBtn.innerHTML = '<div style="font-size:22px;margin-bottom:4px;color:white;">+</div><div style="font-size:10px;font-weight:700;color:white;">أضف طبيب</div>';
  grid.appendChild(addBtn);
}

async function showDoctorAds(subName) {
  await loadAds();
  const isOther = subName === '__other__';
  if(!window._restoringFromDetail){
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) { try { sessionStorage.setItem('parentDynState', currentState); } catch(e) {} }
  }
  sessionStorage.setItem('dynState', JSON.stringify({type:'docSub', sub:subName}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const knownSubs = ['أسنان','عظام','أطفال وحديثي الولادة','نساء وتوليد','باطنة والجهاز الهضمي','عيون','أنف وأذن وحنجرة','قلب وأوعية دموية','جلدية','مخ وأعصاب','جراحة عامة','صدر','مسالك بولية','أورام','علاج طبيعي','تغذية علاجية','عام'];
  const filtered = allAds.filter(a => {
    if(a.status !== 'approved') return false;
    if(a.category !== 'doctors') return false;
    const adSub = (a.subcategory || '').trim();
    if(isOther) return knownSubs.indexOf(adSub) === -1;
    const targetSub = (subName || '').trim();
    return adSub === targetSub;
  });
  const fakeCat = {id:'doctors', name:'أطباء', icon:'🩺', color:'#fee2e2', subs:[]};
  const headerLabel = isOther ? 'تخصصات أخرى' : subName;
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#0891b2,#0e7490);">
      <button class="dyn-back" onclick="showDoctorsHub()">←</button>
      <span>👨‍⚕️ ${headerLabel}</span>
      ${isOther ? '<span></span>' : `<button onclick="openAddModal('doctors','${subName}')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ أضف</button>`}
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;" id="adsContent">
      ${renderAdsList(filtered, fakeCat)}
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  // أول ما يفتح القسم يظهر البوب أب الممول بس (بدون بانر ثاني)
  if(!isOther) showPopupBanner('doctors', subName, null);
}

function showDoctorsCommunity() {
  showCommunityPageGeneric('doctors_community', '🏥 مجتمع الأطباء والمرضى', '#0891b2', '#0e7490', 'showDoctorsHub');
}

// ========== أخبار الحامول (فيد زي فيسبوك — بوست، لايك، كومنت، مشاركة) ==========
function showNewsPage() {
  showCommunityPageGeneric('news', '📰 أخبار ومناقشات الحامول', '#0369a1', '#0ea5e9', 'hideDynPage');
}

function showCommunityPageGeneric(communityId, title, color1, color2, backFnName) {
  sessionStorage.setItem('dynState', JSON.stringify({type:communityId}));
  try{history.pushState({dyn:1},'');}catch(e){}
  window._communityFilter2 = 'all';
  window._communitySearch2 = '';
  window._communitySort2 = 'recent';
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,${color1},${color2});">
      <button class="dyn-back" onclick="${backFnName}()">←</button>
      <span>${title}</span>
      <button onclick="openNewPostModal('${communityId}')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ موضوع</button>
    </div>
    <div class="dyn-content" style="padding:0 0 80px;">
      <div style="background:linear-gradient(135deg,${color1},${color2});padding:0 8px;border-bottom:1px solid var(--border);overflow-x:auto;display:flex;">
        ${[
          {id:'all',label:'الكل',icon:'📋'},
          {id:'سؤال',label:'أسئلة',icon:'❓'},
          {id:'نقاش',label:'نقاشات',icon:'💬'},
          {id:'مشاركة',label:'مشاركات',icon:'📢'},
          {id:'طلب مساعدة',label:'مساعدة',icon:'🤝'},
        ].map((t,i)=>`
        <button onclick="loadCommunityPostsGeneric('${communityId}','${t.id}',this)"
          id="ctab2_${t.id}"
          style="flex-shrink:0;padding:10px 12px;border:none;background:transparent;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;color:${i===0?'white':'rgba(255,255,255,.6)'};border-bottom:${i===0?'2px solid white':'2px solid transparent'};">
          ${t.icon} ${t.label}
        </button>`).join('')}
      </div>
      <!-- بحث وفرز -->
      <div style="display:flex;gap:8px;padding:10px 16px;background:#fafafa;border-bottom:1px solid var(--border);">
        <input type="text" id="communitySearchInput2" placeholder="🔍 ابحث في الأخبار والمناقشات..." oninput="window._communitySearch2=this.value;loadCommunityPostsGeneric('${communityId}',null,null)" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;box-sizing:border-box;">
        <select onchange="window._communitySort2=this.value;loadCommunityPostsGeneric('${communityId}',null,null)" style="padding:8px;border:1px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;background:white;">
          <option value="recent">🕐 الأحدث</option>
          <option value="popular">🔥 الأكثر تفاعلاً</option>
        </select>
      </div>
      <div id="communityPosts2" style="padding:12px 16px;">
        <div style="text-align:center;padding:20px;"><div class="spinner"></div></div>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  window._currentCommunity = communityId;
  loadCommunityPostsGeneric(communityId, 'all', document.getElementById('ctab2_all'));
}

async function loadCommunityPostsGeneric(communityId, filter, btn) {
  if(filter) window._communityFilter2 = filter;
  if(btn) {
    document.querySelectorAll('[id^="ctab2_"]').forEach(b=>{ b.style.color='rgba(255,255,255,.6)'; b.style.borderBottom='2px solid transparent'; });
    btn.style.color='white'; btn.style.borderBottom='2px solid white';
  }
  const activeFilter = window._communityFilter2 || 'all';
  const cont = document.getElementById('communityPosts2');
  if(!cont) return;
  cont.innerHTML = skeletonCards(3);
  try {
    let path = `community_posts?select=*&notes=eq.${encodeURIComponent(communityId)}&order=created_at.desc`;
    if(activeFilter !== 'all') path += `&category=eq.${encodeURIComponent(activeFilter)}`;
    let posts = await sbFetch('GET', path) || [];
    const q = (window._communitySearch2||'').trim().toLowerCase();
    if(q) posts = posts.filter(p => (p.title||'').toLowerCase().includes(q) || (p.content||'').toLowerCase().includes(q));
    posts = sortCommunityPosts(posts, window._communitySort2||'recent');
    renderCommunityPostsInto(posts, cont, communityId, q);
  } catch(e) {
    cont.innerHTML = `<div style="text-align:center;padding:30px;color:var(--gray);">تعذر التحميل</div>`;
  }
}

function renderCommunityPostsInto(posts, cont, communityId, searchQuery) {
  if(!posts.length) {
    if(communityId === 'doctors_community' && !searchQuery) {
      cont.innerHTML = renderDoctorsCommunityEmptyState();
      return;
    }
    cont.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--gray);">
        <div style="font-size:48px;margin-bottom:12px;">💬</div>
        <p style="font-size:15px;font-weight:700;">${searchQuery?'مفيش نتائج للبحث ده':'لا توجد مواضيع بعد'}</p>
        ${!searchQuery?`<button onclick="openNewPostModal('${communityId}')" style="margin-top:14px;background:#dc2626;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ ابدأ موضوع</button>`:''}
      </div>`;
    return;
  }
  const deviceId = getDeviceId();
  cont.innerHTML = posts.map(p => renderPostCard(p, deviceId)).join('');
  checkMyLikes(posts.map(p=>p.id));
}

// ===== محتوى افتراضي (أسئلة شائعة) لتشجيع المشاركة لما مجتمع الأطباء يكون فاضي =====
function renderDoctorsCommunityEmptyState() {
  const faqs = [
    {icon:'🩺', q:'إزاي أختار دكتور أطفال كويس في الحامول؟', a:'اسأل هنا وهيرد عليك أهالي جربوا قبلك — أو دوّر في قسم "أطباء" على تقييمات ومراجعات.'},
    {icon:'💊', q:'فيه بديل لدواء معين نفد من الصيدليات؟', a:'اسأل المجتمع، غالبًا حد هيعرف صيدلية عندها البديل أو الدواء نفسه.'},
    {icon:'🏥', q:'أقرب مستشفى فيه طوارئ 24 ساعة فين؟', a:'شارك تجربتك أو اسأل — المعلومة دي بتفرق وقت الحاجة.'},
    {icon:'👶', q:'مواعيد التطعيمات وجدول المتابعة الدوري؟', a:'اطرح سؤالك وهيفيدك دكاترة وأمهات في نفس المنطقة.'},
  ];
  return `
    <div style="padding:8px 4px 24px;">
      <div style="text-align:center;padding:30px 20px 20px;color:var(--gray);">
        <div style="font-size:44px;margin-bottom:10px;">🩺</div>
        <p style="font-size:15px;font-weight:900;color:#1e293b;">لسه المجتمع لحد دلوقتي فاضي — كن أول من يسأل!</p>
        <p style="font-size:12px;margin-top:6px;">دي أمثلة على أسئلة ممكن تفيد أهالي الحامول:</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        ${faqs.map(f => `
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:12px 14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:18px;">${f.icon}</span>
            <span style="font-size:13px;font-weight:800;color:#0f766e;">${f.q}</span>
          </div>
          <div style="font-size:12px;color:#64748b;line-height:1.6;padding-right:26px;">${f.a}</div>
        </div>`).join('')}
      </div>
      <button onclick="openNewPostModal('doctors_community')" style="display:block;margin:0 auto;background:#0891b2;color:white;border:none;padding:12px 24px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">+ اطرح سؤالك دلوقتي</button>
    </div>`;
}

// CHARITY PAGE
function showCharityOrgs() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'charityOrgs'}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const page = document.getElementById('dynamicPage');
  const orgsAds = allAds.filter(a => a.status==='approved' && a.category==='charity_orgs');

  const cats = [
    {sub:'مساجد', icon:'🕌', color:'#dcfce7', text:'#166534'},
    {sub:'جمعيات خيرية', icon:'🤝', color:'#dbeafe', text:'#1d4ed8'},
    {sub:'مبادرات شبابية', icon:'💪', color:'#fef3c7', text:'#92400e'},
    {sub:'صناديق إغاثة', icon:'📦', color:'#fce7f3', text:'#be185d'},
    {sub:'كفالة أيتام', icon:'👶', color:'#f3e8ff', text:'#7c3aed'},
    {sub:'إفطار رمضان', icon:'🌙', color:'#fef9c3', text:'#78350f'},
  ];

  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#059669,#047857);">
      <button class="dyn-back" onclick="showCharityPage()">←</button>
      <span>🕌 الجمعيات الخيرية</span>
      <span></span>
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" style="padding:0 0 80px;">

      <!-- هيدر -->
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:16px;text-align:center;color:white;">
        <div style="font-size:36px;margin-bottom:6px;">🕌</div>
        <div style="font-size:15px;font-weight:900;margin-bottom:4px;">الجمعيات الخيرية بالحامول</div>
        <div style="font-size:12px;opacity:.85;">"وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى"</div>
      </div>

      <div style="padding:16px;">

        <!-- بانر تسجيل جمعية -->
        <div onclick="openAddModal('charity_orgs','')" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px dashed #059669;border-radius:14px;padding:14px;margin-bottom:16px;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;background:#059669;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">+</div>
          <div>
            <div style="font-size:13px;font-weight:900;color:#166534;">سجّل جمعيتك أو مسجدك</div>
            <div style="font-size:12px;color:#059669;margin-top:2px;">مجاناً — يظهر بعد موافقة الإدارة</div>
          </div>
          <div style="margin-right:auto;color:#059669;font-size:18px;">›</div>
        </div>

        <!-- أقسام الجمعيات -->
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📋 تصفح حسب النوع</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
          ${cats.map(c => {
            const count = orgsAds.filter(a=>a.subcategory===c.sub).length;
            return `
            <div onclick="showCharityOrgAds('${c.sub}')" style="background:${c.color};border-radius:14px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">${c.icon}</span>
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:${c.text};">${c.sub}</div>
                ${count>0?`<div style="font-size:11px;color:${c.text};opacity:.8;">${count} جهة</div>`:''}
              </div>
              ${count>0?`<div style="background:${c.text};color:white;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${count}</div>`:''}
            </div>`;
          }).join('')}
        </div>

        <!-- جمعيات مسجلة -->
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🏛️ الجهات المسجلة (${orgsAds.length})</div>
        ${orgsAds.length ? orgsAds.map(ad => {
          let phone = ad.phone||''; if(phone.startsWith('01')) phone='20'+phone.substring(1);
          return `
          <div class="ad-card" style="border-right:3px solid #059669;" onclick="openAdDetails('${ad.id}')">
            ${ad.image_url?`<img src="${ad.image_url}" class="ad-img" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="ad-body">
              <div style="font-size:11px;color:#059669;font-weight:700;margin-bottom:4px;">🕌 ${ad.subcategory||'جمعية خيرية'}</div>
              <div class="ad-title">${ad.title||''}</div>
              <div class="ad-desc">${ad.description||''}</div>
              <div style="margin-top:8px;display:flex;gap:6px;">
                <button class="btn-details" onclick="event.stopPropagation();openAdDetails('${ad.id}')">التفاصيل</button>
                ${phone?`<a href="https://wa.me/${phone}" target="_blank" class="btn-wa" onclick="event.stopPropagation()">💬 واتساب</a>`:''}
              </div>
            </div>
          </div>`;
        }).join('') : `
        <div style="text-align:center;padding:40px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">🕌</div>
          <p style="font-size:15px;font-weight:700;">لا توجد جمعيات مسجلة بعد</p>
          <p style="font-size:13px;margin-top:6px;">سجّل جمعيتك أو مسجدك مجاناً</p>
          <button onclick="openAddModal('charity_orgs','')" style="margin-top:14px;background:#059669;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ أضف جمعية أو مسجد</button>
        </div>`}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('charity_orgs', subName);
}

async function showCharityOrgAds(subName) {
  await loadAds();
  if(!window._restoringFromDetail){
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) { try { sessionStorage.setItem('parentDynState', currentState); } catch(e) {} }
  }
  sessionStorage.setItem('dynState', JSON.stringify({type:'charityOrgAds', sub:subName}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const filtered = allAds.filter(a => a.status==='approved' && a.category==='charity_orgs' && a.subcategory===subName);
  const fakeCat = {id:'charity_orgs', name:'جمعيات خيرية', icon:'🕌', color:'#dcfce7', subs:[]};
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#059669,#047857);">
      <button class="dyn-back" onclick="showCharityOrgs()">←</button>
      <span>🕌 ${subName}</span>
      <span></span>
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" style="padding:16px 16px 80px;">
      <!-- زرار الإضافة جوه الصفحة -->
      <div onclick="openAddModal('charity_orgs','${subName}')" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px dashed #059669;border-radius:14px;padding:14px;margin-bottom:16px;cursor:pointer;display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;background:#059669;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;color:white;flex-shrink:0;">+</div>
        <div>
          <div style="font-size:13px;font-weight:900;color:#166534;">أضف ${subName}</div>
          <div style="font-size:12px;color:#059669;margin-top:2px;">مجاناً — يظهر بعد موافقة الإدارة</div>
        </div>
        <div style="margin-right:auto;color:#059669;font-size:18px;">›</div>
      </div>
      ${renderAdsList(filtered, fakeCat)}
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('charity_orgs', subName);
}

function showCharityPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'charity'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');

  const cats = [
    {sub:'ملابس وأدوات منزلية', icon:'👕', color:'#dbeafe', text:'#1d4ed8'},
    {sub:'أثاث وعفش', icon:'🪑', color:'#dcfce7', text:'#166534'},
    {sub:'كتب ومستلزمات دراسية', icon:'📚', color:'#fef3c7', text:'#92400e'},
    {sub:'أجهزة وموبايلات', icon:'📱', color:'#f3e8ff', text:'#7c3aed'},
    {sub:'طعام وغذاء', icon:'🥘', color:'#fce7f3', text:'#be185d'},
    {sub:'مساعدة مادية', icon:'💰', color:'#ecfdf5', text:'#059669'},
    {sub:'تبرع بدم', icon:'🩸', color:'#fee2e2', text:'#dc2626'},
    {sub:'غير ذلك', icon:'🎁', color:'#f8fafc', text:'#475569'},
  ];

  const charityAds = allAds.filter(a => a.status==='approved' && a.category==='charity');

  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#059669,#047857);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🤍 قسم الخير والتبرعات</span>
      <button onclick="openAddModal('charity','')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ تبرع</button>
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" style="padding:0 0 80px;">

      <!-- هيدر ملهم -->
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:20px 16px 28px;text-align:center;color:white;">
        <div style="font-size:40px;margin-bottom:8px;">🤍</div>
        <div style="font-size:16px;font-weight:900;margin-bottom:6px;">قسم الخير والتبرعات</div>
        <div style="font-size:12px;opacity:.9;line-height:1.7;">
          "مَن تَصَدَّقَ بِعَدْلِ تَمْرَةٍ مِن كَسْبٍ طَيِّبٍ، وَلاَ يَقْبَلُ اللَّهُ إِلاَّ الطَّيِّبَ"
        </div>
        <div style="margin-top:12px;background:rgba(255,255,255,.15);border-radius:10px;padding:10px;font-size:12px;">
          💡 عرض حاجاتك المستعملة أو طلب مساعدة — كل شيء لوجه الله
        </div>
      </div>

      <div style="padding:16px;">
        <!-- إحصائية سريعة -->
        <div style="background:white;border-radius:14px;border:1px solid #d1fae5;padding:14px;margin-bottom:16px;display:flex;gap:0;text-align:center;">
          <div style="flex:1;border-left:1px solid #d1fae5;">
            <div style="font-size:22px;font-weight:900;color:#059669;">${charityAds.length}</div>
            <div style="font-size:11px;color:var(--gray);">تبرع متاح</div>
          </div>
          <div style="flex:1;border-left:1px solid #d1fae5;">
            <div style="font-size:22px;font-weight:900;color:#059669;">${new Set(charityAds.map(a=>a.subcategory)).size}</div>
            <div style="font-size:11px;color:var(--gray);">فئة مختلفة</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:22px;">🤍</div>
            <div style="font-size:11px;color:var(--gray);">لوجه الله</div>
          </div>
        </div>

        <!-- الجمعيات الخيرية -->
        <div onclick="showCharityOrgs()" style="background:linear-gradient(135deg,#059669,#047857);border-radius:16px;padding:14px;margin-bottom:16px;cursor:pointer;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(5,150,105,.3);">
          <div style="font-size:36px;">🕌</div>
          <div style="flex:1;">
            <div style="color:white;font-size:14px;font-weight:900;">الجمعيات الخيرية بالحامول</div>
            <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:3px;">مساجد • جمعيات • مبادرات خيرية</div>
          </div>
          <div style="background:rgba(255,255,255,.2);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">›</div>
        </div>

        <!-- أقسام التبرع -->
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">📦 تصفح حسب النوع</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
          ${cats.map(c => {
            const count = charityAds.filter(a=>a.subcategory===c.sub).length;
            return `
            <div onclick="showCharityAds('${c.sub}')" style="background:${c.color};border-radius:14px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:10px;position:relative;">
              <span style="font-size:26px;">${c.icon}</span>
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:${c.text};">${c.sub}</div>
                ${count>0?`<div style="font-size:11px;color:${c.text};opacity:.8;">${count} متاح</div>`:''}
              </div>
              ${count>0?`<div style="background:${c.text};color:white;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${count}</div>`:''}
            </div>`;
          }).join('')}
        </div>

        <!-- كل التبرعات -->
        <div style="font-size:13px;font-weight:900;margin-bottom:10px;">🆕 أحدث التبرعات</div>
        ${charityAds.length ? charityAds.slice(0,5).map(ad => {
          let phone = ad.phone||''; if(phone.startsWith('01')) phone='20'+phone.substring(1);
          return `
          <div class="ad-card" style="border-right:3px solid #059669;">
            ${ad.image_url?`<img src="${ad.image_url}" class="ad-img" loading="lazy" onerror="this.style.display='none'" onclick="openAdDetails('${ad.id}')">` : ''}
            <div class="ad-body">
              <div style="font-size:11px;color:#059669;font-weight:700;margin-bottom:4px;">🤍 ${ad.subcategory||'تبرع'} — مجاناً لوجه الله</div>
              <div class="ad-title" onclick="openAdDetails('${ad.id}')">${escapeHtml(ad.title)||''}</div>
              <div class="ad-desc">${ad.description||''}</div>
              <div style="margin-top:8px;display:flex;gap:6px;">
                <button class="btn-details" onclick="openAdDetails('${ad.id}')">التفاصيل</button>
                ${phone?`<a href="https://wa.me/${phone}" target="_blank" class="btn-wa">💬 واتساب</a>`:''}
              </div>
            </div>
          </div>`;
        }).join('') : `
        <div style="text-align:center;padding:40px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">🤍</div>
          <p style="font-size:15px;font-weight:700;">لا توجد تبرعات بعد</p>
          <p style="font-size:13px;margin-top:6px;">كن أول من يعرض تبرعاً</p>
          <button onclick="openAddModal('charity','')" style="margin-top:14px;background:#059669;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🤍 أضف تبرعك</button>
        </div>`}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('charity', subName);
}

async function showCharityAds(subName) {
  await loadAds();
  if(!window._restoringFromDetail){
    const currentState = sessionStorage.getItem('dynState');
    if(currentState) { try { sessionStorage.setItem('parentDynState', currentState); } catch(e) {} }
  }
  sessionStorage.setItem('dynState', JSON.stringify({type:'charitySub', sub:subName}));
  if(!window._restoringFromDetail){ try{history.pushState({dyn:1},'');}catch(e){} }
  window._restoringFromDetail = false;
  const filtered = allAds.filter(a => a.status==='approved' && a.category==='charity' && a.subcategory===subName);
  const fakeCat = {id:'charity', name:'قسم الخير', icon:'🤍', color:'#f0fdf4', subs:[]};
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#059669,#047857);">
      <button class="dyn-back" onclick="showCharityPage()">←</button>
      <span>🤍 ${subName}</span>
      <button onclick="openAddModal('charity','${subName}')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ تبرع</button>
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;" id="adsContent">
      ${renderAdsList(filtered, fakeCat)}
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('charity', subName);
}

// TEACHERS HUB
function showTeachersHub() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'teachers_hub'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>👨‍🏫 مجتمع المدرسين</span>
      <span></span>
    </div>
    <div id="catBanner"></div>
    <div class="dyn-content" style="padding:16px 16px 80px;">

      <!-- مجتمع النقاشات — مستقل فوق -->
      <div onclick="showCommunityPage()" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:16px;padding:16px;margin-bottom:20px;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.3);position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;left:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
        <div style="position:absolute;bottom:-30px;right:20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.06);"></div>
        <div style="position:absolute;top:12px;left:12px;background:#fbbf24;color:#1e293b;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:900;">🔴 مباشر</div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:8px;">
          <div style="font-size:40px;">💬</div>
          <div style="flex:1;">
            <div style="color:white;font-size:15px;font-weight:900;">مجتمع المدرسين والنقاشات</div>
            <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:4px;">اطرح سؤالك • شارك خبرتك • ناقش زملاءك</div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">❓ أسئلة</span>
              <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">💬 نقاشات</span>
              <span style="background:rgba(255,255,255,.2);color:white;padding:3px 8px;border-radius:20px;font-size:11px;">🤝 مساعدة</span>
            </div>
          </div>
          <div style="background:rgba(255,255,255,.2);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;flex-shrink:0;">›</div>
        </div>
      </div>

      <!-- زرار أضف مدرس -->
      <div onclick="openAddModal('teachers_hub','')" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:14px;padding:14px;margin-bottom:20px;cursor:pointer;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;color:white;">➕</span>
        <div>
          <div style="font-size:14px;font-weight:900;color:white;">سجّل نفسك كمدرس</div>
          <div style="font-size:11px;color:rgba(255,255,255,.85);margin-top:2px;">اختار كل المواد اللي بتدرّسها في مرة واحدة</div>
        </div>
      </div>

      <!-- اختر المرحلة -->
      <div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:10px;">📚 اختر المرحلة الدراسية</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
        <div onclick="showTeacherStage('primary')" style="background:#dcfce7;border-radius:14px;padding:16px;cursor:pointer;text-align:center;">
          <div style="font-size:30px;margin-bottom:6px;">🟢</div>
          <div style="font-size:13px;font-weight:900;color:#166534;">الابتدائية</div>
        </div>
        <div onclick="showTeacherStage('prep')" style="background:#fef9c3;border-radius:14px;padding:16px;cursor:pointer;text-align:center;">
          <div style="font-size:30px;margin-bottom:6px;">🟡</div>
          <div style="font-size:13px;font-weight:900;color:#92400e;">الإعدادية</div>
        </div>
        <div onclick="showTeacherSecondary()" style="background:#dbeafe;border-radius:14px;padding:16px;cursor:pointer;text-align:center;">
          <div style="font-size:30px;margin-bottom:6px;">🔵</div>
          <div style="font-size:13px;font-weight:900;color:#1d4ed8;">الثانوية</div>
        </div>
        <div onclick="showTeacherOtherTypes()" style="background:#f3e8ff;border-radius:14px;padding:16px;cursor:pointer;text-align:center;">
          <div style="font-size:30px;margin-bottom:6px;">🏫</div>
          <div style="font-size:13px;font-weight:900;color:#7c3aed;">سناتر ودروس تانية</div>
        </div>
      </div>

      <!-- مطلوب مدرس -->
      <div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:10px;">🔍 مطلوب مدرس</div>
      <div onclick="setTeacherBackTo({type:'hub'});showTeacherAds('مطلوب مدرس')" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:14px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:12px;border:1px solid #fbbf24;">
        <span style="font-size:30px;">🙋</span>
        <div>
          <div style="font-size:14px;font-weight:900;color:#92400e;">محتاج مدرس خاص؟</div>
          <div style="font-size:12px;color:#78350f;margin-top:2px;">انشر طلبك وهيتواصل معاك المدرسين</div>
        </div>
        <span style="margin-right:auto;color:#92400e;font-size:20px;">›</span>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('teachers_hub', null);
}

// صفحة مواد مرحلة معينة (ابتدائي / إعدادي)
// تتبّع الصفحة اللي المستخدم جاي منها عشان زرار الرجوع يرجعله بالظبط مش لمجتمع المدرسين دايمًا
function setTeacherBackTo(info) {
  try { sessionStorage.setItem('teacherAdsBackTo', JSON.stringify(info)); } catch(e) {}
}
function teacherGoBack() {
  var info = null;
  try { info = JSON.parse(sessionStorage.getItem('teacherAdsBackTo') || 'null'); } catch(e) {}
  if(info && info.type === 'stage') { showTeacherStage(info.id); return; }
  if(info && info.type === 'secondary') { showTeacherSecondary(); return; }
  if(info && info.type === 'other') { showTeacherOtherTypes(); return; }
  showTeachersHub();
}

function showTeacherStage(stageId) {
  const group = TEACHER_SUBJECT_GROUPS.find(g => g.id === stageId);
  if(!group) return;
  sessionStorage.setItem('dynState', JSON.stringify({type:'teacherStage', stageId}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const isSecTrack = stageId.indexOf('sec_') === 0 && stageId !== 'sec_shared';
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="${isSecTrack ? 'showTeacherSecondary()' : 'showTeachersHub()'}">←</button>
      <span>${group.icon} ${group.label}</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        ${group.subjects.map(s=>`
        <div onclick="setTeacherBackTo({type:'stage',id:'${stageId}'});showTeacherAds('${s}')" style="background:white;border:1px solid #ede9fe;border-radius:12px;padding:12px 6px;text-align:center;cursor:pointer;">
          <div style="font-size:22px;margin-bottom:4px;">${group.icon}</div>
          <div style="font-size:11px;font-weight:700;color:#4c1d95;">${s}</div>
        </div>`).join('')}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// صفحة الثانوي — اختيار الشعبة
function showTeacherSecondary() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'teacherSecondary'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const shared = TEACHER_SUBJECT_GROUPS.find(g=>g.id==='sec_shared');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="showTeachersHub()">←</button>
      <span>🔵 الثانوية</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;">
      <div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:10px;">📘 مواد مشتركة (كل الشعب)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:22px;">
        ${shared.subjects.map(s=>`
        <div onclick="setTeacherBackTo({type:'secondary'});showTeacherAds('${s}')" style="background:white;border:1px solid #ede9fe;border-radius:12px;padding:12px 6px;text-align:center;cursor:pointer;">
          <div style="font-size:22px;margin-bottom:4px;">🔵</div>
          <div style="font-size:11px;font-weight:700;color:#4c1d95;">${s}</div>
        </div>`).join('')}
      </div>
      <div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:10px;">🎓 اختر الشعبة</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div onclick="showTeacherStage('sec_science')" style="background:#dcfce7;border-radius:14px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:26px;">🧬</span>
          <span style="font-size:13px;font-weight:900;color:#166534;">علمي علوم</span>
        </div>
        <div onclick="showTeacherStage('sec_math')" style="background:#dbeafe;border-radius:14px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:26px;">➗</span>
          <span style="font-size:13px;font-weight:900;color:#1d4ed8;">علمي رياضة</span>
        </div>
        <div onclick="showTeacherStage('sec_literary')" style="background:#fce7f3;border-radius:14px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:26px;">📜</span>
          <span style="font-size:13px;font-weight:900;color:#be185d;">أدبي</span>
        </div>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// صفحة الأنواع التانية (سناتر، روضة، دروس أونلاين...)
function showTeacherOtherTypes() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'teacherOtherTypes'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  const icons = {'سنتر تعليمي':'🏫','روضة وحضانة':'🧸','كورسات لغات':'🌍','كورسات كمبيوتر':'💻','دروس برمجة':'👨‍💻','تأهيل وتدريب مهني':'🎯','فصل دراسي خاص':'📚','دروس أونلاين':'🖥️','تعليم ذوي الاحتياجات الخاصة':'🧩','مطلوب مدرس':'🙋','أخرى':'📋'};
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="showTeachersHub()">←</button>
      <span>🏫 سناتر ودروس تانية</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${TEACHER_OTHER_TYPES.map(s=>`
        <div onclick="setTeacherBackTo({type:'other'});showTeacherAds('${s}')" style="background:#f3e8ff;border-radius:14px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">${icons[s]||'📋'}</span>
          <span style="font-size:12px;font-weight:700;color:#5b21b6;">${s}</span>
        </div>`).join('')}
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function showTeacherAds(subName) {
  await loadAds();
  window._teacherAdsSubName = subName;
  window._teacherAdsAll = allAds.filter(a => a.status==='approved' && a.category==='teachers_hub' && (a.subcategory===subName || (a.subcategory && a.subcategory.includes(subName)) || a.title?.includes(subName)));
  sessionStorage.setItem('dynState', JSON.stringify({type:'teacherSub', sub: subName}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const fakeCat = {id:'teachers_hub', name:'مجتمع المدرسين', icon:'👨‍🏫', color:'#ede9fe', subs:[]};
  const isTeacherRequest = subName === 'مطلوب مدرس';
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="teacherGoBack()">←</button>
      <span>👨‍🏫 ${subName}</span>
      <button onclick="openAddModal('teachers_hub','${subName}')" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ أضف</button>
    </div>
    <div style="background:white;padding:10px 16px;border-bottom:1px solid var(--border);">
      <input type="text" id="teacherAdsSearch" placeholder="🔍 ابحث في ${subName}..." oninput="filterTeacherAds()" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
    </div>
    <div class="dyn-content" style="padding:16px 16px 80px;" id="adsContent">
      ${isTeacherRequest ? `
      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:14px;padding:14px;margin-bottom:16px;border:1px solid #fbbf24;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:22px;flex-shrink:0;">💡</span>
        <div>
          <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:3px;">محتاج مدرس؟</div>
          <div style="font-size:12px;color:#78350f;line-height:1.6;">اكتب تفاصيل طلبك بدقة (المادة، المرحلة الدراسية، المنطقة، والمواعيد المناسبة) لضمان استجابة المدرسين بسرعة</div>
        </div>
      </div>` : ''}
      ${renderAdsList(window._teacherAdsAll, fakeCat)}
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  loadCatBanner('teachers_hub', subName);
}

function filterTeacherAds() {
  const q = (document.getElementById('teacherAdsSearch')?.value || '').trim().toLowerCase();
  const all = window._teacherAdsAll || [];
  const fakeCat = {id:'teachers_hub', name:'مجتمع المدرسين', icon:'👨‍🏫', color:'#ede9fe', subs:[]};
  const filtered = q ? all.filter(a => (a.title||'').toLowerCase().includes(q) || (a.description||'').toLowerCase().includes(q)) : all;
  const listWrap = document.getElementById('adsContent');
  if(!listWrap) return;
  const tipHtml = listWrap.querySelector('div[style*="fef3c7"]');
  listWrap.innerHTML = (tipHtml ? tipHtml.outerHTML : '') + renderAdsList(filtered, fakeCat);
}


// COMMUNITY
async function showCommunityPage(filter='all') {
  sessionStorage.setItem('dynState', JSON.stringify({type:'community'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  window._communityFilter = filter;
  window._communitySearch = '';
  window._communitySort = 'recent';
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">
      <button class="dyn-back" onclick="showTeachersHub()">←</button>
      <span>💬 مجتمع المدرسين</span>
      <button onclick="openNewPostModal()" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">+ موضوع</button>
    </div>
    <div class="dyn-content" style="padding:0 0 80px;">
      <!-- تابات -->
      <div style="background:white;border-bottom:1px solid var(--border);overflow-x:auto;display:flex;padding:0 8px;">
        ${[
          {id:'all',label:'الكل',icon:'📋'},
          {id:'سؤال',label:'أسئلة',icon:'❓'},
          {id:'نقاش',label:'نقاشات',icon:'💬'},
          {id:'مشاركة',label:'مشاركات',icon:'📢'},
          {id:'طلب مساعدة',label:'مساعدة',icon:'🤝'},
        ].map((t,i)=>`
        <button onclick="loadCommunityPosts('${t.id}',this)" id="ctab_${t.id}"
          style="flex-shrink:0;padding:10px 12px;border:none;background:transparent;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;color:${i===0?'#7c3aed':'var(--gray)'};border-bottom:${i===0?'2px solid #7c3aed':'2px solid transparent'};">
          ${t.icon} ${t.label}
        </button>`).join('')}
      </div>
      <!-- بحث وفرز -->
      <div style="display:flex;gap:8px;padding:10px 16px;background:#fafafa;border-bottom:1px solid var(--border);">
        <input type="text" id="communitySearchInput" placeholder="🔍 ابحث في المواضيع..." oninput="window._communitySearch=this.value;loadCommunityPosts(null,null)" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;box-sizing:border-box;">
        <select onchange="window._communitySort=this.value;loadCommunityPosts(null,null)" style="padding:8px;border:1px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:12px;background:white;">
          <option value="recent">🕐 الأحدث</option>
          <option value="popular">🔥 الأكثر تفاعلاً</option>
        </select>
      </div>
      <div id="communityPosts" style="padding:12px 16px;">
        <div style="text-align:center;padding:20px;"><div class="spinner"></div></div>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';
  await loadCommunityPosts('all', document.getElementById('ctab_all'));
}

function renderVideoBlock(url) {
  if(!url) return '';
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{6,})/);
  if(yt) {
    return `<div style="margin-top:10px;border-radius:10px;overflow:hidden;position:relative;padding-top:56.25%;" onclick="event.stopPropagation()">
      <iframe src="https://www.youtube.com/embed/${yt[1]}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  return `<a href="${escapeHtml(safeUrl(url))}" target="_blank" onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:8px;margin-top:10px;background:#fef3c7;color:#92400e;padding:10px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">🎥 مشاهدة الفيديو</a>`;
}

const WA_ICON_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.6 6.3A8.9 8.9 0 0 0 12.04 3.5c-4.9 0-8.9 4-8.9 8.9 0 1.57.41 3.1 1.19 4.45L3 21.5l4.8-1.26a8.9 8.9 0 0 0 4.24 1.08h0c4.9 0 8.9-4 8.9-8.9 0-2.38-.93-4.6-2.6-6.28zM12.04 19.7h0a7.4 7.4 0 0 1-3.77-1.03l-.27-.16-2.8.74.75-2.73-.18-.28a7.4 7.4 0 0 1-1.14-3.94c0-4.1 3.34-7.44 7.45-7.44a7.4 7.4 0 0 1 5.27 2.18 7.4 7.4 0 0 1 2.18 5.27c0 4.1-3.34 7.4-7.5 7.4zm4.08-5.56c-.22-.11-1.32-.65-1.53-.72-.2-.08-.35-.11-.5.11-.15.22-.58.72-.71.87-.13.15-.26.16-.48.05-.22-.11-.94-.35-1.79-1.11-.66-.59-1.11-1.32-1.24-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.4.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.4-.05-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.4.05-.6.28-.2.22-.8.78-.8 1.9s.82 2.2.94 2.35c.11.15 1.62 2.48 3.94 3.48.55.24.98.38 1.31.48.55.18 1.05.15 1.45.09.44-.07 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.05-.1-.2-.15-.42-.26z"/></svg>';
const FB_ICON_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.4c0-.87.24-1.46 1.49-1.46H16.5V4.35C16.24 4.32 15.36 4.24 14.33 4.24c-2.14 0-3.6 1.31-3.6 3.71v2.55H8.2v3h2.53V21h2.77z"/></svg>';

// ===== ترتيب المنشورات: الأخبار الرسمية دايمًا فوق، وبعدين حسب الفرز المطلوب =====
function sortCommunityPosts(posts, sortMode) {
  const sorted = posts.slice();
  if(sortMode === 'popular') {
    sorted.sort((a,b) => ((b.likes_count||0)+(b.comments_count||0)) - ((a.likes_count||0)+(a.comments_count||0)));
  } else {
    sorted.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const pinned = sorted.filter(p => p.category === 'خبر رسمي');
  const rest = sorted.filter(p => p.category !== 'خبر رسمي');
  return pinned.concat(rest);
}

function renderPostCard(p, deviceId) {
  const catColors = {'سؤال':'#dbeafe:#1d4ed8','نقاش':'#dcfce7:#15803d','مشاركة':'#fef3c7:#92400e','طلب مساعدة':'#fee2e2:#dc2626','خبر رسمي':'#fef3c7:#b45309'};
  const isPinned = p.category === 'خبر رسمي';
  const [bg,color] = (catColors[p.category]||'#ede9fe:#7c3aed').split(':');
  const timeAgo = getTimeAgo(p.created_at);
  const imgs = p.images && p.images.length ? p.images : [];
  return `
  <div style="background:${isPinned?'linear-gradient(135deg,#fffbeb,#fff)':'white'};border-radius:14px;border:${isPinned?'2px solid #f59e0b':'1px solid var(--border)'};margin-bottom:12px;overflow:hidden;cursor:pointer;position:relative;" onclick="openPostDetail('${p.id}')">
    ${isPinned?`<div style="position:absolute;top:-1px;right:12px;background:#f59e0b;color:white;padding:3px 12px;border-radius:0 0 8px 8px;font-size:11px;font-weight:900;z-index:1;">📌 خبر رسمي</div>`:''}
    <div style="padding:14px 14px 10px;${isPinned?'padding-top:22px;':''}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:36px;height:36px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;">${escapeHtml(p.author_name)}</div>
          <div style="font-size:11px;color:var(--gray);">${timeAgo}</div>
        </div>
        <span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">${p.category}</span>
      </div>
      <div style="font-size:14px;font-weight:900;margin-bottom:6px;">${escapeHtml(p.title)}</div>
      <div style="font-size:13px;color:#374151;line-height:1.7;">${escapeHtml(p.content.length>150?p.content.substring(0,150)+'...':p.content)}</div>
      ${imgs.length ? `
      <div style="display:flex;gap:6px;margin-top:10px;overflow-x:auto;padding-bottom:4px;">
        ${imgs.slice(0,5).map(url=>`<img src="${url}" onclick="event.stopPropagation();openImgFull('${url}')" style="width:100px;height:100px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border);cursor:zoom-in;" onerror="this.style.display='none'">`).join('')}
        ${imgs.length>5?`<div style="width:100px;height:100px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--gray);flex-shrink:0;">+${imgs.length-5}</div>`:''}
      </div>` : ''}
      ${renderVideoBlock(p.video_link)}
    </div>
    <div style="border-top:1px solid #f3f4f6;padding:10px 14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;" onclick="event.stopPropagation()">
      <button onclick="event.stopPropagation();openPostReactionMenu('${p.id}',this)" id="like_${p.id}"
        style="display:flex;align-items:center;gap:4px;background:#f3f4f6;border:none;padding:7px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        👍 ${p.likes_count||0}
      </button>
      <button onclick="openPostDetail('${p.id}')"
        style="display:flex;align-items:center;gap:4px;background:#f3f4f6;border:none;padding:7px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        💬 ${p.comments_count||0}
      </button>
      <button onclick="sharePostWA('${p.id}','${p.title.replace(/['\"]/g,'')}','${imgs[0]||''}')" 
        style="display:flex;align-items:center;gap:4px;background:#25D366;color:white;border:none;padding:7px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        ${WA_ICON_SVG}
      </button>
      <button onclick="sharePostFB('${p.id}','${p.title.replace(/['\"]/g,'')}','${imgs[0]||''}')" 
        style="display:flex;align-items:center;gap:4px;background:#1877F2;color:white;border:none;padding:7px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        ${FB_ICON_SVG}
      </button>
      <button onclick="event.stopPropagation();copyPostLink('${p.id}')" 
        style="display:flex;align-items:center;gap:4px;background:#f3f4f6;color:#374151;border:none;padding:7px 12px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;" title="انسخ الرابط والصقه في فيسبوك يدويًا عشان تطلع الصورة صح">
        📋
      </button>
      ${!isAdmin && !isOwnerOf(p) ? `
      <button onclick="event.stopPropagation();reportPost('${p.id}','${p.title.replace(/['\"]/g,'')}')" style="display:flex;align-items:center;gap:4px;background:#f3f4f6;color:#94a3b8;border:none;padding:7px 10px;border-radius:20px;font-size:12px;cursor:pointer;" title="تبليغ عن المنشور">
        🚩
      </button>` : ''}
      ${isAdmin||isOwnerOf(p) ? `
      <button onclick="event.stopPropagation();openEditPostModal('${p.id}')" style="margin-right:auto;background:#eff6ff;color:#2563eb;border:none;padding:7px 10px;border-radius:20px;font-size:12px;cursor:pointer;">✏️</button>
      <button onclick="event.stopPropagation();deletePost('${p.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:7px 10px;border-radius:20px;font-size:12px;cursor:pointer;">🗑️</button>` : ''}
    </div>
  </div>`;
}

async function loadCommunityPosts(filter, btn) {
  if(filter) window._communityFilter = filter;
  if(btn) {
    document.querySelectorAll('[id^="ctab_"]').forEach(b=>{ b.style.color='var(--gray)'; b.style.borderBottom='2px solid transparent'; });
    btn.style.color='#7c3aed'; btn.style.borderBottom='2px solid #7c3aed';
  }
  const activeFilter = window._communityFilter || 'all';
  const cont = document.getElementById('communityPosts');
  if(!cont) return;
  cont.innerHTML = skeletonCards(3);
  try {
    let path = `community_posts?select=*&or=(notes.is.null,notes.eq.teachers_community)&order=created_at.desc`;
    if(activeFilter !== 'all') path += `&category=eq.${encodeURIComponent(activeFilter)}`;
    let posts = await sbFetch('GET', path) || [];
    const q = (window._communitySearch||'').trim().toLowerCase();
    if(q) posts = posts.filter(p => (p.title||'').toLowerCase().includes(q) || (p.content||'').toLowerCase().includes(q));
    posts = sortCommunityPosts(posts, window._communitySort||'recent');
    if(!posts.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">💬</div>
          <p style="font-size:15px;font-weight:700;">${q?'مفيش نتائج للبحث ده':'لا توجد مواضيع بعد'}</p>
          <p style="font-size:13px;margin-top:6px;">${q?'':'كن أول من يبدأ نقاشاً!'}</p>
          ${!q?'<button onclick="openNewPostModal()" style="margin-top:14px;background:#7c3aed;color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">+ ابدأ موضوع جديد</button>':''}
        </div>`;
      return;
    }
    const deviceId = getDeviceId();
    cont.innerHTML = posts.map(p => renderPostCard(p, deviceId)).join('');
    // تحقق من الـ likes
    checkMyLikes(posts.map(p=>p.id));
  } catch(e) {
    cont.innerHTML = `<div style="text-align:center;padding:30px;color:var(--gray);">تعذر التحميل</div>`;
  }
}

async function checkMyLikes(postIds) {
  try {
    const deviceId = getDeviceId();
    const likes = await sbFetch('GET', `community_likes?device_id=eq.${deviceId}&post_id=in.(${postIds.join(',')})&select=post_id,reaction`) || [];
    likes.forEach(l => {
      const btn = document.getElementById('like_'+l.post_id);
      if(btn) {
        const emoji = (POST_REACTIONS.find(r=>r.k===l.reaction)||{}).e || '👍';
        btn.style.background='#ede9fe'; btn.style.color='#7c3aed';
        btn.innerHTML = btn.innerHTML.replace(/^\S+/, emoji);
      }
    });
  } catch(e) { console.error('checkMyLikes failed:', e.message||e); }
}

function openImgFull(url) {
  const old = document.getElementById('imgFullOverlay');
  if(old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'imgFullOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <button onclick="document.getElementById('imgFullOverlay').remove()" style="position:absolute;top:16px;left:16px;background:rgba(255,255,255,.15);color:white;border:none;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;">✕</button>
    <img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;">`;
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// تعبيرات التفاعل على المواضيع (زي فيسبوك: لايك / لاف / ضحك)
const POST_REACTIONS = [
  {k:'like', e:'👍'},
  {k:'love', e:'❤️'},
  {k:'haha', e:'😂'},
  {k:'sad', e:'😢'},
  {k:'angry', e:'😠'},
];

function openPostReactionMenu(postId, btn) {
  const oldMenu = document.getElementById('postReactMenu');
  const oldBackdrop = document.getElementById('postReactBackdrop');
  if(oldMenu) {
    const wasForSamePost = oldMenu.dataset.forPost === postId;
    oldMenu.remove();
    if(oldBackdrop) oldBackdrop.remove();
    if(wasForSamePost) return; // ضغط على نفس الزرار تاني — اقفل القايمة (toggle)
  }
  window._reactTargetBtn = btn;

  // خلفية شفافة بتغطي الشاشة كلها وبتقفل القايمة لو المستخدم ضغط برّاها —
  // أضمن بكتير من مراقبة أحداث الكليك على مستوى الصفحة كلها (خصوصًا على الموبايل)
  const backdrop = document.createElement('div');
  backdrop.id = 'postReactBackdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
  backdrop.addEventListener('click', function() {
    const m = document.getElementById('postReactMenu');
    if(m) m.remove();
    backdrop.remove();
  });
  document.body.appendChild(backdrop);

  const menu = document.createElement('div');
  menu.id = 'postReactMenu';
  menu.dataset.forPost = postId;
  menu.style.cssText = 'position:fixed;z-index:9999;background:white;border:1px solid var(--border);border-radius:24px;padding:6px 10px;display:flex;gap:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);visibility:hidden;';
  menu.innerHTML = POST_REACTIONS.map(r=>`<button onclick="event.stopPropagation();applyPostReaction('${postId}','${r.k}')" style="background:none;border:none;font-size:22px;cursor:pointer;line-height:1;transition:transform .1s;padding:2px;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${r.e}</button>`).join('');
  document.body.appendChild(menu);
  // نحسب مكانه بعد ما يتحط في الصفحة عشان نعرف عرضه الحقيقي ونمنعه يطلع بره الشاشة
  const rect = btn.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  let left = rect.right - menuRect.width; // نحاذي حافته اليمين مع حافة الزرار اليمين (مناسب لـ RTL)
  if(left + menuRect.width > vw - 8) left = vw - menuRect.width - 8;
  if(left < 8) left = 8;
  let top = rect.top - menuRect.height - 8;
  if(top < 8) top = rect.bottom + 8; // لو مفيش مكان فوق، حطه تحت الزرار
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.visibility = 'visible';
}

async function applyPostReaction(postId, reactionKey) {
  document.getElementById('postReactMenu')?.remove();
  document.getElementById('postReactBackdrop')?.remove();
  const curUser = getCurrentUser();
  if(!curUser) { requireLogin().then(function(){ applyPostReaction(postId, reactionKey); }); return; }
  const deviceId = getDeviceId();
  const btns = [window._reactTargetBtn, document.getElementById('like_'+postId), document.getElementById('like_detail_'+postId)].filter(Boolean);
  // نديله شكل "بينفذ" فورًا عشان المستخدم يحس إنه استجاب على طول (مش هيستنى الشبكة)
  const optimisticEmoji = (POST_REACTIONS.find(r=>r.k===reactionKey)||{}).e || '👍';
  btns.forEach(function(btn){ btn.style.opacity = '0.6'; });
  try {
    const [existing, posts] = await Promise.all([
      sbFetch('GET', `community_likes?post_id=eq.${postId}&device_id=eq.${deviceId}&select=id,reaction`),
      sbFetch('GET', `community_posts?id=eq.${postId}&select=likes_count`)
    ]);
    const cur = existing && existing[0];
    let count = (posts && posts[0] && posts[0].likes_count) || 0;
    const nowReacted = (!cur || cur.reaction !== reactionKey);
    if(cur) {
      if(cur.reaction === reactionKey) {
        await sbFetch('DELETE', `community_likes?post_id=eq.${postId}&device_id=eq.${deviceId}`);
        count = Math.max(0, count - 1);
      } else {
        await sbFetch('PATCH', `community_likes?post_id=eq.${postId}&device_id=eq.${deviceId}`, {reaction: reactionKey});
      }
    } else {
      await sbFetch('POST', 'community_likes', {post_id:postId, device_id:deviceId, reaction:reactionKey});
      count = count + 1;
    }
    try { await sbRPC('set_post_likes_count', {p_post_id: postId, p_count: count}); }
    catch(cntErr) { console.error('likes_count update failed:', cntErr.message||cntErr); }
    btns.forEach(function(btn){
      btn.style.opacity = '1';
      if(nowReacted) {
        btn.style.background='#ede9fe'; btn.style.color='#7c3aed';
        btn.innerHTML = optimisticEmoji + ' ' + count + (btn.id.startsWith('like_detail_') ? ' إعجاب' : '');
      } else {
        btn.style.background='#f3f4f6'; btn.style.color='';
        btn.innerHTML = '👍 ' + count + (btn.id.startsWith('like_detail_') ? ' إعجاب' : '');
      }
    });
  } catch(e) {
    btns.forEach(function(btn){ btn.style.opacity = '1'; });
    console.error('reaction failed:', e.message||e); showToast('جرب تاني','error');
  }
}

async function openPostDetail(postId) {
  const old = document.getElementById('postDetailModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'postDetailModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;background:white;';
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:12px 16px;display:flex;align-items:center;gap:10px;">
      <button onclick="document.getElementById('postDetailModal').remove()" style="background:rgba(255,255,255,.2);color:white;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">←</button>
      <span style="color:white;font-size:15px;font-weight:900;">تفاصيل الموضوع</span>
    </div>
    <div style="flex:1;overflow-y:auto;padding:16px;" id="postDetailContent">
      <div style="text-align:center;padding:20px;"><div class="spinner"></div></div>
    </div>
    <div style="padding:12px 16px;border-top:1px solid var(--border);background:white;" id="commentBoxWrap"></div>`;
  document.body.appendChild(modal);
  renderCommentBox(postId);
  await loadPostDetail(postId);
}

function renderCommentBox(postId) {
  const wrap = document.getElementById('commentBoxWrap');
  if(!wrap) return;
  const curUser = getCurrentUser();
  if(curUser) {
    wrap.innerHTML = `
      <div style="display:flex;gap:8px;">
        <input id="commentText" placeholder="اكتب تعليقك باسم ${escapeHtml(curUser.name)}..." style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;">
        <button onclick="submitComment('${postId}')" style="background:#7c3aed;color:white;border:none;padding:9px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">إرسال</button>
      </div>`;
  } else {
    wrap.innerHTML = `
      <button onclick="requireLogin().then(function(){ renderCommentBox('${postId}'); })" style="width:100%;background:#f3f4f6;color:var(--primary);border:none;padding:11px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">🔒 سجّل الدخول عشان تكتب تعليق</button>`;
  }
}


async function loadPostDetail(postId) {
  const cont = document.getElementById('postDetailContent');
  if(!cont) return;
  try {
    const [posts, comments] = await Promise.all([
      sbFetch('GET', `community_posts?id=eq.${postId}&select=*`) || [],
      sbFetch('GET', `community_comments?post_id=eq.${postId}&select=*&order=created_at.asc`) || []
    ]);
    const p = posts[0];
    if(!p) return;
    window._currentPostComments = comments;
    const timeAgo = getTimeAgo(p.created_at);
    cont.innerHTML = `
      <div style="background:${p.category==='خبر رسمي'?'linear-gradient(135deg,#fffbeb,#fff)':'#f8f5ff'};border-radius:14px;padding:16px;margin-bottom:16px;border:${p.category==='خبر رسمي'?'2px solid #f59e0b':'1px solid #ede9fe'};">
        ${p.category==='خبر رسمي'?`<div style="background:#f59e0b;color:white;display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:900;margin-bottom:10px;">📌 خبر رسمي</div>`:''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="width:38px;height:38px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:18px;">👨‍🏫</div>
          <div>
            <div style="font-size:13px;font-weight:700;">${escapeHtml(p.author_name)}</div>
            <div style="font-size:11px;color:var(--gray);">${timeAgo}</div>
          </div>
        </div>
        <div style="font-size:15px;font-weight:900;margin-bottom:8px;">${escapeHtml(p.title)}</div>
        ${p.about?`<div style="background:white;border-radius:8px;padding:10px;margin-top:8px;font-size:13px;line-height:1.8;">${escapeHtml(p.content)}</div>`:`<div style="font-size:13px;color:#374151;line-height:1.8;margin-top:6px;">${escapeHtml(p.content)}</div>`}
        ${p.images&&p.images.length?`
        <div style="margin-top:12px;">
          <div style="font-size:12px;color:var(--gray);margin-bottom:6px;">📸 الصور (${p.images.length})</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
            ${p.images.map(url=>`<img src="${url}" onclick="openImgFull('${url}')" style="width:100%;height:130px;object-fit:cover;border-radius:10px;cursor:zoom-in;border:1px solid var(--border);" onerror="this.style.display='none'">`).join('')}
          </div>
        </div>`:''}
        ${renderVideoBlock(p.video_link)}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="openPostReactionMenu('${p.id}',this)" id="like_detail_${p.id}" style="font-size:12px;color:#7c3aed;background:#ede9fe;border:none;border-radius:20px;padding:4px 12px;font-family:Cairo,sans-serif;font-weight:700;cursor:pointer;">👍 ${p.likes_count||0} إعجاب</button>
          <span style="font-size:12px;color:var(--gray);">💬 ${comments.length} تعليق</span>
          <button onclick="sharePostWA('${p.id}','${(p.title||'').replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g,'')}','${(p.images&&p.images[0])||''}')" style="margin-right:auto;display:flex;align-items:center;gap:6px;background:#25D366;color:white;border:none;padding:6px 14px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">${WA_ICON_SVG} واتساب</button>
          <button onclick="sharePostFB('${p.id}','${(p.title||'').replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g,'')}','${(p.images&&p.images[0])||''}')" style="display:flex;align-items:center;gap:6px;background:#1877F2;color:white;border:none;padding:6px 14px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">${FB_ICON_SVG} فيسبوك</button>
          <button onclick="copyPostLink('${p.id}')" style="display:flex;align-items:center;gap:6px;background:#f3f4f6;color:#374151;border:none;padding:6px 14px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📋 نسخ الرابط</button>
          ${!isAdmin && !isOwnerOf(p) ? `<button onclick="reportPost('${p.id}','${(p.title||'').replace(/['\"]/g,'')}')" style="display:flex;align-items:center;gap:6px;background:#f3f4f6;color:#94a3b8;border:none;padding:6px 14px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🚩 تبليغ</button>` : ''}
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--gray);margin-bottom:10px;">التعليقات (${comments.length})</div>
      <div id="commentsTree">${renderCommentsTree(comments, postId)}</div>`;
  } catch(e) {}
}

// بناء شجرة التعليقات: التعليقات الرئيسية + الردود جواها (مستوى واحد)
function renderCommentsTree(comments, postId) {
  if(!comments.length) return `<div style="text-align:center;padding:20px;color:var(--gray);font-size:13px;">لا توجد تعليقات بعد — كن أول من يعلق!</div>`;
  const top = comments.filter(c => !c.parent_id);
  const repliesOf = function(id){ return comments.filter(c => c.parent_id === id); };
  return top.map(c => renderCommentNode(c, postId, repliesOf(c.id))).join('');
}

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢'];

function renderCommentNode(c, postId, replies) {
  const reactions = c.reactions || {};
  const reactionPills = REACTION_EMOJIS.filter(e => reactions[e] > 0)
    .map(e => `<span style="font-size:11px;background:#f3f4f6;border-radius:10px;padding:2px 7px;">${e} ${reactions[e]}</span>`).join('');
  return `
  <div style="background:white;border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:8px;" data-comment-id="${c.id}">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:13px;">👤</div>
      <span style="font-size:12px;font-weight:700;">${escapeHtml(c.author_name)}</span>
      <span style="font-size:11px;color:var(--gray);margin-right:auto;">${getTimeAgo(c.created_at)}</span>
    </div>
    <div style="font-size:13px;color:#374151;line-height:1.6;">${escapeHtml(c.content)}</div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;">
      ${reactionPills}
      <button onclick="toggleReactionPicker('${c.id}')" style="background:none;border:none;color:var(--gray);font-size:12px;cursor:pointer;padding:2px 4px;">😀 تفاعل</button>
      <button onclick="toggleReplyBox('${c.id}','${postId}')" style="background:none;border:none;color:#7c3aed;font-size:12px;font-weight:700;cursor:pointer;padding:2px 4px;">↩️ رد</button>
    </div>
    <div id="reactionPicker_${c.id}" style="display:none;gap:6px;margin-top:6px;">
      ${REACTION_EMOJIS.map(e => `<button onclick="reactToComment('${c.id}','${e}','${postId}')" style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;font-size:16px;padding:4px 8px;cursor:pointer;">${e}</button>`).join('')}
    </div>
    <div id="replyBox_${c.id}" style="display:none;margin-top:8px;"></div>
    ${replies && replies.length ? `
    <div style="margin-top:10px;padding-right:16px;border-right:2px solid #ede9fe;">
      ${replies.map(r => renderCommentNode(r, postId, [])).join('')}
    </div>` : ''}
  </div>`;
}

function toggleReactionPicker(commentId) {
  const el = document.getElementById('reactionPicker_'+commentId);
  if(el) el.style.display = el.style.display==='none' ? 'flex' : 'none';
}

function toggleReplyBox(commentId, postId) {
  const el = document.getElementById('replyBox_'+commentId);
  if(!el) return;
  if(el.style.display === 'none' || !el.innerHTML) {
    const curUser = getCurrentUser();
    if(curUser) {
      el.innerHTML = `
        <div style="display:flex;gap:6px;">
          <input id="replyText_${commentId}" placeholder="اكتب ردك..." style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;">
          <button onclick="submitComment('${postId}','${commentId}')" style="background:#7c3aed;color:white;border:none;padding:8px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">إرسال</button>
        </div>`;
    } else {
      el.innerHTML = `<button onclick="requireLogin().then(function(){ document.getElementById('replyBox_${commentId}').innerHTML=''; toggleReplyBox('${commentId}','${postId}'); })" style="width:100%;background:#f3f4f6;color:var(--primary);border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔒 سجّل الدخول عشان ترد</button>`;
    }
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

async function reactToComment(commentId, emoji, postId) {
  const curUser = getCurrentUser();
  if(!curUser) { requireLogin().then(function(){ reactToComment(commentId, emoji, postId); }); return; }
  try {
    const comments = window._currentPostComments || [];
    const c = comments.find(x => x.id === commentId);
    const reactions = Object.assign({}, c ? c.reactions : {});
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    await sbRPC('set_comment_reactions', {p_comment_id: commentId, p_reactions: reactions});
    await loadPostDetail(postId);
  } catch(e) { showToast('خطأ، جرب تاني','error'); }
}

async function submitComment(postId, parentId) {
  const curUser = getCurrentUser();
  if(!curUser) { requireLogin().then(function(){ renderCommentBox(postId); }); return; }
  const inputId = parentId ? `replyText_${parentId}` : 'commentText';
  const text = document.getElementById(inputId)?.value.trim();
  if(!text) { showToast('اكتب تعليقك','error'); return; }
  try {
    const body = {post_id:postId, author_name:curUser.name, author_device:getDeviceId(), user_id:curUser.id, content:text};
    if(parentId) body.parent_id = parentId;
    await sbFetch('POST', 'community_comments', body);
    // تحديث عدد التعليقات
    const posts = await sbFetch('GET', `community_posts?id=eq.${postId}&select=comments_count`) || [];
    if(posts[0]) {
      try { await sbRPC('set_post_comments_count', {p_post_id: postId, p_count: (posts[0].comments_count||0)+1}); }
      catch(cntErr) { console.error('comments_count update failed:', cntErr.message||cntErr); }
    }
    if(document.getElementById(inputId)) document.getElementById(inputId).value = '';
    showToast(parentId ? '✅ تم إرسال ردك' : '✅ تم إرسال تعليقك');
    await loadPostDetail(postId);
  } catch(e) { showToast('خطأ في الإرسال','error'); }
}

function openNewPostModal(communityId='teachers_community') {
  requireLogin().then(function(){ openNewPostModalForm(communityId); });
}

function openNewPostModalForm(communityId='teachers_community') {
  const postPlaceholders = {
    'teachers_community': {
      title: 'مثال: كيف تشرح الكسور لطلاب الابتدائي؟',
      content: 'مثال: عنوان الدرس، المرحلة الدراسية، والمنطقة — أو أي تفاصيل تساعد زملاءك يفهموا موضوعك بسرعة'
    },
    'doctors_community': {
      title: 'مثال: إيه أفضل علاج لالتهاب اللوزتين عند الأطفال؟',
      content: 'مثال: السن، الأعراض، ومن قد إيه — أو أي تفاصيل تساعد الدكاترة يردوا عليك بدقة'
    },
    'news': {
      title: 'مثال: تعطل مياه في منطقة وسط البلد النهاردة',
      content: 'مثال: مكان الحدث، الوقت، وأي تفاصيل تهم أهل الحامول — أو رأيك في موضوع بيهم الكل'
    }
  };
  const ph = postPlaceholders[communityId] || postPlaceholders['news'];
  const curUser = getCurrentUser();
  const old = document.getElementById('newPostModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'newPostModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;background:rgba(0,0,0,.5);';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;padding-bottom:32px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:15px;font-weight:900;">✏️ موضوع جديد</div>
        <button onclick="document.getElementById('newPostModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;">✕</button>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">هتنشر باسم</label>
        <input id="postAuthor" value="${escapeHtml(curUser?curUser.name:'')}" readonly style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:#f8fafc;color:#64748b;">
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">نوع الموضوع</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${(isAdmin ? [['خبر رسمي','📌','#fef3c7','#b45309']] : []).concat([['سؤال','❓','#dbeafe','#1d4ed8'],['نقاش','💬','#dcfce7','#15803d'],['مشاركة','📢','#fef3c7','#92400e'],['طلب مساعدة','🤝','#fee2e2','#dc2626']]).map(([v,icon,bg,c])=>`
          <button onclick="document.querySelectorAll('.cat-btn').forEach(b=>{b.style.background='#f3f4f6';b.style.color='#374151'});this.style.background='${bg}';this.style.color='${c}';document.getElementById('postCat').value='${v}'"
            class="cat-btn" style="padding:7px 14px;border:none;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;background:#f3f4f6;color:#374151;">${icon} ${v}</button>`).join('')}
        </div>
        <input type="hidden" id="postCommunityId" value="${communityId}">
        <input type="hidden" id="postCat" value="نقاش">
        ${isAdmin ? `<div style="font-size:10px;color:#b45309;margin-top:6px;">📌 "خبر رسمي" بيثبّت المنشور فوق القايمة — استخدمه للإعلانات المهمة بس</div>` : ''}
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">عنوان الموضوع *</label>
        <input id="postTitle" placeholder="${ph.title}" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">تفاصيل الموضوع *</label>
        <textarea id="postContent" rows="4" placeholder="${ph.content}" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;"></textarea>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;padding-right:4px;">💡 كل ما كانت التفاصيل أدق، كل ما كان الرد أسرع من زملائك</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📸 صور (اختياري — حتى 10 صور)</label>
        <input type="file" id="postImages" accept="image/*" multiple style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;" onchange="previewPostImages()">
        <div id="postImagesPreview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🎥 رابط فيديو (اختياري — يوتيوب/تيك توك/فيسبوك)</label>
        <input type="url" id="postVideoLink" placeholder="https://youtube.com/..." style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
      </div>
      <button onclick="submitNewPost()" style="width:100%;background:#7c3aed;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">🚀 نشر الموضوع</button>
    </div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

function previewPostImages() {
  const input = document.getElementById('postImages');
  const preview = document.getElementById('postImagesPreview');
  if(!input || !preview) return;
  preview.innerHTML = '';
  const files = Array.from(input.files).slice(0, 10);
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
  if(input.files.length > 10) showToast('تم اختيار أول 10 صور فقط','error');
}

async function submitNewPost() {
  const curUser = getCurrentUser();
  if(!curUser) { showToast('لازم تسجل الدخول الأول','error'); openAuthModal(); return; }
  const author = document.getElementById('postAuthor').value.trim() || curUser.name;
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const category = document.getElementById('postCat').value;
  const videoLink = document.getElementById('postVideoLink')?.value.trim() || null;
  const communityId = document.getElementById('postCommunityId')?.value || 'teachers_community';
  if(!title) { showToast('اكتب عنوان الموضوع','error'); return; }
  if(!content) { showToast('اكتب تفاصيل الموضوع','error'); return; }

  const btn = document.querySelector('#newPostModal button[onclick="submitNewPost()"]');
  if(btn) { btn.textContent = '⏳ جاري النشر...'; btn.disabled = true; }

  try {
    // رفع الصور لو موجودة
    const imageInput = document.getElementById('postImages');
    const imageUrls = [];
    if(imageInput && imageInput.files.length > 0) {
      const files = Array.from(imageInput.files).slice(0, 10);
      for(const file of files) {
        const ext = file.name.split('.').pop();
        const path = `community/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const { data, error } = await uploadToStorage(file, path);
        if(data) imageUrls.push(data);
      }
    }

    await sbFetch('POST', 'community_posts', {
      author_name: author,
      author_device: getDeviceId(),
      owner_id: curUser.id,
      title, content, category,
      likes_count: 0, comments_count: 0,
      notes: communityId,
      images: imageUrls,
      video_link: videoLink
    });

    document.getElementById('newPostModal').remove();
    showToast('✅ تم نشر موضوعك!');
    if(communityId === 'teachers_community') {
      await loadCommunityPosts('all', document.getElementById('ctab_all'));
    } else {
      await loadCommunityPostsGeneric(communityId, 'all', document.getElementById('ctab2_all'));
    }
  } catch(e) {
    showToast('خطأ في النشر — تأكد من الاتصال','error');
    if(btn) { btn.textContent = '🚀 نشر الموضوع'; btn.disabled = false; }
  }
}

async function uploadToStorage(file, path) {
  try {
    file = await compressImageFile(file);
    const res = await fetch(`${SB_URL}/storage/v1/object/ads-images/${path}`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': file.type },
      body: file
    });
    if(!res.ok) return { data: null };
    const publicUrl = `${SB_URL}/storage/v1/object/public/ads-images/${path}`;
    return { data: publicUrl };
  } catch(e) { return { data: null }; }
}

async function deletePost(id) {
  if(!confirm('حذف الموضوع؟')) return;
  const curUser = getCurrentUser();
  try {
    if(isAdmin) {
      await sbFetch('DELETE', `community_posts?id=eq.${id}`);
    } else {
      if(!curUser) { showToast('لازم تسجل الدخول', 'error'); return; }
      await sbRPC('secure_delete_post', {p_token: curUser.token, p_post_id: id});
    }
    showToast('🗑️ تم الحذف');
    await loadCommunityPosts('all');
  } catch(e) {
    const msg = (e.message||'').indexOf('NOT_OWNER')!==-1 ? 'الموضوع ده مش بتاعك' : 'حصل خطأ في الحذف';
    showToast('❌ ' + msg, 'error');
  }
}

// ===== تعديل موضوع مجتمع =====
function openEditPostModal(postId) {
  const curUser = getCurrentUser();
  if(!curUser) { showToast('لازم تسجل الدخول', 'error'); return; }
  sbFetch('GET', `community_posts?id=eq.${postId}&select=*`).then(function(rows){
    const p = rows && rows[0];
    if(!p) { showToast('الموضوع مش موجود', 'error'); return; }
    if(!isAdmin && p.owner_id !== curUser.id) { showToast('الموضوع ده مش بتاعك', 'error'); return; }
    window._editPostKeptImages = (p.images || []).slice();
    const old = document.getElementById('editPostModal');
    if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'editPostModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;background:rgba(0,0,0,.5);';
    modal.innerHTML = `
      <div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;padding-bottom:32px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="font-size:15px;font-weight:900;">✏️ تعديل الموضوع</div>
          <button onclick="document.getElementById('editPostModal').remove()" style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;">✕</button>
        </div>
        <input type="hidden" id="editPostCommunityId" value="${p.notes||'teachers_community'}">
        <div style="margin-bottom:10px;">
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">عنوان الموضوع *</label>
          <input id="editPostTitle" value="${escapeHtml(p.title)}" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">تفاصيل الموضوع *</label>
          <textarea id="editPostContent" rows="4" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;resize:none;">${escapeHtml(p.content)}</textarea>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🎥 رابط فيديو (اختياري)</label>
          <input type="url" id="editPostVideoLink" value="${escapeHtml(p.video_link||'')}" placeholder="https://youtube.com/..." style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📸 الصور الحالية</label>
          <div id="editPostCurrentImages" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            ${(p.images||[]).map((url,i)=>`
              <div style="position:relative;">
                <img src="${url}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">
                <button onclick="removeEditPostImage(${i},this)" style="position:absolute;top:-6px;left:-6px;background:#dc2626;color:white;border:none;width:20px;height:20px;border-radius:50%;font-size:11px;cursor:pointer;line-height:1;">✕</button>
              </div>`).join('') || '<span style="font-size:12px;color:var(--gray);">مفيش صور حاليًا</span>'}
          </div>
          <label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">➕ إضافة صور جديدة</label>
          <input type="file" id="editPostImages" accept="image/*" multiple style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;" onchange="previewEditPostImages()">
          <div id="editPostImagesPreview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
        </div>
        <button onclick="submitEditPost('${postId}')" style="width:100%;background:#7c3aed;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 حفظ التعديلات</button>
      </div>`;
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  }).catch(function(){ showToast('حصل خطأ', 'error'); });
}

function removeEditPostImage(index, btn) {
  window._editPostKeptImages.splice(index, 1);
  btn.parentElement.remove();
}

function previewEditPostImages() {
  const input = document.getElementById('editPostImages');
  const preview = document.getElementById('editPostImagesPreview');
  if(!input || !preview) return;
  preview.innerHTML = '';
  const files = Array.from(input.files).slice(0, 10);
  files.forEach(function(file){
    const reader = new FileReader();
    reader.onload = function(e){
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

async function submitEditPost(postId) {
  const curUser = getCurrentUser();
  if(!curUser) { showToast('لازم تسجل الدخول', 'error'); return; }
  const title = document.getElementById('editPostTitle').value.trim();
  const content = document.getElementById('editPostContent').value.trim();
  const videoLink = document.getElementById('editPostVideoLink')?.value.trim() || null;
  const communityId = document.getElementById('editPostCommunityId')?.value || 'teachers_community';
  if(!title || !content) { showToast('اكتب العنوان والتفاصيل', 'error'); return; }
  const btn = document.querySelector(`#editPostModal button[onclick="submitEditPost('${postId}')"]`);
  if(btn) { btn.textContent = '⏳ جاري الحفظ...'; btn.disabled = true; }
  try {
    try {
      await sbRPC('secure_update_post', {p_token: curUser.token, p_post_id: postId, p_title: title, p_content: content});
    } catch(rrErr) {
      const rm = (rrErr.message||'');
      const m = rm.indexOf('NOT_OWNER') !== -1 ? 'الموضوع ده مش بتاعك' : 'حصل خطأ';
      showToast('❌ ' + m, 'error');
      if(btn){btn.textContent='💾 حفظ التعديلات';btn.disabled=false;}
      return;
    }

    // رفع أي صور جديدة، ودمجها مع الصور المتبقية (بعد الحذف)
    const imageInput = document.getElementById('editPostImages');
    const newUrls = [];
    if(imageInput && imageInput.files.length > 0) {
      const files = Array.from(imageInput.files).slice(0, 10);
      for(const file of files) {
        const ext = file.name.split('.').pop();
        const path = `community/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const { data } = await uploadToStorage(file, path);
        if(data) newUrls.push(data);
      }
    }
    const finalImages = (window._editPostKeptImages || []).concat(newUrls);
    try {
      await sbRPC('secure_update_post_media', {p_token: curUser.token, p_post_id: postId, p_images: finalImages, p_video_link: videoLink});
    } catch(mediaErr) {
      console.error('post media update failed:', mediaErr.message||mediaErr);
      showToast('⚠️ العنوان اتحفظ بس الصور/الفيديو مش اتحفظوا: ' + (mediaErr.message||'').slice(0,60), 'error');
    }

    document.getElementById('editPostModal')?.remove();
    showToast('✅ تم التعديل بنجاح!');
    if(communityId === 'teachers_community') {
      await loadCommunityPosts('all', document.getElementById('ctab_all'));
    } else {
      await loadCommunityPostsGeneric(communityId, 'all', document.getElementById('ctab2_all'));
    }
  } catch(e) {
    const msg = (e.message||'').indexOf('NOT_OWNER')!==-1 ? 'الموضوع ده مش بتاعك' : 'حصل خطأ في التعديل';
    showToast('❌ ' + msg, 'error');
    if(btn) { btn.textContent = '💾 حفظ التعديلات'; btn.disabled = false; }
  }
}

function sharePost(id, title) {
  const msg = encodeURIComponent(`💬 ${title}\n\nشاركنا في النقاش على مجتمع المدرسين — دليل الحامول\nhttps://souqelhamoul.com`);
  const a = document.createElement('a');
  a.href = `https://wa.me/?text=${msg}`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>document.body.removeChild(a), 500);
}

const SHARE_FN_BASE = 'https://hamoul-share.souqelhamoul.workers.dev';

function sharePostWA(id, title, imgUrl) {
  const url = `${SHARE_FN_BASE}/post/${encodeURIComponent(id)}`;
  const msg = encodeURIComponent(`💬 ${title}\n\nشاركنا في النقاش على دليل الحامول\n${url}`);
  const a = document.createElement('a');
  a.href = `https://wa.me/?text=${msg}`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>document.body.removeChild(a), 500);
}

function sharePostFB(id, title, imgUrl) {
  const url = encodeURIComponent(`${SHARE_FN_BASE}/post/${encodeURIComponent(id)}`);
  const a = document.createElement('a');
  a.href = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(title)}`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>document.body.removeChild(a), 500);
}

function sharePost(id, title) { sharePostWA(id, title); }

// ===== تبليغ عن منشور =====
function reportPost(id, title) {
  if(!confirm('تبليغ عن المنشور ده للمشرف؟')) return;
  const url = `${SHARE_FN_BASE}/post/${encodeURIComponent(id)}`;
  const msg = encodeURIComponent(`🚩 تبليغ عن منشور في دليل الحامول\n\nالعنوان: ${title}\nالرابط: ${url}\n\nياريت تراجعه.`);
  const a = document.createElement('a');
  a.href = `https://wa.me/${ADMIN_WA}?text=${msg}`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>document.body.removeChild(a), 500);
  showToast('✅ اتبعت للمشرف، شكرًا لتنبيهك');
}

function copyPostLink(id) {
  const url = `${SHARE_FN_BASE}/post/${encodeURIComponent(id)}`;
  const doToast = () => showToast('✅ اتنسخ الرابط! الصقه بنفسك في فيسبوك عشان تطلع الصورة صح');
  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(doToast).catch(()=>fallbackCopy(url, doToast));
  } else {
    fallbackCopy(url, doToast);
  }
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); cb(); } catch(e) { showToast('حصل خطأ في النسخ','error'); }
  document.body.removeChild(ta);
}

function getTimeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if(diff < 60) return 'الآن';
  if(diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
  if(diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
  if(diff < 2592000) return `منذ ${Math.floor(diff/86400)} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-EG');
}

// ADMIN BANNERS
async function loadAdminBanners() {
  const cont = document.getElementById('bannersAdminContent');
  if(!cont) return;
  cont.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray);"><div style="font-size:28px;">⏳</div><p>جاري تحميل البانرات...</p></div>';
  try {
    const [banners, stats] = await Promise.all([
      sbFetch('GET', 'banners?select=*&order=created_at.desc') || [],
      sbFetch('GET', 'banner_stats?select=*').catch(()=>[]) || []
    ]);
    cont.innerHTML = `
      <div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:14px;padding:14px;margin-bottom:16px;color:white;">
        <div style="font-size:14px;font-weight:900;margin-bottom:4px;">📢 إدارة البانرات الممولة</div>
        <div style="font-size:12px;opacity:.85;">${banners.length} بانر — ${banners.filter(b=>b.is_active).length} مفعّل</div>
      </div>

      <button onclick="openAddBannerModal()" style="width:100%;background:var(--primary);color:white;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:16px;">+ إضافة بانر جديد</button>

      ${!banners.length ? '<div style="text-align:center;padding:40px;color:var(--gray);"><div style="font-size:40px;margin-bottom:12px;">📢</div><p style="font-weight:700;">مفيش بانرات لحد دلوقتي</p></div>' :
        banners.map(b => {
          const statusColor = b.is_active ? '#10b981' : '#94a3b8';
          return '<div style="background:white;border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);border-right:4px solid '+statusColor+';">' +
            '<div style="padding:12px;">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">' +
            '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:900;color:#1e293b;">'+(b.title||'بدون عنوان')+'</div>' +
            (function(){
              if(!b.expires_at) return '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">⏳ بدون تاريخ انتهاء</div>';
              const exp = new Date(b.expires_at);
              const now = new Date();
              const diff = Math.ceil((exp - now) / (1000*60*60*24));
              if(diff < 0) return '<div style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:2px;font-weight:700;">⛔ انتهى منذ '+Math.abs(diff)+' يوم</div>';
              if(diff <= 3) return '<div style="font-size:10px;background:#fef3c7;color:#d97706;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:2px;font-weight:700;">⚠️ ينتهي خلال '+diff+' يوم</div>';
              return '<div style="font-size:10px;background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:2px;font-weight:700;">📅 ينتهي '+exp.toLocaleDateString("ar-EG")+' ('+diff+' يوم)</div>';
            })() +
            (b.subtitle?'<div style="font-size:12px;color:var(--gray);margin-top:2px;">'+b.subtitle+'</div>':'') +
            '<div style="font-size:11px;color:#64748b;margin-top:4px;">📂 '+b.category+(b.subcategory?' ← <strong style=\"color:#1d4ed8;\">'+b.subcategory+'</strong>':' <span style=\"background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-weight:700;\">⚠️ بيظهر في كل '+b.category+'</span>')+(b.phone?' | 📞 '+b.phone:'')+'</div>' +
            (function(){
              const bStats = stats.filter(s=>s.banner_id===b.id);
              const views = bStats.filter(s=>s.event_type==='view').length;
              const clicks = bStats.filter(s=>s.event_type==='whatsapp').length;
              return views > 0 ? '<div style="display:flex;gap:6px;margin-top:6px;"><span style=\"background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;\">👁️ '+views+' مشاهدة</span><span style=\"background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;\">📞 '+clicks+' ضغطة</span></div>' : '';
            })() +
            '</div>' +
            '<span style="background:'+(b.is_active?'#dcfce7':'#f3f4f6')+';color:'+(b.is_active?'#166534':'#94a3b8')+';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;margin-right:8px;">'+(b.is_active?'✅ مفعّل':'⏸ متوقف')+'</span>' +
            '</div>' +
            (b.image_url?'<img src="'+b.image_url+'" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;display:block;" onerror="this.style.display=\'none\'">':'') +
            '<div style="display:flex;gap:6px;">' +
            '<button data-bid="'+b.id+'" onclick="editBanner(this.dataset.bid)" style="flex:1;background:#dbeafe;color:#1d4ed8;border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✏️ تعديل</button>' +
            '<button data-bid="'+b.id+'" data-active="'+(b.is_active?'1':'0')+'" onclick="toggleBanner(this.dataset.bid,this.dataset.active===\'1\')" style="flex:1;background:'+(b.is_active?'#fef3c7':'#dcfce7')+';color:'+(b.is_active?'#92400e':'#166534')+';border:none;padding:8px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">'+(b.is_active?'⏸ إيقاف':'▶️ تفعيل')+'</button>' +
            '<button data-bid="'+b.id+'" onclick="deleteBanner(this.dataset.bid)" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:8px;font-size:14px;cursor:pointer;">🗑️</button>' +
            '</div>' +
            '</div></div>';
        }).join('')
      }`;
  } catch(e) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);"><p>خطأ في تحميل البانرات</p><button onclick="loadAdminBanners()" style="margin-top:10px;background:#f3f4f6;border:none;padding:8px 16px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;cursor:pointer;">↺ إعادة المحاولة</button></div>';
  }
}

async function toggleBanner(id, isActive) {
  try {
    await sbFetch('PATCH', 'banners?id=eq.'+id, {is_active: !isActive});
    showToast(isActive ? '⏸ تم إيقاف البانر' : '✅ تم تفعيل البانر');
    loadAdminBanners();
  } catch(e) { showToast('خطأ في التحديث','error'); }
}

async function deleteBanner(id) {
  if(!confirm('حذف البانر نهائياً؟')) return;
  try {
    await sbFetch('DELETE', 'banners?id=eq.'+id);
    showToast('🗑️ تم الحذف');
    loadAdminBanners();
  } catch(e) { showToast('خطأ في الحذف','error'); }
}


// BANNER CATEGORY HELPER FUNCTIONS
function getBannerSubcatOptions(catId, selectedSub) {
  const subsMap = {
    'doctors': ['أسنان','عظام','أطفال وحديثي الولادة','نساء وتوليد','باطنة والجهاز الهضمي','عيون','أنف وأذن وحنجرة','قلب وأوعية دموية','جلدية','مخ وأعصاب','جراحة عامة','صدر','مسالك بولية','أورام','علاج طبيعي','تغذية علاجية','عام'],
    'medservices': ['صيدليات','معامل تحاليل','مراكز أشعة','مراكز تخاطب','مستلزمات طبية','معامل نظارات','تمريض منزلي','الطب التكميلي'],
    'food_rest': ['مطاعم بروست','مطاعم مشويات','مطاعم فول وطعمية','مطاعم كشري','مطاعم بيتزا وكريب','مطاعم شاورما','مطاعم سمك','مطاعم وجبات سريعة','حلويات ومخبوزات','عصائر ومشروبات'],
    'food_cafe': ['كافيهات قهوة','كافيهات مشروبات','كافيهات متكاملة'],
    'building': ['بناء','محارة','سيراميك','رخام','جبس','عزل','مقاولات عامة'],
    'home_goods': ['ماركت','عطارة','خضار وفاكهة','مقلة وتسالي','حلويات','شوايات سمك','فراخ وطيور','لحوم','مستحضرات تجميل'],
  };
  const subs = subsMap[catId] || [];
  if(!subs.length) return '<option value="">— للقسم كله —</option>';
  let opts = '<option value="">— للقسم كله (كل الأقسام الفرعية) —</option>';
  subs.forEach(function(s) { opts += '<option value="'+s+'"'+(s===selectedSub?' selected':'')+'>'+s+'</option>'; });
  return opts;
}

function updateBannerSubcatDropdown(selectId, catId, selectedSub) {
  const el = document.getElementById(selectId);
  if(el) el.innerHTML = getBannerSubcatOptions(catId, selectedSub||'');
}

function getBannerCategorySelect(fieldId, selectedVal, onchangeCall) {
  const opts = [
    {v:'home', n:'🏠 الصفحة الرئيسية'},
    {v:'doctors', n:'🩺 أطباء'},
    {v:'medservices', n:'🏥 خدمات طبية'},
    {v:'jobs', n:'💼 وظائف'},
    {v:'realestate', n:'🏘️ عقارات'},
    {v:'food_rest', n:'🍽️ مطاعم'},
    {v:'food_cafe', n:'☕ كافيهات'},
    {v:'crafts', n:'🔧 صيانة وحرفيين'},
    {v:'building', n:'🏗️ بناء وتشطيب'},
    {v:'online', n:'🛍️ البيع أونلاين'},
    {v:'cars_market', n:'🚙 سوق السيارات والتكاتك'},
    {v:'transport', n:'🚗 مواصلات'},
    {v:'market', n:'📦 سوق'},
    {v:'teachers_hub', n:'📚 مدرسين'},
    {v:'charity', n:'🤍 خيرية'},
    {v:'charity_orgs', n:'🕌 جمعيات خيرية'},
    {v:'all', n:'📢 كل الأقسام'},
  ];
  let html = '<select id="'+fieldId+'" onchange="'+onchangeCall+'" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">';
  opts.forEach(function(o){ html += '<option value="'+o.v+'"'+(o.v===selectedVal?' selected':'')+'>'+o.n+'</option>'; });
  html += '</select>';
  return html;
}

function openAddBannerModal(catId, subName) {
  const old = document.getElementById('addBannerModal');
  if(old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'addBannerModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';
  modal.innerHTML = '<div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:90vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div style="font-size:16px;font-weight:900;">📢 إضافة بانر جديد</div>' +
    '<button onclick="document.getElementById(\'addBannerModal\').remove()" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>' +
    '</div>' +
    '<div class="fg"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">العنوان *</label><input id="bnrTitle" placeholder="مثال: أفضل مطعم في الحامول" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">الوصف</label><input id="bnrSubtitle" placeholder="وصف قصير" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رقم الواتساب</label><input id="bnrPhone" placeholder="01xxxxxxxxx" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📂 القسم</label>' + getBannerCategorySelect("bnrCategory","home","updateBannerSubcatDropdown('bnrSubcat',this.value,'')") + '</div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📁 القسم الفرعي</label><select id="bnrSubcat" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;"><option value="">— للقسم كله —</option></select></div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📅 تاريخ الانتهاء</label><input type="date" id="bnrExpiry" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🖼️ صورة البانر</label>' +
    '<input type="file" id="bnrImageInput" accept="image/*" style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;" onchange="previewBnrImage(this)">' +
    '<div id="bnrImagePreview" style="margin-top:8px;display:none;"><img id="bnrPreviewImg" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;display:block;"></div>' +
    '</div>' +
    '<button onclick="submitNewBanner()" style="width:100%;background:var(--primary);color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:16px;" id="bnrSubmitBtn">💾 حفظ البانر</button>' +
    '</div>';
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  // auto-fill القسم والقسم الفرعي لو اتبعتوا
  if(catId) {
    const catSel = document.getElementById('bnrCategory');
    if(catSel) { catSel.value = catId; updateBannerSubcatDropdown('bnrSubcat', catId, subName||''); }
  }
}

function previewBnrImage(input) {
  const preview = document.getElementById('bnrImagePreview');
  const img = document.getElementById('bnrPreviewImg');
  if(input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; if(preview) preview.style.display='block'; };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitNewBanner() {
  const title = document.getElementById('bnrTitle')?.value.trim();
  const subtitle = document.getElementById('bnrSubtitle')?.value.trim();
  const phone = document.getElementById('bnrPhone')?.value.trim();
  const category = document.getElementById('bnrCategory')?.value.trim() || 'home';
  const subcategory = document.getElementById('bnrSubcat')?.value.trim();
  if(!title) { showToast('اكتب عنوان البانر','error'); return; }
  const btn = document.getElementById('bnrSubmitBtn');
  if(btn) { btn.textContent='⏳ جاري الحفظ...'; btn.disabled=true; }
  try {
    let imageUrl = null;
    const fileInput = document.getElementById('bnrImageInput');
    if(fileInput && fileInput.files && fileInput.files[0]) {
      try {
        imageUrl = await uploadImage(fileInput.files[0]);
      } catch(imgErr) {
        if(btn) { btn.textContent='💾 حفظ البانر'; btn.disabled=false; }
        const errMsg = imgErr.message || '';
        if(errMsg.includes('400') || errMsg.includes('404') || errMsg.includes('bucket')) {
          showToast('❌ خطأ في رفع الصورة — تأكد أن bucket اسمه ads-images موجود في Supabase Storage وعامل Public', 'error');
        } else if(errMsg.includes('401') || errMsg.includes('403')) {
          showToast('❌ مش مسموح برفع الصور — افتح Supabase > Storage > ads-images > Policies وأضف Policy للرفع', 'error');
        } else if(errMsg.includes('413')) {
          showToast('❌ الصورة كبيرة جداً — اختار صورة أصغر من 5MB', 'error');
        } else {
          showToast('❌ فشل رفع الصورة: ' + errMsg.slice(0,60), 'error');
        }
        return;
      }
    }
    await sbFetch('POST', 'banners', {
      title, subtitle: subtitle||null, phone: phone||null,
      category, subcategory: subcategory||null,
      image_url: imageUrl, is_active: true,
      bg_color: '#1a7a4a',
      expires_at: (document.getElementById('bnrExpiry')?.value ? new Date(document.getElementById('bnrExpiry').value).toISOString() : null)
    });
    document.getElementById('addBannerModal')?.remove();
    showToast('✅ تم إضافة البانر!');
    loadAdminBanners();
  } catch(e) {
    showToast('❌ خطأ في الحفظ: ' + (e.message||'').slice(0,60), 'error');
    if(btn) { btn.textContent='💾 حفظ البانر'; btn.disabled=false; }
  }
}

async function editBanner(id) {
  try {
    const banners = await sbFetch('GET', 'banners?id=eq.'+id+'&select=*') || [];
    const b = banners[0];
    if(!b) { showToast('البانر مش موجود','error'); return; }
    const old = document.getElementById('editBannerModal');
    if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'editBannerModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';
    modal.innerHTML = '<div style="background:white;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:90vh;overflow-y:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<div style="font-size:16px;font-weight:900;">✏️ تعديل البانر</div>' +
      '<button onclick="document.getElementById(\'editBannerModal\').remove()" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div class="fg"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">العنوان *</label><input id="eBnrTitle" value="'+(b.title||'')+'" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">الوصف</label><input id="eBnrSubtitle" value="'+(b.subtitle||'')+'" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">رقم الواتساب</label><input id="eBnrPhone" value="'+(b.phone||'')+'" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📅 تاريخ الانتهاء</label><input type="date" id="eBnrExpiry" value="'+(b.expires_at?b.expires_at.split("T")[0]:'')+'" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📂 القسم</label>' + getBannerCategorySelect("eBnrCategory",(b.category||'home'),"updateBannerSubcatDropdown('eBnrSubcat',this.value,'')") + '</div>' +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📁 القسم الفرعي</label><select id="eBnrSubcat" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;box-sizing:border-box;background:white;">' + getBannerSubcatOptions((b.category||'home'),(b.subcategory||'')) + '</select></div>' +
      (b.image_url?'<div style="margin-top:10px;"><div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px;">الصورة الحالية:</div><img src="'+b.image_url+'" style="width:100%;max-height:80px;object-fit:cover;border-radius:8px;display:block;" onerror="this.style.display=\'none\'"></div>':'') +
      '<div class="fg" style="margin-top:10px;"><label style="font-size:11px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🖼️ تغيير الصورة</label>' +
      '<input type="file" id="eBnrImageInput" accept="image/*" style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;"></div>' +
      '<button data-bid="'+id+'" onclick="saveEditBanner(this.dataset.bid)" style="width:100%;background:var(--primary);color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-top:16px;" id="eBnrSubmitBtn">💾 حفظ التعديلات</button>' +
      '</div>';
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch(e) { showToast('خطأ في تحميل البانر','error'); }
}

async function saveEditBanner(id) {
  if(!id || id === 'undefined' || id === '') { showToast('❌ خطأ: ID البانر مش موجود','error'); return; }
  const title = document.getElementById('eBnrTitle')?.value.trim();
  const subtitle = document.getElementById('eBnrSubtitle')?.value.trim();
  const phone = document.getElementById('eBnrPhone')?.value.trim();
  const category = document.getElementById('eBnrCategory')?.value.trim() || 'home';
  const subcategory = document.getElementById('eBnrSubcat')?.value.trim();
  if(!title) { showToast('اكتب عنوان البانر','error'); return; }
  const btn = document.getElementById('eBnrSubmitBtn');
  if(btn) { btn.textContent='⏳ جاري الحفظ...'; btn.disabled=true; }
  try {
    const expiryInput = document.getElementById('eBnrExpiry')?.value;
    const updates = { title, category, subcategory: subcategory || null };
    if(subtitle) updates.subtitle = subtitle; else updates.subtitle = null;
    if(phone) updates.phone = phone; else updates.phone = null;
    if(expiryInput) updates.expires_at = new Date(expiryInput).toISOString(); else updates.expires_at = null;
    const fileInput = document.getElementById('eBnrImageInput');
    if(fileInput && fileInput.files && fileInput.files[0]) {
      try {
        updates.image_url = await uploadImage(fileInput.files[0]);
      } catch(imgErr) {
        if(btn) { btn.textContent='💾 حفظ التعديلات'; btn.disabled=false; }
        const errMsg = imgErr.message || '';
        if(errMsg.includes('400') || errMsg.includes('404') || errMsg.includes('bucket')) {
          showToast('❌ خطأ في رفع الصورة — تأكد أن bucket اسمه ads-images موجود في Supabase Storage وعامل Public', 'error');
        } else if(errMsg.includes('401') || errMsg.includes('403')) {
          showToast('❌ مش مسموح برفع الصور — افتح Supabase > Storage > ads-images > Policies وأضف Policy للرفع', 'error');
        } else if(errMsg.includes('413')) {
          showToast('❌ الصورة كبيرة جداً — اختار صورة أصغر من 5MB', 'error');
        } else {
          showToast('❌ فشل رفع الصورة: ' + errMsg.slice(0,60), 'error');
        }
        return;
      }
    }
    // جرب PATCH أولاً
    const patchRes = await fetch(SB_URL+'/rest/v1/banners?id=eq.'+id, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updates)
    });
    if(!patchRes.ok) {
      const errText = await patchRes.text().catch(()=>'');
      throw new Error('PATCH failed ' + patchRes.status + ': ' + errText.slice(0,100));
    }
    document.getElementById('editBannerModal')?.remove();
    showToast('✅ تم حفظ التعديلات!');
    loadAdminBanners();
  } catch(e) {
    const msg = e.message || '';
    if(msg.includes('PGRST204') || msg.includes('204')) {
      // PGRST204 = no rows matched - ID مش موجود أو RLS مش سامح
      showToast('❌ البانر مش موجود في قاعدة البيانات أو مش مسموح بالتعديل — تأكد من RLS في Supabase', 'error');
    } else {
      showToast('❌ خطأ: ' + msg.slice(0,80), 'error');
    }
    if(btn) { btn.textContent='💾 حفظ التعديلات'; btn.disabled=false; }
  }
}

// BANNERS SYSTEM
let _homeBannersData = [];
let _homeBannerIndex = 0;
let _homeBannerTimer = null;

async function loadHomeBanners() {
  const cont = document.getElementById('homeBanners');
  if(!cont) return;
  try {
    const nowDate = new Date();
    const allBanners = await sbFetch('GET', 'banners?select=*') || [];
    _homeBannerIndex = 0;
    _homeBannersData = allBanners.filter(function(b){
      return b.is_active && b.category === 'home' && (!b.expires_at || new Date(b.expires_at) > nowDate);
    });
    if(!_homeBannersData.length) { cont.style.display='none'; return; }
    cont.style.display = 'block';

    var html = '<div style="position:relative;width:100%;border-radius:14px;overflow:hidden;" id="homeBannerSlider">';
    _homeBannersData.forEach(function(b, i) {
      var phone = b.phone || '';
      if(phone.startsWith('01')) phone = '20' + phone.substring(1);
      html += '<div class="hb-slide" id="hbslide-'+i+'" style="display:'+(i===0?'block':'none')+';width:100%;">';
      if(b.image_url) {
        html += '<img src="'+b.image_url+'" style="width:100%;max-height:280px;min-height:150px;object-fit:cover;display:block;" onerror="this.onerror=null;this.style.display=\'none\'">';
      } else {
        html += '<div style="background:'+(b.bg_color||'#1a7a4a')+';padding:20px;min-height:120px;display:flex;align-items:center;gap:12px;">';
        html += '<div style="font-size:32px;">📢</div>';
        html += '<div><div style="font-size:15px;font-weight:900;color:white;">'+(b.title||'')+'</div>';
        if(b.subtitle) html += '<div style="font-size:12px;color:rgba(255,255,255,.85);margin-top:3px;">'+b.subtitle+'</div>';
        html += '</div></div>';
      }
      html += '<div style="position:absolute;top:8px;right:10px;background:rgba(0,0,0,.55);color:white;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">إعلان ممول</div>';
      if(phone) {
        var waMsg = encodeURIComponent('السلام عليكم، رأيت إعلانكم على دليل الحامول وأريد الاستفسار');
        html += '<a href="https://wa.me/'+phone+'?text='+waMsg+'" target="_blank" onclick="trackBannerStat(this.dataset.bid,this.dataset.ev)" data-bid="'+b.id+'" data-ev="whatsapp" style="display:block;background:#25D366;color:white;text-align:center;padding:8px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;text-decoration:none;">📞 تواصل واتساب</a>';
      }
      html += '</div>';
    });
    if(_homeBannersData.length > 1) {
      html += '<div id="homeBannerDots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2;">';
      _homeBannersData.forEach(function(_,i) {
        html += '<div onclick="goHomeBanner('+i+')" style="width:'+(i===0?'18':'8')+'px;height:8px;border-radius:4px;background:'+(i===0?'white':'rgba(255,255,255,.5)')+';cursor:pointer;transition:all .3s;"></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    cont.innerHTML = html;

    if(_homeBannersData.length > 1) {
      if(_homeBannerTimer) clearInterval(_homeBannerTimer);
      _homeBannerTimer = setInterval(function(){ moveHomeBanner(1); }, 4000);
    }
    if(_homeBannersData[0]) trackBannerStat(_homeBannersData[0].id, 'view');


  } catch(e) { console.warn('homeBanners err:', e); }
}

function goHomeBanner(idx) {
  var slides = document.querySelectorAll('.hb-slide');
  slides.forEach(function(s,i){ s.style.display = i===idx ? 'block' : 'none'; });
  _homeBannerIndex = idx;
  var dots = document.querySelectorAll('#homeBannerDots div');
  dots.forEach(function(d,i){
    d.style.width = i===idx ? '18px' : '8px';
    d.style.background = i===idx ? 'white' : 'rgba(255,255,255,.5)';
  });
  if(_homeBannersData[idx]) trackBannerStat(_homeBannersData[idx].id, 'view');
}

function moveHomeBanner(dir) {
  var next = _homeBannerIndex + dir;
  if(next < 0) next = _homeBannersData.length - 1;
  if(next >= _homeBannersData.length) next = 0;
  goHomeBanner(next);
}



// ===== STATS CHART =====
// ===== CHART SYSTEM =====
let _chartAdStats = [];
let _currentChartPeriod = '7d';

function renderViewsChart(adStats) {
  _chartAdStats = adStats || [];
  setChartPeriod('7d');
}

function setChartPeriod(period) {
  _currentChartPeriod = period;
  // Update button styles
  ['7d','30d','3m','1y','custom'].forEach(p => {
    const btn = document.getElementById('cf_'+p);
    if(!btn) return;
    if(p === period) {
      btn.style.background = '#0284c7'; btn.style.color = 'white'; btn.style.borderColor = '#0284c7';
    } else {
      btn.style.background = 'white'; btn.style.color = '#64748b'; btn.style.borderColor = '#e2e8f0';
    }
  });
  const customDiv = document.getElementById('customDateRange');
  if(customDiv) customDiv.style.display = period === 'custom' ? 'flex' : 'none';
  if(period !== 'custom') drawChart(period, null, null);
}

function applyCustomDateRange() {
  const from = document.getElementById('chartDateFrom')?.value;
  const to = document.getElementById('chartDateTo')?.value;
  if(!from || !to) { showToast('اختار تاريخ البداية والنهاية','error'); return; }
  drawChart('custom', from, to);
}

function drawChart(period, customFrom, customTo) {
  const canvas = document.getElementById('viewsChart');
  if(!canvas) return;

  const now = new Date();
  let fromDate, toDate = new Date(now);
  toDate.setHours(23,59,59,999);

  if(period === '7d')  { fromDate = new Date(now); fromDate.setDate(fromDate.getDate()-6); }
  else if(period === '30d') { fromDate = new Date(now); fromDate.setDate(fromDate.getDate()-29); }
  else if(period === '3m')  { fromDate = new Date(now); fromDate.setMonth(fromDate.getMonth()-3); }
  else if(period === '1y')  { fromDate = new Date(now); fromDate.setFullYear(fromDate.getFullYear()-1); }
  else if(period === 'custom') { fromDate = new Date(customFrom); toDate = new Date(customTo); toDate.setHours(23,59,59,999); }

  fromDate.setHours(0,0,0,0);

  // فلتر البيانات حسب الفترة
  const filtered = _chartAdStats.filter(s => {
    if(!s.created_at) return false;
    const d = new Date(s.created_at);
    return d >= fromDate && d <= toDate;
  });

  // حساب الإجماليات
  const totalV = filtered.filter(s=>s.event_type==='view').length;
  const totalW = filtered.filter(s=>s.event_type==='whatsapp').length;
  const convRate = totalV > 0 ? Math.round((totalW/totalV)*100) : 0;
  const tvEl = document.getElementById('totalViewsNum');
  const twEl = document.getElementById('totalWaNum');
  const crEl = document.getElementById('convRateNum');
  if(tvEl) tvEl.textContent = totalV.toLocaleString('ar-EG');
  if(twEl) twEl.textContent = totalW.toLocaleString('ar-EG');
  if(crEl) crEl.textContent = convRate + '%';

  // تحديد عدد النقاط والتجميع
  const diffDays = Math.ceil((toDate - fromDate) / (1000*60*60*24));
  let points, groupBy;
  if(diffDays <= 31)       { points = diffDays+1; groupBy = 'day'; }
  else if(diffDays <= 100) { points = Math.ceil(diffDays/7); groupBy = 'week'; }
  else                     { points = Math.ceil(diffDays/30); groupBy = 'month'; }
  points = Math.min(points, 24);

  const labels = [], viewsData = [], waData = [];
  for(let i=0; i<points; i++) {
    const start = new Date(fromDate);
    const end = new Date(fromDate);
    if(groupBy==='day')   { start.setDate(start.getDate()+i); end.setDate(end.getDate()+i+1); }
    else if(groupBy==='week')  { start.setDate(start.getDate()+i*7); end.setDate(end.getDate()+i*7+7); }
    else if(groupBy==='month') { start.setMonth(start.getMonth()+i); end.setMonth(end.getMonth()+i+1); }

    let label;
    if(groupBy==='day') label = start.toLocaleDateString('ar-EG',{day:'numeric',month:'numeric'});
    else if(groupBy==='week') label = start.toLocaleDateString('ar-EG',{day:'numeric',month:'numeric'});
    else label = start.toLocaleDateString('ar-EG',{month:'short'});

    labels.push(label);
    const grpStats = filtered.filter(s => { const d=new Date(s.created_at); return d>=start && d<end; });
    viewsData.push(grpStats.filter(s=>s.event_type==='view').length);
    waData.push(grpStats.filter(s=>s.event_type==='whatsapp').length);
  }

  // رسم الـ canvas
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.offsetWidth - 28 || 300;
  canvas.width = W;
  canvas.height = 160;
  const H = 160;

  const maxVal = Math.max(...viewsData, ...waData, 1);
  const padL = 32, padR = 8, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = labels.length;
  const barW = Math.max(3, Math.min(14, (chartW/n)*0.3));
  const gap = chartW / n;

  ctx.clearRect(0, 0, W, H);

  // Grid
  for(let i=0; i<=4; i++) {
    const y = padT + chartH - (i/4)*chartH;
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Cairo'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal*i/4), padL-3, y+3);
  }

  // Bars
  for(let i=0; i<n; i++) {
    const x = padL + i*gap + gap/2;
    const vH = Math.max(2, (viewsData[i]/maxVal)*chartH);
    const wH = Math.max(waData[i]>0?2:0, (waData[i]/maxVal)*chartH);

    // Views
    const vGrad = ctx.createLinearGradient(0, padT+chartH-vH, 0, padT+chartH);
    vGrad.addColorStop(0,'#38bdf8'); vGrad.addColorStop(1,'#0284c7');
    ctx.fillStyle = vGrad;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x-barW-1, padT+chartH-vH, barW, vH, [3,3,0,0]);
    else ctx.rect(x-barW-1, padT+chartH-vH, barW, vH);
    ctx.fill();

    // WA
    if(waData[i] > 0) {
      const wGrad = ctx.createLinearGradient(0, padT+chartH-wH, 0, padT+chartH);
      wGrad.addColorStop(0,'#4ade80'); wGrad.addColorStop(1,'#16a34a');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x+1, padT+chartH-wH, barW, wH, [3,3,0,0]);
      else ctx.rect(x+1, padT+chartH-wH, barW, wH);
      ctx.fill();
    }

    // Label (كل كذا نقطة)
    if(i % Math.ceil(n/8) === 0 || i === n-1) {
      ctx.fillStyle = '#64748b'; ctx.font = '8px Cairo'; ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, H-8);
    }
  }
}

// ===== POPUP BANNER SYSTEM =====
async function trackBannerStat(bannerId, eventType) {
  try {
    await fetch(SB_URL+'/rest/v1/banner_stats', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},
      body: JSON.stringify({banner_id: bannerId, event_type: eventType})
    });
  } catch(e) {}
}

async function showPopupBanner(catId, subName, onClose) {
  try {
    const allBanners = await sbFetch('GET', 'banners?select=*') || [];
    const now = new Date();
    const active = allBanners.filter(b => b.is_active && (!b.expires_at || new Date(b.expires_at) > now));
    // نفس أولوية البحث
    const banner = (subName ? active.find(b => b.category === catId && b.subcategory === subName) : null)
                || active.find(b => b.category === catId && (!b.subcategory || b.subcategory === ''))
                || active.find(b => b.category === 'all' && (!b.subcategory || b.subcategory === ''))
                || null;
    if(!banner || !banner.image_url) { if(onClose) onClose(); return; }

    // track view
    trackBannerStat(banner.id, 'view');

    let phone = banner.phone || '';
    if(phone.startsWith('01')) phone = '20' + phone.substring(1);

    const overlay = document.createElement('div');
    overlay.id = 'popupBannerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;';

    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;width:100%;max-width:420px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <!-- زرار الإغلاق -->
        <button id="popupCloseBtn" style="position:absolute;top:10px;left:10px;z-index:10;background:rgba(0,0,0,.6);color:white;border:none;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">✕</button>
        <!-- شارة إعلان ممول -->
        <div style="position:absolute;top:10px;right:10px;z-index:10;background:rgba(0,0,0,.55);color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">إعلان ممول</div>
        <!-- الصورة -->
        <img src="${banner.image_url}" style="width:100%;max-height:340px;object-fit:contain;background:#000;display:block;" onerror="this.style.display='none'">
        <!-- المعلومات -->
        <div style="padding:16px;">
          <div style="font-size:16px;font-weight:900;color:#1e293b;margin-bottom:4px;">${banner.title}</div>
          ${banner.subtitle ? `<div style="font-size:13px;color:#64748b;margin-bottom:12px;">${banner.subtitle}</div>` : '<div style="margin-bottom:12px;"></div>'}
          <div style="display:flex;gap:10px;">
            ${phone ? `<a href="https://wa.me/${phone}?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85+%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C+%D8%B1%D8%A3%D9%8A%D8%AA+%D8%A5%D8%B9%D9%84%D8%A7%D9%86%D9%83%D9%85+%D8%B9%D9%84%D9%89+%D8%AF%D9%84%D9%8A%D9%84+%D8%A7%D9%84%D8%AD%D8%A7%D9%85%D9%88%D9%84+%D9%88%D8%A3%D8%B1%D9%8A%D8%AF+%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1" target="_blank" id="popupWaBtn" style="flex:1;background:#25D366;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;text-align:center;text-decoration:none;display:block;">📞 تواصل واتساب</a>` : ''}
            <button id="popupSkipBtn" style="flex:1;background:#f3f4f6;color:#374151;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">تخطي ←</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    function closePopup() {
      overlay.remove();
      if(onClose) onClose();
    }

    document.getElementById('popupCloseBtn').onclick = closePopup;
    document.getElementById('popupSkipBtn').onclick = closePopup;

    if(phone) {
      document.getElementById('popupWaBtn').onclick = function() {
        trackBannerStat(banner.id, 'whatsapp');
        closePopup();
      };
    }

    // إغلاق لو ضغط برا
    overlay.addEventListener('click', function(e) {
      if(e.target === overlay) closePopup();
    });

    // إظهار الأدمن زرار تعديل
    if(isAdmin) {
      const editBtn = document.createElement('button');
      editBtn.style.cssText = 'position:absolute;bottom:10px;left:10px;z-index:10;background:rgba(255,255,255,.9);color:#1d4ed8;border:none;padding:4px 10px;border-radius:8px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;';
      editBtn.textContent = '✏️ تعديل';
      editBtn.onclick = function(e) { e.stopPropagation(); overlay.remove(); editBanner(banner.id); };
      overlay.querySelector('div').appendChild(editBtn);
    }

  } catch(e) { if(onClose) onClose(); }
}

async function loadCatBanner(catId, subName) {
  const cont = document.getElementById('catBanner');
  if(!cont) return;
  try {
    const allBanners = await sbFetch('GET', 'banners?select=*') || [];
    const nowDate = new Date();
    const active = allBanners.filter(function(b){ return b.is_active && (!b.expires_at || new Date(b.expires_at) > nowDate); });
    // أولوية البحث:
    // 1. بانر خاص بالـ subcategory بالظبط
    // 2. بانر للـ category بدون subcategory (عام للقسم كله)
    // 3. بانر category = all (عام لكل الأقسام)
    // مش بنعرض بانر subcategory تاني حتى لو نفس الـ category
    const banner = (subName ? active.find(function(b){ return b.category === catId && b.subcategory === subName; }) : null)
                || active.find(function(b){ return b.category === catId && (!b.subcategory || b.subcategory === ''); })
                || active.find(function(b){ return b.category === 'all' && (!b.subcategory || b.subcategory === ''); })
                || null;

    if(!banner) {
      // Fallback: hardcoded paidBanner
      if(paidBanners && paidBanners.length > 0) {
        const pb = paidBanners[0];
        let html = '<div style="margin:0 0 12px;border-radius:12px;overflow:hidden;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer;"';
        if(pb.link) html += ' onclick="window.open(\'' + pb.link + '\',\'_blank\')"';
        html += '>';
        html += '<div style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,.55);color:white;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;z-index:1;">إعلان ممول</div>';
        html += '<img src="' + (pb.image_url||pb.img||'') + '" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:12px;">';
        html += '</div>';
        if(isAdmin) {
          html += '<div onclick="openAddBannerModal(\''+catId+'\',\''+subName+'\')" style="background:#fef9c3;border:2px dashed #ca8a04;border-radius:10px;padding:10px;margin-bottom:8px;text-align:center;cursor:pointer;font-size:12px;font-weight:700;color:#92400e;">📢 + أضف إعلان ممول لهذا القسم</div>';
        }
        cont.innerHTML = html;
      } else if(isAdmin) {
        cont.innerHTML = '<div onclick="openAddBannerModal(\''+catId+'\',\''+subName+'\')" style="background:#fef9c3;border:2px dashed #ca8a04;border-radius:10px;padding:12px;margin:0 0 12px;text-align:center;cursor:pointer;font-size:12px;font-weight:700;color:#92400e;">📢 + أضف إعلان ممول لهذا القسم</div>';
      }
      return;
    }

    var phone = banner.phone || '';
    if(phone.startsWith('01')) phone = '20' + phone.substring(1);

    var html = '<div style="margin:0 0 12px;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;"';
    if(phone) html += ' onclick="window.open(\'https://wa.me/' + phone + '\',\'_blank\')"';
    html += '>';

    if(banner.image_url) {
      html += '<div style="position:relative;">';
      html += '<div style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,.55);color:white;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;z-index:1;">إعلان ممول</div>';
      html += '<img src="' + banner.image_url + '" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:12px;">';
      if(phone) html += '<div style="background:#25D366;color:white;text-align:center;padding:6px;font-size:12px;font-weight:700;">📞 تواصل واتساب</div>';
      html += '</div>';
    } else {
      html += '<div style="background:' + (banner.bg_color||'#1a7a4a') + ';padding:12px 14px;display:flex;align-items:center;gap:12px;position:relative;">';
      html += '<div style="position:absolute;top:6px;right:8px;background:rgba(255,255,255,.25);color:white;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">إعلان ممول</div>';
      html += '<div style="width:48px;height:48px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;margin-top:8px;">📢</div>';
      html += '<div style="flex:1;padding-top:8px;">';
      html += '<div style="color:white;font-size:14px;font-weight:900;">' + banner.title + '</div>';
      if(banner.subtitle) html += '<div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:3px;">' + banner.subtitle + '</div>';
      if(banner.phone) html += '<div style="color:rgba(255,255,255,.8);font-size:11px;margin-top:4px;">📞 ' + banner.phone + '</div>';
      html += '</div>';
      if(isAdmin) html += '<button data-bid="' + banner.id + '" onclick="event.stopPropagation();editBanner(this.getAttribute(\'data-bid\'))" style="background:rgba(255,255,255,.2);color:white;border:none;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;flex-shrink:0;">✏️</button>';
      html += '</div>';
    }

    if(isAdmin && banner.image_url) {
      html += '<button data-bid="' + banner.id + '" onclick="event.stopPropagation();editBanner(this.getAttribute(\'data-bid\'))" style="display:block;width:100%;background:#f3f4f6;color:#374151;border:none;padding:6px;font-size:11px;cursor:pointer;font-family:\'Cairo\',sans-serif;">✏️ تعديل الإعلان</button>';
    }
    html += '</div>';
    cont.innerHTML = html;
  } catch(e) { console.warn('banner err:', e); }
}

function renderAdminAdsList(cont, ads, tab) {
  if(!cont) return;
  if(!ads.length) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray);"><div style="font-size:40px;margin-bottom:12px;">✨</div><p>مفيش إعلانات هنا</p></div>';
    return;
  }
  cont.innerHTML = ads.map(ad => {
    const date = new Date(ad.created_at).toLocaleDateString('ar-EG');
    return '<div style="background:white;border-radius:12px;padding:12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
      '<div style="font-size:13px;font-weight:900;color:#1e293b;flex:1;">' + escapeHtml(ad.title||'') + '</div>' +
      '<span style="background:' + (tab==='pending'?'#fef3c7':tab==='approved'?'#dcfce7':'#fee2e2') + ';color:' + (tab==='pending'?'#92400e':tab==='approved'?'#166534':'#991b1b') + ';padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;flex-shrink:0;margin-right:6px;">' + (ad.category||'') + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--gray);margin-bottom:8px;">📞 ' + (ad.phone||'—') + ' | 📅 ' + date + (ad.subcategory?' | '+ad.subcategory:'') + '</div>' +
      (ad.image_url ? '<img src="'+ad.image_url+'" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:8px;display:block;">' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
      (tab==='approved' ? (function(){
        var orderDiv = document.createElement('div');
        orderDiv.dataset.adid = ad.id;
        orderDiv.dataset.cat = ad.category;
        orderDiv.dataset.sub = ad.subcategory||'';
        return '<div style="display:flex;align-items:center;gap:6px;width:100%;margin-bottom:6px;background:#f8fafc;border-radius:8px;padding:6px 10px;">' +
          '<span style="font-size:11px;color:#64748b;font-weight:700;white-space:nowrap;">ترتيب:</span>' +
          '<input type="number" value="'+(ad.sponsored_order||0)+'" min="0" max="999" data-adid="'+ad.id+'" onchange="updateAdOrder(this.dataset.adid,this.value)" style="width:55px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-weight:700;text-align:center;">' +
          '<span style="font-size:10px;color:#94a3b8;">↑ أكبر = أول</span>' +
          '<button data-adid="'+ad.id+'" data-cat="'+ad.category+'" data-sub="'+(ad.subcategory||'')+'" onclick="moveAdToCategory(this.dataset.adid,this.dataset.cat,this.dataset.sub)" style="margin-right:auto;background:#dbeafe;color:#1d4ed8;border:none;padding:4px 10px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📂 نقل</button>' +
          '</div>';
      })() : '') +
      (tab==='pending' ? (
        '<button data-id="'+ad.id+'" onclick="approveAd(this.dataset.id)" style="flex:1;background:var(--green);color:white;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✅ موافقة</button>' +
        '<button data-id="'+ad.id+'" onclick="openRejectReasonModal(this.dataset.id)" style="flex:1;background:#ef4444;color:white;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">❌ رفض</button>'
      ) : '') +
      (tab==='rejected' ? '<button data-id="'+ad.id+'" onclick="approveAd(this.dataset.id)" style="flex:1;background:var(--green);color:white;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✅ موافقة</button>' : '') +
      '<button data-id="'+ad.id+'" onclick="openEditAd(this.dataset.id)" style="background:#eff6ff;color:#2563eb;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✏️ تعديل</button>' +
      '<button data-id="'+ad.id+'" onclick="deleteAdAdmin(this.dataset.id)" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:8px;font-size:14px;cursor:pointer;">🗑️</button>' +

      '</div></div>';
  }).join('');
}


// ===== إعادة فتح آخر صفحة كانت مفتوحة بعد عمل Refresh للصفحة =====
function restoreOnRefresh() {
  try {
    const raw = sessionStorage.getItem('dynState');
    if(!raw) return;
    const state = JSON.parse(raw);
    if(!state || !state.type) return;
    switch(state.type) {
      case 'ads': {
        const cat = CATEGORIES.find(c => c.id === state.catId);
        if(cat) showAdsPage(cat, state.sub || null);
        break;
      }
      case 'subs': {
        const cat = CATEGORIES.find(c => c.id === state.catId);
        if(cat) showSubsPage(cat);
        break;
      }
      case 'children': {
        const cat = CATEGORIES.find(c => c.id === state.catId);
        if(cat) showChildrenPage(cat);
        break;
      }
      case 'subs2': {
        const parent = CATEGORIES.find(c => c.id === state.catId);
        const child = parent && parent.children ? parent.children.find(c => c.id === state.childId) : null;
        if(parent && child) showSubsPageV2(parent, child);
        break;
      }
      case 'ads2':
        if(state.catId && state.childId && state.subName) showAdsPageV2(state.catId, state.childId, state.subName);
        break;
      case 'shops':
        if(state.sub) showShopsPage(state.sub, state.catId || getShopCatId(state.sub));
        break;
      case 'shop_detail':
        if(state.traderId) openShop(state.traderId);
        break;
      case 'ad_detail':
        if(state.adId) openAdDetails(state.adId);
        break;
      case 'community': showCommunityPage('all'); break;
      case 'teachers_hub': showTeachersHub(); break;
      case 'doctors': showDoctorsHub(); break;
      case 'doctors_community': showDoctorsCommunity(); break;
      case 'news': showNewsPage(); break;
      case 'charity': showCharityPage(); break;
      case 'marriage': showMarriagePage(state.filter || 'all'); break;
      case 'favorites': showFavorites(); break;
      case 'deals': showDeals(); break;
      case 'search': showSearchPage(); break;
      case 'transport_news': showTransportPage(); break;
      case 'market_prices': showMarketPrices(); break;
      case 'prayer': showPrayerTimes(); break;
      case 'emergency': showEmergencyPage(); break;
      case 'daily_tips': showTipsPage(); break;
      case 'more': showMore(); break;
      default:
        // صفحات مؤقتة زي الإضافة/التعديل/لوحة الأدمن — أأمن إننا نرجّع للرئيسية بدل ما نفتحها بحالة ناقصة
        sessionStorage.removeItem('dynState');
        break;
    }
  } catch(e) { console.warn('restoreOnRefresh failed:', e); }
}

// ===== بوب أب تحفيزي للتسجيل المبكر =====
// ===== زرار "سجّل نشاطك" العام في الصفحة الرئيسية — قائمة كل الأنشطة عشان أي حد يلاقي نفسه من غير ما يعرف يدخل قسمه فين =====
function openBusinessRegisterPicker(mode) {
  mode = mode || 'register';
  var items = [];
  CATEGORIES.forEach(function(cat) {
    if(SHOP_ONLY_CAT_IDS.indexOf(cat.id) !== -1 && cat.subs && cat.subs.length) {
      cat.subs.forEach(function(s) {
        items.push({ parent: cat.name, icon: cat.icon, catId: cat.id, sub: s });
      });
    }
    if(cat.children) {
      cat.children.forEach(function(child) {
        if(NESTED_SHOP_CHILDREN.indexOf(child.id) !== -1 && child.subs && child.subs.length) {
          child.subs.forEach(function(s) {
            var subName = (typeof s === 'string') ? s : s.name;
            items.push({ parent: cat.name + ' — ' + child.name, icon: child.icon || cat.icon, catId: child.id, sub: subName });
          });
        }
      });
    }
  });

  var overlay = document.createElement('div');
  overlay.id = 'bizRegPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:20px 20px 0 0;padding:18px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;">' +
      '<div style="font-size:16px;font-weight:900;text-align:center;margin-bottom:4px;">' + (mode === 'login' ? '✏️ نشاطك إيه بالظبط؟' : '🏪 نشاطك إيه بالظبط؟') + '</div>' +
      '<div style="font-size:12px;color:#64748b;text-align:center;margin-bottom:12px;">' + (mode === 'login' ? 'دوس على نشاطك عشان تسجّل دخول وتعدّل بياناتك' : 'دوس على نشاطك عشان تبدأ التسجيل على طول') + '</div>' +
      '<input id="bizRegSearch" type="text" placeholder="🔍 دوّر على نشاطك (مثال: كافيه، سباك، صيدلية)..." oninput="filterBizRegPicker()" style="width:100%;padding:11px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;margin-bottom:10px;box-sizing:border-box;">' +
      '<div id="bizRegPickerList" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;"></div>' +
      '<button onclick="document.getElementById(\'bizRegPickerOverlay\').remove()" style="margin-top:12px;background:#f3f4f6;color:#666;border:none;padding:12px;border-radius:12px;font-family:Cairo,sans-serif;font-size:13px;cursor:pointer;">إلغاء</button>' +
    '</div>';
  document.body.appendChild(overlay);
  window._bizRegPickerItems = items;
  window._bizRegPickerMode = mode;
  renderBizRegPickerList(items);
}
function renderBizRegPickerList(items) {
  var list = document.getElementById('bizRegPickerList');
  if(!list) return;
  var mode = window._bizRegPickerMode || 'register';
  if(items.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px;">مفيش نتائج — جرب كلمة تانية</div>';
    return;
  }
  var lastParent = null;
  var html = '';
  items.forEach(function(it) {
    if(it.parent !== lastParent) {
      html += '<div style="font-size:11px;font-weight:900;color:#7c3aed;margin-top:8px;">' + it.parent + '</div>';
      lastParent = it.parent;
    }
    var action = mode === 'login'
      ? "document.getElementById('bizRegPickerOverlay').remove();showShopLogin('" + it.sub.replace(/'/g,"\\'") + "')"
      : "document.getElementById('bizRegPickerOverlay').remove();showShopRegister('" + it.sub.replace(/'/g,"\\'") + "','" + it.catId + "')";
    html += '<div onclick="' + action + '" style="background:#f5f3ff;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;">' +
      '<span style="font-size:18px;">' + it.icon + '</span><span style="font-size:13px;font-weight:700;color:#4c1d95;">' + it.sub + '</span>' +
    '</div>';
  });
  list.innerHTML = html;
}
function filterBizRegPicker() {
  var q = (document.getElementById('bizRegSearch').value || '').trim();
  var items = window._bizRegPickerItems || [];
  if(!q) { renderBizRegPickerList(items); return; }
  var filtered = items.filter(function(it) { return it.sub.indexOf(q) !== -1 || it.parent.indexOf(q) !== -1; });
  renderBizRegPickerList(filtered);
}

function maybeShowRegisterUrgencyPopup() {
  if(isAdmin) return;
  var lastShown = localStorage.getItem('reg_urgency_popup_last');
  var now = Date.now();
  if(lastShown && (now - parseInt(lastShown)) < 24 * 60 * 60 * 1000) return; // مرة كل يوم بس
  setTimeout(function() {
    if(document.getElementById('regUrgencyOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'regUrgencyOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="background:white;border-radius:18px;max-width:360px;width:100%;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3);position:relative;">' +
        '<button onclick="closeRegUrgencyPopup()" style="position:absolute;top:10px;left:10px;background:rgba(255,255,255,.9);border:none;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;z-index:2;">✕</button>' +
        '<div style="background:linear-gradient(135deg,#1a7a4a,#0e5c33);padding:24px 20px;text-align:center;color:white;">' +
          '<div style="font-size:40px;margin-bottom:8px;">🚀</div>' +
          '<div style="font-size:17px;font-weight:900;">سجّل نشاطك دلوقتي وكن الأول!</div>' +
        '</div>' +
        '<div style="padding:18px 20px;text-align:center;">' +
          '<p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 16px;">الأماكن الأولى في كل قسم بتاخد أكبر نسبة مشاهدة. سجّل نشاطك أو خدمتك دلوقتي عشان تظهر من أوائل النتائج قبل ما الأماكن تتزحم.</p>' +
          '<button onclick="closeRegUrgencyPopup();openBusinessRegisterPicker();" style="width:100%;background:#1a7a4a;color:white;border:none;padding:13px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">سجّل نشاطي دلوقتي 🚀</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    localStorage.setItem('reg_urgency_popup_last', String(Date.now()));
  }, 2500);
}
function closeRegUrgencyPopup() {
  var el = document.getElementById('regUrgencyOverlay');
  if(el) el.remove();
}

// ===== INIT =====
// ===== PWA: تسجيل Service Worker (مطلوب على أغلب الموبايلات عشان التثبيت يبقى تطبيق حقيقي مش مجرد اختصار) =====
// تنبيه لمستخدمي الآيفون اللي فاتحين الموقع من متصفح غير Safari — عشان يعرفوا إن التثبيت مش هيشتغل غير من Safari
(function(){
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua);
  var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  var isStandalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if(isIOS && !isSafari && !isStandalone && !localStorage.getItem('ios_safari_banner_dismissed')) {
    var banner = document.createElement('div');
    banner.id = 'iosSafariBanner';
    banner.style.cssText = 'position:fixed;bottom:66px;left:10px;right:10px;z-index:9998;background:#1e293b;color:white;padding:12px 14px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px;font-family:Cairo,sans-serif;';
    banner.innerHTML = '<div style="font-size:22px;">🧭</div>' +
      '<div style="flex:1;font-size:11.5px;line-height:1.7;">عشان تقدر تثبّت التطبيق على آيفون، افتح الموقع من متصفح <strong>Safari</strong> بدل المتصفح الحالي 📲</div>' +
      '<button onclick="document.getElementById(\'iosSafariBanner\').remove();localStorage.setItem(\'ios_safari_banner_dismissed\',\'1\')" style="background:rgba(255,255,255,.2);border:none;color:white;width:24px;height:24px;border-radius:50%;font-size:14px;cursor:pointer;flex-shrink:0;">×</button>';
    document.body.appendChild(banner);
  }
})();

if('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(e) {
      console.warn('service worker registration failed', e);
    });
  });
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

var deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  try { var b = document.getElementById('installBtn'); if(b) b.style.display = 'flex'; } catch(e2) {}
});
window.addEventListener('appinstalled', function() {
  deferredInstallPrompt = null;
  try { var b = document.getElementById('installBtn'); if(b) b.style.display = 'none'; } catch(e2) {}
  try { showToast('✅ تم تثبيت التطبيق بنجاح'); } catch(e3) {}
  try { trackAppInstall(); } catch(e4) {}
});

function detectInstallPlatform() {
  var ua = navigator.userAgent || '';
  if(/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if(/android/i.test(ua)) return 'android';
  return 'desktop';
}

async function trackAppInstall() {
  try {
    if(localStorage.getItem('hamoul_install_logged')) return; // مرة واحدة بس لكل جهاز
    localStorage.setItem('hamoul_install_logged', '1');
    var vid = localStorage.getItem('hamoul_visitor_id');
    if(!vid) { vid = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2,9); localStorage.setItem('hamoul_visitor_id', vid); }
    await sbFetch('POST', 'app_installs', { device_id: vid, platform: detectInstallPlatform() });
  } catch(e) {}
}

// لو الموقع شغال دلوقتي في وضع standalone (اتثبت فعلاً) وأول مرة نكتشف ده — سجّله
// ده بيغطي آيفون كمان، لأن Safari مبيطلقش appinstalled أبدًا
try { if(isStandaloneMode()) trackAppInstall(); } catch(e) {}

function installPWA() {
  if(isStandaloneMode()) {
    try { showToast('التطبيق مثبت بالفعل ✅'); } catch(e) {}
    return;
  }
  if(deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function() { deferredInstallPrompt = null; });
    return;
  }
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua);
  if(isIOS) {
    alert('لتثبيت التطبيق على آيفون:\n\n1. دوس على أيقونة المشاركة ⬆️ تحت في المتصفح (Safari)\n2. مرّر لحد ما تلاقي "إضافة إلى الشاشة الرئيسية"\n3. دوس "إضافة"');
  } else {
    alert('لتثبيت التطبيق:\n\n1. دوس على قائمة المتصفح (⋮ فوق يمين)\n2. اختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"');
  }
}

// ===== بانر تثبيت التطبيق بعد 12 ثانية =====
function maybeShowInstallBanner() {
  if(isStandaloneMode()) return; // متثبت بالفعل — متظهرش تاني أبدًا
  if(sessionStorage.getItem('install_banner_shown_session')) return; // ظهرت خلاص في الجلسة دي
  setTimeout(function() {
    if(isStandaloneMode() || document.getElementById('installBannerBar')) return;
    var bar = document.createElement('div');
    bar.id = 'installBannerBar';
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:80px;z-index:9998;background:linear-gradient(135deg,#1a7a4a,#0e5c33);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;animation:slideUpBanner .3s ease;';
    bar.innerHTML =
      '<span style="font-size:26px;">📲</span>' +
      '<div style="flex:1;color:white;">' +
        '<div style="font-size:13px;font-weight:900;">ثبّت التطبيق على موبايلك</div>' +
        '<div style="font-size:11px;opacity:.85;">وصول أسرع، من غير ما تفتح المتصفح كل مرة</div>' +
      '</div>' +
      '<button onclick="event.stopPropagation();closeInstallBanner();" style="background:rgba(255,255,255,.2);border:none;color:white;width:26px;height:26px;border-radius:50%;font-size:14px;cursor:pointer;flex-shrink:0;">✕</button>';
    bar.onclick = function() { closeInstallBanner(); installPWA(); };
    var style = document.createElement('style');
    style.textContent = '@keyframes slideUpBanner { from { transform:translateY(30px); opacity:0; } to { transform:translateY(0); opacity:1; } }';
    document.head.appendChild(style);
    document.body.appendChild(bar);
    sessionStorage.setItem('install_banner_shown_session', '1');
  }, 12000);
}
function closeInstallBanner() {
  var el = document.getElementById('installBannerBar');
  if(el) el.remove();
}


try {
  if(isStandaloneMode()) {
    var _ib = document.getElementById('installBtn'); if(_ib) _ib.style.display = 'none';
  } else {
    var _ib2 = document.getElementById('installBtn'); if(_ib2) _ib2.style.display = 'flex';
  }
} catch(e) {}

buildCatsGrid();
// ===== ربط زرار الرجوع (أندرويد/متصفح) بالتنقل الداخلي =====
window.addEventListener('popstate', function() {
  var zoomOverlay = document.getElementById('shopZoomOverlay') || document.getElementById('adZoomOverlay');
  if(zoomOverlay) { zoomOverlay.remove(); return; }

  // أي نافذة/بوب-أب من النوع اللي مش متسجل في تاريخ المتصفح — اقفلها الأول قبل أي رجوع تاني
  var floatingOverlayIds = [
    'imgFullOverlay', 'productDetailOverlay', 'notifModal', 'postDetailModal',
    'shareProdModal', 'shareShopModal', 'tipModal', 'contactRequestModal',
    'shopDashOverlay', 'editProdOverlay', 'shopEditOverlay', 'shopPassChangeOverlay',
    'shopLoginOverlay', 'traderLoginOverlay', 'traderUpdateOverlay', 'traderAddOverlay',
    'sectionDetailOverlay', 'adPreviewModal', 'editPostModal', 'newPostModal',
    'authModalOverlay', 'moveModal', 'adminEditModal', 'advertiseFormModal'
  ];
  for(var i=0; i<floatingOverlayIds.length; i++) {
    var el = document.getElementById(floatingOverlayIds[i]);
    if(el) { el.remove(); document.body.style.overflow = document.getElementById('dynamicPage')?.classList.contains('active') ? 'hidden' : ''; return; }
  }

  var page = document.getElementById('dynamicPage');
  if(!page || !page.classList.contains('active')) return; // مفيش صفحة داخلية — خروج طبيعي
  if(window._adDetailOpen) {
    window._adDetailOpen = false;
    goBackFromAdDetail();
  } else {
    clickRealBackButton();
  }
});

try { buildSlider(); } catch(e) { console.warn('slider err:', e); }
try { updateNavAddVisibility(); } catch(e) {}
loadAds().then(async function() {
  try { checkNewAds(); } catch(e) {}
  // تحقق من الـ admin session المحفوظة (جلسة حقيقية عبر Supabase Auth)
  try {
    await tryRestoreAdminSession();
  } catch(e) {}
  try { var _agb = document.getElementById('adminGearBtn'); if(_agb) _agb.style.display = isAdmin ? 'flex' : 'none'; } catch(e) {}
  try { restoreOnRefresh(); } catch(e) { console.warn('restoreOnRefresh err:', e); }
  try { loadHomeBanners(); } catch(e) {}
  try { loadGoldPrices(); } catch(e) {}
  try { loadPrayerTimes(); } catch(e) {}
  try { loadWeather(); } catch(e) {}
  try { loadGoldPrice(); } catch(e) {}
  try { trackSiteVisit(); } catch(e) {}
  try { maybeShowRegisterUrgencyPopup(); } catch(e) {}
  try { maybeShowInstallBanner(); } catch(e) {}
}).catch(function(e) { console.warn(e); }).finally(function() {
  setTimeout(function() {
    var s = document.getElementById('splashScreen');
    if(s) s.style.display = 'none';
  }, 1500);
});
setTimeout(function() {
  var s = document.getElementById('splashScreen');
  if(s) s.style.display = 'none';
}, 5000);

// ===== أسعار الذهب =====
let _lastGoldPrices = null;

async function loadGoldPrices() {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU'),
      fetch('https://api.exchangerate-api.com/v4/latest/USD')
    ]);
    const goldData = await goldRes.json();
    const fxData = await fxRes.json();
    const priceUSD = parseFloat(goldData.price);
    const usdToEgp = (fxData.rates && fxData.rates.EGP ? fxData.rates.EGP : 49.45);
    const gramsPerOunce = 31.1035;
    const pricePerGram24 = (priceUSD / gramsPerOunce) * usdToEgp;
    // هامش البيع المحسوب من أسعار السوق الفعلية 28/6/2026 (24=6583، 21=5760، 18=4937)
    const sellMargin = 1.0128;
    const prices = {
      k24: Math.round(pricePerGram24 * sellMargin),
      k21: Math.round(pricePerGram24 * 21/24 * sellMargin),
      k18: Math.round(pricePerGram24 * 18/24 * sellMargin),
    };
    const prev = _lastGoldPrices;
    _lastGoldPrices = prices;
    renderGoldBar(prices, prev);
  } catch(e) {
    const bar = document.getElementById('goldPricesBar');
    if(bar) bar.innerHTML = '<span style="opacity:.7;">غير متاح الآن</span>';
  }
}

function renderGoldBar(prices, prev) {
  const bar = document.getElementById('goldPricesBar');
  if(!bar) return;
  function arrow(k) {
    if(!prev) return '';
    if(prices[k] > prev[k]) return '<span style="color:#86efac;">▲</span>';
    if(prices[k] < prev[k]) return '<span style="color:#fca5a5;">▼</span>';
    return '<span style="opacity:.5;">─</span>';
  }
  bar.innerHTML =
    '<span style="background:rgba(255,255,255,.15);padding:3px 8px;border-radius:8px;font-weight:700;">عيار 24 ' + arrow('k24') + ' ' + prices.k24.toLocaleString() + ' ج</span>' +
    '<span style="background:rgba(255,255,255,.22);padding:3px 8px;border-radius:8px;font-weight:900;">عيار 21 ' + arrow('k21') + ' ' + prices.k21.toLocaleString() + ' ج</span>' +
    '<span style="background:rgba(255,255,255,.15);padding:3px 8px;border-radius:8px;font-weight:700;">عيار 18 ' + arrow('k18') + ' ' + prices.k18.toLocaleString() + ' ج</span>';
}

// تحديث الذهب كل 30 دقيقة بـ setInterval ثابت — مش بيوقف حتى لو API فشلت مرة
if(!window._goldTimer) {
  window._goldTimer = setInterval(function(){ loadGoldPrices(); }, 30 * 60 * 1000);
}

function showGoldPrices() {
  if(!_lastGoldPrices) return;
  var p = _lastGoldPrices;
  alert('💛 أسعار الذهب اليوم (للجرام)\n\nعيار 24: ' + p.k24.toLocaleString() + ' جنيه\nعيار 21: ' + p.k21.toLocaleString() + ' جنيه\nعيار 18: ' + p.k18.toLocaleString() + ' جنيه\n\n* الأسعار تقريبية وتتحدث كل 5 دقائق');
}

// ===== الطقس — الحامول، كفر الشيخ =====
const WEATHER_LAT = 31.1667;
const WEATHER_LON = 30.9333;
let _lastWeather = null;

function weatherCodeInfo(code) {
  // أكواد الطقس العالمية (WMO) مبسطة بالعربي
  const map = {
    0:{icon:'☀️',text:'صافي'}, 1:{icon:'🌤️',text:'صافي غالبًا'}, 2:{icon:'⛅',text:'غائم جزئيًا'}, 3:{icon:'☁️',text:'غائم'},
    45:{icon:'🌫️',text:'شبورة'}, 48:{icon:'🌫️',text:'شبورة كثيفة'},
    51:{icon:'🌦️',text:'رذاذ خفيف'}, 53:{icon:'🌦️',text:'رذاذ'}, 55:{icon:'🌧️',text:'رذاذ كثيف'},
    61:{icon:'🌧️',text:'مطر خفيف'}, 63:{icon:'🌧️',text:'مطر'}, 65:{icon:'🌧️',text:'مطر غزير'},
    71:{icon:'🌨️',text:'ثلج خفيف'}, 73:{icon:'🌨️',text:'ثلج'}, 75:{icon:'❄️',text:'ثلج كثيف'},
    80:{icon:'🌦️',text:'زخات مطر'}, 81:{icon:'🌧️',text:'زخات مطر'}, 82:{icon:'⛈️',text:'زخات غزيرة'},
    95:{icon:'⛈️',text:'عاصفة رعدية'}, 96:{icon:'⛈️',text:'عاصفة رعدية مع برد'}, 99:{icon:'⛈️',text:'عاصفة رعدية شديدة'},
  };
  return map[code] || {icon:'🌤️', text:'—'};
}

async function loadWeather() {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Africa/Cairo`);
    const data = await res.json();
    _lastWeather = data;
    const bar = document.getElementById('weatherBarContent');
    if(bar && data?.current) {
      const info = weatherCodeInfo(data.current.weather_code);
      bar.innerHTML =
        '<span style="background:rgba(255,255,255,.2);padding:3px 8px;border-radius:8px;font-weight:900;">' + info.icon + ' ' + Math.round(data.current.temperature_2m) + '°</span>' +
        '<span style="background:rgba(255,255,255,.15);padding:3px 8px;border-radius:8px;">' + info.text + '</span>';
    }
  } catch(e) {
    const bar = document.getElementById('weatherBarContent');
    if(bar) bar.innerHTML = '<span style="opacity:.6;">اضغط للتفاصيل</span>';
  }
}
const loadWeatherBar = loadWeather;
if(!window._weatherTimer) {
  window._weatherTimer = setInterval(function(){ loadWeather(); }, 30 * 60 * 1000);
}

function showWeatherPage() {
  sessionStorage.setItem('dynState', JSON.stringify({type:'weather'}));
  try{history.pushState({dyn:1},'');}catch(e){}
  const page = document.getElementById('dynamicPage');
  page.innerHTML = `
    <div class="dyn-header" style="background:linear-gradient(135deg,#0369a1,#0ea5e9);">
      <button class="dyn-back" onclick="hideDynPage()">←</button>
      <span>🌤️ طقس الحامول</span>
      <span></span>
    </div>
    <div class="dyn-content" style="padding:16px;">
      <div style="text-align:center;padding:40px;color:var(--gray);">
        <div class="spinner"></div>
        <p style="margin-top:12px;">جاري تحميل الطقس...</p>
      </div>
    </div>`;
  page.classList.add('active');
  document.body.style.overflow = 'hidden';

  const render = function() {
    const data = _lastWeather;
    const content = page.querySelector('.dyn-content');
    if(!data?.current) {
      content.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--gray);">
          <div style="font-size:48px;margin-bottom:12px;">📡</div>
          <p style="font-weight:700;">تعذر تحميل بيانات الطقس</p>
          <button onclick="loadWeather().then(()=>showWeatherPage())" style="margin-top:14px;background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:10px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">إعادة المحاولة</button>
        </div>`;
      return;
    }
    const cur = data.current;
    const info = weatherCodeInfo(cur.weather_code);
    const daily = data.daily;
    const dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    content.innerHTML = `
      <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:16px;padding:24px;margin-bottom:16px;color:white;text-align:center;">
        <div style="font-size:13px;opacity:.85;margin-bottom:6px;">📍 مركز الحامول — كفر الشيخ</div>
        <div style="font-size:56px;margin-bottom:4px;">${info.icon}</div>
        <div style="font-size:38px;font-weight:900;">${Math.round(cur.temperature_2m)}°</div>
        <div style="font-size:15px;opacity:.9;margin-top:4px;">${info.text}</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-top:14px;font-size:12px;opacity:.85;">
          <span>💧 رطوبة ${cur.relative_humidity_2m}%</span>
          <span>💨 رياح ${Math.round(cur.wind_speed_10m)} كم/س</span>
        </div>
      </div>

      <div style="font-size:13px;font-weight:900;color:var(--dark);margin-bottom:10px;">📅 توقعات الأيام الجاية</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${daily.time.slice(0,7).map((dateStr,i) => {
          const d = new Date(dateStr);
          const dName = i===0 ? 'النهاردة' : dayNames[d.getDay()];
          const dInfo = weatherCodeInfo(daily.weather_code[i]);
          return `
          <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:700;color:var(--dark);width:70px;">${dName}</span>
            <span style="font-size:22px;">${dInfo.icon}</span>
            <span style="font-size:12px;color:var(--gray);flex:1;text-align:center;">${dInfo.text}</span>
            <span style="font-size:13px;font-weight:900;color:var(--dark);">${Math.round(daily.temperature_2m_max[i])}°</span>
            <span style="font-size:12px;color:var(--gray);margin-right:6px;">${Math.round(daily.temperature_2m_min[i])}°</span>
          </div>`;
        }).join('')}
      </div>
      <div style="text-align:center;margin-top:14px;font-size:11px;color:#aaa;">
        بيانات الطقس من open-meteo.com
      </div>`;
  };

  if(_lastWeather?.current) { render(); }
  else { loadWeather().then(render); }
}

// لو حد فتح رابط مشاركة موضوع (?post=ID) أو إعلان (?ad=ID) أو معرض (?shop=ID)، افتحله مباشرة
(function(){
  window.addEventListener('load', function(){
    setTimeout(checkPhoneRequired, 500);
  });
  try {
    const params = new URLSearchParams(window.location.search);
    const sharedPostId = params.get('post');
    const sharedAdId = params.get('ad');
    const sharedShopId = params.get('shop');
    const sharedProductId = params.get('product');
    if(sharedPostId) {
      window.addEventListener('load', function(){
        setTimeout(function(){ openPostDetail(sharedPostId); }, 300);
      });
    } else if(sharedAdId) {
      window.addEventListener('load', function(){
        setTimeout(function(){ openAdDetails(sharedAdId); }, 300);
      });
    } else if(sharedShopId) {
      window.addEventListener('load', function(){
        setTimeout(function(){
          document.getElementById('dynamicPage').classList.add('active');
          document.body.style.overflow = 'hidden';
          openShop(sharedShopId);
        }, 300);
      });
    } else if(sharedProductId) {
      window.addEventListener('load', function(){
        setTimeout(function(){ openShopProduct(sharedProductId); }, 300);
      });
    }
  } catch(e) {}
})();


