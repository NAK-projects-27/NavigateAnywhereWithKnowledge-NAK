// ============================================
// itineraryApi.js - Day-by-day itinerary storage
// ============================================
// Saves an AI-generated itinerary as a real trip: one trips row,
// one trip_days row per day, one activities row per activity.
//
// Unlike maps and weather, nothing here calls an external API.
// Claude generates the whole itinerary; this just persists it.
// ============================================

import supabase from './supabaseClient';
import { geocodeLocationCached } from './mapboxApi';

/**
 * Save an itinerary block as a new trip.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.conversationId]
 * @param {object} params.itinerary   the parsed json:itinerary block
 * @returns {Promise<{trip: object, dayCount: number, activityCount: number}>}
 */
export async function saveItinerary({ userId, conversationId = null, itinerary }) {
    if (!userId) throw new Error('Not signed in');
    if (!itinerary?.days?.length) throw new Error('Itinerary has no days');

    const startDate = itinerary.startDate || null;
    const endDate = startDate
        ? addDays(startDate, itinerary.days.length - 1)
        : null;

    // ---- Step 1: create the trip ----
    const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
            user_id: userId,
            conversation_id: conversationId,
            title: itinerary.title || 'My Itinerary',
            description: itinerary.destination || null,
            start_date: startDate,
            end_date: endDate
        })
        .select()
        .single();

    if (tripError) throw tripError;

    // Everything after this point rolls back the trip on failure, so
    // a partial save never leaves a half-built itinerary behind.
    try {
        // ---- Step 2: create the days ----
        const dayRows = itinerary.days.map((day, index) => ({
            trip_id: trip.id,
            day_number: day.day ?? index + 1,
            date: startDate ? addDays(startDate, index) : null,
            title: day.title || null,
            notes: day.notes || null
        }));

        const { data: savedDays, error: daysError } = await supabase
            .from('trip_days')
            .insert(dayRows)
            .select();

        if (daysError) throw daysError;

        // Map day_number back to the row id so activities can be linked.
        // Insert order isn't guaranteed, so match on the number rather
        // than assuming savedDays[i] lines up with itinerary.days[i].
        const dayIdByNumber = new Map(
            savedDays.map(d => [d.day_number, d.id])
        );

        // ---- Step 3: geocode the places we can ----
        // Activities carry an optional "place" string. Resolving it
        // gives the trip detail page real map pins. Failures are fine -
        // latitude and longitude are nullable here, unlike destinations.
        const allActivities = [];

        itinerary.days.forEach((day, dayIndex) => {
            const dayNumber = day.day ?? dayIndex + 1;
            const tripDayId = dayIdByNumber.get(dayNumber);
            if (!tripDayId) return;

            (day.activities || []).forEach((activity, activityIndex) => {
                allActivities.push({
                    tripDayId,
                    activity,
                    orderIndex: activityIndex
                });
            });
        });

        const geocoded = await Promise.allSettled(
            allActivities.map(item =>
                item.activity.place
                    ? geocodeLocationCached(item.activity.place)
                    : Promise.reject(new Error('no place'))
            )
        );

        // ---- Step 4: insert the activities ----
        const activityRows = allActivities.map((item, i) => {
            const geo = geocoded[i].status === 'fulfilled'
                ? geocoded[i].value
                : null;

            return {
                trip_day_id: item.tripDayId,
                type: item.activity.type || 'other',
                name: item.activity.name,
                description: item.activity.description || null,
                latitude: geo?.lat ?? null,
                longitude: geo?.lng ?? null,
                address: geo?.fullAddress || item.activity.place || null,
                time_start: normaliseTime(item.activity.time),
                time_end: normaliseTime(item.activity.endTime),
                price: item.activity.price ?? null,
                currency: itinerary.currency || 'INR',
                booking_url: item.activity.bookingUrl || null,
                order_index: item.orderIndex
            };
        });

        if (activityRows.length > 0) {
            const { error: activitiesError } = await supabase
                .from('activities')
                .insert(activityRows);

            if (activitiesError) throw activitiesError;
        }

        return {
            trip,
            dayCount: savedDays.length,
            activityCount: activityRows.length
        };

    } catch (err) {
        // Cascade deletes clear trip_days and activities automatically
        await supabase.from('trips').delete().eq('id', trip.id);
        throw err;
    }
}

/**
 * Load a trip with its full day-by-day structure.
 * Used by the trip detail page.
 */
export async function getItinerary(tripId) {
    const { data, error } = await supabase
        .from('trips')
        .select(`
            *,
            trip_days (
                id, day_number, date, title, notes,
                activities (
                    id, type, name, description,
                    latitude, longitude, address,
                    time_start, time_end,
                    price, currency, booking_url, order_index
                )
            )
        `)
        .eq('id', tripId)
        .single();

    if (error) throw error;

    // Postgres doesn't guarantee order in nested selects, so sort here
    // rather than hoping the rows come back in a useful sequence.
    if (data?.trip_days) {
        data.trip_days.sort((a, b) => a.day_number - b.day_number);
        data.trip_days.forEach(day => {
            day.activities?.sort((a, b) => a.order_index - b.order_index);
        });
    }

    return data;
}

/** 'HH:MM' or 'HH:MM:SS' -> a value Postgres accepts as `time`. */
function normaliseTime(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = String(Math.min(23, Number(match[1]))).padStart(2, '0');
    return `${hours}:${match[2]}:00`;
}

/** Add whole days to a 'YYYY-MM-DD' string. */
function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}