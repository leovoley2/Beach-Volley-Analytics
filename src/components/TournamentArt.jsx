import { useId, useMemo } from 'react';

// Portada generativa para torneos sin imagen: una composición abstracta de playa
// (sol, horizonte, cancha, red) única y estable para cada nombre de torneo.

function seedOf(str) {
    let h = 2166136261;
    for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const W = 400, H = 300;

function wavePath(y0, amp, freq, phase) {
    let d = `M0 ${H} L0 ${y0.toFixed(1)}`;
    for (let x = 0; x <= W; x += 10) {
        const y = y0 + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp;
        d += ` L${x} ${y.toFixed(1)}`;
    }
    return `${d} L${W} ${H} Z`;
}

export default function TournamentArt({ name = '', color = '#f97316', variant: forced }) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const art = useMemo(() => {
        const r = rng(seedOf(name.toLowerCase().trim() || 'torneo'));
        const variant = forced ?? Math.floor(r() * 3);
        const left = r() > 0.5;
        const sunX = left ? 70 + r() * 80 : 250 + r() * 90;
        const sunY = 62 + r() * 46;
        const sunR = 42 + r() * 30;
        const waves = [0, 1, 2, 3].map(i => wavePath(188 + i * 27 + r() * 6, 5 + r() * 6, 1 + r() * 1.4, r() * 6.28));
        const shift = (r() - 0.5) * 70;
        const tilt = (r() - 0.5) * 6;
        return { variant, sunX, sunY, sunR, waves, shift, tilt };
    }, [name, forced]);
    const { variant, sunX, sunY, sunR, waves, shift, tilt } = art;

    return (
        <svg className="tart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
            <defs>
                <linearGradient id={`${id}b`} x1="0" y1="0" x2="0.35" y2="1">
                    <stop offset="0" stopColor="#1b2028" /><stop offset="1" stopColor="#0b0d11" />
                </linearGradient>
                <radialGradient id={`${id}g`} cx={sunX / W} cy={sunY / H} r="0.85">
                    <stop offset="0" stopColor={color} stopOpacity="0.6" />
                    <stop offset="0.45" stopColor={color} stopOpacity="0.16" />
                    <stop offset="1" stopColor={color} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${id}s`} x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                    <stop offset="0.25" stopColor={color} stopOpacity="1" />
                    <stop offset="1" stopColor={color} stopOpacity="0.35" />
                </linearGradient>
                <pattern id={`${id}n`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <path d="M0 0H9M0 0V9" stroke="#fff" strokeWidth="0.6" fill="none" />
                </pattern>
                <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" />
                </linearGradient>
                <mask id={`${id}m`}><rect width={W} height={H} fill={`url(#${id}f)`} /></mask>
            </defs>

            <rect width={W} height={H} fill={`url(#${id}b)`} />
            <rect width={W} height={H} fill={`url(#${id}g)`} />

            {variant === 0 && (
                <>
                    <circle cx={sunX} cy={sunY + 60} r={sunR + 14} fill={`url(#${id}s)`} />
                    {waves.map((d, i) => (
                        <path key={i} d={d} fill={i % 2 ? '#0b0d11' : color} fillOpacity={i % 2 ? 0.72 : 0.2 + i * 0.05} />
                    ))}
                    <path d={waves[0].replace(/^M0 300 L/, 'M').replace(/ L400 300 Z$/, '')} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />
                </>
            )}

            {variant === 1 && (
                <g transform={`translate(${shift} 0) rotate(${tilt} 200 220)`}>
                    <circle cx={sunX - shift} cy={sunY} r={sunR * 0.55} fill={`url(#${id}s)`} />
                    <path d="M132 150H268L440 320H-40Z" fill={color} fillOpacity="0.08" stroke="#fff" strokeOpacity="0.26" strokeWidth="1" />
                    <path d="M92 198H308V176H92Z" fill={`url(#${id}n)`} fillOpacity="0.32" />
                    <path d="M92 176H308M92 198H308" stroke="#fff" strokeOpacity="0.42" strokeWidth="1.1" />
                    <path d="M92 168V214M308 168V214" stroke="#fff" strokeOpacity="0.36" strokeWidth="1.4" />
                </g>
            )}

            {variant === 2 && (
                <>
                    {[1, 2, 3, 4, 5, 6, 7].map(k => (
                        <circle key={k} cx={sunX} cy={sunY + 20} r={sunR * 0.6 + k * 30} fill="none"
                            stroke={k % 3 === 0 ? color : '#fff'} strokeOpacity={0.34 - k * 0.035}
                            strokeWidth={k % 3 === 0 ? 1.4 : 0.8} strokeDasharray={k === 4 ? '2 7' : undefined} />
                    ))}
                    <circle cx={sunX} cy={sunY + 20} r={sunR * 0.6} fill={`url(#${id}s)`} />
                    <rect y="150" width={W} height="150" fill={`url(#${id}n)`} fillOpacity="0.16" mask={`url(#${id}m)`} />
                </>
            )}

            <rect width={W} height={H} fill={`url(#${id}n)`} fillOpacity="0.035" />
        </svg>
    );
}
