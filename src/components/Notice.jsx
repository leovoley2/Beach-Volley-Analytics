import React from 'react';

// Mensaje de resultado de un formulario: msg = { ok: boolean, text: string } | null
export default function Notice({ msg }) {
    if (!msg) return null;
    return <div className={`notice ${msg.ok ? 'notice-ok' : 'notice-error'}`}>{msg.text}</div>;
}
