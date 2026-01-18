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
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        
        // API version (required by Anthropic)
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        // Which AI model to use
        model: 'claude-sonnet-4-20250514',
        
        // Maximum length of response (in tokens)
        // 1024 tokens ≈ 750 words
        max_tokens: 1024,
        
        // System prompt: Tells Claude HOW to behave
        system: `You are NAK, an enthusiastic and knowledgeable AI travel assistant. 
                 Help users plan trips, discover destinations, find hotels, events, restaurants, and more.
                 Be conversational, friendly, and provide specific, actionable recommendations.
                 When discussing locations, try to mention specific coordinates, addresses, or landmarks.`,
        
        // The conversation history + new message
        messages: messages
      })
    })

    // --------------------------------------------
    // STEP 6: Parse Claude's response
    // --------------------------------------------
    // Convert response from JSON to JavaScript object
    const aiResponse = await response.json()
    
    // Extract the actual message text
    // Claude returns: { content: [{ text: "Paris is..." }] }
    const assistantMessage = aiResponse.content[0].text

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