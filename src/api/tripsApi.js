// ============================================
// tripsApi.js - Saved Trips Service
// ============================================
// Everything that reads or writes the trips and destinations tables.
//
// KEY IDEA:
// The conversation already contains the trip. Every ```json:map block
// the AI produced lists the stops. So saving a trip means scanning the
// messages for those blocks, geocoding the place names, and writing
// them to the destinations table - the user re-enters nothing.
// ============================================

import supabase from './supabaseClient';
import { geocodeLocationCached } from './mapboxApi';

// ============================================
// EXTRACT PLACES FROM A CONVERSATION
// ============================================
/**
 * Pull every place name out of the map blocks in a conversation.
 *
 * @param {Array} messages  rows from the messages table
 * @returns {string[]}      unique place names, in the order they appeared
 */
export function extractPlacesFromMessages(messages = []) {
    const blockRegex = /```json:map\s*\n([\s\S]*?)```/g;
    const seen = new Set();
    const places = [];

    messages
        .filter(msg => msg.role === 'assistant')
        .forEach(msg => {
            let match;
            // Reset between messages - a /g regex keeps its position
            blockRegex.lastIndex = 0;

            while ((match = blockRegex.exec(msg.content || '')) !== null) {
                let data;
                try {
                    data = JSON.parse(match[1]);
                } catch {
                    continue;   // malformed block, skip it
                }

                // Same shapes ChatMapBlock accepts
                let names = [];
                if (Array.isArray(data.places)) {
                    names = data.places;
                } else {
                    names = [
                        data.origin,
                        ...(data.waypoints || []),
                        data.destination
                    ].filter(Boolean);
                }

                names.forEach(name => {
                    const key = name.trim().toLowerCase();
                    if (name && !seen.has(key)) {
                        seen.add(key);
                        places.push(name.trim());
                    }
                });
            }
        });

    return places;
}

/**
 * Load a conversation's messages and extract its places in one step.
 * Used by SaveTripButton to prefill the modal.
 */
export async function getPlacesForConversation(conversationId) {
    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return extractPlacesFromMessages(data || []);
}

// ============================================
// SAVE
// ============================================
/**
 * Create a trip and its destinations.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.conversationId]
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {string} [params.startDate]   'YYYY-MM-DD'
 * @param {string} [params.endDate]     'YYYY-MM-DD'
 * @param {string[]} params.places      place names to geocode and store
 * @returns {Promise<{trip: object, savedCount: number, skipped: string[]}>}
 */
export async function saveTrip({
    userId,
    conversationId = null,
    title,
    description = null,
    startDate = null,
    endDate = null,
    places = []
}) {
    if (!userId) throw new Error('Not signed in');
    if (!title?.trim()) throw new Error('Trip needs a title');

    // ---- Step 1: geocode first, before writing anything ----
    // The destinations table requires latitude and longitude (NOT NULL),
    // so a place we can't resolve cannot be stored. Doing this first
    // means we never create a trip that then fails halfway through
    // inserting its stops.
    const resolved = [];
    const skipped = [];

    const results = await Promise.allSettled(
        places.map(name => geocodeLocationCached(name))
    );

    results.forEach((outcome, i) => {
        if (outcome.status === 'fulfilled') {
            resolved.push({
                name: places[i],
                latitude: outcome.value.lat,
                longitude: outcome.value.lng,
                description: outcome.value.fullAddress || null
            });
        } else {
            console.warn(`Skipping "${places[i]}":`, outcome.reason?.message);
            skipped.push(places[i]);
        }
    });

    // ---- Step 2: create the trip row ----
    const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
            user_id: userId,
            conversation_id: conversationId,
            title: title.trim(),
            description: description?.trim() || null,
            start_date: startDate || null,
            end_date: endDate || null
        })
        .select()
        .single();

    if (tripError) throw tripError;

    // ---- Step 3: insert the destinations ----
    if (resolved.length > 0) {
        const rows = resolved.map((place, index) => ({
            trip_id: trip.id,
            name: place.name,
            description: place.description,
            latitude: place.latitude,
            longitude: place.longitude,
            // Spread visit dates across the trip if we know the start date.
            // One stop per day is a rough default the user can edit later.
            visit_date: startDate ? addDays(startDate, index) : null
        }));

        const { error: destError } = await supabase
            .from('destinations')
            .insert(rows);

        if (destError) {
            // Roll back the trip so we don't leave an empty shell behind.
            await supabase.from('trips').delete().eq('id', trip.id);
            throw destError;
        }
    }

    return { trip, savedCount: resolved.length, skipped };
}

/** Add whole days to a 'YYYY-MM-DD' string, returning the same format. */
function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

// ============================================
// READ
// ============================================
/**
 * All trips for a user, newest first, with their destinations attached.
 *
 * Uses a nested select so this is one round trip rather than one query
 * per trip.
 */
export async function getTrips(userId) {
    const { data, error } = await supabase
        .from('trips')
        .select(`
            *,
            destinations (
                id, name, description, latitude, longitude, visit_date
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

/** A single trip with its destinations. */
export async function getTrip(tripId) {
    const { data, error } = await supabase
        .from('trips')
        .select(`
            *,
            destinations (
                id, name, description, latitude, longitude, visit_date
            )
        `)
        .eq('id', tripId)
        .single();

    if (error) throw error;

    return data;
}

// ============================================
// UPDATE / DELETE
// ============================================
/** Edit a trip's own fields. Destinations are managed separately. */
export async function updateTrip(tripId, updates) {
    const { data, error } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId)
        .select()
        .single();

    if (error) throw error;

    return data;
}

/**
 * Delete a trip. Its destinations go with it - the foreign key is
 * declared ON DELETE CASCADE, so no manual cleanup is needed.
 */
export async function deleteTrip(tripId) {
    const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);

    if (error) throw error;
}