import { useRef, useState } from 'react';
import { compressCover, normalizeName } from '../lib/tournamentsApi';
import { TOURNAMENT_COLORS, colorFor } from '../lib/matchGrouping';
import TournamentArt from './TournamentArt';
import { IconImage, IconTrash, IconClose } from './Icons';

// Crear / editar un torneo: portada, nombre, sede, fechas y color.
export default function TournamentEditor({ group, takenNames = [], onSave, onDelete, onClose }) {
    const meta = group?.meta;
    const [name, setName]         = useState(group?.name || '');
    const [location, setLocation] = useState(meta?.location || '');
    const [start, setStart]       = useState(meta?.start_date || '');
    const [end, setEnd]           = useState(meta?.end_date || '');
    const [color, setColor]       = useState(meta?.color || '');
    const [image, setImage]       = useState(meta?.image || '');
    const [busy, setBusy]         = useState(false);
    const [error, setError]       = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const fileRef = useRef(null);

    const accent = colorFor(name || 'Torneo', color);
    const isNew = !group;

    async function pickImage(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        try { setImage(await compressCover(file)); }
        catch (err) { setError(err.message); }
    }

    async function submit(e) {
        e.preventDefault();
        const clean = name.trim().replace(/\s+/g, ' ');
        if (!clean) { setError('Ponle un nombre al torneo.'); return; }
        if (normalizeName(clean) !== group?.key && takenNames.includes(normalizeName(clean))) {
            setError('Ya tienes un torneo con ese nombre.'); return;
        }
        if (start && end && end < start) { setError('La fecha final no puede ser anterior a la inicial.'); return; }
        setBusy(true); setError('');
        try {
            await onSave({ id: meta?.id, name: clean, location, start_date: start, end_date: end, color, image });
        } catch (err) {
            setError(err.message); setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try { await onDelete(); } catch (err) { setError(err.message); setBusy(false); }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <form className="tedit" onClick={e => e.stopPropagation()} onSubmit={submit}>
                <div className="tedit-head">
                    <h3>{isNew ? 'Nuevo torneo' : 'Editar torneo'}</h3>
                    <button type="button" className="tedit-x" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
                </div>

                <button type="button" className="tedit-cover" onClick={() => fileRef.current?.click()}
                    style={{ '--t-color': accent }}>
                    {image
                        ? <img src={image} alt="" />
                        : <TournamentArt name={name || 'Torneo'} color={accent} />}
                    <span className="tedit-cover-hint"><IconImage /> {image ? 'Cambiar portada' : 'Añadir portada'}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
                {image && (
                    <button type="button" className="tedit-link" onClick={() => setImage('')}>Quitar portada</button>
                )}

                <div className="form-group">
                    <label>Nombre del torneo</label>
                    <input className="form-input" autoFocus={isNew} value={name} maxLength={120}
                        placeholder="Ej: Circuito Sudamericano · Lima" onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Sede</label>
                    <input className="form-input" value={location} maxLength={120}
                        placeholder="Ciudad, país" onChange={e => setLocation(e.target.value)} />
                </div>
                <div className="tedit-row">
                    <div className="form-group">
                        <label>Inicio</label>
                        <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Fin</label>
                        <input className="form-input" type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
                    </div>
                </div>
                <div className="form-group">
                    <label>Color</label>
                    <div className="tedit-swatches">
                        {TOURNAMENT_COLORS.map(c => (
                            <button key={c} type="button" aria-label={`Color ${c}`}
                                className={`tedit-swatch${accent === c ? ' on' : ''}`}
                                style={{ background: c }} onClick={() => setColor(c)} />
                        ))}
                    </div>
                </div>

                {!isNew && group.matches.length > 0 && name.trim() !== group.name && (
                    <p className="tedit-note">Los {group.matches.length} partidos de este torneo pasarán a llamarse con el nuevo nombre.</p>
                )}
                {error && <p className="tedit-error">{error}</p>}

                <div className="tedit-actions">
                    {meta?.id && onDelete && (
                        confirmDelete
                            ? <button type="button" className="tedit-del confirm" onClick={remove} disabled={busy}>¿Seguro? Quitar</button>
                            : <button type="button" className="tedit-del" onClick={() => setConfirmDelete(true)} title="Quita la portada y los datos del torneo. Los partidos no se borran.">
                                <IconTrash /> Quitar datos
                            </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn-new" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </form>
        </div>
    );
}
