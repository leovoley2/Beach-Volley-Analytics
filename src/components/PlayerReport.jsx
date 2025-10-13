import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SKILLS = ['Saque', 'Recepción', 'Colocación', 'Ataque Contundente', 'Ataque Coloque', 'Bloqueo', 'Defensa'];
const chartOptions = {
    indexAxis: 'y', responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Resultados por Habilidad (+/-)', font: { size: 14 } } },
    scales: { x: { stacked: true, ticks: { stepSize: 1 } }, y: { stacked: true } }
};

function PlayerReport({ playerName, playerStats }) {
    if (!playerStats || !playerStats.skills) {
        return <div className="player-report error">Error: Faltan datos del jugador.</div>;
    }

    const chartData = {
        labels: SKILLS,
        datasets: [
            { label: 'Positivos', data: SKILLS.map(skill => playerStats.skills[skill]?.Positivo || 0), backgroundColor: 'rgba(52, 199, 89, 0.8)' },
            { label: 'Negativos', data: SKILLS.map(skill => playerStats.skills[skill]?.Negativo || 0), backgroundColor: 'rgba(255, 59, 48, 0.8)' },
        ],
    };

    return (
        <div className="player-report">
            <h3>{playerName}</h3>
            <div className="report-layout">
                <div className="report-table-side">
                    <h4>Estadísticas Detalladas</h4>
                    <table className="compact-table">
                        <thead><tr><th>Fundamento</th><th>Total</th><th>%Ef</th><th>%Err</th><th>%Efic.</th></tr></thead>
                        <tbody>
                            {SKILLS.map(skill => {
                                const s = playerStats.skills[skill];
                                if (!s) return <tr key={skill}><td colSpan="5">{skill} - Sin datos</td></tr>;
                                const total = s.total;
                                if (total === 0) return <tr key={skill}><td>{skill}</td><td>0</td><td>-</td><td>-</td><td>-</td></tr>;
                                const eficacia = ((s.Positivo / total) * 100).toFixed(0);
                                const error = ((s.Negativo / total) * 100).toFixed(0);
                                const eficiencia = (((s.Positivo - s.Negativo) / total) * 100).toFixed(0);
                                return <tr key={skill}><td>{skill}</td><td>{total}</td><td>{eficacia}%</td><td>{error}%</td><td>{eficiencia}%</td></tr>;
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="report-chart-side"><Bar options={chartOptions} data={chartData} /></div>
            </div>
        </div>
    );
}

export default PlayerReport;
