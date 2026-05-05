import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart,
    CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ALL_SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque Contundente', 'Ataque Coloque', 'Ataque 2 Toques', 'Bloqueo', 'Defensa'];

// Color palette aligned with index.css tokens
const OUTCOME_COLORS = {
    'Doble Positivo': { bg: '#16a34a', border: '#15803d' },
    'Positivo': { bg: '#22c55e', border: '#16a34a' },
    'Overpass': { bg: '#ca8a04', border: '#a16207' },
    'Negativo': { bg: '#ea580c', border: '#c2410c' },
    'Doble Negativo': { bg: '#dc2626', border: '#b91c1c' },
};

const OUTCOME_KEYS = ['Doble Positivo', 'Positivo', 'Overpass', 'Negativo', 'Doble Negativo'];
const OUTCOME_LABELS = ['# Doble Positivo', '+ Positivo', '/ Overpass', '- Negativo', '= Doble Negativo'];

// Scoring skills that generate a point on Doble Positivo
const SCORING_SKILLS = ['Saque', 'Ataque Contundente', 'Ataque Coloque', 'Ataque 2 Toques', 'Bloqueo'];

/**
 * Reconstructs rallies (puntos) from the raw, ordered action list.
 * A new rally starts at the beginning and after every scoring action.
 * Returns an array of rally objects: { rallyNum, score, actions[] }
 */
function buildRallies(actions) {
    if (!actions || actions.length === 0) return [];
    let rallyNum = 1;
    const rallies = [];
    let current = { rallyNum, actions: [] };

    actions.forEach((action) => {
        current.actions.push(action);
        const isScoring =
            (SCORING_SKILLS.some(s => action.skill === s) && action.outcome === 'Doble Positivo') ||
            action.outcome === 'Doble Negativo';
        if (isScoring) {
            rallies.push(current);
            rallyNum++;
            current = { rallyNum, actions: [] };
        }
    });
    if (current.actions.length > 0) {
        rallies.push(current);
    }
    return rallies;
}

// Outcome → dot colour
const OUTCOME_DOT_COLOR = {
    'Doble Positivo': '#16a34a',
    'Positivo':       '#22c55e',
    'Overpass':       '#ca8a04',
    'Negativo':       '#ea580c',
    'Doble Negativo': '#dc2626',
};
// Outcome → icon symbol
const OUTCOME_SYMBOL = {
    'Doble Positivo': '#',
    'Positivo':       '+',
    'Overpass':       '/',
    'Negativo':       '-',
    'Doble Negativo': '=',
};

/** Timeline of actions grouped by rally (point) */
function PointChronology({ playerActions, allSetActions, playerColor, playerName }) {
    const [tooltip, setTooltip] = useState(null);

    // Use full set actions for rally boundary detection; fall back to playerActions
    const sourceForRallies = (allSetActions && allSetActions.length > 0) ? allSetActions : playerActions;

    if (!playerActions || playerActions.length === 0) {
        return (
            <div style={{ textAlign: 'center', color: '#7a8899', fontSize: '0.85rem', padding: '2rem 0' }}>
                Sin acciones registradas
            </div>
        );
    }

    // Reconstruct rally boundaries from ALL match actions, then map each player action to its rally
    const allRallies = buildRallies(sourceForRallies);

    // Map each action to its rally number via a composite key (timestamp + setIndex + player + skill)
    const makeKey = (a) => `${a.timestamp}_${a.setIndex}_${a.playerId}_${a.skill}`;
    const keyToRally = {};
    allRallies.forEach(rally => {
        rally.actions.forEach((a) => {
            keyToRally[makeKey(a)] = rally.rallyNum;
        });
    });

    // Determine unique rally numbers that this player participated in
    const playerRallyNums = [...new Set(
        playerActions.map(a => keyToRally[makeKey(a)] ?? null).filter(n => n !== null)
    )].sort((a, b) => a - b);

    // Build rally objects that contain only this player's actions, in correct rally order
    const playerRallyMap = {};
    playerActions.forEach(a => {
        const rNum = keyToRally[makeKey(a)] ?? 0;
        if (!playerRallyMap[rNum]) playerRallyMap[rNum] = { rallyNum: rNum, actions: [] };
        playerRallyMap[rNum].actions.push(a);
    });
    const rallies = playerRallyNums.map(n => playerRallyMap[n]);
    const dotR = 7;
    const colW = 28;     // width per rally column
    const rowH = 26;     // height per action row
    const headerH = 32; // space for the rally number labels
    const leftPad = 100; // space for skill labels on the left
    const rightPad = 12;

    // All unique skills present in these actions (ordered)
    const skillOrder = ['Saque', 'Recepción', 'Armado', 'Ataque Contundente', 'Ataque Coloque', 'Ataque 2 Toques', 'Bloqueo', 'Defensa'];
    const activeSkills = skillOrder.filter(sk => playerActions.some(a => a.skill === sk));

    const svgW = leftPad + rallies.length * colW + rightPad;
    const svgH = headerH + activeSkills.length * rowH + 16;

    return (
        <div style={{ overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
            <svg
                width={svgW}
                height={svgH}
                style={{ display: 'block', minWidth: '100%' }}
                onMouseLeave={() => setTooltip(null)}
            >
                {/* Background */}
                <rect x={0} y={0} width={svgW} height={svgH} fill="transparent" />

                {/* Skill row labels */}
                {activeSkills.map((sk, ri) => {
                    const cy = headerH + ri * rowH + rowH / 2;
                    return (
                        <g key={sk}>
                            {/* row zebra */}
                            <rect
                                x={leftPad} y={headerH + ri * rowH}
                                width={rallies.length * colW} height={rowH}
                                fill={ri % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)'}
                            />
                            <text
                                x={leftPad - 8} y={cy}
                                textAnchor="end" dominantBaseline="middle"
                                style={{ fontSize: '10px', fill: '#8b949e', fontFamily: 'Inter, sans-serif' }}
                            >
                                {sk}
                            </text>
                        </g>
                    );
                })}

                {/* Rally columns */}
                {rallies.map((rally, ci) => {
                    const cx = leftPad + ci * colW + colW / 2;
                    // Determine if this rally ended with a positive or negative for the player
                    const lastAction = rally.actions[rally.actions.length - 1];
                    const rallyEndsGood =
                        lastAction &&
                        (lastAction.outcome === 'Doble Positivo' || lastAction.outcome === 'Positivo');
                    const rallyEndsBad =
                        lastAction &&
                        (lastAction.outcome === 'Doble Negativo' || lastAction.outcome === 'Negativo');

                    const headerY = headerH - 8;
                    const headerColor = rallyEndsGood ? '#22c55e' : rallyEndsBad ? '#dc2626' : '#ca8a04';

                    return (
                        <g key={ci}>
                            {/* Vertical grid line */}
                            <line
                                x1={cx} y1={headerH}
                                x2={cx} y2={svgH - 8}
                                stroke="rgba(255,255,255,0.06)" strokeWidth="1"
                            />
                            {/* Rally number label */}
                            <text
                                x={cx} y={headerY}
                                textAnchor="middle" dominantBaseline="middle"
                                style={{
                                    fontSize: '9px',
                                    fill: headerColor,
                                    fontWeight: '600',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                            >
                                {rally.rallyNum}
                            </text>

                            {/* Action dots for each skill row */}
                            {rally.actions.map((action, ai) => {
                                const skillIdx = activeSkills.indexOf(action.skill);
                                if (skillIdx === -1) return null;
                                const cy = headerH + skillIdx * rowH + rowH / 2;
                                const fill = OUTCOME_DOT_COLOR[action.outcome] || '#7a8899';
                                const sym = OUTCOME_SYMBOL[action.outcome] || '?';
                                return (
                                    <g
                                        key={ai}
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                                            setTooltip({
                                                x: cx,
                                                y: cy - dotR - 2,
                                                skill: action.skill,
                                                outcome: action.outcome,
                                                rally: rally.rallyNum,
                                            });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    >
                                        <circle cx={cx} cy={cy} r={dotR} fill={fill} opacity={0.92} />
                                        <text
                                            x={cx} y={cy}
                                            textAnchor="middle" dominantBaseline="middle"
                                            style={{
                                                fontSize: '8px',
                                                fill: 'white',
                                                fontWeight: '700',
                                                fontFamily: 'monospace',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            {sym}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}

                {/* Tooltip */}
                {tooltip && (
                    <g>
                        <rect
                            x={tooltip.x - 58} y={tooltip.y - 28}
                            width={116} height={26}
                            rx={5} ry={5}
                            fill="#1e2d3d" stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                        />
                        <text
                            x={tooltip.x} y={tooltip.y - 15}
                            textAnchor="middle" dominantBaseline="middle"
                            style={{
                                fontSize: '9px',
                                fill: '#e8edf5',
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            Pto {tooltip.rally} · {tooltip.skill} · {OUTCOME_SYMBOL[tooltip.outcome]}{tooltip.outcome}
                        </text>
                    </g>
                )}
            </svg>

            {/* Legend */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px',
                marginTop: '8px', paddingLeft: `${leftPad}px`
            }}>
                {OUTCOME_KEYS.map(key => (
                    <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#8b949e' }}>
                        <span style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: OUTCOME_DOT_COLOR[key],
                            display: 'inline-block', flexShrink: 0
                        }} />
                        {OUTCOME_SYMBOL[key]} {key}
                    </span>
                ))}
            </div>
        </div>
    );
}

function PlayerReport({ playerName, playerStats, playerColor, matchType, playerActions, allSetActions }) {
    if (!playerStats || !playerStats.skills) {
        return <div className="player-report error">Error: Faltan datos del jugador.</div>;
    }

    // Only include skills where the player has at least one action
    const activeSkills = ALL_SKILLS.filter(skill => {
        const s = playerStats.skills[skill];
        return s && s.total > 0;
    });

    if (activeSkills.length === 0) return null; // No actions at all — skip

    // --- Chart: Stacked horizontal bar (skills with data only) ---
    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#8b949e',
                    font: { family: 'Inter', size: 11 },
                    boxWidth: 12,
                    padding: 12,
                },
            },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}`,
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { stepSize: 1, color: '#7a8899', font: { size: 10 } },
                grid: { color: 'rgba(255,255,255,0.05)' },
                border: { color: 'rgba(255,255,255,0.08)' },
            },
            y: {
                stacked: true,
                ticks: { color: '#e8edf5', font: { size: 11, weight: '600' } },
                grid: { display: false },
                border: { color: 'rgba(255,255,255,0.08)' },
            },
        },
    };

    const barData = {
        labels: activeSkills,
        datasets: OUTCOME_KEYS.map((key, i) => ({
            label: OUTCOME_LABELS[i],
            data: activeSkills.map(skill => playerStats.skills[skill]?.[key] || 0),
            backgroundColor: OUTCOME_COLORS[key].bg,
            borderColor: OUTCOME_COLORS[key].border,
            borderWidth: 0,
            borderRadius: 3,
        })),
    };

    // --- Totals for header chips ---
    const totalsByOutcome = OUTCOME_KEYS.map(key =>
        activeSkills.reduce((sum, skill) => sum + (playerStats.skills[skill]?.[key] || 0), 0)
    );
    const totalActions = totalsByOutcome.reduce((a, b) => a + b, 0);

    // Eficiencia general: ((# + +) - (- + =)) × 100 / total
    const overallEff = totalActions > 0
        ? Number((((totalsByOutcome[0] + totalsByOutcome[1]) - (totalsByOutcome[3] + totalsByOutcome[4])) / totalActions * 100).toFixed(0))
        : 0;
    // Eficacia general: # × 100 / total
    const overallEficacia = totalActions > 0
        ? Number(((totalsByOutcome[0] / totalActions) * 100).toFixed(0))
        : 0;

    return (
        <div className="player-report">
            {/* Player header */}
            <div className="player-report-header">
                <span className="player-color-dot" style={{ background: playerColor || '#888' }} />
                <h3>{playerName}</h3>
                <div className="player-summary-chips">
                    <span className="chip chip-total">{totalActions} acciones</span>
                    <span className="chip chip-eficacia">
                        ⚡ {overallEficacia}% eficacia
                    </span>
                    <span className={`chip ${overallEff >= 0 ? 'chip-pos' : 'chip-neg'}`}>
                        {overallEff >= 0 ? '+' : ''}{overallEff}% eficiencia
                    </span>
                </div>
            </div>

            {/* Charts section */}
            <div className={`player-charts-grid ${matchType === 'scouting' ? 'scouting-mode' : ''}`}>
                {/* Main stacked bar */}
                <div className="chart-bar-wrap">
                    <p className="chart-label">Resultados por Fundamento</p>
                    <div style={{ height: `${Math.max(180, activeSkills.length * 38)}px` }}>
                        <Bar options={barOptions} data={barData} />
                    </div>
                </div>
                {/* Point Chronology: one dot per action, per rally/point */}
                <div className="chart-donut-wrap" style={{ overflowX: 'hidden' }}>
                    <p className="chart-label">Cronología por Puntos</p>
                    <PointChronology
                        playerActions={playerActions || []}
                        allSetActions={allSetActions || []}
                        playerColor={playerColor}
                        playerName={playerName}
                    />
                </div>
            </div>

            {/* Stats table — only skills with data */}
            <div className="stats-table-wrap">
                <p className="chart-label">Detalle Estadístico</p>
                <table className="compact-table">
                    <thead>
                        <tr>
                            <th>Fundamento</th>
                            <th>Total</th>
                            <th title="Doble Positivo">#</th>
                            <th title="Positivo">+</th>
                            <th title="Overpass">/</th>
                            <th title="Negativo">-</th>
                            <th title="Doble Negativo">=</th>
                            <th title="Eficacia = # × 100 / Total">%Eficacia</th>
                            <th title="Eficiencia = ((# + +) − (- + =)) × 100 / Total">%Eficiencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeSkills.map(skill => {
                            const s = playerStats.skills[skill];
                            const dp = s['Doble Positivo'] || 0;
                            const pos = s['Positivo'] || 0;
                            const ovp = s['Overpass'] || 0;
                            const neg = s['Negativo'] || 0;
                            const dn = s['Doble Negativo'] || 0;
                            // Eficacia: # × 100 / total
                            const eficacia = Number(((dp / s.total) * 100).toFixed(0));
                            // Eficiencia: ((# + +) − (- + =)) × 100 / total
                            const eff = Number((((dp + pos) - (neg + dn)) / s.total * 100).toFixed(0));
                            return (
                                <tr key={skill}>
                                    <td><strong>{skill}</strong></td>
                                    <td>{s.total}</td>
                                    <td className="cell-dp">{dp}</td>
                                    <td className="cell-pos">{pos}</td>
                                    <td className="cell-ovp">{ovp}</td>
                                    <td className="cell-neg">{neg}</td>
                                    <td className="cell-dn">{dn}</td>
                                    <td><strong style={{ color: eficacia > 0 ? '#22c55e' : '#7a8899' }}>{eficacia}%</strong></td>
                                    <td><strong style={{ color: eff >= 0 ? '#22c55e' : '#dc2626' }}>{eff}%</strong></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PlayerReport;
