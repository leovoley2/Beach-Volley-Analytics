import { getPayPalAccessToken, supabaseAdmin, PAYPAL_BASE } from './_paypal.js';
import { requireAdmin } from './_auth.js';

/**
 * Panel de administración (sólo profiles.role = 'admin').
 * Un único endpoint con acciones para no multiplicar funciones serverless:
 *   overview       → métricas, usuarios y cobros
 *   grant          → { email, months (0 = sin vencimiento), note } da Pro manual
 *   revoke         → { userId } quita un Pro manual
 *   sync_payments  → importa desde PayPal los cobros de todas las suscripciones
 */
const DAY = 24 * 60 * 60 * 1000;
const MONTHLY_VALUE = { pro: 10, team: 100 / 12 };      // USD/mes, para estimar el MRR
const PAYPAL_HISTORY_START = '2026-07-01T00:00:00Z';     // PayPal se activó en jul-2026

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res, { bucket: 'admin', limit: 60 });
    if (!admin) return;

    try {
        const { action } = req.body || {};
        switch (action) {
            case 'overview':      return res.status(200).json(await overview());
            case 'grant':         return await grant(req.body, res);
            case 'revoke':        return await revoke(req.body, res);
            case 'sync_payments': return res.status(200).json(await syncPayments());
            default:              return res.status(400).json({ error: 'Acción inválida' });
        }
    } catch (err) {
        console.error('admin error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Origen del acceso de pago de un usuario.
function accessSource(u) {
    if (!u.is_paid) return 'free';
    if (u.role === 'admin') return 'admin';
    if (u.has_paypal) return u.status === 'canceled' ? 'paypal_canceled' : 'paypal';
    return 'manual';
}

async function loadUsers() {
    const { data, error } = await supabaseAdmin.rpc('admin_users');
    if (error) throw error;
    return data.map(u => ({ ...u, source: accessSource(u) }));
}

async function overview() {
    const now = Date.now();
    const since12w = new Date(now - 12 * 7 * DAY).toISOString();

    const [users, matchesRes, paymentsRes] = await Promise.all([
        loadUsers(),
        supabaseAdmin.from('matches').select('created_at').gte('created_at', since12w),
        supabaseAdmin.from('billing_events').select('*').order('paid_at', { ascending: false }).limit(500),
    ]);
    if (matchesRes.error) throw matchesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const within = (ts, days) => ts && now - new Date(ts).getTime() <= days * DAY;
    const bySource = (s) => users.filter(u => u.source === s);
    const paying = bySource('paypal');

    // Serie semanal (12 semanas): registros y partidos creados.
    const weeks = Array.from({ length: 12 }, (_, i) => {
        const start = now - (12 - i) * 7 * DAY;
        return { start: new Date(start).toISOString(), signups: 0, matches: 0 };
    });
    const weekIndex = (ts) => Math.floor((new Date(ts).getTime() - (now - 12 * 7 * DAY)) / (7 * DAY));
    users.forEach(u => { const i = weekIndex(u.created_at); if (i >= 0 && i < 12) weeks[i].signups++; });
    matchesRes.data.forEach(m => { const i = weekIndex(m.created_at); if (i >= 0 && i < 12) weeks[i].matches++; });

    const payments = paymentsRes.data;
    const emailById = Object.fromEntries(users.map(u => [u.id, u.email]));
    const completed = payments.filter(p => p.status === 'completed');
    const sum = (list) => Math.round(list.reduce((a, p) => a + Number(p.amount), 0) * 100) / 100;

    return {
        metrics: {
            totalUsers:    users.length,
            newUsers7d:    users.filter(u => within(u.created_at, 7)).length,
            newUsers30d:   users.filter(u => within(u.created_at, 30)).length,
            activeUsers30d: users.filter(u => within(u.last_sign_in_at, 30) || within(u.last_match_at, 30)).length,
            matchesTotal:  users.reduce((a, u) => a + u.matches_total, 0),
            matches30d:    users.reduce((a, u) => a + u.matches_30d, 0),
            paying:        paying.length,
            canceling:     bySource('paypal_canceled').length,
            granted:       bySource('manual').length,
            mrr:           Math.round(paying.reduce((a, u) => a + (MONTHLY_VALUE[u.plan] || 0), 0) * 100) / 100,
            revenueTotal:  sum(completed),
            revenue30d:    sum(completed.filter(p => within(p.paid_at, 30))),
            paymentsCount: completed.length,
        },
        weekly: weeks,
        users,
        payments: payments.slice(0, 100).map(p => ({ ...p, email: emailById[p.user_id] ?? null })),
    };
}

async function grant(body, res) {
    const email  = String(body.email || '').trim().toLowerCase();
    const months = Number(body.months) || 0;
    const note   = String(body.note || '').trim().slice(0, 80) || null;
    if (!email) return res.status(400).json({ error: 'Indica el correo del usuario.' });
    if (months < 0 || months > 36) return res.status(400).json({ error: 'Duración inválida.' });

    const users = await loadUsers();
    const target = users.find(u => u.email?.toLowerCase() === email);
    if (!target) {
        return res.status(404).json({ error: 'No existe una cuenta con ese correo. Pídele que se registre gratis primero y vuelve a intentarlo.' });
    }
    // Si ya paga con PayPal, pisar su fila rompería el vínculo y le seguirían cobrando.
    if (target.has_paypal && target.status === 'active') {
        return res.status(409).json({ error: 'Este usuario ya tiene una suscripción de PayPal activa.' });
    }

    const end = months > 0 ? new Date(Date.now() + months * 30 * DAY).toISOString() : null;
    const { error } = await supabaseAdmin.from('subscriptions').upsert({
        user_id:                target.id,
        plan:                   'pro',
        status:                 'active',
        provider:               'manual',
        paypal_subscription_id: null,
        current_period_end:     end,
        admin_note:             note,
        granted_at:             new Date().toISOString(),
        updated_at:             new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;

    return res.status(200).json({ ok: true });
}

async function revoke(body, res) {
    const userId = String(body.userId || '');
    const { data: sub } = await supabaseAdmin
        .from('subscriptions').select('provider').eq('user_id', userId).maybeSingle();
    if (sub?.provider !== 'manual') {
        return res.status(400).json({ error: 'Sólo se puede quitar un Pro otorgado manualmente.' });
    }
    const { error } = await supabaseAdmin.from('subscriptions').update({
        plan:               'free',
        status:             'active',
        current_period_end: null,
        admin_note:         null,
        updated_at:         new Date().toISOString(),
    }).eq('user_id', userId);
    if (error) throw error;
    return res.status(200).json({ ok: true });
}

// Importa los cobros de cada suscripción PayPal (útil para los anteriores al registro
// automático del webhook). Idempotente: upsert por id de transacción.
async function syncPayments() {
    const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id, paypal_subscription_id')
        .not('paypal_subscription_id', 'is', null);
    if (error) throw error;

    const token = await getPayPalAccessToken();
    const end = new Date().toISOString();
    let imported = 0;
    let failed = 0;

    for (const s of subs) {
        const url = `${PAYPAL_BASE}/v1/billing/subscriptions/${s.paypal_subscription_id}/transactions`
            + `?start_time=${PAYPAL_HISTORY_START}&end_time=${end}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { failed++; continue; }
        const { transactions = [] } = await r.json();

        const rows = transactions
            .filter(t => t.id && t.amount_with_breakdown?.gross_amount)
            .map(t => ({
                id:                     t.id,
                user_id:                s.user_id,
                paypal_subscription_id: s.paypal_subscription_id,
                amount:                 t.amount_with_breakdown.gross_amount.value,
                currency:               t.amount_with_breakdown.gross_amount.currency_code,
                status:                 String(t.status || 'completed').toLowerCase(),
                paid_at:                t.time,
            }));
        if (rows.length) {
            const { error: upErr } = await supabaseAdmin.from('billing_events').upsert(rows, { onConflict: 'id' });
            if (upErr) { failed++; continue; }
            imported += rows.length;
        }
    }
    return { ok: true, subscriptions: subs.length, imported, failed };
}
