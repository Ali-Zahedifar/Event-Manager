const LANG_KEY = 'evm_lang';
const I18N = {
  en: {
    'event.manager': 'Event Manager',
    'sign.in': 'Sign in to your account',
    'username': 'Username',
    'password': 'Password',
    'sign.in.btn': 'Sign In',
    'login.error': 'Invalid username or password',
    'login.title': 'Event Manager',
  },
  fa: {
    'event.manager': 'مدیریت رویداد',
    'sign.in': 'به حساب خود وارد شوید',
    'username': 'نام کاربری',
    'password': 'رمز عبور',
    'sign.in.btn': 'ورود',
    'login.error': 'نام کاربری یا رمز عبور اشتباه است',
    'login.title': 'مدیریت رویداد',
  }
};

let lang = localStorage.getItem(LANG_KEY) || 'en';
function t(key) { return (I18N[lang] && I18N[lang][key]) || (I18N.en[key]) || key; }

function applyLang() {
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.getElementById('title').textContent = t('event.manager');
  document.getElementById('subtitle').textContent = t('sign.in');
  document.getElementById('label-user').textContent = t('username');
  document.getElementById('label-pass').textContent = t('password');
  document.getElementById('btn-login').textContent = t('sign.in.btn');
  document.getElementById('lang-toggle').textContent = lang === 'en' ? 'فا / EN' : 'EN / فا';
}

document.getElementById('lang-toggle').addEventListener('click', () => {
  lang = lang === 'en' ? 'fa' : 'en';
  localStorage.setItem(LANG_KEY, lang);
  applyLang();
});

applyLang();

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  errEl.textContent = '';
  btn.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      window.location.href = '/';
    } else {
      errEl.textContent = t('login.error');
    }
  } catch (err) {
    errEl.textContent = t('login.error');
  } finally {
    btn.disabled = false;
  }
});