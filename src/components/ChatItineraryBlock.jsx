// ============================================
// ChatItineraryBlock.jsx
// ============================================
// Renders a day-by-day itinerary as a vertical timeline, with a
// button to save it as a real trip.
//
// DIFFERENT FROM THE OTHER BLOCKS:
// Map, weather, and events all fetch external data before they can
// render. Claude generates the entire itinerary itself, so there's
// nothing to load - this renders immediately from the block data.
// The only async work is saving.
// ============================================

import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import {
    Calendar, Clock, MapPin, Save, Check,
    Utensils, Camera, Bed, Car, Ticket
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { saveItinerary } from '../api/itineraryApi';

// Activity type -> icon. Falls back to the map pin for anything
// Claude invents that isn't in this list.
const TYPE_ICONS = {
    restaurant: Utensils,
    attraction: Camera,
    hotel: Bed,
    travel: Car,
    event: Ticket,
    other: MapPin
};

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export default function ChatItineraryBlock({ data, conversationId}) {
    const { user } = useContext(AuthContext);

    const [openDay, setOpenDay] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);

    const days = data.days || [];
    const symbol = CURRENCY_SYMBOLS[data.currency] || '';

    if (days.length === 0) return null;

    async function handleSave() {
        setIsSaving(true);
        setError(null);

        try {
            const result = await saveItinerary({
                userId: user.id,
                conversationId,
                itinerary: data
            });
            setSaved(result);
        } catch (err) {
            console.error('Save itinerary failed:', err);
            setError(err.message || 'Could not save');
        } finally {
            setIsSaving(false);
        }
    }

    const activeDay = days[openDay] || days[0];

    return (
        <div style={{
            marginTop: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(0,224,255,0.2)',
            background: 'rgba(0,224,255,0.04)',
            overflow: 'hidden'
        }}>
            {/* ---------- HEADER ---------- */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(0,224,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
            }}>
                <Calendar size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: '140px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#eaf6ff' }}>
                        {data.title || 'Your itinerary'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                        {days.length} day{days.length === 1 ? '' : 's'}
                        {data.destination && ` · ${data.destination}`}
                    </div>
                </div>

                {/* Save button, or a confirmation once saved */}
                {saved ? (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--neon-cyan)'
                    }}>
                        <Check size={14} /> Saved to your trips
                    </span>
                ) : (
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !user}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 13px',
                            borderRadius: '9px',
                            border: '1px solid rgba(0,224,255,0.3)',
                            background: 'rgba(0,224,255,0.08)',
                            color: 'var(--neon-cyan)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: isSaving ? 'wait' : 'pointer',
                            opacity: isSaving ? 0.6 : 1,
                            flexShrink: 0
                        }}
                    >
                        <Save size={13} />
                        {isSaving ? 'Saving...' : 'Save trip'}
                    </button>
                )}
            </div>

            {error && (
                <div style={{
                    padding: '9px 16px',
                    fontSize: '12.5px',
                    color: '#ff6b8a',
                    background: 'rgba(255,107,138,0.06)'
                }}>
                    {error}
                </div>
            )}

            {/* ---------- DAY TABS ---------- */}
            {/* Horizontally scrollable so a 10-day trip doesn't wrap
                into an unusable pile of buttons */}
            <div style={{
                display: 'flex',
                gap: '6px',
                padding: '12px 14px 0',
                overflowX: 'auto'
            }}>
                {days.map((day, index) => {
                    const isActive = index === openDay;
                    return (
                        <button
                            key={index}
                            onClick={() => setOpenDay(index)}
                            style={{
                                flexShrink: 0,
                                padding: '7px 14px',
                                borderRadius: '20px',
                                border: isActive
                                    ? '1px solid rgba(0,224,255,0.45)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                background: isActive
                                    ? 'rgba(0,224,255,0.12)'
                                    : 'transparent',
                                color: isActive ? 'var(--neon-cyan)' : '#e6eef6',
                                opacity: isActive ? 1 : 0.6,
                                fontSize: '12.5px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Day {day.day ?? index + 1}
                        </button>
                    );
                })}
            </div>

            {/* ---------- ACTIVE DAY ---------- */}
            <div style={{ padding: '14px 16px 16px' }}>
                {activeDay.title && (
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#eaf6ff',
                        marginBottom: activeDay.notes ? '3px' : '12px'
                    }}>
                        {activeDay.title}
                    </div>
                )}

                {activeDay.notes && (
                    <div style={{
                        fontSize: '13px',
                        color: '#e6eef6',
                        opacity: 0.7,
                        marginBottom: '12px',
                        lineHeight: 1.45
                    }}>
                        {activeDay.notes}
                    </div>
                )}

                {/* Timeline of activities */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(activeDay.activities || []).map((activity, index, arr) => {
                        const Icon = TYPE_ICONS[activity.type] || MapPin;
                        const isLast = index === arr.length - 1;

                        return (
                            <div key={index} style={{ display: 'flex', gap: '12px' }}>
                                {/* Rail: icon plus the connecting line */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    flexShrink: 0
                                }}>
                                    <div style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        border: '1px solid rgba(0,224,255,0.3)',
                                        background: 'rgba(0,224,255,0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Icon size={14} style={{ color: 'var(--neon-cyan)' }} />
                                    </div>

                                    {/* No line after the last item, or the
                                        timeline appears to continue nowhere */}
                                    {!isLast && (
                                        <div style={{
                                            width: '1px',
                                            flex: 1,
                                            minHeight: '18px',
                                            background: 'rgba(0,224,255,0.18)',
                                            margin: '3px 0'
                                        }} />
                                    )}
                                </div>

                                {/* Activity detail */}
                                <div style={{
                                    flex: 1,
                                    minWidth: 0,
                                    paddingBottom: isLast ? 0 : '16px'
                                }}>
                                    {(activity.time || activity.endTime) && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '11.5px',
                                            fontWeight: 600,
                                            color: 'var(--neon-cyan)',
                                            marginBottom: '2px'
                                        }}>
                                            <Clock size={11} />
                                            {activity.time}
                                            {activity.endTime && ` – ${activity.endTime}`}
                                        </div>
                                    )}

                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#eaf6ff',
                                        lineHeight: 1.35
                                    }}>
                                        {activity.name}
                                    </div>

                                    {activity.description && (
                                        <div style={{
                                            fontSize: '13px',
                                            color: '#e6eef6',
                                            opacity: 0.7,
                                            marginTop: '3px',
                                            lineHeight: 1.45
                                        }}>
                                            {activity.description}
                                        </div>
                                    )}

                                    {(activity.place || activity.price != null) && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            marginTop: '5px',
                                            fontSize: '12px',
                                            opacity: 0.6,
                                            flexWrap: 'wrap'
                                        }}>
                                            {activity.place && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px'
                                                }}>
                                                    <MapPin size={11} />
                                                    {activity.place}
                                                </span>
                                            )}
                                            {activity.price != null && (
                                                <span>{symbol}{activity.price}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

ChatItineraryBlock.propTypes = {
    data: PropTypes.shape({
        title: PropTypes.string,
        destination: PropTypes.string,
        startDate: PropTypes.string,
        currency: PropTypes.string,
        days: PropTypes.array
    }).isRequired,
    conversationId: PropTypes.string
};