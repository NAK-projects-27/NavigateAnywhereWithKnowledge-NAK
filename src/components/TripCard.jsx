// ============================================
// TripCard.jsx
// ============================================
// One saved trip, rendered as a card for the profile page.
// Display only - loading and deleting are the parent's job.
// ============================================

import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Trash2, MessageCircle } from 'lucide-react';

export default function TripCard({ trip, onDelete }) {
    const destinations = trip.destinations || [];

    // "Jun 15 - Jun 22, 2026", or a single date, or nothing
    const dateLabel = formatDateRange(trip.start_date, trip.end_date);

    return (
        <div style={{
            borderRadius: '14px',
            border: '1px solid rgba(0,224,255,0.15)',
            background: 'rgba(0,224,255,0.03)',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            {/* ---------- TITLE ROW ---------- */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '17px',
                        fontWeight: 700,
                        color: '#eaf6ff',
                        marginBottom: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {trip.title}
                    </div>

                    {dateLabel && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '13px',
                            color: 'var(--muted)'
                        }}>
                            <Calendar size={13} />
                            {dateLabel}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onDelete(trip)}
                    title="Delete trip"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff6b8a',
                        opacity: 0.65,
                        cursor: 'pointer',
                        padding: '4px',
                        flexShrink: 0
                    }}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* ---------- NOTES ---------- */}
            {trip.description && (
                <div style={{
                    fontSize: '13px',
                    color: '#e6eef6',
                    opacity: 0.75,
                    lineHeight: 1.45
                }}>
                    {trip.description}
                </div>
            )}

            {/* ---------- STOPS ---------- */}
            {destinations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {destinations.slice(0, 4).map(dest => (
                        <span
                            key={dest.id}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 9px',
                                borderRadius: '20px',
                                background: 'rgba(0,224,255,0.08)',
                                border: '1px solid rgba(0,224,255,0.18)',
                                fontSize: '12px',
                                color: '#e6eef6'
                            }}
                        >
                            <MapPin size={11} style={{ color: 'var(--neon-cyan)' }} />
                            {dest.name}
                        </span>
                    ))}

                    {destinations.length > 4 && (
                        <span style={{
                            padding: '4px 9px',
                            fontSize: '12px',
                            color: 'var(--muted)'
                        }}>
                            +{destinations.length - 4} more
                        </span>
                    )}
                </div>
            )}

            {/* ---------- FOOTER ---------- */}
            {trip.conversation_id && (
                <Link
                    to={`/chat?conversation=${trip.conversation_id}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--neon-cyan)',
                        textDecoration: 'none',
                        marginTop: '2px'
                    }}
                >
                    <MessageCircle size={14} />
                    Open the chat
                </Link>
            )}
        </div>
    );
}

function formatDateRange(start, end) {
    if (!start && !end) return null;

    const opts = { month: 'short', day: 'numeric' };
    const startDate = start ? new Date(`${start}T00:00:00`) : null;
    const endDate = end ? new Date(`${end}T00:00:00`) : null;

    if (startDate && endDate) {
        return `${startDate.toLocaleDateString('en-US', opts)} - ` +
               `${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    }

    const single = startDate || endDate;
    return single.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
}

TripCard.propTypes = {
    trip: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        description: PropTypes.string,
        start_date: PropTypes.string,
        end_date: PropTypes.string,
        conversation_id: PropTypes.string,
        destinations: PropTypes.array
    }).isRequired,
    onDelete: PropTypes.func.isRequired
};