import { db, error, json, router } from '@appdeploy/sdk';

type JoinRequest = { email?: unknown; plan?: unknown; website?: unknown };

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Ready' })],
  'POST /api/join': [async ({ body }) => {
    const input = (body || {}) as JoinRequest;
    if (typeof input.website === 'string' && input.website.trim()) return json({ message: 'You’re on the list.' });
    if (typeof input.email !== 'string') return error('Enter a valid email address.', 400);
    const email = input.email.trim().toLowerCase();
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Enter a valid email address.', 400);
    const plan = input.plan === 'founder' ? 'founder' : 'free';
    const { items } = await db.list<{ email: string }>('early_access', { filter: { email }, limit: 1000 });
    if (items.some((item) => item.email === email)) return json({ message: 'You’re already on the list. Thank you.' });
    const [id] = await db.add('early_access', [{ email, plan, joined_at: Date.now(), source: 'sohken-web' }]);
    if (!id) return error('Could not save your email. Please try again.', 500);
    return json({ message: plan === 'founder' ? 'Founder interest saved. We’ll send the private build before any payment.' : 'You’re on the free list. We’ll send the first public build.' }, 201);
  }],
  'POST /api/leave': [async ({ body }) => {
    const input = (body || {}) as JoinRequest;
    if (typeof input.email !== 'string') return error('Enter a valid email address.', 400);
    const email = input.email.trim().toLowerCase();
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Enter a valid email address.', 400);
    const { items } = await db.list<{ email: string }>('early_access', { filter: { email }, limit: 1000 });
    const ids = items.filter((item) => item.email === email).map((item) => item.id);
    if (ids.length) await db.delete('early_access', ids);
    return json({ message: 'Your email was removed from the list.' });
  }],
});
