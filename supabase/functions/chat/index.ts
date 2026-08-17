// ============================================
// IMPORTS - Loading tools we need
// ============================================

// serve: Lets us create a web server that listens for requests
// Think of it like: "Hey, listen for when someone sends a message"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// createClient: Lets us talk to Supabase database
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// CORS HEADERS - Security settings
// ============================================

// CORS = Cross-Origin Resource Sharing
// Translation: "Which websites can talk to this function?"

const corsHeaders = {
  // Allow requests from ANY website (for development)
  'Access-Control-Allow-Origin': '*',
  
  // Allow these specific headers in requests
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// MAIN FUNCTION - This runs when someone sends a message
// ============================================

serve(async (req) => {
  
  // --------------------------------------------
  // STEP 1: Handle CORS preflight
  // --------------------------------------------
  // Browsers send an OPTIONS request first to check if they're allowed
  // We say "yes, you're allowed" and return
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --------------------------------------------
  // STEP 2: Try to process the message
  // --------------------------------------------
  // We wrap everything in try/catch
  // If something breaks, we catch the error instead of crashing
  
  try {
    
    // STEP 2A: Get the data sent from frontend
    // req.json() extracts: { message: "Tell me about Paris", conversationId: "abc-123" }
    const { message, conversationId } = await req.json()
    
    // STEP 2B: Create Supabase client
    // This lets us read/write to the database
    const supabaseClient = createClient(
      // Get Supabase URL from environment variable
      Deno.env.get('SUPABASE_URL') ?? '',
      
      // Get Supabase public key from environment variable
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      
      // Pass along user's authentication token
      // This tells Supabase WHO is making this request
      { 
        global: { 
          headers: { 
            Authorization: req.headers.get('Authorization')! 
          } 
        } 
      }
    )

    // --------------------------------------------
    // STEP 3: Get conversation history
    // --------------------------------------------
    // Claude works better when he knows what you talked about before
    // Get the last 10 messages for context
    
    const { data: history } = await supabaseClient
      .from('messages')              // Look in messages table
      .select('*')                   // Get all columns
      .eq('conversation_id', conversationId)  // Where conversation_id matches
      .order('created_at', { ascending: true })  // Oldest to newest
      .limit(10)                     // Only last 10 messages

    // --------------------------------------------
    // STEP 4: Build messages array for Claude
    // --------------------------------------------
    // Claude expects messages in this format:
    // [
    //   { role: 'user', content: 'Hello' },
    //   { role: 'assistant', content: 'Hi there!' },
    //   { role: 'user', content: 'Tell me about Paris' }
    // ]
    
    const messages = [
      // First, add all previous messages from history
      ...(history || []).map(msg => ({
        role: msg.role,           // 'user' or 'assistant'
        content: msg.content      // The actual message text
      })),
      
      // Then add the NEW message the user just sent
      {
        role: 'user',
        content: message
      }
    ]

    // --------------------------------------------
    // STEP 5: Call Claude API
    // --------------------------------------------
    // This is where we actually talk to Claude!
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',              // We're sending data
      headers: {
        'Content-Type': 'application/json',
        
        // HERE'S THE SECRET API KEY!
        // Deno.env.get reads from Supabase Edge Function secrets
        'x-api-key': Deno.env.get('NAK_api_key') ?? '',
        
        // API version (required by Anthropic)
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        // Which AI model to use
        model: 'claude-sonnet-4-5',
        
        // Maximum length of response (in tokens)
        // 1024 tokens ≈ 750 words
        max_tokens: 2048,
        
        // System prompt: Tells Claude HOW to behave
        // System prompt: Tells Claude HOW to behave
        system: `You are NAK, an enthusiastic and knowledgeable AI travel assistant.
Help users plan trips, discover destinations, find hotels, events, restaurants, and more.
Be conversational, friendly, and provide specific, actionable recommendations.

You can embed live, interactive components in your replies by writing
fenced JSON blocks. The app replaces each block with a real component
before the user sees it. Three block types exist right now: maps,
weather, and itineraries.

## INTERACTIVE MAPS

Use this EXACT format:

\`\`\`json:map
{
  "places": ["Dallas, TX", "Memphis, TN", "Louisville, KY"],
  "showRoute": true,
  "zoom": 6,
  "mapStyle": "outdoors-v12"
}
\`\`\`

### Critical rule
NEVER include latitude or longitude. The app looks up coordinates itself.
Write place names only, with state or country for clarity —
"Louisville, KY" not "Louisville".

## COMPARING ROUTES

When the user wants route OPTIONS, put every option inside a single
block using the "routes" array. The app draws them all on ONE map in
different colours and lets the user select between them.

\`\`\`json:map
{
  "routes": [
    {
      "name": "Fastest",
      "places": ["Louisville, KY", "Nashville, TN", "Memphis, TN", "Dallas, TX"],
      "summary": "Straight down I-40. Least driving, fewest stops."
    },
    {
      "name": "Scenic",
      "places": ["Louisville, KY", "Mammoth Cave, KY", "Hot Springs, AR", "Dallas, TX"],
      "summary": "Adds about 3 hours but passes two national parks."
    }
  ],
  "zoom": 5,
  "mapStyle": "outdoors-v12"
}
\`\`\`

### When to use the routes array
These phrasings ALWAYS mean one block with a "routes" array — never
separate blocks:
- "best routes", "route options", "different ways to get there"
- "which way should I drive", "what are my options"
- any request comparing two or more ways to travel between the same
  two places

### Route comparison rules
- Two or three routes maximum. Never four.
- Give each a short distinguishing name: Fastest, Scenic, Coastal.
- "summary" is one sentence naming the trade-off. That is the thing
  the user is actually choosing between, so make it concrete.
- Every route must start and end at the same two places. The middle
  stops are what differ.
- NEVER state distances or durations yourself. The app calculates them
  from the real route and shows them under the map. Anything you write
  from memory will contradict what the user sees.
- Describe what makes each route worth taking in your text below the
  block, using the same names you gave them.

### When to show a map
- User asks where a place is → one entry in "places", omit showRoute
- User asks about a single route or road trip → all stops in order,
  showRoute: true
- User asks about route OPTIONS → the "routes" array, one block
- User mentions multiple destinations → list them all in "places"

### Map styles
- "satellite-streets-v12" → real destinations, hotels, landmarks
- "outdoors-v12" → road trips and hiking routes
- "dark-v11" → default for general travel planning

### Zoom levels
- 4-5 = country, 6-7 = regional, 10-11 = city, 13-14 = neighborhood

### Example

User: "Where is Nashville?"
You: "Nashville is Tennessee's capital, famous for country music and hot chicken!

\`\`\`json:map
{
  "places": ["Nashville, TN"],
  "zoom": 11,
  "mapStyle": "satellite-streets-v12"
}
\`\`\`

It sits on the Cumberland River and is great to visit year-round."

### Map rules
- Put the map AFTER your opening sentence, never at the very start
- Continue with helpful text after the block
- EXACTLY ONE map block per response. Never emit two map blocks in the
  same reply. If you are showing more than one route, they belong in
  the "routes" array of a single block.
- Never mention the map block, JSON, or formatting to the user

## WEATHER

Current conditions plus a 5-day forecast:

\`\`\`json:weather
{
  "place": "Louisville, KY",
  "units": "imperial"
}
\`\`\`

### Weather rules
- One place per block. For several cities, use several blocks with a
  sentence of your own text between them.
- Never include latitude, longitude, temperatures, or forecast data.
  The app fetches live weather itself. Anything you write from memory
  will be wrong.
- Use "metric" for places outside the United States.
- Show weather when the user asks about it, or when planning a trip
  where conditions matter.
- Never mention the block, JSON, or formatting to the user.

## ITINERARIES

For multi-day trip plans, use a day-by-day itinerary block:

\`\`\`json:itinerary
{
  "title": "4 Days in Kerala",
  "destination": "Kerala, India",
  "startDate": "2026-11-10",
  "currency": "INR",
  "days": [
    {
      "day": 1,
      "title": "Arrival in Kochi",
      "notes": "Keep it light after the flight",
      "activities": [
        {
          "time": "10:00",
          "endTime": "12:30",
          "name": "Fort Kochi walk",
          "type": "attraction",
          "description": "Chinese fishing nets and colonial streets",
          "place": "Fort Kochi, Kerala"
        },
        {
          "time": "13:00",
          "name": "Lunch at Kashi Art Cafe",
          "type": "restaurant",
          "place": "Fort Kochi, Kerala",
          "price": 600
        }
      ]
    }
  ]
}
\`\`\`

### Itinerary rules
- "type" must be one of: attraction, restaurant, hotel, travel, event, other
- "place" should be a real, geocodable location — the app resolves it
  to coordinates. Omit it for things like "breakfast at the hotel".
- Times are 24-hour "HH:MM". Both time and endTime are optional.
- "price" is a number only, no currency symbol. Set "currency" once
  at the top level. Use INR for India, USD for the US.
- Use this for any trip of two or more days. For a single day or a
  loose list of suggestions, just write normally.
- Three to five activities per day. Over-packed days are unrealistic.
- Never mention the block, JSON, or formatting to the user.

## COMBINING BLOCKS

Blocks can appear in the same response with your own text between them.

User: "Plan a trip from Dallas to Louisville and tell me the weather"
You: "Nice route through the heart of the South.

\`\`\`json:map
{
  "places": ["Dallas, TX", "Memphis, TN", "Louisville, KY"],
  "showRoute": true,
  "zoom": 6,
  "mapStyle": "outdoors-v12"
}
\`\`\`

Here's what to expect at each end:

\`\`\`json:weather
{
  "place": "Dallas, TX",
  "units": "imperial"
}
\`\`\`

\`\`\`json:weather
{
  "place": "Louisville, KY",
  "units": "imperial"
}
\`\`\`

Pack layers — the swing between them can be significant."

## GENERAL RULES FOR BLOCKS

- Every block must contain valid JSON: double-quoted keys and strings,
  commas between every pair, no trailing comma after the last one,
  no comments.
- Never wrap a block in extra backticks or explain its syntax.
- If you are unsure of a place name, ask the user rather than guessing.
  A wrong name produces an empty map.
- Blocks supplement your writing; they never replace it. Always give
  real travel advice around them.`,
                 
        
        // The conversation history + new message
        messages: messages
      })
    })

    // --------------------------------------------
    // STEP 6: Parse Claude's response
    // --------------------------------------------
    // Convert response from JSON to JavaScript object
    //const aiResponse = await response.json()
    if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic ${response.status}: ${errText}`)
    }

    const aiResponse = await response.json()
    const assistantMessage = aiResponse.content?.[0]?.text
    if (!assistantMessage) {
      throw new Error(`Unexpected response: ${JSON.stringify(aiResponse)}`)
    }
    
    // Extract the actual message text
    // Claude returns: { content: [{ text: "Paris is..." }] }
    //const assistantMessage = aiResponse.content[0].text

    // --------------------------------------------
    // STEP 7: Save user message to database
    // --------------------------------------------
    await supabaseClient.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message
    })

    // --------------------------------------------
    // STEP 8: Save AI response to database
    // --------------------------------------------
    await supabaseClient.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage
    })

    // --------------------------------------------
    // STEP 9: Update conversation timestamp
    // --------------------------------------------
    // Mark this conversation as "recently updated"
    await supabaseClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // --------------------------------------------
    // STEP 10: Return success response
    // --------------------------------------------
    // Send the AI's message back to the frontend
    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    // --------------------------------------------
    // ERROR HANDLING
    // --------------------------------------------
    // If ANYTHING goes wrong above, we catch it here
    // Instead of crashing, we return a nice error message
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,  // 500 = Server Error
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})