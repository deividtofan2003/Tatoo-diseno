'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import NumberField from '@/components/NumberField';
import {
  ChevronDown,
  Calendar,
  Clock,
  Sparkles,
  Sliders,
  Share2,
  FileText,
  MessageSquare,
  Plus,
  Coffee,
  AlertCircle,
  Camera,
  Send,
  UserCheck,
  Tag,
  CheckCircle,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bot
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ConsentDocumentModal from '@/components/dashboard/ConsentDocumentModal';
import EditAppointmentModal from '@/components/dashboard/EditAppointmentModal';
import ArtistCopilotChat from '@/components/dashboard/ArtistCopilotChat';

export default function ArtistPortal({
  user,
  profile,
  artistId,
  onBackToStudio
}: {
  user: any;
  profile: any;
  artistId?: string;
  onBackToStudio?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'copilot' | 'chats' | 'pricing' | 'healing' | 'shares'>('calendar');
  const [artist, setArtist] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [artistInputText, setArtistInputText] = useState('');
  const [shares, setShares] = useState<any[]>([]);
  const [studioArtists, setStudioArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for appointment edition and consent form viewing
  const [editingApp, setEditingApp] = useState<any>(null);
  const [viewingConsentApp, setViewingConsentApp] = useState<any>(null);

  // Manual Appointment / Break Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'walk_in' | 'break' | 'vacation'>('walk_in');
  const [modalTitle, setModalTitle] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [modalStartTime, setModalStartTime] = useState('11:00');
  const [modalEndTime, setModalEndTime] = useState('14:00');
  const [walkInClientName, setWalkInClientName] = useState('');
  const [walkInClientPhone, setWalkInClientPhone] = useState('');

  // Pricing Rules State
  const [minFee, setMinFee] = useState(60);
  const [hourlyRate, setHourlyRate] = useState(80);
  const [pricingMode, setPricingMode] = useState<'hour' | 'session'>('hour');
  const [sessionPrice, setSessionPrice] = useState<number>(250);
  const [smallPrice, setSmallPrice] = useState(60);
  const [mediumPrice, setMediumPrice] = useState(140);
  const [largePrice, setLargePrice] = useState(260);
  const [colorMultiplier, setColorMultiplier] = useState(1.25);
  const [savingPricing, setSavingPricing] = useState(false);

  // Healing Templates State
  const [normalHealingMsg, setNormalHealingMsg] = useState('');
  const [rednessHealingMsg, setRednessHealingMsg] = useState('');
  const [alertInfectionMsg, setAlertInfectionMsg] = useState('');
  const [savingHealing, setSavingHealing] = useState(false);

  // Share / Flash Upload State
  const [shareTitle, setShareTitle] = useState('');
  const [shareDesc, setShareDesc] = useState('');
  const [sharePriceHint, setSharePriceHint] = useState('');
  const [shareIsFlash, setShareIsFlash] = useState(true);
  const [shareImgUrl, setShareImgUrl] = useState('');
  const [uploadingShare, setUploadingShare] = useState(false);

  // Calendar View State: 'week' or 'month' (Google / Teams style)
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // La agenda siempre parte del día de HOY: si la pestaña se queda abierta y cambia el día,
  // vuelve sola a la fecha nueva (y el círculo de "hoy" se mueve al día correcto).
  const todayKeyRef = useRef(new Date().toDateString());
  const [, setTodayTick] = useState(0);
  useEffect(() => {
    const checkDay = () => {
      const nowKey = new Date().toDateString();
      if (nowKey !== todayKeyRef.current) {
        todayKeyRef.current = nowKey;
        setCalendarDate(new Date());
        setTodayTick(t => t + 1);
      }
    };
    const timer = setInterval(checkDay, 60 * 1000);
    window.addEventListener('focus', checkDay);
    document.addEventListener('visibilitychange', checkDay);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkDay);
      document.removeEventListener('visibilitychange', checkDay);
    };
  }, []);

  // Avisos de chats: último mensaje y última foto de curación de cada conversación
  const [chatSignals, setChatSignals] = useState<Record<string, { lastSender?: string; healingStatus?: string; healingAt?: string }>>({});

  // Clear Chat Modal State
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);

  const handleClearChat = async () => {
    if (!selectedChat?.id) return;
    setClearingChat(true);
    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al limpiar el chat');

      if (data.initialMessage) {
        setChatMessages([data.initialMessage]);
      } else {
        setChatMessages([]);
      }
      setShowClearChatModal(false);
    } catch (err: any) {
      alert(`Error al limpiar el chat: ${err.message}`);
    } finally {
      setClearingChat(false);
    }
  };

  const handlePrevDate = () => {
    const d = new Date(calendarDate);
    if (calendarView === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCalendarDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(calendarDate);
    if (calendarView === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCalendarDate(d);
  };

  const handleTodayDate = () => {
    setCalendarDate(new Date());
  };

  const getWeekDays = (baseDate: Date) => {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      return dayDate;
    });
  };

  const getMonthData = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const totalDays = lastDay.getDate();
    return { startingDayOfWeek, totalDays, year, month };
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const formatLocalIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const createMadridDate = (dateStr: string, timeStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = (timeStr || '11:00').split(':').map(Number);
    const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min || 0, 0));
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(utcGuess);
      const map: Record<string, number> = {};
      for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value);
      const tzH = map.hour === 24 ? 0 : map.hour;
      const tzDateAsUtc = new Date(Date.UTC(map.year, map.month - 1, map.day, tzH, map.minute, map.second || 0));
      const offsetMs = tzDateAsUtc.getTime() - utcGuess.getTime();
      return new Date(utcGuess.getTime() - offsetMs);
    } catch {
      return new Date(`${dateStr}T${timeStr}:00`);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadArtistData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadArtistData = async () => {
    setLoading(true);
    try {
      // 1. Fetch artist record (by specific artistId or user.id)
      let artQuery = supabase.from('artists').select('*');
      if (artistId) {
        artQuery = artQuery.eq('id', artistId);
      } else {
        artQuery = artQuery.eq('profile_id', user.id);
      }
      const { data: art } = await artQuery.maybeSingle();

      if (art) {
        setArtist(art);
        const rules = art.pricing_rules || {};
        setMinFee(rules.minimum_fee ?? 60);
        setHourlyRate(rules.hourly_rate ?? 80);
        setPricingMode(rules.pricing_mode === 'session' ? 'session' : 'hour');
        setSessionPrice(rules.session_price ?? 250);
        setSmallPrice(rules.size_rates?.small?.base_price ?? 60);
        setMediumPrice(rules.size_rates?.medium?.base_price ?? 140);
        setLargePrice(rules.size_rates?.large?.base_price ?? 260);
        setColorMultiplier(rules.color_multiplier ?? 1.25);

        const hTemplates = art.healing_templates || {};
        setNormalHealingMsg(hTemplates.normal?.es || 'El tatuaje muestra una evolución normal de cicatrización.');
        setRednessHealingMsg(hTemplates.redness_mild?.es || 'Enrojecimiento leve propio de los primeros días.');
        setAlertInfectionMsg(hTemplates.alert_infection?.es || 'El tatuaje está supurando pus o con inflamación severa, necesitas...');

        // Fetch other studio artists for reassignment
        if (art.studio_id) {
          const { data: stdArts } = await supabase
            .from('artists')
            .select('id, display_name, specialties, minimum_fee, hourly_rate')
            .eq('studio_id', art.studio_id);
          setStudioArtists(stdArts || []);
        }

        // 2. Fetch artist appointments
        const { data: apps } = await supabase
          .from('appointments')
          .select(`
            *,
            clients (id, dni_nie, profiles (full_name, email, phone)),
            consent_forms (*)
          `)
          .eq('artist_id', art.id)
          .order('start_time', { ascending: true });
        setAppointments(apps || []);

        // 3. Fetch chats with AI summaries & client names
        const { data: chatList } = await supabase
          .from('chats')
          .select(`
            *,
            clients (
              id,
              profiles (full_name, email, avatar_url)
            )
          `)
          .eq('artist_id', art.id)
          .order('updated_at', { ascending: false });

        setChats(chatList || []);
        await loadChatSignals(chatList || []);
        if (chatList && chatList.length > 0) {
          selectChat(chatList[0]);
        }

        // 4. Fetch shares
        const { data: shrs } = await supabase
          .from('shares')
          .select('*')
          .eq('artist_id', art.id)
          .order('created_at', { ascending: false });
        setShares(shrs || []);
      }
    } catch (err) {
      console.error('Error loading artist data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Lee los últimos mensajes de cada chat para saber quién habló el último y si hay foto de curación
  const loadChatSignals = async (chatList: any[]) => {
    const ids = (chatList || []).map((c: any) => c.id);
    if (ids.length === 0) { setChatSignals({}); return; }
    const { data: recent } = await supabase
      .from('chat_messages')
      .select('chat_id, sender_role, healing_status, created_at')
      .in('chat_id', ids)
      .order('created_at', { ascending: false })
      .limit(400);
    const signals: Record<string, { lastSender?: string; healingStatus?: string; healingAt?: string }> = {};
    for (const m of recent || []) {
      const s = signals[m.chat_id] || (signals[m.chat_id] = {});
      if (!s.lastSender) s.lastSender = m.sender_role;
      if (!s.healingStatus && m.healing_status) {
        s.healingStatus = m.healing_status;
        s.healingAt = m.created_at;
      }
    }
    setChatSignals(signals);
  };

  // Refresca la lista de chats cada 30 s para que los avisos lleguen solos
  useEffect(() => {
    if (!artist?.id) return;
    const refresh = async () => {
      const { data: chatList } = await supabase
        .from('chats')
        .select(`
          *,
          clients (
            id,
            profiles (full_name, email, avatar_url)
          )
        `)
        .eq('artist_id', artist.id)
        .order('updated_at', { ascending: false });
      if (chatList) {
        setChats(chatList);
        await loadChatSignals(chatList);
      }
    };
    const timer = setInterval(refresh, 30 * 1000);
    return () => clearInterval(timer);
  }, [artist?.id]);

  // ¿Este cliente necesita que el tatuador entre? (la IA se ha atascado, pide una persona o posible infección)
  const chatNeedsAttention = (c: any) => {
    const sig = chatSignals[c.id] || {};
    if (sig.lastSender === 'artist') return false;
    return c.status_badge === 'takeover' || sig.healingStatus === 'alert_infection';
  };

  const healingLabel = (status?: string) => {
    if (status === 'alert_infection') return { text: 'Curación: posible infección', cls: 'chat-pill-red' };
    if (status === 'redness_mild') return { text: 'Curación: revisar', cls: 'chat-pill-amber' };
    if (status === 'normal') return { text: 'Curación: va bien', cls: 'chat-pill-green' };
    return null;
  };

  const selectChat = async (chat: any) => {
    setSelectedChat(chat);
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });
    setChatMessages(msgs || []);
  };

  // Human Takeover: Toggle AI on / off for selected chat
  const handleToggleAi = async () => {
    if (!selectedChat) return;
    const newAiState = !selectedChat.ai_enabled;

    await supabase
      .from('chats')
      .update({
        ai_enabled: newAiState,
        status_badge: newAiState ? 'quoting' : 'takeover',
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedChat.id);

    setSelectedChat((prev: any) => ({ ...prev, ai_enabled: newAiState, status_badge: newAiState ? 'quoting' : 'takeover' }));
    setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, ai_enabled: newAiState, status_badge: newAiState ? 'quoting' : 'takeover' } : c));
  };

  // Artist sends direct human reply in chat
  const handleSendArtistMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistInputText.trim() || !selectedChat) return;

    const content = artistInputText.trim();
    setArtistInputText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.id,
          content,
          senderRole: 'artist'
        })
      });

      const data = await res.json();
      if (data.message) {
        setChatMessages(prev => [...prev, data.message]);
        setSelectedChat((prev: any) => ({ ...prev, ai_enabled: false, status_badge: 'takeover' }));
      }
    } catch (err) {
      console.error('Error sending artist message:', err);
    }
  };

  // Save updated pricing rules
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist) return;
    setSavingPricing(true);

    const updatedRules = {
      minimum_fee: Number(minFee),
      hourly_rate: Number(hourlyRate),
      pricing_mode: pricingMode,
      session_price: Number(sessionPrice),
      size_rates: {
        small: { max_cm: 5, base_price: Number(smallPrice) },
        medium: { max_cm: 15, base_price: Number(mediumPrice) },
        large: { max_cm: 25, base_price: Number(largePrice) },
        xlarge: { max_cm: 999, base_price: Number(largePrice) * 1.8 }
      },
      color_multiplier: Number(colorMultiplier),
      complex_placement_multiplier: 1.15
    };

    try {
      const { error } = await supabase
        .from('artists')
        .update({
          pricing_rules: updatedRules,
          minimum_fee: Number(minFee),
          hourly_rate: Number(hourlyRate)
        })
        .eq('id', artist.id);

      if (error) throw error;
      alert('¡Reglas de presupuesto actualizadas! El modelo de IA las utilizará inmediatamente.');
    } catch (err: any) {
      alert(`Error al guardar tarifas: ${err.message}`);
    } finally {
      setSavingPricing(false);
    }
  };

  // Save updated healing templates
  const handleSaveHealing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist) return;
    setSavingHealing(true);

    const updatedTemplates = {
      normal: { es: normalHealingMsg, en: normalHealingMsg },
      redness_mild: { es: rednessHealingMsg, en: rednessHealingMsg },
      alert_infection: { es: alertInfectionMsg, en: alertInfectionMsg }
    };

    try {
      const { error } = await supabase
        .from('artists')
        .update({ healing_templates: updatedTemplates })
        .eq('id', artist.id);

      if (error) throw error;
      alert('¡Plantillas de curación guardadas con éxito!');
    } catch (err: any) {
      alert(`Error al guardar plantillas: ${err.message}`);
    } finally {
      setSavingHealing(false);
    }
  };

  // Create Manual Walk-in or Break Space
  const handleCreateScheduleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist) return;

    try {
      const startDateTime = createMadridDate(modalDate, modalStartTime);
      const endDateTime = createMadridDate(modalDate, modalEndTime);

      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: artist.id,
          studioId: artist.studio_id,
          appointmentType: modalType === 'walk_in' ? 'tattoo_session' : modalType === 'break' ? 'break_blocked' : 'vacation',
          title: modalTitle || (modalType === 'walk_in' ? 'Cita Walk-in' : modalType === 'break' ? 'Espacio de Descanso' : 'Vacaciones'),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          walkInName: modalType === 'walk_in' ? (walkInClientName.trim() || 'Cliente No Registrado') : null,
          walkInPhone: modalType === 'walk_in' ? walkInClientPhone.trim() : null,
          status: 'confirmed'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar evento');

      setAppointments(prev => [...prev, data.appointment]);
      setIsModalOpen(false);
      setWalkInClientName('');
      setWalkInClientPhone('');
      setModalTitle('');
      alert('¡Bloque añadido al calendario con éxito!');
    } catch (err: any) {
      alert(`Error al añadir evento: ${err.message}`);
    }
  };

  // Upload new photo to Share section
  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist || !shareImgUrl) return;
    setUploadingShare(true);

    try {
      const { data, error } = await supabase
        .from('shares')
        .insert({
          artist_id: artist.id,
          studio_id: artist.studio_id || (await supabase.from('studios').select('id').limit(1).single()).data?.id,
          title: shareTitle.trim() || 'Nuevo Trabajo',
          description: shareDesc.trim(),
          image_url: shareImgUrl,
          is_flash: shareIsFlash,
          price_hint: sharePriceHint ? Number(sharePriceHint) : null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setShares(prev => [data, ...prev]);
      setShareTitle('');
      setShareDesc('');
      setSharePriceHint('');
      setShareImgUrl('');
      alert('¡Foto subida a la sección Share! Se incluirá automáticamente en la newsletter mensual.');
    } catch (err: any) {
      alert(`Error al publicar en Share: ${err.message}`);
    } finally {
      setUploadingShare(false);
    }
  };

  const handleShareFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setShareImgUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {onBackToStudio && (
        <div className="mb-6 p-3.5 rounded-2xl bg-ink-950/80 border border-amber-500/25 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-300">
            <span>Estás en la consola de</span>
            <span className="font-semibold text-ink-50">{artist?.display_name || 'Tatuador'}</span>
          </div>
          <button
            onClick={onBackToStudio}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            ← Volver al estudio
          </button>
        </div>
      )}

      {/* Artist Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[11px] uppercase tracking-[0.3em] text-ink-400 font-medium flex items-center gap-3">Panel del tatuador<span className="h-px w-10 bg-ink-600/60" /></span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
            {artist?.display_name || profile?.full_name || 'Tatuador'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setModalType('walk_in'); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-crimson-500" />
            <span>Cita walk-in</span>
          </button>
          <button
            onClick={() => { setModalType('break'); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span>Descanso o vacaciones</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 mb-8 pb-3">
        <button
          onClick={() => { setActiveTab('calendar'); setCalendarDate(new Date()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'calendar' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 text-crimson-500" />
          <span>Agenda ({appointments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'copilot'
              ? 'bg-gradient-to-r from-amber-500/20 to-crimson-600/30 text-white border border-amber-500/40 shadow-sm'
              : 'text-ink-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Copilot IA Tatuador</span>
        </button>

        <button
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'chats' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span>Chats ({chats.length})</span>
          {chats.filter(chatNeedsAttention).length > 0 && (
            <span className="chat-tab-alert">{chats.filter(chatNeedsAttention).length}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'pricing' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Presupuestos</span>
        </button>

        <button
          onClick={() => setActiveTab('healing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'healing' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>Curación</span>
        </button>

        <button
          onClick={() => setActiveTab('shares')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'shares' ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Share2 className="w-4 h-4 text-purple-400" />
          <span>Galería y newsletter</span>
        </button>
      </div>

      {/* Avisos para el tatuador: clientes que necesitan atención y fotos de curación */}
      {(() => {
        const urgent = chats.filter(chatNeedsAttention);
        const healingNews = chats.filter((c: any) => {
          const sig = chatSignals[c.id] || {};
          return sig.healingStatus && sig.lastSender !== 'artist' && !chatNeedsAttention(c)
            && sig.healingAt && (Date.now() - new Date(sig.healingAt).getTime()) < 48 * 60 * 60 * 1000;
        });
        // Los avisos solo salen en Conversaciones, no en la agenda ni en las demás pestañas
        if (activeTab !== 'chats') return null;
        if (urgent.length === 0 && healingNews.length === 0) return null;
        return (
          <div className="artist-alerts mb-6">
            {urgent.slice(0, 3).map((c: any) => {
              const sig = chatSignals[c.id] || {};
              const name = c.clients?.profiles?.full_name || 'Un cliente';
              const why = sig.healingStatus === 'alert_infection'
                ? 'ha mandado una foto con posible infección'
                : 'necesita que le atiendas tú';
              return (
                <button key={c.id} type="button" className="artist-alert artist-alert-red"
                  onClick={() => { setActiveTab('chats'); selectChat(c); }}>
                  <span className="artist-alert-dot" />
                  <span><strong>{name}</strong> {why}</span>
                  <span className="artist-alert-cta">Atender</span>
                </button>
              );
            })}
            {healingNews.slice(0, 3).map((c: any) => {
              const sig = chatSignals[c.id] || {};
              const name = c.clients?.profiles?.full_name || 'Un cliente';
              const label = sig.healingStatus === 'redness_mild' ? 'algo enrojecido, conviene revisarlo' : 'va bien';
              return (
                <button key={c.id} type="button"
                  className={`artist-alert ${sig.healingStatus === 'redness_mild' ? 'artist-alert-amber' : 'artist-alert-green'}`}
                  onClick={() => { setActiveTab('chats'); selectChat(c); }}>
                  <span className="artist-alert-dot" />
                  <span><strong>{name}</strong> ha mandado foto de su tatuaje: {label}</span>
                  <span className="artist-alert-cta">Ver</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* TAB 1: CALENDAR & APPOINTMENTS (GOOGLE / TEAMS STYLE) */}
      {activeTab === 'calendar' && (() => {
        const weekDays = getWeekDays(calendarDate);
        const monthData = getMonthData(calendarDate);

        return (
          <div className="space-y-4">
            {/* Calendar Controls Bar: Navigation, Title and View Mode Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-ink-900/90 border border-white/10 shadow-xl">
              <div className="flex items-center gap-3">
                {/* Navigation: Prev, Today, Next */}
                <div className="flex items-center bg-ink-950 rounded-2xl border border-white/10 p-1 shadow-inner">
                  <button
                    onClick={handlePrevDate}
                    className="p-2 rounded-xl hover:bg-white/10 text-ink-300 hover:text-white transition-colors"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleTodayDate}
                    className="px-3.5 py-1.5 rounded-xl hover:bg-white/10 text-xs font-bold text-ink-200 hover:text-white transition-colors"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={handleNextDate}
                    className="p-2 rounded-xl hover:bg-white/10 text-ink-300 hover:text-white transition-colors"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar Range Header */}
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {calendarView === 'week' ? (
                    <span>
                      Semana del {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : (
                    <span className="capitalize">
                      {calendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </h2>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Mode Selector: Semana / Mes */}
                <div className="flex items-center bg-ink-950 p-1 rounded-2xl border border-white/10">
                  <button
                    onClick={() => setCalendarView('week')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      calendarView === 'week'
                        ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/30'
                        : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setCalendarView('month')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      calendarView === 'month'
                        ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/30'
                        : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    Mes
                  </button>
                </div>

                {/* Quick Add Block Button */}
                <button
                  onClick={() => {
                    setModalDate(formatLocalIsoDate(calendarDate));
                    setModalType('walk_in');
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-crimson-600 to-crimson-700 hover:from-crimson-500 hover:to-crimson-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-crimson-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Añadir Cita</span>
                </button>
              </div>
            </div>

            {/* VISTA SEMANAL (7 COLUMNAS TIPO TEAMS / GOOGLE) */}
            {calendarView === 'week' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {weekDays.map((dayDate, idx) => {
                  const isToday = isSameDay(dayDate, new Date());
                  const dayAppointments = appointments.filter(a => isSameDay(new Date(a.start_time), dayDate));

                  return (
                    <div
                      key={idx}
                      className={`rounded-3xl border p-3.5 flex flex-col justify-between min-h-[420px] transition-all ${
                        isToday
                          ? 'bg-crimson-950/20 border-crimson-500/40 shadow-xl shadow-crimson-950/20'
                          : 'bg-ink-950/70 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div>
                        {/* Day Column Header */}
                        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-300">
                            {dayDate.toLocaleDateString('es-ES', { weekday: 'short' })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${isToday ? 'text-crimson-400 font-extrabold' : 'text-white'}`}>
                              {dayDate.getDate()}
                            </span>
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-crimson-500 animate-ping" />}
                          </div>
                        </div>

                        {/* Appointments on this day */}
                        <div className="space-y-2.5">
                          {dayAppointments.length === 0 ? (
                            <div className="text-center py-12 text-[11px] text-ink-600 font-mono">
                              <span>Sin citas</span>
                            </div>
                          ) : (
                            dayAppointments.map(app => {
                              const start = new Date(app.start_time);
                              const end = new Date(app.end_time);
                              const isBreak = app.appointment_type === 'break_blocked' || app.appointment_type === 'vacation';
                              const clientName = app.clients?.profiles?.full_name || app.walk_in_name || 'Cita';
                              const isSigned = app.consent_forms && app.consent_forms.length > 0;

                              return (
                                <div
                                  key={app.id}
                                  className={`p-2.5 rounded-2xl border text-xs leading-snug transition-all ${
                                    isBreak
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                      : app.appointment_type === 'design_consultation'
                                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                      : 'bg-crimson-500/10 border-crimson-500/30 text-crimson-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-mono text-[10px] opacity-85 mb-1">
                                    <span>
                                      {start.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span>{isBreak ? '☕' : app.appointment_type === 'design_consultation' ? '📜' : '🩸'}</span>
                                  </div>
                                  <div className="font-bold text-white truncate text-xs">{clientName}</div>
                                  {app.description && (
                                    <div className="text-[10px] text-ink-400 truncate mt-0.5">{app.description}</div>
                                  )}
                                  {!isBreak && (
                                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-1 text-[10px]">
                                      <span className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                                        app.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                      }`}>
                                        {app.status === 'confirmed' ? '✓ Confirmada' : '⏳ Pendiente'}
                                      </span>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingApp(app); }}
                                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-semibold transition-colors"
                                          title="Confirmar o ajustar duración de la cita"
                                        >
                                          Editar
                                        </button>
                                        {isSigned && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setViewingConsentApp(app); }}
                                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9px] font-bold transition-colors"
                                            title="Ver y descargar consentimiento legal firmado"
                                          >
                                            PDF
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Quick Add Button on this day */}
                      <button
                        onClick={() => {
                          setModalDate(formatLocalIsoDate(dayDate));
                          setModalType('walk_in');
                          setIsModalOpen(true);
                        }}
                        className="mt-3 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white border border-white/5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-crimson-500" />
                        <span>+ Añadir en este día</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VISTA MENSUAL (TABLERO COMPLETO) */}
            {calendarView === 'month' && (
              <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl bg-ink-950/70">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-2 pb-3 mb-3 border-b border-white/10 text-center font-mono text-xs font-bold text-ink-400">
                  <div>LUN</div>
                  <div>MAR</div>
                  <div>MIÉ</div>
                  <div>JUE</div>
                  <div>VIE</div>
                  <div>SÁB</div>
                  <div>DOM</div>
                </div>

                {/* Month Days Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty prefix cells for previous month alignment */}
                  {Array.from({ length: monthData.startingDayOfWeek }, (_, i) => (
                    <div key={`empty-${i}`} className="min-h-[100px] rounded-2xl bg-transparent opacity-10 border border-transparent" />
                  ))}

                  {/* Actual Month Days */}
                  {Array.from({ length: monthData.totalDays }, (_, i) => {
                    const dayNum = i + 1;
                    const thisDate = new Date(monthData.year, monthData.month, dayNum);
                    const isToday = isSameDay(thisDate, new Date());
                    const dayAppointments = appointments.filter(a => isSameDay(new Date(a.start_time), thisDate));

                    return (
                      <div
                        key={dayNum}
                        onClick={() => {
                          setModalDate(formatLocalIsoDate(thisDate));
                          setModalType('walk_in');
                          setIsModalOpen(true);
                        }}
                        className={`min-h-[110px] p-2.5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all hover:border-crimson-500/50 hover:bg-white/5 group ${
                          isToday
                            ? 'bg-crimson-950/20 border-crimson-500/40 shadow-md shadow-crimson-950/20'
                            : 'bg-ink-900/60 border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isToday ? 'text-crimson-400 font-extrabold' : 'text-ink-200'}`}>
                            {dayNum}
                          </span>
                          {dayAppointments.length > 0 && (
                            <span className="text-[10px] font-mono bg-crimson-500/20 text-crimson-300 px-1.5 py-0.2 rounded-full border border-crimson-500/30">
                              {dayAppointments.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 my-1">
                          {dayAppointments.slice(0, 2).map(app => {
                            const isBreak = app.appointment_type === 'break_blocked' || app.appointment_type === 'vacation';
                            return (
                              <div
                                key={app.id}
                                onClick={(e) => {
                                  if (!isBreak) {
                                    e.stopPropagation();
                                    setEditingApp(app);
                                  }
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded-lg truncate font-medium border cursor-pointer hover:scale-[1.02] transition-transform ${
                                  isBreak
                                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                                    : app.appointment_type === 'design_consultation'
                                    ? 'bg-blue-500/20 text-blue-200 border-blue-500/30'
                                    : 'bg-crimson-500/20 text-crimson-200 border-crimson-500/30'
                                }`}
                              >
                                {new Date(app.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} {app.clients?.profiles?.full_name || app.walk_in_name || 'Cita'}
                              </div>
                            );
                          })}
                          {dayAppointments.length > 2 && (
                            <span className="text-[9px] text-ink-400 font-mono block text-center">+{dayAppointments.length - 2} más</span>
                          )}
                        </div>

                        <span className="text-[9px] text-ink-500 group-hover:text-crimson-400 transition-colors">
                          + Añadir
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 2: CHATS WITH AI SUMMARY & HUMAN TAKEOVER */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[700px]">
          {/* Left Column: Chat list with AI 1-line summary descriptors */}
          <div className="glass-panel rounded-2xl border border-white/10 p-3 overflow-y-auto space-y-2">
            <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider px-2 py-1">Conversaciones</h3>
            {[...chats].sort((a: any, b: any) => Number(chatNeedsAttention(b)) - Number(chatNeedsAttention(a))).map((c) => {
              const clientName = c.clients?.profiles?.full_name || 'Cliente';
              const isSelected = selectedChat?.id === c.id;
              const needsAttention = chatNeedsAttention(c);
              const healing = healingLabel(chatSignals[c.id]?.healingStatus);

              return (
                <div
                  key={c.id}
                  onClick={() => selectChat(c)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    needsAttention ? 'chat-card-alert ' : ''
                  }${
                    isSelected
                      ? 'bg-crimson-600/15 border-crimson-500/40 text-white'
                      : 'bg-ink-900/60 border-white/5 text-ink-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{clientName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      c.ai_enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {c.ai_enabled ? 'IA' : 'HUMANO'}
                    </span>
                  </div>

                  {/* AI Generated 1-Line Summary Descriptor */}
                  <p className="text-xs text-amber-300/90 font-medium line-clamp-2">
                    ✨ {c.ai_summary || 'Consulta en curso...'}
                  </p>

                  {/* Estado para el tatuador: rojo si hay que atender, verde si va bien */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {needsAttention ? (
                      <span className="chat-pill chat-pill-red">Atiende a este cliente</span>
                    ) : (
                      <span className="chat-pill chat-pill-green">Va bien</span>
                    )}
                    {healing && <span className={`chat-pill ${healing.cls}`}>{healing.text}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Chat Window with Takeover Control */}
          <div className="md:col-span-2 glass-panel rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Top Bar with Human Takeover Button */}
                <div className="p-4 border-b border-white/10 bg-ink-900/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {selectedChat.clients?.profiles?.full_name || 'Cliente'}
                    </h3>
                    <p className="text-xs text-ink-400">
                      Estado: <strong className="text-amber-400 font-mono">{selectedChat.status_badge}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClearChatModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-red-500/20 text-ink-300 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition-all"
                      title="Limpiar toda la conversación"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span className="hidden sm:inline">Limpiar chat</span>
                    </button>

                    <button
                      onClick={handleToggleAi}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedChat.ai_enabled
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{selectedChat.ai_enabled ? 'Pausar IA' : 'Reanudar Asistente IA'}</span>
                    </button>
                  </div>
                </div>

                {/* Messages Container */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {chatMessages.map((msg) => {
                    const isClient = msg.sender_role === 'client';
                    const isAi = msg.sender_role === 'ai_assistant';

                    return (
                      <div key={msg.id} className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm ${
                          isClient
                            ? 'bg-ink-900 border border-white/10 text-white'
                            : isAi
                            ? 'bg-white/5 border border-white/10 text-ink-200'
                            : 'bg-crimson-600 text-white'
                        }`}>
                          <span className="block text-[10px] uppercase font-bold tracking-wider mb-1 opacity-70">
                            {isClient ? 'Cliente' : isAi ? 'Asistente IA' : 'Tú (Tatuador)'}
                          </span>

                          {msg.image_url && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-w-xs">
                              <img src={msg.image_url} alt="Adjunto" className="w-full h-auto object-cover max-h-56" />
                            </div>
                          )}

                          <MarkdownRenderer content={msg.content} />

                          {msg.healing_status && (
                            <div className="mt-2 pt-2 border-t border-white/10 text-xs font-semibold">
                              {msg.healing_status === 'normal' && <span className="text-emerald-400">✅ Curación Normal</span>}
                              {msg.healing_status === 'redness_mild' && <span className="text-amber-400">⚠️ Enrojecimiento Leve</span>}
                              {msg.healing_status === 'alert_infection' && <span className="text-crimson-400">🚨 Alerta: Supuración / Pus</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Direct Artist Reply Bar */}
                <form onSubmit={handleSendArtistMessage} className="p-3 border-t border-white/10 bg-ink-900/60 flex items-center gap-2">
                  <input
                    type="text"
                    value={artistInputText}
                    onChange={(e) => setArtistInputText(e.target.value)}
                    placeholder="Escribe como tatuador (pausará automáticamente la IA)..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-ink-950 border border-white/10 text-sm text-white placeholder-ink-600 focus:outline-none focus:border-crimson-500"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white transition-all shadow-md shadow-crimson-600/30"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ink-500 text-sm">
                Selecciona una conversación para intervenir
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRICING RULES (FOLLOWED BY EDEN AI) */}
      {activeTab === 'pricing' && (
        <div className="max-w-2xl glass-panel p-8 rounded-3xl border border-white/10">
          <div className="flex items-center gap-2 text-crimson-500 text-xs font-mono font-bold uppercase mb-2">
            <Sliders className="w-4 h-4" />
            <span>Tarifas y Reglas para el Modelo IA</span>
          </div>
          <h2 className="font-display text-xl font-bold text-white mb-2">Reglas de Presupuesto</h2>
          <p className="text-xs text-ink-400 mb-6 leading-relaxed">
            El modelo IA seguirá estrictamente estas reglas cuando un cliente le pida un presupuesto aproximado en el chat.
          </p>

          <form onSubmit={handleSavePricing} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">
                  Tarifa Mínima de Apertura (€)
                </label>
                <NumberField
                  value={minFee}
                  onChange={(e) => setMinFee(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                {/* Desplegable: el tatuador elige si cobra por hora o por sesión */}
                <label className="pricing-select mb-1.5" title="Elige si cobras por hora o por sesión">
                  <select
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value === 'session' ? 'session' : 'hour')}
                    aria-label="Cómo cobras"
                  >
                    <option value="hour">Precio por Hora (€)</option>
                    <option value="session">Precio por Sesión (€)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5" />
                </label>
                {pricingMode === 'hour' ? (
                  <NumberField
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-crimson-500"
                  />
                ) : (
                  <NumberField
                    value={sessionPrice}
                    onChange={(e) => setSessionPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-crimson-500"
                  />
                )}
                {pricingMode === 'session' && (
                  <p className="text-[11px] text-ink-400 mt-1.5">La IA dará este precio por sesión. Cuántas sesiones hacen falta lo decides tú al ver el diseño.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 space-y-3">
              <span className="block text-xs font-bold text-white uppercase tracking-wider">Tramos por Medidas (cm)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ink-400 mb-1">Pequeño (&lt;5cm)</label>
                  <NumberField
                    value={smallPrice}
                    onChange={(e) => setSmallPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-400 mb-1">Medio (5-15cm)</label>
                  <NumberField
                    value={mediumPrice}
                    onChange={(e) => setMediumPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-400 mb-1">Grande (&gt;15cm)</label>
                  <NumberField
                    value={largePrice}
                    onChange={(e) => setLargePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">
                Multiplicador por Color (Ej: 1.25 = +25%)
              </label>
              <NumberField
                step="0.05"
                value={colorMultiplier}
                onChange={(e) => setColorMultiplier(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-crimson-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingPricing}
              className="mt-4 w-full py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-sm shadow-lg shadow-crimson-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingPricing ? 'Guardando...' : 'Actualizar Reglas de Presupuesto'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: HEALING PREDEFINED RESPONSES */}
      {activeTab === 'healing' && (
        <div className="max-w-2xl glass-panel p-8 rounded-3xl border border-white/10">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase mb-2">
            <Camera className="w-4 h-4" />
            <span>Pautas Clínicas Predefinidas por el Tatuador</span>
          </div>
          <h2 className="font-display text-xl font-bold text-white mb-2">Respuestas de Cicatrización</h2>
          <p className="text-xs text-ink-400 mb-6 leading-relaxed">
            Cuando un cliente mande una foto de su tatuaje al chatbot, la IA evaluará la imagen y le responderá con tus pautas exactas para cada caso.
          </p>

          <form onSubmit={handleSaveHealing} className="space-y-5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                1. Estado Normal / Buena evolución
              </label>
              <textarea
                rows={3}
                value={normalHealingMsg}
                onChange={(e) => setNormalHealingMsg(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                2. Enrojecimiento Leve (Primeros 3-4 días)
              </label>
              <textarea
                rows={3}
                value={rednessHealingMsg}
                onChange={(e) => setRednessHealingMsg(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-crimson-400 uppercase tracking-wider mb-1.5">
                3. Alerta de Supuración / Pus / Posible Infección
              </label>
              <textarea
                rows={3}
                value={alertInfectionMsg}
                onChange={(e) => setAlertInfectionMsg(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-crimson-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingHealing}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingHealing ? 'Guardando...' : 'Guardar Pautas de Curación'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: SHARE SECTION & MONTHLY NEWSLETTER PUBLISHER */}
      {activeTab === 'shares' && (
        <div className="space-y-8">
          {/* Upload Form */}
          <div className="max-w-2xl glass-panel p-6 sm:p-8 rounded-3xl border border-white/10">
            <h2 className="font-display text-xl font-bold text-white mb-1">Subir a Sección Share</h2>
            <p className="text-xs text-ink-400 mb-6">
              Las fotos que subas aquí se envían automáticamente el día 1 de cada mes en la newsletter a los clientes que se hayan tatuado contigo.
            </p>

            <form onSubmit={handleCreateShare} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Título del diseño / Flash</label>
                  <input
                    type="text"
                    required
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    placeholder="Ej: Flash Tigre Tradicional"
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Precio orientativo (€)</label>
                  <NumberField
                    value={sharePriceHint}
                    onChange={(e) => setSharePriceHint(e.target.value)}
                    placeholder="Ej: 120"
                    className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 uppercase tracking-wider mb-1.5">Seleccionar Foto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleShareFileSelected}
                  className="w-full text-xs text-ink-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-crimson-600 file:text-white hover:file:bg-crimson-500 cursor-pointer"
                />
              </div>

              {shareImgUrl && (
                <div className="max-w-xs rounded-xl overflow-hidden border border-white/10">
                  <img src={shareImgUrl} alt="Preview" className="w-full h-auto object-cover max-h-48" />
                </div>
              )}

              <button
                type="submit"
                disabled={uploadingShare || !shareImgUrl}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all"
              >
                {uploadingShare ? 'Publicando...' : 'Publicar en Share'}
              </button>
            </form>
          </div>

          {/* Grid of uploaded shares */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Tus Publicaciones Recientes ({shares.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {shares.map((s) => (
                <div key={s.id} className="glass-panel rounded-2xl overflow-hidden border border-white/5 group">
                  <div className="h-48 w-full bg-ink-900 overflow-hidden relative">
                    <img src={s.image_url} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {s.price_hint && (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-amber-400 font-bold text-xs px-2 py-0.5 rounded-md backdrop-blur-md">
                        {s.price_hint} €
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm text-white truncate">{s.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COPILOT IA DEL TATUADOR */}
      {activeTab === 'copilot' && (
        <ArtistCopilotChat
          artist={artist}
          appointments={appointments}
          onRefreshAppointments={loadArtistData}
        />
      )}

      {/* MODAL: MANUAL WALK-IN OR BREAK BLOCK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/10 relative">
            <h2 className="font-display text-xl font-bold text-white mb-4">
              {modalType === 'walk_in' ? 'Añadir Cita Manual (Walk-in)' : 'Bloquear Descanso o Vacaciones'}
            </h2>

            <form onSubmit={handleCreateScheduleBlock} className="space-y-4 text-xs">
              {modalType === 'walk_in' ? (
                <>
                  <div>
                    <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Nombre del Cliente *</label>
                    <input
                      type="text"
                      required
                      value={walkInClientName}
                      onChange={(e) => setWalkInClientName(e.target.value)}
                      placeholder="Cliente sin registro"
                      className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={walkInClientPhone}
                      onChange={(e) => setWalkInClientPhone(e.target.value)}
                      placeholder="+34 600 000 000"
                      className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Motivo del Bloqueo</label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="Ej: Descanso almuerzo / Viaje convención"
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Hora Inicio *</label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-300 uppercase tracking-wider mb-1">Hora Fin *</label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-900 border border-white/10 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold"
                >
                  Guardar en Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearChatModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-red-500/30 bg-ink-950/95 relative shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              ¿Estás seguro que quieres eliminar toda la conversación?
            </h3>
            <p className="text-xs text-ink-400 text-center mb-6 leading-relaxed">
              Esta acción vaciará todos los mensajes de este chat de forma definitiva.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearChatModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-ink-300 hover:text-white font-semibold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={clearingChat}
                onClick={handleClearChat}
                className="flex-1 py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-sm shadow-lg shadow-crimson-600/30 transition-all hover:scale-[1.02]"
              >
                {clearingChat ? 'Eliminando...' : 'Sí, eliminar conversación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT & CONFIRM APPOINTMENT MODAL */}
      <EditAppointmentModal
        isOpen={Boolean(editingApp)}
        onClose={() => setEditingApp(null)}
        appointment={editingApp}
        studioArtists={studioArtists}
        onAppointmentUpdated={(updated) => {
          if (!updated || updated._deleted) {
            setAppointments(prev => prev.filter(a => a.id !== (updated?.id || editingApp?.id)));
          } else {
            setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
          }
        }}
      />

      {/* OFFICIAL LEGAL CONSENT DOCUMENT VIEWER & PDF PRINTER */}
      <ConsentDocumentModal
        isOpen={Boolean(viewingConsentApp)}
        onClose={() => setViewingConsentApp(null)}
        consent={viewingConsentApp?.consent_forms?.[0]}
        appointment={viewingConsentApp}
        studioName="Tatoo Studio Atelier"
        artistName={artist?.display_name}
      />
    </div>
  );
}
