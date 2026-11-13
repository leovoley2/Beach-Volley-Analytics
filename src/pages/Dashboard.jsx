import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMatchesDB } from '../hooks/useMatchesDB';
import { LEGAL } from '../lib/legalConfig';
import AccountMenu from '../components/AccountMenu';
import TournamentEditor from '../components/TournamentEditor';
import TournamentArt from '../components/TournamentArt';
import {
    IconSearch, IconPlus, IconEdit, IconTrash, IconPlay, IconPin, IconCalendar,
    IconBack, IconChevron, IconGrid, IconList, IconTag,
} from '../components/Icons';
import { versionDetail } from '../lib/appVersion';
import { listPending, syncAllPending, clearPending, onSyncChange } from '../lib/offlineSync';
import { fetchTournaments, saveTournament, deleteTournament, normalizeName } from '../lib/tournamentsApi';
import {
    NO_TOURNAMENT_KEY, groupByTournament, groupByMonth, groupByDay, formatDay, formatRange,
    matchHaystack, normalizeQuery, matchDay,
} from '../lib/matchGrouping';

// Columnas de la lista: sin `actions` (el conteo viene calculado por la BD en action_count).
const LIST_COLUMNS = 'id, match_type, status, match_date, created_at, updated_at, own_team_name, opponent_team_name, own_players, opponent_players, score, sets, location, tournament, action_count';

const STATUS_FILTERS = [
    { id: 'all', label: 'Todos' },
    { id: 'in_progress', label: 'En progreso' },
    { id: 'completed', label: 'Completados' },
];
const VIEW_KEY = 'bva:dashboard:view';

const matchUrl = (m) => (m.status === 'completed' ? `/match/${m.id}` : `/match/${m.id}/tracker`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Dashboard() {
    const { user, subscription, isPaid } = useAuth();
    const { matches, loading, monthlyUsed, monthlyLimit, canCreateMatch, deleteMatch, updateMatch, refetch } =
        useMatchesDB({ columns: LIST_COLUMNS });
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const openKey = params.get('torneo');

    const [deletingId, setDeletingId] = useState(null);
    const [confirmId, setConfirmId]   = useState(null);
    const [moveMatch, setMoveMatch]   = useState(null);
    const [editing, setEditing]       = useState(null); // null | 'new' | group
    const [query, setQuery]           = useState('');
    const [status, setStatus]         = useState('all');
    const [intro, setIntro]           = useState(true); // animación de entrada solo la primera vez
    const [view, setView]             = useState(() => {
        try { return localStorage.getItem(VIEW_KEY) || 'tournaments'; } catch { return 'tournaments'; }
    });
    const changeView = (v) => { setIntro(false); setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ } };

    // Torneos (portada, sede, fechas)
    const [tournaments, setTournaments] = useState([]);
    const [tError, setTError] = useState('');
    useEffect(() => {
        let alive = true;
        fetchTournaments().then(t => alive && setTournaments(t)).catch(err => alive && setTError(err.message));
        return () => { alive = false; };
    }, []);

    // Partidos con cambios guardados en este equipo que aún no se subieron (sin conexión).
    const userId = user?.id;
    const [pendingCount, setPendingCount] = useState(() => listPending(userId).length);
    const [syncing, setSyncing] = useState(false);
    const syncPending = useCallback(async () => {
        if (!userId || !listPending(userId).length) { setPendingCount(0); return; }
        setSyncing(true);
        const synced = await syncAllPending(userId);
        setSyncing(false);
        setPendingCount(listPending(userId).length);
        if (synced) refetch();
    }, [userId, refetch]);
    useEffect(() => {
        syncPending();
        window.addEventListener('online', syncPending);
        const off = onSyncChange(() => setPendingCount(listPending(userId).length));
        return () => { window.removeEventListener('online', syncPending); off(); };
    }, [syncPending, userId]);

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';

    // ---- Datos derivados ----
    const groups = useMemo(() => groupByTournament(matches, tournaments), [matches, tournaments]);
    const groupByKey = useMemo(() => new Map(groups.map((g, i) => [g.key, { ...g, vt: `tposter-${i}` }])), [groups]);
    const takenNames = useMemo(() => groups.filter(g => g.key !== NO_TOURNAMENT_KEY).map(g => g.key), [groups]);
    const openGroup = openKey ? groupByKey.get(openKey) : null;

    const q = normalizeQuery(query);
    const statusOk = useCallback((m) =>
        status === 'all' || (status === 'completed') === (m.status === 'completed'), [status]);
    const passes = useCallback((m) => statusOk(m) && (!q || matchHaystack(m).includes(q)), [statusOk, q]);
    const filtering = !!q || status !== 'all';

    // Un torneo se muestra si su nombre coincide con la búsqueda o si tiene partidos que coinciden.
    const visibleGroups = useMemo(() => [...groupByKey.values()]
        .map(g => {
            const nameHit = !!q && normalizeQuery(g.name).includes(q);
            const shown = g.matches.filter(m => statusOk(m) && (nameHit || !q || matchHaystack(m).includes(q)));
            return { ...g, nameHit, shown };
        })
        .filter(g => !filtering || g.shown.length > 0 || (g.nameHit && status === 'all')),
    [groupByKey, q, status, statusOk, filtering]);

    // Torneos por año (el archivo crece: cada temporada queda en su bloque).
    const years = useMemo(() => {
        const map = new Map();
        for (const g of visibleGroups) {
            if (g.key === NO_TOURNAMENT_KEY) continue;
            const y = (g.sortDay || '').slice(0, 4) || 'Sin fecha';
            if (!map.has(y)) map.set(y, []);
            map.get(y).push(g);
        }
        return [...map.entries()].map(([year, list]) => ({ year, list }));
    }, [visibleGroups]);
    const loose = visibleGroups.find(g => g.key === NO_TOURNAMENT_KEY);

    const filteredAll = useMemo(() => matches.filter(passes), [matches, passes]);
    const live = useMemo(() => matches.filter(m => m.status !== 'completed')
        .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')), [matches]);
    const totalActions = useMemo(() => matches.reduce((s, m) => s + (m.action_count || 0), 0), [matches]);
    const tournamentCount = groups.filter(g => g.key !== NO_TOURNAMENT_KEY).length;

    // ---- Navegación entre archivo y torneo, con transición ----
    const savedScroll = useRef(0);
    const vtDone = useRef(null);
    const go = useCallback((next, opts) => {
        setIntro(false);
        if (!document.startViewTransition || reducedMotion()) { setParams(next, opts); return; }
        document.startViewTransition(() => new Promise(resolve => {
            vtDone.current = resolve;
            setParams(next, opts);
            setTimeout(resolve, 500); // por si el DOM no cambia
        }));
    }, [setParams]);
    useLayoutEffect(() => {
        window.scrollTo(0, openKey ? 0 : savedScroll.current);
        vtDone.current?.();
        vtDone.current = null;
    }, [openKey]);
    const openTournament = (key) => { savedScroll.current = window.scrollY; go({ torneo: key }); };
    const closeTournament = () => { if (openKey) go({}); };

    // ---- Acciones ----
    async function handleDelete(id) {
        setDeletingId(id);
        const { error } = await deleteMatch(id);
        if (!error && userId) clearPending(userId, id);
        setDeletingId(null);
        setConfirmId(null);
    }

    async function handleSaveTournament(data) {
        const group = editing === 'new' ? null : editing;
        const saved = await saveTournament(data, { userId, matchNames: group ? [...group.matchNames] : [] });
        setTournaments(prev => [...prev.filter(t => t.id !== saved.id), saved]);
        if (group?.matchNames.size) await refetch();
        setEditing(null);
        if (group && openKey === group.key && normalizeName(saved.name) !== group.key) {
            setParams({ torneo: normalizeName(saved.name) }, { replace: true });
        }
    }

    async function handleDeleteTournament() {
        const id = editing?.meta?.id;
        await deleteTournament(id);
        setTournaments(prev => prev.filter(t => t.id !== id));
        setEditing(null);
        if (openGroup && !openGroup.matches.length) setParams({});
    }

    const newMatchIn = (name) => {
        if (!canCreateMatch) { navigate('/pricing'); return; }
        navigate(name ? `/match/new?torneo=${encodeURIComponent(name)}` : '/match/new');
    };

    const pct = Math.min((monthlyUsed / monthlyLimit) * 100, 100);
    const supportMailto = `mailto:${LEGAL.supportEmail}`
        + `?subject=${encodeURIComponent('Soporte — Beach Volley Analytics')}`
        + `&body=${encodeURIComponent(`\n\n---\nUsuario: ${user?.email || ''}\nPlan: ${subscription?.plan || 'free'}\nVersión: ${versionDetail()}`)}`;

    const rowProps = { onOpen: (m) => navigate(matchUrl(m)), onDelete: setConfirmId, onMove: setMoveMatch };

    return (
        <div className="dash-root" style={openGroup ? { '--t-color': openGroup.color } : undefined}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button className="active" onClick={closeTournament}>Mis partidos</button>
                    <button onClick={() => navigate('/match/new')}>Nuevo partido</button>
                    <button onClick={() => navigate('/pizarra')}>Pizarra</button>
                </div>
                <div className="topbar-right"><AccountMenu /></div>
            </div>

            <div className="page-wrap page-wrap--wide">
                {pendingCount > 0 && (
                    <div className="sync-banner" role="status">
                        <span>
                            ⚠ {pendingCount === 1 ? 'Hay 1 partido' : `Hay ${pendingCount} partidos`} con cambios guardados en este equipo que aún no se subieron.
                            Se subirán solos cuando vuelva la conexión. <strong>No borres los datos del navegador.</strong>
                        </span>
                        <button className="btn-primary" onClick={syncPending} disabled={syncing}>{syncing ? 'Subiendo…' : 'Reintentar'}</button>
                    </div>
                )}

                {openGroup ? (
                    <TournamentDetail
                        group={openGroup} passes={passes} query={query} setQuery={setQuery}
                        status={status} setStatus={setStatus} rowProps={rowProps}
                        onBack={closeTournament} onEdit={() => setEditing(openGroup)}
                        onNewMatch={() => newMatchIn(openGroup.key === NO_TOURNAMENT_KEY ? '' : openGroup.name)}
                        canCreateMatch={canCreateMatch}
                    />
                ) : (
                    <>
                        <div className="dash-head">
                            <div className="dash-head-text">
                                <div className="dash-kicker">Archivo de scouting</div>
                                <h1>Mis partidos</h1>
                                <p>Hola, {displayName}. Todo tu trabajo, ordenado por torneo.</p>
                            </div>
                            <button className="btn-new dash-cta" onClick={() => newMatchIn('')} style={!canCreateMatch ? { opacity: 0.6 } : undefined}>
                                {canCreateMatch ? <><IconPlus /> Nuevo partido</> : '🔒 Límite alcanzado'}
                            </button>
                        </div>

                        <dl className="dash-figures">
                            <Figure label="Este mes" value={monthlyUsed} sub={isPaid ? 'Ilimitados · Pro' : `de ${monthlyLimit} · Free`} accent />
                            <Figure label="Torneos" value={tournamentCount} />
                            <Figure label="Partidos" value={matches.length} />
                            <Figure label="Acciones registradas" value={totalActions.toLocaleString('es-ES')} />
                        </dl>

                        {!isPaid && (
                            <div className="limit-bar-wrap">
                                <div className="limit-info">
                                    <div className="limit-title">Plan Free · {monthlyUsed} / {monthlyLimit} partidos este mes</div>
                                    <div className="limit-bar">
                                        <div className="limit-bar-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--c-dn)' : 'var(--accent)' }} />
                                    </div>
                                    <div className="limit-sub">
                                        {canCreateMatch
                                            ? `Te quedan ${monthlyLimit - monthlyUsed} partidos. Actualiza a Pro para partidos ilimitados.`
                                            : 'Límite mensual alcanzado. Actualiza a Pro para continuar.'}
                                    </div>
                                </div>
                                <button className="btn-upgrade" onClick={() => navigate('/pricing')}>Actualizar a Pro →</button>
                            </div>
                        )}

                        {live.length > 0 && (
                            <section className="dash-live">
                                <div className="dash-eyebrow"><span className="live-dot" /> Continuar donde lo dejaste</div>
                                <div className="live-strip">
                                    {live.slice(0, 8).map(m => {
                                        const g = groupByKey.get(normalizeName(m.tournament) || NO_TOURNAMENT_KEY);
                                        return (
                                            <button key={m.id} className="live-card" onClick={() => navigate(matchUrl(m))}>
                                                <span className="live-thumb">{g && <Cover group={g} />}</span>
                                                <span className="live-body">
                                                    <span className="live-t">{g?.name || 'Sin torneo'}</span>
                                                    <span className="live-teams">{m.own_team_name} <i>vs</i> {m.opponent_team_name}</span>
                                                    <span className="live-foot">
                                                        <span className="num">Sets {m.score?.own ?? 0}–{m.score?.opponent ?? 0}</span>
                                                        <span>·</span>
                                                        <span>{formatDay(matchDay(m), { day: 'numeric', month: 'short' })}</span>
                                                    </span>
                                                </span>
                                                <span className="live-go"><IconPlay size={13} /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {matches.length > 0 || tournaments.length > 0 ? (
                            <>
                                <Toolbar query={query} setQuery={setQuery} status={status} setStatus={setStatus}
                                    end={<button className="btn-ghost" onClick={() => setEditing('new')}><IconPlus size={14} /> Torneo</button>}>
                                    <div className="seg" role="tablist" aria-label="Vista">
                                        <button role="tab" aria-selected={view === 'tournaments'} className={view === 'tournaments' ? 'on' : ''} onClick={() => changeView('tournaments')}><IconGrid size={14} /> Torneos</button>
                                        <button role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'on' : ''} onClick={() => changeView('all')}><IconList size={14} /> Cronología</button>
                                    </div>
                                </Toolbar>
                                {tError && <p className="dash-muted">No se pudieron cargar las portadas de los torneos ({tError}).</p>}

                                {loading ? (
                                    <div className="t-grid">{[0, 1, 2, 3].map(i => <div key={i} className="tposter skeleton" />)}</div>
                                ) : view === 'tournaments' ? (
                                    <div className={intro ? 'is-intro' : undefined}>
                                        {years.map(({ year, list }, yi) => {
                                            const feature = yi === 0 && !filtering && list.length >= 3;
                                            return (
                                                <section key={year} className="year-block">
                                                    <div className="year-head">
                                                        <span className="year-num">{year}</span>
                                                        <span className="year-line" />
                                                        <span className="year-count">{plural(list.length, 'torneo', 'torneos')}</span>
                                                    </div>
                                                    <div className={`t-grid${feature ? ' t-grid--feature' : ''}`}>
                                                        {list.map((g, i) => (
                                                            <TournamentPoster key={g.key} group={g} index={i} filtered={filtering}
                                                                featured={feature && i === 0}
                                                                onOpen={() => openTournament(g.key)} onEdit={() => setEditing(g)} />
                                                        ))}
                                                    </div>
                                                </section>
                                            );
                                        })}
                                        {loose && (
                                            <button className="loose-row" onClick={() => openTournament(loose.key)}>
                                                <span className="loose-icon"><IconTag size={16} /></span>
                                                <span className="loose-text">
                                                    <strong>Partidos sin torneo</strong>
                                                    <span>{plural(filtering ? loose.shown.length : loose.matches.length, 'partido', 'partidos')} · asígnalos a un torneo para ordenarlos</span>
                                                </span>
                                                <IconChevron size={16} />
                                            </button>
                                        )}
                                        {years.length === 0 && !loose && <NoResults />}
                                    </div>
                                ) : filteredAll.length === 0 ? <NoResults /> : (
                                    groupByMonth(filteredAll).map(month => (
                                        <section key={month.key} className="month-block">
                                            <div className="month-head"><span>{month.label}</span><span className="dash-count">{month.matches.length}</span></div>
                                            <div className="mrow-list">
                                                {month.matches.map(m => <MatchRow key={m.id} m={m} showTournament {...rowProps} />)}
                                            </div>
                                        </section>
                                    ))
                                )}
                            </>
                        ) : loading ? (
                            <div className="t-grid">{[0, 1, 2, 3].map(i => <div key={i} className="tposter skeleton" />)}</div>
                        ) : (
                            <div className="dash-blank">
                                <div className="dash-blank-art"><TournamentArt name="Beach Volley Analytics" color="#f97316" variant={0} /></div>
                                <h3>Tu archivo empieza aquí</h3>
                                <p>Crea un torneo con su portada y registra tu primer scouting.</p>
                                <div className="dash-blank-actions">
                                    <button className="btn-ghost" onClick={() => setEditing('new')}>Crear torneo</button>
                                    <button className="btn-new" onClick={() => newMatchIn('')}><IconPlus /> Nuevo partido</button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="dash-support">
                    ¿Necesitas ayuda o tienes un problema? Escríbenos a{' '}
                    <a href={supportMailto}>{LEGAL.supportEmail}</a>
                </div>
            </div>

            {editing && (
                <TournamentEditor
                    group={editing === 'new' ? null : editing}
                    takenNames={takenNames}
                    onSave={handleSaveTournament}
                    onDelete={handleDeleteTournament}
                    onClose={() => setEditing(null)}
                />
            )}

            {moveMatch && (
                <MoveDialog match={moveMatch} groups={groups} onClose={() => setMoveMatch(null)}
                    onSave={async (name) => {
                        const { error } = await updateMatch(moveMatch.id, { tournament: name });
                        if (error) throw new Error(error);
                        await refetch();
                        setMoveMatch(null);
                    }} />
            )}

            {confirmId && (
                <div className="modal-overlay" onClick={() => setConfirmId(null)}>
                    <div className="dialog-card" onClick={e => e.stopPropagation()}>
                        <div className="dialog-icon">🗑</div>
                        <h3>Eliminar partido</h3>
                        <p>¿Estás seguro? Esta acción no se puede deshacer.</p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => setConfirmId(null)}>Cancelar</button>
                            <button className="btn-delete" onClick={() => handleDelete(confirmId)} disabled={deletingId === confirmId}>
                                {deletingId === confirmId ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------

function Figure({ label, value, sub, accent }) {
    return (
        <div className={`dash-figure${accent ? ' accent' : ''}`}>
            <dt>{label}</dt>
            <dd className="num">{value}{sub && <small>{sub}</small>}</dd>
        </div>
    );
}

function Toolbar({ query, setQuery, status, setStatus, children, end }) {
    return (
        <div className="dash-toolbar">
            {children}
            <label className="dash-search">
                <IconSearch size={15} />
                <input type="search" placeholder="Buscar jugador, equipo o torneo" value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <div className="chips">
                {STATUS_FILTERS.map(f => (
                    <button key={f.id} className={`chip${status === f.id ? ' on' : ''}`} onClick={() => setStatus(f.id)}>{f.label}</button>
                ))}
            </div>
            {end}
        </div>
    );
}

function NoResults() {
    return <div className="dash-empty-mini">No hay partidos que coincidan con la búsqueda.</div>;
}

// Portada: la imagen del torneo o, si no tiene, una composición generada con su color.
function Cover({ group }) {
    const img = group.meta?.image;
    return (
        <span className="tcover">
            {img
                ? <img src={img} alt="" loading="lazy" decoding="async" />
                : <TournamentArt name={group.name} color={group.key === NO_TOURNAMENT_KEY ? '#64748b' : group.color}
                    variant={group.key === NO_TOURNAMENT_KEY ? 2 : undefined} />}
        </span>
    );
}

function TournamentPoster({ group: g, index, filtered, featured, onOpen, onEdit }) {
    const count = filtered ? g.shown.length : g.matches.length;
    const range = formatRange(g.from, g.to);
    return (
        <article className={`tposter${featured ? ' tposter--featured' : ''}`} role="button" tabIndex={0}
            onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
            style={{ '--t-color': g.color, '--i': Math.min(index, 10), viewTransitionName: g.vt }}>
            <Cover group={g} />
            <span className="tposter-scrim" />
            <div className="tposter-top">
                {g.inProgress > 0
                    ? <span className="glass-pill"><span className="live-dot" /> {g.inProgress} en curso</span>
                    : featured ? <span className="glass-pill">Más reciente</span> : <span />}
                <button className="tposter-edit" title="Editar torneo" aria-label="Editar torneo"
                    onClick={e => { e.stopPropagation(); onEdit(); }}><IconEdit size={14} /></button>
            </div>
            <div className="tposter-info">
                {(range || g.meta?.location) && (
                    <div className="tposter-kicker">
                        {range}{range && g.meta?.location ? ' · ' : ''}{g.meta?.location}
                    </div>
                )}
                <h3 className="tposter-name">{g.name}</h3>
                <div className="tposter-foot">
                    <span><b className="num">{count}</b> {count === 1 ? 'partido' : 'partidos'}{filtered && count !== g.matches.length ? ` de ${g.matches.length}` : ''}</span>
                    <span><b className="num">{g.actions.toLocaleString('es-ES')}</b> acciones</span>
                    <span className="tposter-arrow"><IconChevron size={16} /></span>
                </div>
            </div>
        </article>
    );
}

function TournamentDetail({ group: g, passes, query, setQuery, status, setStatus, rowProps, onBack, onEdit, onNewMatch, canCreateMatch }) {
    const shown = g.matches.filter(passes);
    const isNone = g.key === NO_TOURNAMENT_KEY;
    const range = formatRange(g.from, g.to);
    const record = g.matches.reduce((acc, m) => {
        if (m.status !== 'completed') return acc;
        const own = m.score?.own ?? 0, opp = m.score?.opponent ?? 0;
        if (own > opp) acc.w++; else if (opp > own) acc.l++;
        return acc;
    }, { w: 0, l: 0 });

    return (
        <>
            <div className="thero" style={{ '--t-color': g.color, viewTransitionName: g.vt }}>
                <Cover group={g} />
                <span className="thero-shade" />
                <div className="thero-top">
                    <button className="glass-btn" onClick={onBack}><IconBack size={15} /> Torneos</button>
                    <div className="thero-actions">
                        {!isNone && <button className="glass-btn" onClick={onEdit}><IconEdit size={14} /> Editar</button>}
                        <button className="glass-btn primary" onClick={onNewMatch} style={!canCreateMatch ? { opacity: 0.6 } : undefined}>
                            <IconPlus size={14} /> Nuevo partido
                        </button>
                    </div>
                </div>
                <div className="thero-bottom">
                    <div className="thero-content">
                        <div className="thero-kicker">{isNone ? 'Partidos sueltos' : 'Torneo'}</div>
                        <h1>{g.name}</h1>
                        {(g.meta?.location || range) && (
                            <div className="thero-meta">
                                {g.meta?.location && <span><IconPin size={13} /> {g.meta.location}</span>}
                                {range && <span><IconCalendar size={13} /> {range}</span>}
                            </div>
                        )}
                    </div>
                    <dl className="thero-stats">
                        <div><dt>Partidos</dt><dd className="num">{g.matches.length}</dd></div>
                        <div><dt>En curso</dt><dd className="num">{g.inProgress}</dd></div>
                        <div><dt>Balance</dt><dd className="num">{record.w}<i>–</i>{record.l}</dd></div>
                        <div><dt>Acciones</dt><dd className="num">{g.actions.toLocaleString('es-ES')}</dd></div>
                    </dl>
                </div>
            </div>

            <Toolbar query={query} setQuery={setQuery} status={status} setStatus={setStatus} />

            {g.matches.length === 0 ? (
                <div className="dash-blank dash-blank--plain">
                    <h3>Este torneo aún no tiene partidos</h3>
                    <p>Crea el primero y quedará guardado aquí.</p>
                    <div className="dash-blank-actions">
                        <button className="btn-new" onClick={onNewMatch}><IconPlus /> Nuevo partido</button>
                    </div>
                </div>
            ) : shown.length === 0 ? <NoResults /> : (
                groupByDay(shown).map(day => (
                    <section key={day.key} className="month-block">
                        <div className="month-head"><span>{day.label}</span><span className="dash-count">{day.matches.length}</span></div>
                        <div className="mrow-list">
                            {day.matches.map(m => <MatchRow key={m.id} m={m} hideDate {...rowProps} />)}
                        </div>
                    </section>
                ))
            )}
        </>
    );
}

// Fila de partido con marcador tipo tablero: un equipo por línea, sets ganados y parciales.
function MatchRow({ m, showTournament, hideDate, onOpen, onDelete, onMove }) {
    const isScout = m.match_type === 'scouting';
    const done = m.status === 'completed';
    const sets = (m.sets || []).filter(s => (s?.own || 0) + (s?.opponent || 0) > 0).slice(0, 5);
    const own = m.score?.own ?? 0, opp = m.score?.opponent ?? 0;
    const winner = done ? (own > opp ? 'own' : opp > own ? 'opp' : '') : '';

    const line = (side, name, won) => (
        <div className={`mboard-line${winner === side ? ' win' : winner ? ' lose' : ''}`}>
            <span className="mboard-name">{name}</span>
            <span className="mboard-sets num">{won}</span>
            {sets.map((s, i) => {
                const mine = side === 'own' ? s.own : s.opponent, theirs = side === 'own' ? s.opponent : s.own;
                return <span key={i} className={`mboard-pt num${mine > theirs ? ' hi' : ''}`}>{mine}</span>;
            })}
        </div>
    );

    return (
        <div className={`mrow${done ? '' : ' is-live'}`} role="button" tabIndex={0}
            onClick={() => onOpen(m)} onKeyDown={e => { if (e.key === 'Enter') onOpen(m); }}>
            <span className={`mrow-type ${isScout ? 'sc' : 'k'}`} title={isScout ? 'Scouting de tendencias' : 'Análisis completo K1/K2'}>{isScout ? 'SC' : 'K1'}</span>
            <div className="mrow-main">
                <div className="mboard" style={{ '--sets': sets.length }}>
                    {line('own', m.own_team_name, own)}
                    {line('opp', m.opponent_team_name, opp)}
                </div>
                <div className="mrow-meta">
                    {!done && <span className="mrow-live"><span className="live-dot" /> En progreso</span>}
                    {!hideDate && <span>{formatDay(matchDay(m))}</span>}
                    {showTournament && m.tournament?.trim() && <span className="mrow-t">{m.tournament.trim()}</span>}
                    {m.location && <span>{m.location}</span>}
                    {m.action_count > 0 && <span>{m.action_count} acciones</span>}
                </div>
            </div>
            <div className="mrow-actions">
                <button className="btn-icon" title="Mover a otro torneo" aria-label="Mover a otro torneo" onClick={e => { e.stopPropagation(); onMove(m); }}><IconTag size={14} /></button>
                <button className="btn-icon danger" title="Eliminar" aria-label="Eliminar" onClick={e => { e.stopPropagation(); onDelete(m.id); }}><IconTrash size={14} /></button>
            </div>
            <span className="mrow-go" aria-hidden><IconChevron size={16} /></span>
        </div>
    );
}

function MoveDialog({ match, groups, onClose, onSave }) {
    const [name, setName] = useState(match.tournament?.trim() || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const options = groups.filter(g => g.key !== NO_TOURNAMENT_KEY);

    async function submit(e) {
        e.preventDefault();
        setBusy(true); setError('');
        // Si coincide con un torneo existente (sin importar mayúsculas), usar su nombre exacto.
        const hit = options.find(g => g.key === normalizeName(name));
        try { await onSave(hit ? hit.name : name.trim().replace(/\s+/g, ' ')); }
        catch (err) { setError(err.message); setBusy(false); }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <form className="tedit tedit--sm" onClick={e => e.stopPropagation()} onSubmit={submit}>
                <div className="tedit-head"><h3>Mover a torneo</h3></div>
                <p className="dash-muted" style={{ marginBottom: '0.9rem' }}>{match.own_team_name} vs {match.opponent_team_name}</p>
                <div className="form-group">
                    <label>Torneo</label>
                    <input className="form-input" list="move-tournaments" autoFocus value={name}
                        placeholder="Escribe o elige un torneo (vacío = sin torneo)" onChange={e => setName(e.target.value)} />
                    <datalist id="move-tournaments">{options.map(g => <option key={g.key} value={g.name} />)}</datalist>
                </div>
                <div className="chips" style={{ marginBottom: '1rem' }}>
                    {options.slice(0, 6).map(g => (
                        <button type="button" key={g.key} className={`chip${normalizeName(name) === g.key ? ' on' : ''}`} onClick={() => setName(g.name)}>{g.name}</button>
                    ))}
                </div>
                {error && <p className="tedit-error">{error}</p>}
                <div className="tedit-actions">
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn-new" disabled={busy}>{busy ? 'Moviendo…' : 'Mover'}</button>
                </div>
            </form>
        </div>
    );
}
