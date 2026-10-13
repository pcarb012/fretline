import { getUser, signIn, signOut, signUp } from '../backend/auth.js';
import { getGoal, setGoal } from '../backend/practice.js';
import { backButton, h } from './dom.js';

/** Run work while the given buttons are disabled, so a double click cannot send it twice. */
async function whileBusy(buttons, work) {
  buttons.forEach((b) => b.setAttribute('disabled', ''));
  try {
    return await work();
  } finally {
    buttons.forEach((b) => b.removeAttribute('disabled'));
  }
}

const field = (id, label, props) =>
  h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, ...props }));

export function mountAccount(root, go) {
  let gone = false;
  const panel = h('div', {});
  root.append(backButton(go), h('h2', {}, 'Account'), panel);

  function showSignedOut() {
    const email = field('acct-email', 'Email', { type: 'email', autocomplete: 'email', required: '' });
    const password = field('acct-password', 'Password', {
      type: 'password', autocomplete: 'current-password', minlength: '6', required: '',
    });
    const message = h('p', { class: 'form-msg', role: 'status' });
    const signInBtn = h('button', { class: 'primary', type: 'submit' }, 'Sign in');
    const createBtn = h('button', { type: 'button' }, 'Create account');
    const buttons = [signInBtn, createBtn];
    const say = (text, isError = true) => {
      message.textContent = text;
      message.className = isError ? 'form-msg bad' : 'form-msg';
    };
    const values = () => [email.querySelector('input').value.trim(), password.querySelector('input').value];

    async function submit(action) {
      const [mail, pass] = values();
      if (!mail || !pass) return say('Enter your email and password.');
      say('');
      const { user, error } = await whileBusy(buttons, () => action(mail, pass));
      if (gone) return;
      if (error) return say(error);
      // With email confirmation on, sign-up succeeds but no session starts.
      if (!user || !(await getUser())) return say('Check your email to confirm, then sign in.', false);
      showSignedIn(user);
    }

    panel.replaceChildren(h('form', {
      class: 'account-form',
      onsubmit: (event) => {
        event.preventDefault();
        submit(signIn);
      },
    }, email, password, h('div', { class: 'row' }, signInBtn, createBtn), message));
    createBtn.addEventListener('click', () => submit(signUp));
  }

  async function showSignedIn(knownUser) {
    const user = knownUser ?? await getUser();
    if (gone) return;
    if (!user) return showSignedOut();
    const goal = field('acct-goal', 'Daily goal (minutes)', {
      type: 'number', min: '1', max: '240', step: '1', value: '10', disabled: '',
    });
    const goalInput = goal.querySelector('input');
    const saveBtn = h('button', { class: 'primary', type: 'submit', disabled: '' }, 'Save goal');
    const outBtn = h('button', { type: 'button' }, 'Sign out');
    const message = h('p', { class: 'form-msg', role: 'status' });
    const say = (text, isError = false) => {
      message.textContent = text;
      message.className = isError ? 'form-msg bad' : 'form-msg';
    };

    panel.replaceChildren(
      h('p', {}, 'Signed in as ', h('b', {}, user.email ?? 'your account'), '.'),
      h('form', {
        class: 'account-form',
        onsubmit: async (event) => {
          event.preventDefault();
          const minutes = Number(goalInput.value);
          if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
            return say('Pick a goal from 1 to 240 minutes.', true);
          }
          say('');
          const saved = await whileBusy([saveBtn, outBtn], () => setGoal(minutes));
          if (!gone) say(saved ? 'Goal saved.' : 'Could not save the goal. Try again.', !saved);
        },
      }, goal, h('div', { class: 'row' }, saveBtn), message),
      h('div', { class: 'row' }, outBtn),
    );

    outBtn.addEventListener('click', async () => {
      const out = await whileBusy([saveBtn, outBtn], signOut);
      if (gone) return;
      if (out) showSignedOut();
      else say('Could not sign out. Try again.', true);
    });

    const current = await getGoal();
    if (gone) return;
    goalInput.value = String(current);
    goalInput.removeAttribute('disabled');
    saveBtn.removeAttribute('disabled');
  }

  getUser().then((user) => {
    if (gone) return;
    if (user) showSignedIn(user);
    else showSignedOut();
  });

  return () => {
    gone = true;
  };
}
