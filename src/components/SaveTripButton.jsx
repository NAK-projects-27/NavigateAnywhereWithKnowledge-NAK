// ============================================
// SaveTripButton.jsx
// ============================================
// Button + modal for saving the current conversation as a trip.
//
// The modal prefills itself from the conversation: the title comes
// from the conversation title, and the stops come from the map blocks
// the AI already produced. The user confirms rather than types.
// ============================================

import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Save, X, MapPin, Check } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { getPlacesForConversation, saveTrip } from '../api/tripsApi';

export default function SaveTripButton({ conversationId, conversationTitle }) {
    const { user } = useContext(AuthContext);

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [savedTrip, setSavedTrip] = useState(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [places, setPlaces] = useState([]);
    const [excluded, setExcluded] = useState(new Set());

    async function openModal() {
        setIsOpen(true);
        setIsLoading(true);
        setError(null);
        setSavedTrip(null);
        setExcluded(new Set());

        // Prefill the title from the conversation, minus the ellipsis
        // ChatInterface adds when it truncates.
        setTitle((conversationTitle || 'My Trip').replace(/\.\.\.$/, ''));
        setDescription('');
        setStartDate('');
        setEndDate('');

        try {
            const found = await getPlacesForConversation(conversationId);
            setPlaces(found);
            if (found.length === 0) {
                setError('No destinations found in this chat yet. Ask NAK to plan a route first.');
            }
        } catch (err) {
            console.error('Could not read conversation:', err);
            setError('Could not read this conversation');
        } finally {
            setIsLoading(false);
        }
    }

    function togglePlace(place) {
        setExcluded(prev => {
            const next = new Set(prev);
            if (next.has(place)) {
                next.delete(place);
            } else {
                next.add(place);
            }
            return next;
        });
    }

    async function handleSave() {
        const selected = places.filter(p => !excluded.has(p));

        if (!title.trim()) {
            setError('Give your trip a title');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const result = await saveTrip({
                userId: user.id,
                conversationId,
                title,
                description,
                startDate: startDate || null,
                endDate: endDate || null,
                places: selected
            });

            setSavedTrip(result);

            // Close on its own so the success state is visible briefly
            setTimeout(() => setIsOpen(false), 1800);

        } catch (err) {
            console.error('Save trip failed:', err);
            setError(err.message || 'Could not save trip');
        } finally {
            setIsSaving(false);
        }
    }

    const selectedCount = places.length - excluded.size;

    return (
        <>
            <button
                onClick={openModal}
                disabled={!conversationId}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,224,255,0.3)',
                    background: 'rgba(0,224,255,0.08)',
                    color: 'var(--neon-cyan)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: conversationId ? 'pointer' : 'not-allowed',
                    opacity: conversationId ? 1 : 0.4
                }}
            >
                <Save size={15} />
                Save Trip
            </button>

            {!isOpen ? null : (
                <div
                    onClick={() => !isSaving && setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,6,23,0.75)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '480px',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            borderRadius: '16px',
                            border: '1px solid rgba(0,224,255,0.2)',
                            background: '#0b1220',
                            boxShadow: '0 20px 60px rgba(2,6,23,0.6)',
                            padding: '24px'
                        }}
                    >
                        {/* ---------- HEADER ---------- */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                fontSize: '19px',
                                fontWeight: 800,
                                color: '#eaf6ff'
                            }}>
                                Save this trip
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                disabled={isSaving}
                                style={{
                                    marginLeft: 'auto',
                                    background: 'none',
                                    border: 'none',
                                    color: '#e6eef6',
                                    opacity: 0.6,
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* ---------- SUCCESS ---------- */}
                        {savedTrip ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '32px 12px',
                                color: '#e6eef6'
                            }}>
                                <Check
                                    size={44}
                                    style={{ color: 'var(--neon-cyan)', marginBottom: '12px' }}
                                />
                                <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
                                    Saved to your profile
                                </div>
                                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                    {savedTrip.savedCount} destination
                                    {savedTrip.savedCount === 1 ? '' : 's'} stored
                                    {savedTrip.skipped.length > 0 &&
                                        ` — couldn't locate ${savedTrip.skipped.join(', ')}`}
                                </div>
                            </div>
                        ) : isLoading ? (
                            <div style={{
                                padding: '40px',
                                textAlign: 'center',
                                color: 'var(--neon-cyan)',
                                fontSize: '14px',
                                fontWeight: 600
                            }}>
                                Reading your conversation...
                            </div>
                        ) : (
                            <>
                                {/* ---------- TITLE ---------- */}
                                <Field label="Trip name">
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Dallas to Louisville road trip"
                                        style={inputStyle}
                                    />
                                </Field>

                                {/* ---------- DATES ---------- */}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <Field label="Start date" style={{ flex: 1 }}>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            style={inputStyle}
                                        />
                                    </Field>
                                    <Field label="End date" style={{ flex: 1 }}>
                                        <input
                                            type="date"
                                            value={endDate}
                                            min={startDate || undefined}
                                            onChange={e => setEndDate(e.target.value)}
                                            style={inputStyle}
                                        />
                                    </Field>
                                </div>

                                {/* ---------- NOTES ---------- */}
                                <Field label="Notes (optional)">
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={2}
                                        placeholder="Anything you want to remember"
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>

                                {/* ---------- DESTINATIONS ---------- */}
                                {places.length > 0 && (
                                    <Field label={`Stops (${selectedCount} of ${places.length})`}>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}>
                                            {places.map(place => {
                                                const isIncluded = !excluded.has(place);
                                                return (
                                                    <button
                                                        key={place}
                                                        onClick={() => togglePlace(place)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '9px',
                                                            padding: '10px 12px',
                                                            borderRadius: '9px',
                                                            border: isIncluded
                                                                ? '1px solid rgba(0,224,255,0.35)'
                                                                : '1px solid rgba(255,255,255,0.08)',
                                                            background: isIncluded
                                                                ? 'rgba(0,224,255,0.07)'
                                                                : 'transparent',
                                                            color: '#e6eef6',
                                                            opacity: isIncluded ? 1 : 0.45,
                                                            fontSize: '14px',
                                                            textAlign: 'left',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <MapPin
                                                            size={15}
                                                            style={{ color: 'var(--neon-cyan)', flexShrink: 0 }}
                                                        />
                                                        {place}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>
                                )}

                                {/* ---------- ERROR ---------- */}
                                {error && (
                                    <div style={{
                                        padding: '11px 13px',
                                        borderRadius: '9px',
                                        background: 'rgba(255,107,138,0.08)',
                                        border: '1px solid rgba(255,107,138,0.25)',
                                        color: '#ff6b8a',
                                        fontSize: '13px',
                                        marginBottom: '16px'
                                    }}>
                                        {error}
                                    </div>
                                )}

                                {/* ---------- ACTIONS ---------- */}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        disabled={isSaving}
                                        style={{
                                            flex: '0 0 auto',
                                            padding: '11px 18px',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'transparent',
                                            color: '#e6eef6',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || !title.trim()}
                                        style={{
                                            flex: 1,
                                            padding: '11px 18px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-indigo))',
                                            color: '#031024',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            cursor: isSaving ? 'wait' : 'pointer',
                                            opacity: (isSaving || !title.trim()) ? 0.55 : 1
                                        }}
                                    >
                                        {isSaving ? 'Saving...' : 'Save trip'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// Small local helpers so the form markup stays readable
function Field({ label, children, style }) {
    return (
        <div style={{ marginBottom: '16px', ...style }}>
            <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--neon-cyan)',
                marginBottom: '6px'
            }}>
                {label}
            </div>
            {children}
        </div>
    );
}

Field.propTypes = {
    label: PropTypes.string.isRequired,
    children: PropTypes.node,
    style: PropTypes.object
};

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '9px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6eef6',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
};

SaveTripButton.propTypes = {
    conversationId: PropTypes.string,
    conversationTitle: PropTypes.string
};