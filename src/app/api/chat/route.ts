import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callEdenAI, callEdenAIWithTools, generateChatSummary, compressContext, type ChatMessage } from '@/lib/edenai';
import { executeAiTool, AI_TOOLS, OPENAI_TOOLS, ToolExecutionContext, ToolExecutionResult, toLocalIsoDate, formatMadridDate, formatMadridTime } from '@/lib/ai-tools';

export const dynamic = 'force-dynamic';

const isUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chatId,
      content,
      imageUrl,
      senderRole = 'client',
      lang = 'es',
      artistId,
      studioId,
      clientProfileId
    } = body;

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'El contenido o la imagen son obligatorios.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    let chat: any = null;
    let actualChatId: string | null = null;
    let artist: any = null;
    let client: any = null;

    // 1. Try to fetch existing chat if chatId is a valid UUID
    if (chatId && isUUID(chatId)) {
      const { data: existingChat } = await supabase
        .from('chats')
        .select(`
          id,
          ai_enabled,
          artist_id,
          studio_id,
          client_id,
          artists (
            id,
            display_name,
            pricing_rules,
            healing_templates
          ),
          clients (
            id,
            profile_id,
            profiles (full_name)
          )
        `)
        .eq('id', chatId)
        .maybeSingle();

      if (existingChat) {
        chat = existingChat;
        actualChatId = existingChat.id;
        artist = (existingChat as any).artists;
        client = (existingChat as any).clients;
      }
    }

    // 2. If chat not resolved, resolve artist & client and fetch/create dedicated 1:1 chat
    let resolvedArtistId = (artistId && isUUID(artistId)) ? artistId : (chat?.artist_id || null);
    let resolvedStudioId = (studioId && isUUID(studioId)) ? studioId : (chat?.studio_id || null);
    let resolvedClientId = chat?.client_id || null;

    if (!resolvedArtistId) {
      const { data: defaultArtist } = await supabase
        .from('artists')
        .select('id, studio_id, display_name, pricing_rules, healing_templates')
        .limit(1)
        .maybeSingle();

      if (defaultArtist) {
        resolvedArtistId = defaultArtist.id;
        resolvedStudioId = resolvedStudioId || defaultArtist.studio_id;
        artist = defaultArtist;
      }
    } else if (!artist) {
      const { data: foundArtist } = await supabase
        .from('artists')
        .select('id, studio_id, display_name, pricing_rules, healing_templates')
        .eq('id', resolvedArtistId)
        .maybeSingle();
      if (foundArtist) {
        artist = foundArtist;
        resolvedStudioId = resolvedStudioId || foundArtist.studio_id;
      }
    }

    if (!resolvedStudioId && artist?.studio_id) {
      resolvedStudioId = artist.studio_id;
    }

    // Resolve client
    if (!resolvedClientId && clientProfileId && isUUID(clientProfileId)) {
      const { data: clientRec } = await supabase
        .from('clients')
        .select('id, profile_id, profiles(full_name)')
        .eq('profile_id', clientProfileId)
        .maybeSingle();

      if (clientRec) {
        resolvedClientId = clientRec.id;
        client = clientRec;
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({ profile_id: clientProfileId })
          .select('id, profile_id')
          .maybeSingle();
        if (newClient) resolvedClientId = newClient.id;
      }
    }

    // Ensure 1:1 dedicated chat row
    if (!chat && resolvedClientId && resolvedArtistId && resolvedStudioId) {
      let { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .eq('client_id', resolvedClientId)
        .eq('artist_id', resolvedArtistId)
        .maybeSingle();

      if (!existingChat) {
        const { data: newChat } = await supabase
          .from('chats')
          .insert({
            studio_id: resolvedStudioId,
            artist_id: resolvedArtistId,
            client_id: resolvedClientId,
            ai_enabled: true,
            status_badge: 'quoting'
          })
          .select()
          .maybeSingle();
        existingChat = newChat;
      }

      if (existingChat) {
        chat = existingChat;
        actualChatId = existingChat.id;
      }
    }

    const artistName = artist?.display_name || 'El Tatuador';
    const clientName = client?.profiles?.full_name || 'Cliente';

    // 3. Save incoming user message
    let savedUserMsg: any = {
      id: 'msg-' + Date.now(),
      sender_role: senderRole,
      content: content || (imageUrl ? 'Foto adjunta' : ''),
      image_url: imageUrl || null,
      created_at: new Date().toISOString()
    };

    if (actualChatId) {
      const { data: dbUserMsg } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: actualChatId,
          sender_role: senderRole,
          content: savedUserMsg.content,
          image_url: savedUserMsg.image_url
        })
        .select()
        .maybeSingle();

      if (dbUserMsg) savedUserMsg = dbUserMsg;
    }

    // 4. Human intervention
    if (senderRole === 'artist' && actualChatId) {
      await supabase
        .from('chats')
        .update({
          ai_enabled: false,
          status_badge: 'takeover',
          updated_at: new Date().toISOString()
        })
        .eq('id', actualChatId);

      return NextResponse.json({ success: true, message: savedUserMsg, chat });
    }

    if (chat && chat.ai_enabled === false) {
      return NextResponse.json({
        success: true,
        message: savedUserMsg,
        chat,
        aiPaused: true,
        info: 'El tatuador ha intervenido en este chat. La IA está en pausa temporal.'
      });
    }

    // 5. Tool Context
    const toolContext: ToolExecutionContext = {
      studioId: resolvedStudioId || chat?.studio_id || '',
      artistId: resolvedArtistId || chat?.artist_id || '',
      clientId: resolvedClientId || chat?.client_id,
      clientProfileId,
      chatId: actualChatId,
      artistPricingRules: artist?.pricing_rules,
      artistHealingTemplates: artist?.healing_templates,
      artistName,
      lang: lang as 'es' | 'en',
      userMessage: content || ''
    };

    // 6. Retrieve History for conversational context
    let historyMessages: ChatMessage[] = [];
    if (actualChatId) {
      const { data: dbHistory } = await supabase
        .from('chat_messages')
        .select('sender_role, content, created_at')
        .eq('chat_id', actualChatId)
        .order('created_at', { ascending: false })
        .limit(12);

      if (dbHistory) {
        // Cogemos los ÚLTIMOS mensajes (antes cogía los 10 primeros y la IA no veía lo nuevo)
        historyMessages = [...dbHistory].reverse().filter(m => (m.content || '').trim() !== '').map(m => ({
          role: m.sender_role === 'ai_assistant' ? 'assistant' : (m.sender_role === 'client' ? 'user' : 'assistant'),
          content: m.content
        }));
      }
    }

    if (historyMessages.length === 0) {
      historyMessages = [{ role: 'user', content: content || (imageUrl ? 'Te adjunto esta foto para que la revises.' : 'Hola') }];
    }

    const compressed = compressContext(historyMessages);

    // 7. System Prompt with Real Temporal Context & Artist Identity
    const now = new Date();
    const todayIso = toLocalIsoDate(now);
    const todayFormatted = formatMadridDate(now);
    const currentTimeFormatted = formatMadridTime(now);

    // Precompute upcoming 7 days in the current year to eliminate model cutoff hallucination
    const calendarWeekReference = [0, 1, 2, 3, 4, 5, 6, 7].map(dayOffset => {
      const d = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const iso = toLocalIsoDate(d);
      const weekdayName = d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long' });
      const pretty = formatMadridDate(d);
      const label = dayOffset === 0 ? 'Hoy' : (dayOffset === 1 ? 'Mañana' : `Este ${weekdayName}`);
      return `- ${label} (${pretty}): ${iso}`;
    }).join('\n');

    const systemPrompt = `Eres el Asistente Virtual Oficial con Inteligencia Artificial de ${artistName} en el estudio de tatuajes.
Tu misión es atender con máxima cordialidad, profesionalidad y agilidad al cliente (${clientName}).

CALENDARIO OFICIAL Y CONTEXTO TEMPORAL ACTUAL:
- Fecha de hoy: ${todayFormatted} (ISO: ${todayIso})
- Hora actual: ${currentTimeFormatted}
- Año actual: ${now.getFullYear()}
- Tatuador: ${artistName}
- Especialidades: ${artist?.specialties?.join(', ') || 'Todo estilo de tatuaje'}
- Tarifa base mínima: ${artist?.minimum_fee || 60}€

CALENDARIO DE ESTA SEMANA (AÑO ${now.getFullYear()}):
${calendarWeekReference}

REGLAS CRÍTICAS DE FECHAS (OBLIGATORIAS):
1. La fecha actual es ${todayFormatted} (${todayIso}). Estamos en el año ${now.getFullYear()}.
2. Cuando el cliente diga "hoy", "mañana", "este miércoles", "el viernes", "el próximo lunes", debes usar EXCLUSIVAMENTE las fechas del calendario de arriba (${now.getFullYear()}).
3. NUNCA inventes fechas de 2023 o 2024 ni meses pasados. Si el cliente dice "este miércoles", la fecha en ${now.getFullYear()} es exactamente la indicada en el calendario de arriba.
4. Cuando una herramienta devuelva huecos disponibles, cita SIEMPRE exactamente los días de la semana y horas devueltos por la herramienta.

REGLAS FUNDAMENTALES DE HERRAMIENTAS (TOOLS):
1. 'check_availability': ÚSALA SIEMPRE que el cliente pregunte por citas de forma genérica ("quiero una cita", "dame una cita", "¿tienes hueco?", "¿qué horarios tienes?", "qué huecos tienes para este miércoles", "quiero reservar para el viernes"). NUNCA reserves directamente sin que el cliente haya confirmado un hueco específico. check_availability consultará la agenda real y devolverá huecos libres para que el cliente elija.
2. 'book_appointment': ÚSALA ÚNICAMENTE cuando el cliente haya especificado una fecha y una hora concreta o haya elegido uno de los huecos propuestos (ej: "resérvame el viernes a las 11:00").
3. 'get_client_appointments': ÚSALA si el cliente pregunta qué citas tiene agendadas o cuándo es su próxima cita.
4. 'reschedule_appointment': ÚSALA cuando el cliente pida cambiar, reprogramar o mover una cita existente a otro día u hora.
5. 'cancel_appointment': ÚSALA cuando el cliente pida anular o cancelar su cita agendada.
6. 'estimate_quote': ÚSALA si el cliente consulta precio, presupuesto o indica medidas en cm.
7. 'analyze_healing': ÚSALA si el cliente envía una foto de curación dérmica.
8. 'request_human_takeover': ÚSALA si el cliente solicita expresamente hablar con una persona humana o con ${artistName}.
9. 'get_app_faq': ÚSALA si el cliente pregunta dudas sobre cómo funciona la app, cómo reservar o cancelar, cómo firmar y descargar el consentimiento informado en PDF de 1 página con firma nítida, mapa de estudios o la suscripción de 50€/mes con Stripe para estudios. RECUERDA: El estudio NO vende productos comerciales ni cremas; aclara que los cuidados higiénicos recomendados se adquieren en farmacia.
11. NUNCA INVENTES DATOS: Menciona SOLO los huecos, fechas, horas, precios y citas que te devuelvan las herramientas. Si check_availability devuelve 3 huecos, ofrece esos 3 y ninguno más. Si no devuelve huecos para un día, dilo y ofrece buscar otro día. Para dudas de la app usa la 'respuesta_oficial' de get_app_faq, sin cambiar cómo funciona.
12. CONVERSACIÓN NORMAL: Si el cliente solo saluda, charla o pregunta algo general sobre tatuajes (estilos, dolor, cuidados, ideas), contesta tú directamente de forma natural, breve y cercana, sin usar herramientas. Usa herramientas solo cuando haga falta consultar o cambiar algo real (agenda, citas, precios). Escribe en español de España ("precio", no "costo"), con frases cortas, como una persona del estudio.
10. REGLA CRÍTICA DE COMPRENSIÓN: El mensaje de bienvenida inicial SOLO se utiliza al abrir una conversación nueva. Si no entiendes lo que dice el cliente, dilo con total claridad y amabilidad ("Disculpa, no he terminado de entender tu consulta...") ofreciendo opciones para reformularla. NUNCA repitas el mensaje de bienvenida.

Transparencia: Recuerda que ${artistName} supervisa este chat y puede intervenir en cualquier momento. Responde siempre en ${lang === 'en' ? 'Inglés' : 'Español'} de forma cercana, acogedora y profesional.`;

    // 8. Pure Multi-turn Native Tool Calling Loop with Eden AI
    let executedToolResult: ToolExecutionResult | null = null;
    let toolExecutedName: string | null = null;

    let workingMessages: ChatMessage[] = [...compressed];
    let finalReplyText = '';

    // First LLM Turn: Send user message with native tools schema
    const firstCall = await callEdenAIWithTools({
      messages: workingMessages,
      instructions: systemPrompt,
      tools: OPENAI_TOOLS,
      temperature: 0.4
    });

    if (firstCall.tool_calls && firstCall.tool_calls.length > 0) {
      // The LLM natively decided which tool(s) to invoke based on tool definitions
      workingMessages.push({
        role: 'assistant',
        content: firstCall.content || null,
        tool_calls: firstCall.tool_calls
      });

      // Execute each tool call in application Tool Registry
      for (const toolCall of firstCall.tool_calls) {
        toolExecutedName = toolCall.function.name;

        let parsedArgs: any = {};
        try {
          parsedArgs = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : (toolCall.function.arguments || {});
        } catch (parseErr) {
          console.error('[EdenAI Tools] Error parsing tool call JSON arguments:', parseErr);
          parsedArgs = {};
        }

        // If analyzing healing and image was provided in body, fallback image_url if omitted
        if (toolCall.function.name === 'analyze_healing' && imageUrl && !parsedArgs.image_url) {
          parsedArgs.image_url = imageUrl;
        }

        executedToolResult = await executeAiTool(toolCall.function.name, parsedArgs, toolContext);

        // Append structured tool execution result for the LLM
        workingMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify({
            datos: executedToolResult.result,
            texto_de_referencia: executedToolResult.displayText || null
          })
        });
      }

      // Second LLM Turn: Eden AI synthesizes natural language response using tool results
      const secondCall = await callEdenAIWithTools({
        messages: workingMessages,
        instructions: systemPrompt,
        tools: OPENAI_TOOLS,
        temperature: 0.4
      });

      finalReplyText = secondCall.content || executedToolResult?.displayText || 'He gestionado tu solicitud con éxito.';
    } else if (firstCall.content) {
      // The LLM answered directly (conversational guidance, clarifications or general advice)
      finalReplyText = firstCall.content;
    } else {
      // Clear non-understanding response: NEVER the default welcome message and NO keyword scraping!
      finalReplyText = 'Disculpa, no he terminado de entender tu consulta o mensaje. Como asistente del estudio puedo ayudarte a:\n\n' +
        '• 📅 **Consultar disponibilidad y agendar citas**\n' +
        '• 🔄 **Reprogramar o anular citas existentes**\n' +
        '• 💶 **Calcular presupuestos orientativos** (dime medidas aproximadas en cm y zona)\n' +
        '• ❓ **Resolver dudas sobre la app** (firmar consentimiento, descargar PDF, mapa de estudios, etc.)\n' +
        '• 🩹 **Revisar fotos de cicatrización**\n\n' +
        '¿Podrías aclararme o reformular lo que necesitas?';
    }

    // 9. Save AI response message
    let savedAiMsg: any = {
      id: 'ai-' + Date.now(),
      sender_role: 'ai_assistant',
      content: finalReplyText,
      quote_data: executedToolResult?.quoteData || null,
      healing_status: executedToolResult?.healingData?.healing_status || null,
      healing_metadata: executedToolResult?.healingData || null,
      available_slots: executedToolResult?.availableSlots || null,
      created_appointment: executedToolResult?.createdAppointment || null,
      rescheduled_appointment: executedToolResult?.rescheduledAppointment || null,
      created_at: new Date().toISOString()
    };

    if (actualChatId) {
      const { data: dbAiMsg } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: actualChatId,
          sender_role: 'ai_assistant',
          content: finalReplyText,
          quote_data: executedToolResult?.quoteData || null,
          healing_status: executedToolResult?.healingData?.healing_status || null,
          healing_metadata: executedToolResult?.healingData || null
        })
        .select()
        .maybeSingle();

      if (dbAiMsg) {
        savedAiMsg = {
          ...dbAiMsg,
          available_slots: executedToolResult?.availableSlots || null,
          created_appointment: executedToolResult?.createdAppointment || null,
          rescheduled_appointment: executedToolResult?.rescheduledAppointment || null
        };
      }

      // Update chat status badge & summary
      let newBadge = 'quoting';
      if (executedToolResult?.createdAppointment || executedToolResult?.rescheduledAppointment) newBadge = 'booking';
      if (executedToolResult?.healingData) newBadge = executedToolResult.healingData.healing_status === 'alert_infection' ? 'takeover' : 'healing_check';
      if (toolExecutedName === 'request_human_takeover') newBadge = 'takeover';

      // La IA se atasca: no entiende dos veces seguidas, o el cliente se desespera / pide una persona
      const aiConfusedNow = /no he terminado de entender/i.test(finalReplyText);
      const aiConfusedBefore = compressed.slice(-4).some(m => m.role === 'assistant' && typeof m.content === 'string' && /no he terminado de entender/i.test(m.content));
      const clientFrustrated = /no me entiendes|no entiendes nada|no me est[aá]s entendiendo|no me sirve|me est[aá]s liando|ya te lo he dicho|hablar con (una persona|alguien|el tatuador|un humano)/i.test(content || '');
      if ((aiConfusedNow && aiConfusedBefore) || clientFrustrated) newBadge = 'takeover';

      const updatedHistory: ChatMessage[] = [...compressed, { role: 'assistant', content: finalReplyText }];
      const chatSummary = await generateChatSummary(updatedHistory, lang as 'es' | 'en');

      await supabase
        .from('chats')
        .update({
          ai_summary: chatSummary,
          status_badge: newBadge,
          updated_at: new Date().toISOString()
        })
        .eq('id', actualChatId);
    }

    return NextResponse.json({
      success: true,
      chat: chat || { id: actualChatId || 'session-chat', ai_enabled: true },
      message: savedUserMsg,
      aiResponse: savedAiMsg,
      toolExecuted: toolExecutedName,
      createdAppointment: executedToolResult?.createdAppointment || null,
      rescheduledAppointment: executedToolResult?.rescheduledAppointment || null,
      cancelledAppointmentId: executedToolResult?.cancelledAppointmentId || null,
      availableSlots: executedToolResult?.availableSlots || null,
      clientAppointments: executedToolResult?.clientAppointments || null,
      quote: executedToolResult?.quoteData || null,
      healing: executedToolResult?.healingData || null,
      faqTopic: executedToolResult?.faqTopic || null
    });

  } catch (err: any) {
    console.error('Chat API Error:', err);
    return NextResponse.json({
      success: true,
      message: {
        id: 'msg-' + Date.now(),
        sender_role: 'client',
        content: 'Mensaje recibido',
        created_at: new Date().toISOString()
      },
      aiResponse: {
        id: 'ai-' + Date.now(),
        sender_role: 'ai_assistant',
        content: 'Disculpa, ha ocurrido un error temporal al procesar tu solicitud. Como asistente del estudio puedo ayudarte a agendar citas, reprogramar reservas, calcular presupuestos, resolver dudas sobre el uso de la app o revisar fotos de curación. ¿Podrías volver a intentarlo o reformular tu consulta?',
        created_at: new Date().toISOString()
      }
    });
  }
}
