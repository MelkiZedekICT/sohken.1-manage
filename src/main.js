import { inspectText } from './check.js';

const checkText = document.querySelector('#check-text');
const checkButton = document.querySelector('#check-button');
const checkResult = document.querySelector('#check-result');

checkButton.addEventListener('click', () => {
  const text = checkText.value.trim();
  if (!text) {
    checkResult.className = 'check-result warning';
    const title = document.createElement('strong');
    title.textContent = 'Add some text first.';
    const detail = document.createElement('p');
    detail.textContent = 'The check runs only when you press the button.';
    checkResult.replaceChildren(title, detail);
    return;
  }
  const matches = inspectText(text);
  if (matches.length) {
    checkResult.className = 'check-result danger';
    const title = document.createElement('strong');
    title.textContent = `${matches.length} warning${matches.length === 1 ? '' : 's'} found`;
    const list = document.createElement('ul');
    for (const match of matches) {
      const item = document.createElement('li');
      item.textContent = match;
      list.append(item);
    }
    checkResult.replaceChildren(title, list);
  } else {
    checkResult.className = 'check-result clear';
    const title = document.createElement('strong');
    title.textContent = 'No set warning matched.';
    const detail = document.createElement('p');
    detail.textContent = 'Still review the text. This check cannot prove it is safe.';
    checkResult.replaceChildren(title, detail);
  }
});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('seen');
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .section').forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('.reveal, .section').forEach((element) => element.classList.add('seen'));
}
