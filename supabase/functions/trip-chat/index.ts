// ============================================
// supabase/functions/trip-chat/index.ts
// ============================================
// Chat that edits an existing saved trip.
//
// HOW IT DIFFERS FROM THE `chat` FUNCTION:
// `chat` is open-ended conversation that can CREATE an itinerary.
// This one is scoped to ONE trip that already exists. It loads that
// trip, hands Claude the current structure INCLUDING DATABASE IDS,
// and asks for edit operations that reference those IDs.
//
// The function does not write anything. It returns operations; the
// frontend validates every ID against the trip it loaded and then
// applies them. That keeps the write path under RLS and makes a
// hallucinated ID impossible to act on.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tripId, message, history = [] } = await req.json()

    if (!tripId || !message) {
      throw new Error('tripId and message are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    // ---- Load the trip. RLS means a trip the caller doesn't own
    // ---- simply returns no rows, so no ownership check is needed here.
    const { data: trip, error: tripError } = await supabaseClient
      .from('trips')
      .select(`
        id, title, description, start_date, end_date,
        trip_days (
          id, day_number, date, title, notes,
          activities (
            id, type, name, description, address,
            time_start, time_end, price, currency, order_index
          )
        )
      `)
      .eq('id', tripId)
      .single()

    if (tripError) throw tripError
    if (!trip) throw new Error('Trip not found')

    // ---- Serialise the trip for Claude ----
    // Sorted, and with IDs included. The IDs are the whole point: they
    // are what lets Claude say "delete THIS activity" instead of
    // describing it in prose and hoping we match the right one.
    // Explicit types: Supabase's nested select returns `any`, and the
    // editor's noImplicitAny flags the callback parameters.
    type TripActivity = {
      id: string; type: string; name: string; description: string | null;
      address: string | null; time_start: string | null; time_end: string | null;
      price: number | null; currency: string | null; order_index: number;
    }

    type TripDay = {
      id: string; day_number: number; date: string | null;
      title: string | null; notes: string | null;
      activities: TripActivity[] | null;
    }

    const days: TripDay[] = (trip.trip_days || []).sort(
      (a: TripDay, b: TripDay) => a.day_number - b.day_number
    )

    days.forEach((day: TripDay) => {
      day.activities?.sort(
        (a: TripActivity, b: TripActivity) => a.order_index - b.order_index
      )
    })

    const tripContext = JSON.stringify({
      tripId: trip.id,
      title: trip.title,
      description: trip.description,
      startDate: trip.start_date,
      endDate: trip.end_date,
      days: days.map(day => ({
        dayId: day.id,
        dayNumber: day.day_number,
        date: day.date,
        title: day.title,
        notes: day.notes,
        activities: (day.activities || []).map(a => ({
          activityId: a.id,
          type: a.type,
          name: a.name,
          description: a.description,
          place: a.address,
          time: a.time_start?.slice(0, 5) ?? null,
          endTime: a.time_end?.slice(0, 5) ?? null,
          price: a.price
        }))
      }))
    }, null, 2)

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      })),
      {
        role: 'user',
        content: `Here is the trip as it currently stands:

${tripContext}

My request: ${message}`
      }
    ]

    const apiKey = Deno.env.get('NAK_api_key')
    if (!apiKey) throw new Error('NAK_api_key is not set')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic ${response.status}: ${errText}`)
    }

    const aiResponse = await response.json()

    // Find the text block by type rather than by index - safer if the
    // response shape ever includes other block types.
    const assistantMessage = aiResponse.content
      ?.find((b: { type: string }) => b.type === 'text')?.text

    if (!assistantMessage) {
      throw new Error(`Unexpected response: ${JSON.stringify(aiResponse)}`)
    }

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('TRIP CHAT ERROR:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

const SYSTEM_PROMPT = `You are NAK, editing a trip the user has already saved.

You are given the trip's current structure as JSON, including database
IDs. Your job is to return edit operations that the app will apply.

There are TWO ways to respond. Choose deliberately.

## 1. TARGETED OPERATIONS (use this almost always)

For anything short of a rebuild — changing a time, swapping one
activity, adding a stop, deleting a day — emit an operations block:

\\\`\\\`\\\`json:tripops
{
  "operations": [
    {
      "op": "update_activity",
      "activityId": "the-uuid-from-the-context",
      "fields": { "time": "09:30", "name": "Early breakfast at Kashi" }
    },
    {
      "op": "delete_activity",
      "activityId": "another-uuid"
    },
    {
      "op": "add_activity",
      "dayNumber": 2,
      "position": 1,
      "activity": {
        "name": "Munnar tea museum",
        "type": "attraction",
        "time": "14:00",
        "description": "Working plantation with tastings",
        "place": "Munnar, Kerala"
      }
    },
    {
      "op": "update_day",
      "dayNumber": 3,
      "fields": { "title": "Backwaters", "notes": "Slow day" }
    },
    {
      "op": "update_trip",
      "fields": { "title": "Kerala, relaxed" }
    }
  ]
}
\\\`\\\`\\\`

### Available operations
- update_activity  — needs activityId, fields
- delete_activity  — needs activityId
- add_activity     — needs dayNumber, activity; position is optional
                     (0-based; omit to append to the end of the day)
- update_day       — needs dayNumber, fields (title, notes, date)
- delete_day       — needs dayNumber
- add_day          — needs dayNumber, day { title, notes, activities: [] }
- update_trip      — needs fields (title, description, startDate, endDate)

### Absolute rules for IDs
- ONLY use activityId values that appear in the trip context above.
  Never invent, guess, abbreviate, or reconstruct an ID.
- If you cannot find the activity the user means, ASK which one they
  mean. Do not guess.
- Days are addressed by dayNumber, not by ID.

### Field formats
- "time" and "endTime": 24-hour "HH:MM"
- "type": attraction, restaurant, hotel, travel, event, or other
- "price": a plain number, no currency symbol
- "place": a real geocodable location, or omit it

## 2. FULL REPLACEMENT (rare)

Only when the user wants the whole trip rebuilt — "start over",
"redo this as a beach trip", "make it 7 days instead of 3". Emit a
normal itinerary block:

\\\`\\\`\\\`json:itinerary
{
  "title": "...",
  "destination": "...",
  "startDate": "2026-11-10",
  "currency": "INR",
  "days": [ ... ]
}
\\\`\\\`\\\`

WARNING: full replacement DELETES every existing day and activity,
including anything the user edited by hand. Before using it, say
plainly in your text that this rebuilds the whole trip. When in doubt,
use targeted operations instead.

## GENERAL

- Emit at most ONE block per reply, either tripops or itinerary.
- Always explain in plain language what you changed, above the block.
  The user sees your text, never the block.
- Never mention JSON, blocks, operations, IDs, or formatting.
- If the request is a question rather than an edit ("what's on day 2?"),
  just answer it. No block.
- Keep replies short. This is a side panel, not a full chat window.`