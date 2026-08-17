// ============================================
// TripDetail.jsx - Read-only trip view
// ============================================
// Route: /trip/:id
//
// Renders a saved trip. Handles both shapes a trip can take:
//   - itinerary trips: trip_days -> activities (day tabs + timeline)
//   - Save Trip trips: a flat destinations list
// Whichever exists is what gets shown.
//
// PASS 1 IS READ-ONLY. Editing comes next.
// ============================================

import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Calendar, Clock, MapPin, Trash2, MessageCircle,
    Utensils, Camera, Bed, Car, Ticket, Package
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { getTripDetail } from '../api/itineraryApi';
import { deleteTrip } from '../api/tripsApi';
import InlineChatMap from '../components/InlineChatMap';
import '../styles/global.css';

const TYPE_ICONS = {
    restaurant: Utensils,
    attraction: Camera,
    hotel: Bed,
    travel: Car,
    event: Ticket,
    other: MapPin
};

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export default function TripDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDay, setOpenDay] = useState(0);

    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }

        let cancelled = false;

        // The state updates live inside this function rather than in the
        // effect body. Same behaviour, but it satisfies
        // react-hooks/set-state-in-effect, which flags synchronous
        // setState calls directly in an effect.
        async function load() {
            setLoading(true);
            setError(null);

            try {
                const data = await getTripDetail(id);
                if (!cancelled) {
                    setTrip(data);
                    setOpenDay(0);   // reset tab when switching trips
                }
            } catch (err) {
                console.error('Load trip failed:', err);
                // RLS returns "no rows" for someone else's trip, which is
                // indistinguishable from a deleted one — and that's correct.
                // Don't reveal which it was.
                if (!cancelled) setError('Trip not found');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [id, user, navigate]);

    async function handleDelete() {
        if (!window.confirm(`Delete "${trip.title}"? This can't be undone.`)) return;

        try {
            await deleteTrip(trip.id);
            navigate('/profile');
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Could not delete trip');
        }
    }

    // ---------- LOADING / ERROR ----------
    if (loading) {
        return (
            <div className="app-center">
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Loading trip…</div>
                </div>
            </div>
        );
    }

    if (error || !trip) {
        return (
            <div className="app-center">
                <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
                    <Package size={40} style={{
                        color: 'var(--muted)',
                        margin: '0 auto 14px',
                        opacity: 0.5
                    }} />
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                        {error || 'Trip not found'}
                    </div>
                    <Link to="/profile" className="btn" style={{ marginTop: 12 }}>
                        Back to profile
                    </Link>
                </div>
            </div>
        );
    }

    const days = trip.trip_days || [];
    const destinations = trip.destinations || [];
    const hasItinerary = days.length > 0;

    const activeDay = days[openDay] || days[0];

    // Which points go on the map. For an itinerary that's the selected
    // day's activities; otherwise the flat destination list. Activities
    // have nullable coordinates, so unmappable ones are filtered out.
    const mapLocations = hasItinerary
        ? (activeDay?.activities || [])
            .filter(a => a.latitude != null && a.longitude != null)
            .map(a => ({ lat: a.latitude, lng: a.longitude, name: a.name }))
        : destinations
            .filter(d => d.latitude != null && d.longitude != null)
            .map(d => ({ lat: d.latitude, lng: d.longitude, name: d.name }));

    return (
        <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
            {/* ---------- BACK ---------- */}
            <button
                onClick={() => navigate('/profile')}
                className="btn-ghost"
                style={{ marginBottom: 20 }}
            >
                <ArrowLeft size={16} /> Back to profile
            </button>

            {/* ---------- HEADER ---------- */}
            <div className="card">
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap'
                }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <h1 style={{
                            fontSize: 26,
                            fontWeight: 800,
                            margin: 0,
                            color: '#eaf6ff'
                        }}>
                            {trip.title}
                        </h1>

                        {trip.description && (
                            <div style={{
                                fontSize: 14,
                                color: '#e6eef6',
                                opacity: 0.75,
                                marginTop: 6,
                                lineHeight: 1.5
                            }}>
                                {trip.description}
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            gap: 16,
                            marginTop: 10,
                            flexWrap: 'wrap',
                            fontSize: 13,
                            color: 'var(--muted)'
                        }}>
                            {formatDateRange(trip.start_date, trip.end_date) && (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5
                                }}>
                                    <Calendar size={13} />
                                    {formatDateRange(trip.start_date, trip.end_date)}
                                </span>
                            )}

                            {hasItinerary && (
                                <span>{days.length} day{days.length === 1 ? '' : 's'}</span>
                            )}

                            {!hasItinerary && destinations.length > 0 && (
                                <span>
                                    {destinations.length} stop
                                    {destinations.length === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {trip.conversation_id && (
                            <Link
                                to={`/chat?conversation=${trip.conversation_id}`}
                                className="btn-ghost"
                            >
                                <MessageCircle size={16} /> Open chat
                            </Link>
                        )}

                        <button
                            onClick={handleDelete}
                            className="btn-ghost"
                            style={{
                                color: '#ff9aa2',
                                borderColor: 'rgba(255,100,110,0.1)'
                            }}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* ---------- ITINERARY VIEW ---------- */}
            {hasItinerary && (
                <div className="card" style={{ marginTop: 20 }}>
                    {/* Day tabs */}
                    <div style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        paddingBottom: 4,
                        marginBottom: 18
                    }}>
                        {days.map((day, index) => {
                            const isActive = index === openDay;
                            return (
                                <button
                                    key={day.id}
                                    onClick={() => setOpenDay(index)}
                                    style={{
                                        flexShrink: 0,
                                        padding: '8px 16px',
                                        borderRadius: 20,
                                        border: isActive
                                            ? '1px solid rgba(0,224,255,0.45)'
                                            : '1px solid rgba(255,255,255,0.08)',
                                        background: isActive
                                            ? 'rgba(0,224,255,0.12)'
                                            : 'transparent',
                                        color: isActive ? 'var(--neon-cyan)' : '#e6eef6',
                                        opacity: isActive ? 1 : 0.6,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Day {day.day_number}
                                </button>
                            );
                        })}
                    </div>

                    {/* Day heading */}
                    {activeDay?.title && (
                        <div style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#eaf6ff',
                            marginBottom: activeDay.notes ? 4 : 14
                        }}>
                            {activeDay.title}
                        </div>
                    )}

                    {activeDay?.date && (
                        <div style={{
                            fontSize: 13,
                            color: 'var(--muted)',
                            marginBottom: 12
                        }}>
                            {new Date(`${activeDay.date}T00:00:00`).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    )}

                    {activeDay?.notes && (
                        <div style={{
                            fontSize: 14,
                            color: '#e6eef6',
                            opacity: 0.75,
                            marginBottom: 18,
                            lineHeight: 1.5
                        }}>
                            {activeDay.notes}
                        </div>
                    )}

                    {/* Activity timeline */}
                    <ActivityTimeline
                        activities={activeDay?.activities || []}
                        currency={activeDay?.activities?.[0]?.currency}
                    />
                </div>
            )}

            {/* ---------- DESTINATIONS VIEW (Save Trip shape) ---------- */}
            {!hasItinerary && destinations.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                    <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#eaf6ff',
                        marginBottom: 14
                    }}>
                        Stops
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {destinations.map(dest => (
                            <div
                                key={dest.id}
                                style={{
                                    display: 'flex',
                                    gap: 12,
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}
                            >
                                <MapPin
                                    size={16}
                                    style={{
                                        color: 'var(--neon-cyan)',
                                        flexShrink: 0,
                                        marginTop: 2
                                    }}
                                />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                                        {dest.name}
                                    </div>
                                    {dest.description && (
                                        <div style={{
                                            fontSize: 13,
                                            opacity: 0.65,
                                            marginTop: 2
                                        }}>
                                            {dest.description}
                                        </div>
                                    )}
                                    {dest.visit_date && (
                                        <div style={{
                                            fontSize: 12,
                                            color: 'var(--neon-cyan)',
                                            marginTop: 4
                                        }}>
                                            {new Date(`${dest.visit_date}T00:00:00`)
                                                .toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ---------- MAP ---------- */}
            {mapLocations.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                    <div style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#eaf6ff',
                        marginBottom: 4
                    }}>
                        {hasItinerary ? `Day ${activeDay?.day_number} map` : 'Route'}
                    </div>

                    <InlineChatMap
                        locations={mapLocations}
                        showRoute={mapLocations.length >= 2}
                        zoom={hasItinerary ? 12 : 6}
                        mapStyle={hasItinerary ? 'satellite-streets-v12' : 'outdoors-v12'}
                    />
                </div>
            )}

            {/* ---------- EMPTY ---------- */}
            {!hasItinerary && destinations.length === 0 && (
                <div className="card" style={{
                    marginTop: 20,
                    textAlign: 'center',
                    padding: '50px 20px'
                }}>
                    <Package size={40} style={{
                        color: 'var(--neon-cyan)',
                        opacity: 0.4,
                        margin: '0 auto 14px'
                    }} />
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                        Nothing planned yet
                    </div>
                    <div className="small" style={{ color: 'var(--muted)' }}>
                        This trip has no stops or days saved to it.
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// ACTIVITY TIMELINE
// ============================================
function ActivityTimeline({ activities, currency }) {
    const symbol = CURRENCY_SYMBOLS[currency] || '';

    if (activities.length === 0) {
        return (
            <div style={{
                fontSize: 14,
                color: 'var(--muted)',
                padding: '20px 0'
            }}>
                No activities planned for this day.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activities.map((activity, index) => {
                const Icon = TYPE_ICONS[activity.type] || MapPin;
                const isLast = index === activities.length - 1;

                return (
                    <div key={activity.id} style={{ display: 'flex', gap: 14 }}>
                        {/* Rail */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flexShrink: 0
                        }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                border: '1px solid rgba(0,224,255,0.3)',
                                background: 'rgba(0,224,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Icon size={15} style={{ color: 'var(--neon-cyan)' }} />
                            </div>

                            {!isLast && (
                                <div style={{
                                    width: 1,
                                    flex: 1,
                                    minHeight: 20,
                                    background: 'rgba(0,224,255,0.18)',
                                    margin: '4px 0'
                                }} />
                            )}
                        </div>

                        {/* Detail */}
                        <div style={{
                            flex: 1,
                            minWidth: 0,
                            paddingBottom: isLast ? 0 : 20
                        }}>
                            {(activity.time_start || activity.time_end) && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--neon-cyan)',
                                    marginBottom: 3
                                }}>
                                    <Clock size={11} />
                                    {formatTime(activity.time_start)}
                                    {activity.time_end && ` – ${formatTime(activity.time_end)}`}
                                </div>
                            )}

                            <div style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: '#eaf6ff',
                                lineHeight: 1.35
                            }}>
                                {activity.name}
                            </div>

                            {activity.description && (
                                <div style={{
                                    fontSize: 13.5,
                                    color: '#e6eef6',
                                    opacity: 0.7,
                                    marginTop: 4,
                                    lineHeight: 1.5
                                }}>
                                    {activity.description}
                                </div>
                            )}

                            {(activity.address || activity.price != null) && (
                                <div style={{
                                    display: 'flex',
                                    gap: 14,
                                    marginTop: 6,
                                    fontSize: 12.5,
                                    opacity: 0.6,
                                    flexWrap: 'wrap'
                                }}>
                                    {activity.address && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            <MapPin size={11} />
                                            {activity.address}
                                        </span>
                                    )}
                                    {activity.price != null && (
                                        <span>{symbol}{activity.price}</span>
                                    )}
                                </div>
                            )}

                            {activity.booking_url && (
                                <a
                                    href={activity.booking_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-block',
                                        marginTop: 6,
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: 'var(--neon-cyan)'
                                    }}
                                >
                                    Book →
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================
// HELPERS
// ============================================

/** Postgres time comes back as 'HH:MM:SS'. Show '9:30 AM'. */
function formatTime(value) {
    if (!value) return '';
    const [hours, minutes] = value.split(':');
    const date = new Date();
    date.setHours(Number(hours), Number(minutes));
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatDateRange(start, end) {
    if (!start && !end) return null;

    const opts = { month: 'short', day: 'numeric' };
    const startDate = start ? new Date(`${start}T00:00:00`) : null;
    const endDate = end ? new Date(`${end}T00:00:00`) : null;

    if (startDate && endDate) {
        return `${startDate.toLocaleDateString('en-US', opts)} – ` +
               `${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    }

    const single = startDate || endDate;
    return single.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
}