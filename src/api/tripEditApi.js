// ============================================
// tripEditApi.js - Applying AI edit operations
// ============================================
// Takes the operations Claude returned and writes them to the
// database.
//
// SECURITY MODEL:
// Claude is not trusted with IDs. Every activityId in an operation is
// checked against the trip actually loaded from the database before
// anything is written. An ID that isn't in that set is discarded and
// reported, never executed. RLS is the second line of defence, but
// this validation is the first.
// ============================================

import supabase from './supabaseClient';
import { geocodeLocationCached } from './mapboxApi';
//import { saveItinerary } from './itineraryApi';

// ============================================
// APPLY TARGETED OPERATIONS
// ============================================
/**
 * @param {object} params
 * @param {object} params.trip   the trip as loaded by getTripDetail
 * @param {Array}  params.operations
 * @returns {Promise<{applied: string[], failed: string[]}>}
 */
export async function applyTripOperations({ trip, operations = [] }) {
    // Build the set of IDs that genuinely exist on this trip.
    const validActivityIds = new Set();
    const dayByNumber = new Map();

    (trip.trip_days || []).forEach(day => {
        dayByNumber.set(day.day_number, day);
        (day.activities || []).forEach(a => validActivityIds.add(a.id));
    });

    const applied = [];
    const failed = [];

    // Sequential, not parallel. Operations can depend on each other -
    // deleting an activity then reordering the same day - and running
    // them out of order produces nonsense.
    for (const operation of operations) {
        try {
            await applyOne(operation, { trip, validActivityIds, dayByNumber });
            applied.push(describe(operation));
        } catch (err) {
            console.error('Operation failed:', operation, err);
            failed.push(`${describe(operation)}: ${err.message}`);
        }
    }

    return { applied, failed };
}

async function applyOne(operation, ctx) {
    const { trip, validActivityIds, dayByNumber } = ctx;

    switch (operation.op) {

        // ---------- ACTIVITIES ----------
        case 'update_activity': {
            requireValidActivity(operation.activityId, validActivityIds);

            const updates = await activityFieldsToRow(operation.fields || {});
            if (Object.keys(updates).length === 0) {
                throw new Error('no recognised fields');
            }

            const { error } = await supabase
                .from('activities')
                .update(updates)
                .eq('id', operation.activityId);

            if (error) throw error;
            return;
        }

        case 'delete_activity': {
            requireValidActivity(operation.activityId, validActivityIds);

            const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', operation.activityId);

            if (error) throw error;
            return;
        }

        case 'add_activity': {
            const day = dayByNumber.get(operation.dayNumber);
            if (!day) throw new Error(`day ${operation.dayNumber} not found`);

            const existing = day.activities || [];

            // position is 0-based; omitted means append
            const position = Number.isInteger(operation.position)
                ? Math.max(0, Math.min(operation.position, existing.length))
                : existing.length;

            const row = await activityToRow(operation.activity || {}, day.id);
            row.order_index = position;

            // Shift everything at or after the insertion point down one,
            // otherwise two activities share an order_index and the
            // display order becomes arbitrary.
            const toShift = existing.filter(a => a.order_index >= position);

            for (const activity of toShift) {
                const { error } = await supabase
                    .from('activities')
                    .update({ order_index: activity.order_index + 1 })
                    .eq('id', activity.id);
                if (error) throw error;
            }

            const { error } = await supabase.from('activities').insert(row);
            if (error) throw error;
            return;
        }

        // ---------- DAYS ----------
        case 'update_day': {
            const day = dayByNumber.get(operation.dayNumber);
            if (!day) throw new Error(`day ${operation.dayNumber} not found`);

            const fields = operation.fields || {};
            const updates = {};
            if ('title' in fields) updates.title = fields.title || null;
            if ('notes' in fields) updates.notes = fields.notes || null;
            if ('date'  in fields) updates.date  = fields.date  || null;

            if (Object.keys(updates).length === 0) {
                throw new Error('no recognised fields');
            }

            const { error } = await supabase
                .from('trip_days')
                .update(updates)
                .eq('id', day.id);

            if (error) throw error;
            return;
        }

        case 'delete_day': {
            const day = dayByNumber.get(operation.dayNumber);
            if (!day) throw new Error(`day ${operation.dayNumber} not found`);

            const { error } = await supabase
                .from('trip_days')
                .delete()
                .eq('id', day.id);

            if (error) throw error;

            // Close the gap in numbering. Without this you get a trip
            // that goes Day 1, Day 2, Day 4, and the unique constraint
            // on (trip_id, day_number) blocks later inserts.
            const later = (trip.trip_days || [])
                .filter(d => d.day_number > operation.dayNumber)
                .sort((a, b) => a.day_number - b.day_number);

            for (const d of later) {
                const { error: shiftError } = await supabase
                    .from('trip_days')
                    .update({ day_number: d.day_number - 1 })
                    .eq('id', d.id);
                if (shiftError) throw shiftError;
            }
            return;
        }

        case 'add_day': {
            const dayNumber = operation.dayNumber;
            if (!Number.isInteger(dayNumber)) {
                throw new Error('dayNumber required');
            }

            // Make room: bump every day at or after this number up one.
            // Descending order matters - going up from the bottom would
            // collide with the unique constraint mid-loop.
            const toShift = (trip.trip_days || [])
                .filter(d => d.day_number >= dayNumber)
                .sort((a, b) => b.day_number - a.day_number);

            for (const d of toShift) {
                const { error } = await supabase
                    .from('trip_days')
                    .update({ day_number: d.day_number + 1 })
                    .eq('id', d.id);
                if (error) throw error;
            }

            const dayInput = operation.day || {};

            const { data: newDay, error } = await supabase
                .from('trip_days')
                .insert({
                    trip_id: trip.id,
                    day_number: dayNumber,
                    title: dayInput.title || null,
                    notes: dayInput.notes || null,
                    date: dayInput.date || null
                })
                .select()
                .single();

            if (error) throw error;

            const activities = dayInput.activities || [];
            if (activities.length > 0) {
                const rows = [];
                for (let i = 0; i < activities.length; i++) {
                    const row = await activityToRow(activities[i], newDay.id);
                    row.order_index = i;
                    rows.push(row);
                }

                const { error: actError } = await supabase
                    .from('activities')
                    .insert(rows);
                if (actError) throw actError;
            }
            return;
        }

        // ---------- TRIP ----------
        case 'update_trip': {
            const fields = operation.fields || {};
            const updates = {};
            if ('title'       in fields) updates.title       = fields.title;
            if ('description' in fields) updates.description = fields.description || null;
            if ('startDate'   in fields) updates.start_date  = fields.startDate || null;
            if ('endDate'     in fields) updates.end_date    = fields.endDate || null;

            if (Object.keys(updates).length === 0) {
                throw new Error('no recognised fields');
            }

            const { error } = await supabase
                .from('trips')
                .update(updates)
                .eq('id', trip.id);

            if (error) throw error;
            return;
        }

        default:
            throw new Error(`unknown operation "${operation.op}"`);
    }
}

// ============================================
// FULL REPLACEMENT
// ============================================
/**
 * Rebuild a trip from a fresh itinerary block.
 *
 * DESTRUCTIVE: deletes every existing day and activity, including
 * anything the user edited by hand. The caller must confirm with the
 * user before calling this.
 */
export async function replaceItinerary({ tripId, itinerary }) {
    if (!itinerary?.days?.length) {
        throw new Error('Itinerary has no days');
    }

    // Cascade on trip_days removes the activities too
    const { error: deleteError } = await supabase
        .from('trip_days')
        .delete()
        .eq('trip_id', tripId);

    if (deleteError) throw deleteError;

    // saveItinerary creates a new trip, so reuse its day/activity
    // building by writing directly instead.
    const startDate = itinerary.startDate || null;

    const { error: tripError } = await supabase
        .from('trips')
        .update({
            title: itinerary.title || 'My Itinerary',
            description: itinerary.destination || null,
            start_date: startDate,
            end_date: startDate
                ? addDays(startDate, itinerary.days.length - 1)
                : null
        })
        .eq('id', tripId);

    if (tripError) throw tripError;

    for (let i = 0; i < itinerary.days.length; i++) {
        const day = itinerary.days[i];

        const { data: newDay, error: dayError } = await supabase
            .from('trip_days')
            .insert({
                trip_id: tripId,
                day_number: day.day ?? i + 1,
                date: startDate ? addDays(startDate, i) : null,
                title: day.title || null,
                notes: day.notes || null
            })
            .select()
            .single();

        if (dayError) throw dayError;

        const activities = day.activities || [];
        if (activities.length === 0) continue;

        const rows = [];
        for (let j = 0; j < activities.length; j++) {
            const row = await activityToRow(activities[j], newDay.id);
            row.order_index = j;
            row.currency = itinerary.currency || 'INR';
            rows.push(row);
        }

        const { error: actError } = await supabase
            .from('activities')
            .insert(rows);

        if (actError) throw actError;
    }

    return { dayCount: itinerary.days.length };
}

// ============================================
// HELPERS
// ============================================

function requireValidActivity(activityId, validIds) {
    if (!activityId) throw new Error('activityId missing');

    // This is the check that makes a hallucinated ID harmless.
    if (!validIds.has(activityId)) {
        throw new Error('activity does not belong to this trip');
    }
}

/** Build a full activities row from AI-supplied fields. */
async function activityToRow(activity, tripDayId) {
    const row = {
        trip_day_id: tripDayId,
        type: activity.type || 'other',
        name: activity.name || 'Untitled',
        description: activity.description || null,
        address: activity.place || null,
        time_start: normaliseTime(activity.time),
        time_end: normaliseTime(activity.endTime),
        price: activity.price ?? null,
        booking_url: activity.bookingUrl || null,
        latitude: null,
        longitude: null
    };

    // Geocoding is best-effort. Coordinates are nullable on activities,
    // so an unrecognised place still saves - it just won't appear on
    // the map.
    if (activity.place) {
        try {
            const location = await geocodeLocationCached(activity.place);
            row.latitude = location.lat;
            row.longitude = location.lng;
            row.address = location.fullAddress || activity.place;
        } catch {
            // keep the raw place string
        }
    }

    return row;
}

/** Build a partial update from AI-supplied fields. */
async function activityFieldsToRow(fields) {
    const updates = {};

    if ('name'        in fields) updates.name        = fields.name;
    if ('type'        in fields) updates.type        = fields.type || 'other';
    if ('description' in fields) updates.description = fields.description || null;
    if ('price'       in fields) updates.price       = fields.price ?? null;
    if ('bookingUrl'  in fields) updates.booking_url = fields.bookingUrl || null;
    if ('time'        in fields) updates.time_start  = normaliseTime(fields.time);
    if ('endTime'     in fields) updates.time_end    = normaliseTime(fields.endTime);

    if ('place' in fields) {
        updates.address = fields.place || null;
        updates.latitude = null;
        updates.longitude = null;

        if (fields.place) {
            try {
                const location = await geocodeLocationCached(fields.place);
                updates.latitude = location.lat;
                updates.longitude = location.lng;
                updates.address = location.fullAddress || fields.place;
            } catch {
                // keep the raw string
            }
        }
    }

    return updates;
}

/** Short human label for a confirmation line. */
function describe(operation) {
    switch (operation.op) {
        case 'update_activity': return 'Updated an activity';
        case 'delete_activity': return 'Removed an activity';
        case 'add_activity':    return `Added an activity to day ${operation.dayNumber}`;
        case 'update_day':      return `Updated day ${operation.dayNumber}`;
        case 'delete_day':      return `Removed day ${operation.dayNumber}`;
        case 'add_day':         return `Added day ${operation.dayNumber}`;
        case 'update_trip':     return 'Updated trip details';
        default:                return operation.op || 'Unknown change';
    }
}

function normaliseTime(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = String(Math.min(23, Number(match[1]))).padStart(2, '0');
    return `${hours}:${match[2]}:00`;
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}