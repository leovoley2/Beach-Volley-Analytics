import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function PlayerCharts({ playerStats }) {
  if (!playerStats) return null;

  const skills = Object.keys(playerStats.skills);

  const actionsBySkillData = {
    labels: skills,
    datasets: [
      {
        label: 'Total de Acciones',
        data: skills.map(skill => playerStats.skills[skill].total),
        backgroundColor: 'rgba(0, 122, 255, 0.6)',
        borderColor: 'rgba(0, 122, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const outcomesBySkillData = {
    labels: skills,
    datasets: [
      {
        label: 'Positivas (#)',
        data: skills.map(skill => playerStats.skills[skill].Positivo),
        backgroundColor: 'rgba(52, 199, 89, 0.7)',
      },
      {
        label: 'Negativas (=)',
        data: skills.map(skill => playerStats.skills[skill].Negativo),
        backgroundColor: 'rgba(255, 59, 48, 0.7)',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                stepSize: 1 // Asegura que el eje Y vaya de 1 en 1
            }
        }
    }
  };

  return (
    <div className="charts-container">
      <h4>Gráficas de Rendimiento</h4>
      <div style={{ marginBottom: '2rem' }}>
        <h5>Total de Acciones por Habilidad</h5>
        <Bar data={actionsBySkillData} options={options} />
      </div>
      <div>
        <h5>Resultados por Habilidad</h5>
        <Bar data={outcomesBySkillData} options={{...options, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }}} />
      </div>
    </div>
  );
}

export default PlayerCharts;