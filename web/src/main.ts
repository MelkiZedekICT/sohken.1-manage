import './styles.css';
import { api } from '@appdeploy/client';
import { inspectText } from './check.js';

const checkText = document.querySelector<HTMLTextAreaElement>('#check-text')!;
const checkButton = document.querySelector<HTMLButtonElement>('#check-button')!;
const checkResult = document.querySelector<HTMLDivElement>('#check-result')!;

checkButton.addEventListener('click', () => {
  const text = checkText.value.trim();
  if (!text) {
    checkResult.className = 'check-result warning';
    checkResult.innerHTML = '<strong>Add some text first.</strong><p>The check runs only when you press the button.</p>';
    return;
  }
  const matches = inspectText(text);
  if (matches.length) {
    checkResult.className = 'check-result danger';
    checkResult.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = `${matches.length} warning${matches.length === 1 ? '' : 's'} found`;
    const list = document.createElement('ul');
    for (const match of matches) {
      const item = document.createElement('li');
      item.textContent = match;
      list.append(item);
    }
    checkResult.append(title, list);
  } else {
    checkResult.className = 'check-result clear';
    checkResult.innerHTML = '<strong>No set warning matched.</strong><p>Still review the text. This check cannot prove it is safe.</p>';
  }
});

document.querySelectorAll<HTMLAnchorElement>('[data-plan="Founder"]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelector<HTMLInputElement>('#founder')!.checked = true;
  });
});

const form = document.querySelector<HTMLFormElement>('#join-form')!;
const status = document.querySelector<HTMLParagraphElement>('#form-status')!;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector<HTMLInputElement>('#email')!;
  const founder = document.querySelector<HTMLInputElement>('#founder')!;
  const website = document.querySelector<HTMLInputElement>('#website')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  status.textContent = 'Joining…';
  try {
    const response = await api.post('/api/join', {
      email: email.value,
      plan: founder.checked ? 'founder' : 'free',
      website: website.value,
    });
    status.textContent = response.data?.message || 'You’re on the list. We’ll be in touch.';
    status.className = 'success';
    form.reset();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    status.textContent = message.includes('429') ? 'Too many tries. Please come back in a few minutes.' : 'Could not save your email. Please try again.';
    status.className = 'error';
  } finally {
    button.disabled = false;
  }
});

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('seen');
}, { threshold: 0.12 });
document.querySelectorAll('.reveal, .section, .join').forEach((element) => observer.observe(element));
