import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart,
    CategoryScale, LinearScale, BarElement,
    ArcElement,
    Title, Tooltip, Legend
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const ALL_SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque Contundente', 'Ataque Coloque', 'Bloqueo', 'Defensa'];

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

function PlayerReport({ playerName, playerStats, playerColor, matchType }) {
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

    // --- Doughnut: overall outcome distribution ---
    const totalsByOutcome = OUTCOME_KEYS.map(key =>
        activeSkills.reduce((sum, skill) => sum + (playerStats.skills[skill]?.[key] || 0), 0)
    );
    const totalActions = totalsByOutcome.reduce((a, b) => a + b, 0);

    const doughnutData = {
        labels: OUTCOME_LABELS,
        datasets: [{
            data: totalsByOutcome,
            backgroundColor: OUTCOME_KEYS.map(k => OUTCOME_COLORS[k].bg),
            borderColor: '#121929',
            borderWidth: 2,
            hoverOffset: 6,
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: '#8b949e',
                    font: { family: 'Inter', size: 10 },
                    boxWidth: 10,
                    padding: 8,
                },
            },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const pct = totalActions > 0 ? ((ctx.parsed / totalActions) * 100).toFixed(0) : 0;
                        return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                    },
                },
            },
        },
    };

    // Eficiencia general: ((# + +) - (- + =)) × 100 / total
    const overallEff = totalActions > 0
        ? (((totalsByOutcome[0] + totalsByOutcome[1]) - (totalsByOutcome[3] + totalsByOutcome[4])) / totalActions * 100).toFixed(0)
        : 0;
    // Eficacia general: # × 100 / total
    const overallEficacia = totalActions > 0
        ? ((totalsByOutcome[0] / totalActions) * 100).toFixed(0)
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
                {/* Doughnut summary (Hide in scouting mode because 100% is always 'Ataque') */}
                {matchType !== 'scouting' && (
                    <div className="chart-donut-wrap">
                        <p className="chart-label">Distribución General</p>
                        <div style={{ height: '180px' }}>
                            <Doughnut options={doughnutOptions} data={doughnutData} />
                        </div>
                    </div>
                )}
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
                            const eficacia = ((dp / s.total) * 100).toFixed(0);
                            // Eficiencia: ((# + +) − (- + =)) × 100 / total
                            const eff = (((dp + pos) - (neg + dn)) / s.total * 100).toFixed(0);
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
