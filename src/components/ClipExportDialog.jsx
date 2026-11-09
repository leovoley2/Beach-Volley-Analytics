import React, { useState, useRef, useEffect } from 'react';
import { exportClips, pickType, safeFileName, saveBlob } from '../lib/clipExporter';
import { clipBounds, totalDuration, fmtTime } from '../lib/videoClips';

// Diálogo "Descargar video": une los clips en un solo archivo (MP4 si el navegador lo permite)
// con portada y rótulos, listo para mandar por WhatsApp. Todo ocurre en el navegador.
export default function ClipExportDialog({ clips, src, defaultTitle, subtitle, labelFor, onClose }) {
    const [title, setTitle] = useState(defaultTitle);
    const [titleCard, setTitleCard] = useState(clips.length > 1);
    const [overlay, setOverlay] = useState(true);
    const [quality, setQuality] = useState(720);
    const [phase, setPhase] = useState('form'); // form | running | done | error
    const [progress, setProgress] = useState({ p: 0, text: '' });
    const [result, setResult] = useState(null); // File
    const [error, setError] = useState('');
    const signal = useRef({ cancelled: false });
    const type = pickType();
    const duration = totalDuration(clips);

    // Si se cierra el diálogo a mitad de la exportación, cancelarla.
    useEffect(() => () => { signal.current.cancelled = true; }, []);

    const start = async () => {
        signal.current = { cancelled: false };
        setPhase('running');
        setProgress({ p: 0, text: 'Preparando…' });
        try {
            const res = await exportClips({
                src,
                ranges: clips.map(clipBounds),
                labels: clips.map(labelFor),
                title: title.trim() || 'Clips',
                subtitle,
                titleCard,
                overlay,
                maxHeight: quality,
                signal: signal.current,
                onProgress: (p, text) => setProgress({ p, text }),
            });
            if (!res) { onClose(); return; }
            const file = new File([res.blob], safeFileName(title.trim(), res.ext), { type: res.blob.type });
            setResult(file);
            setPhase('done');
            saveBlob(file);
        } catch (err) {
            setError(err?.message || String(err));
            setPhase('error');
        }
    };

    const cancel = () => {
        if (phase === 'running') signal.current.cancelled = true;
        else onClose();
    };

    const canShare = result && navigator.canShare?.({ files: [result] });

    return (
        <div className="modal-overlay" onClick={phase === 'running' ? undefined : onClose}>
            <div className="dialog-card vs-export" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vs-export-title">
                <h3 id="vs-export-title">Descargar video</h3>
                <p className="vs-export-info">
                    {clips.length} clip{clips.length === 1 ? '' : 's'} · {fmtTime(duration, false)} de video
                    {type ? ` · ${type.ext.toUpperCase()} · tarda ~${Math.ceil(duration + (titleCard ? 3 : 1))} s` : ''}
                </p>

                {!type && <p className="vs-export-error">Este navegador no puede crear videos. Usa Chrome o Safari actualizados.</p>}

                {phase === 'form' && type && (
                    <div className="vs-export-form">
                        <label>
                            <span>Título</span>
                            <input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />
                        </label>
                        <label className="vs-check">
                            <input type="checkbox" checked={titleCard} onChange={e => setTitleCard(e.target.checked)} />
                            Portada con el título (2 s)
                        </label>
                        <label className="vs-check">
                            <input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} />
                            Rótulo en cada clip: jugador, fundamento y resultado
                        </label>
                        <label>
                            <span>Calidad</span>
                            <select value={quality} onChange={e => setQuality(Number(e.target.value))}>
                                <option value={480}>480p · más liviano para WhatsApp</option>
                                <option value={720}>720p · recomendado</option>
                                <option value={1080}>1080p · máxima calidad</option>
                            </select>
                        </label>
                    </div>
                )}

                {phase === 'running' && (
                    <div className="vs-export-progress">
                        <div className="vs-export-bar"><span style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
                        <p>{progress.text} · {Math.round(progress.p * 100)}%</p>
                        <p className="vs-export-hint">Se graba en tiempo real. <strong>No cambies de pestaña</strong> mientras se crea (si lo haces, se pausa).</p>
                    </div>
                )}

                {phase === 'done' && result && (
                    <div className="vs-export-done">
                        <p>✅ <strong>{result.name}</strong> · {(result.size / 1048576).toFixed(1)} MB — se descargó a tu carpeta de Descargas.</p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => saveBlob(result)}>Descargar otra vez</button>
                            {canShare && (
                                <button className="btn-primary" onClick={() => navigator.share({ files: [result], title }).catch(() => {})}>Compartir…</button>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'error' && <p className="vs-export-error">No se pudo crear el video: {error}</p>}

                <div className="dialog-actions">
                    <button className="btn-cancel" onClick={cancel}>{phase === 'running' ? 'Cancelar' : 'Cerrar'}</button>
                    {phase === 'form' && type && (
                        <button className="btn-primary vs-export-start" onClick={start}>Crear video</button>
                    )}
                </div>
            </div>
        </div>
    );
}
